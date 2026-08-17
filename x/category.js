const { listImagesInFolder } = require('../_drive.js');

export default async function handler(req, res) {
  try {
    const id = req.query.id;
    if (!id) throw new Error("Keine Ordner-ID übergeben.");
    
    const images = await listImagesInFolder(id);
    res.status(200).json({ images });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
