const { resolveRootFolderId, crawlTree } = require('../_drive.js');

export default async function handler(req, res) {
  try {
    const fileId = req.query.id;
    if (!fileId) throw new Error("Keine Bild-ID angegeben.");

    const rootId = await resolveRootFolderId();
    const allImages = await crawlTree(rootId, []);

    const index = allImages.findIndex((img) => img.id === fileId);
    
    res.status(200).json({
      images: allImages,
      index: index >= 0 ? index : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
