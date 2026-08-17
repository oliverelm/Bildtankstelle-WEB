const { DRIVE_API, getAccessToken } = require('../_drive.js');

export default async function handler(req, res) {
  try {
    const id = req.query.id;
    if (!id) throw new Error("Keine Bild-ID angegeben.");
    
    const token = await getAccessToken();
    // "?alt=media" sagt Google Drive, dass wir die echte Datei wollen, nicht nur Infos
    const url = `${DRIVE_API}/${id}?alt=media`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error("Bild konnte nicht aus Drive geladen werden.");
    
    const buffer = await response.arrayBuffer();
    
    // Prüfen, ob das Bild im Browser angezeigt oder heruntergeladen werden soll
    if (req.query.inline) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 Tag im Cache speichern
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="bildtankstelle-${id}.jpg"`);
    }
    
    res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
