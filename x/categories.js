const { resolveRootFolderId, buildFolderCards } = require('../_drive.js');

export default async function handler(req, res) {
  try {
    // Entweder eine spezifische Unterkategorie-ID oder den Hauptordner laden
    const id = req.query.id || await resolveRootFolderId();
    const categories = await buildFolderCards(id);
    
    res.status(200).json({ categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
