const { resolveRootFolderId, crawlTree } = require('../_drive.js');
const { enrichWithGeo } = require('../_geo.js');

export default async function handler(req, res) {
  try {
    const query = (req.query.q || "").toLowerCase().trim();
    if (!query) {
      return res.status(200).json({ results: [] });
    }

    const rootId = await resolveRootFolderId();
    const allImages = await crawlTree(rootId, []);

    // GPS-Daten optional in Länder/Städte auflösen, falls _geo.js bereitsteht
    let enrichedImages = allImages;
    try {
      enrichedImages = await enrichWithGeo(allImages);
    } catch (e) {
      // Falls Geocoding fehlschlägt, nutzen wir die Rohdaten weiter
    }

    // Volltextsuche über Dateinamen, Beschreibung/Bemerkung und Land/Ort
    const results = enrichedImages.filter((img) => {
      const name = (img.name || "").toLowerCase();
      const desc = (img.description || "").toLowerCase();
      const country = (img.country || "").toLowerCase();
      const breadcrumbStr = (img.breadcrumb || []).join(" ").toLowerCase();

      return (
        name.includes(query) ||
        desc.includes(query) ||
        country.includes(query) ||
        breadcrumbStr.includes(query)
      );
    });

    res.status(200).json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
