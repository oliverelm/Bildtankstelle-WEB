const crypto = require('crypto');

const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

// Helfer: Erzeugt ein sicheres Token aus deiner JSON-Datei in Vercel
async function getAccessToken() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  
  if (!serviceAccountJson) {
    throw new Error("Server ist nicht konfiguriert: GOOGLE_SERVICE_ACCOUNT_JSON fehlt.");
  }

  const credentials = JSON.parse(serviceAccountJson);
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  // JSON Web Token (JWT) für die Google Drive API generieren
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: exp,
    iat: iat
  })).toString('base64url');

  const signatureInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(credentials.private_key, 'base64url');

  const jwt = `${signatureInput}.${signature}`;

  // Token bei Google abholen
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error("Token-Generierung fehlgeschlagen: " + detail);
  }

  const data = await res.json();
  return data.access_token;
}

// Führt die eigentlichen Anfragen an Google Drive aus
async function driveFetch(url) {
  const accessToken = await getAccessToken();
  const res = await fetch(url, {
    headers: { Authorization: "Bearer " + accessToken },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Drive-Anfrage fehlgeschlagen (${res.status}): ${detail}`);
  }
  return res.json();
}

// Findet die ID deines Hauptordners
async function resolveRootFolderId() {
  // Hier nutzen wir jetzt die Variable, die du in Vercel angelegt hast!
  const { DRIVE_FOLDER_ID } = process.env;
  if (DRIVE_FOLDER_ID) return DRIVE_FOLDER_ID;

  throw new Error(`Die DRIVE_FOLDER_ID fehlt in den Vercel-Umgebungsvariablen.`);
}

// Hier greifen wir auch die GPS-Koordinaten (location) und Beschreibung für die Suche ab
const IMAGE_FIELDS = "id,name,description,thumbnailLink,imageMediaMetadata(location)";

// Listet die direkten Unterordner (z.B. "Italien", "Venedig")
async function listSubfolders(parentId) {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const data = await driveFetch(
    `${DRIVE_API}?q=${q}&fields=files(id,name)&orderBy=name&pageSize=200`
  );
  return data.files || [];
}

// Listet alle Bilder in einem Ordner
async function listImagesInFolder(folderId) {
  let files = [];
  let pageToken = null;
  const q = encodeURIComponent(
    `'${folderId}' in parents and mimeType contains 'image/' and trashed=false`
  );
  do {
    const url =
      `${DRIVE_API}?q=${q}&fields=nextPageToken,files(${IMAGE_FIELDS})` +
      `&orderBy=name&pageSize=1000` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const data = await driveFetch(url);
    files = files.concat(data.files || []);
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return files;
}

// Baut die Kacheln für Kategorien und Unterkategorien
async function buildFolderCards(parentId) {
  const subfolders = await listSubfolders(parentId);

  return Promise.all(
    subfolders.map(async (folder) => {
      const [childSubfolders, images] = await Promise.all([
        listSubfolders(folder.id),
        listImagesInFolder(folder.id),
      ]);

      if (childSubfolders.length > 0) {
        let count = images.length;
        let cover = images[0] ? images[0].thumbnailLink : null;
        for (const sub of childSubfolders) {
          const subImages = await listImagesInFolder(sub.id);
          count += subImages.length;
          if (!cover && subImages[0]) cover = subImages[0].thumbnailLink;
        }
        return {
          id: folder.id,
          name: folder.name,
          count,
          coverThumbnailLink: cover,
          hasSubcategories: true,
        };
      }

      return {
        id: folder.id,
        name: folder.name,
        count: images.length,
        coverThumbnailLink: images[0] ? images[0].thumbnailLink : null,
        hasSubcategories: false,
      };
    })
  );
}

// Durchsucht den kompletten Baum (perfekt für unsere spätere Suchfunktion!)
async function crawlTree(folderId, breadcrumb) {
  const [subfolders, images] = await Promise.all([
    listSubfolders(folderId),
    listImagesInFolder(folderId),
  ]);

  let results = images.map((img) => ({ ...img, breadcrumb }));

  if (subfolders.length > 0) {
    const nested = await Promise.all(
      subfolders.map((f) => crawlTree(f.id, [...breadcrumb, f.name]))
    );
    for (const arr of nested) results = results.concat(arr);
  }

  return results;
}

module.exports = {
  DRIVE_API,
  IMAGE_FIELDS,
  getAccessToken,
  driveFetch,
  resolveRootFolderId,
  listSubfolders,
  listImagesInFolder,
  buildFolderCards,
  crawlTree,
};
