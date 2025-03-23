const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.json());

app.post('/upload', async (req, res) => {
  try {
    const { image_urls_combined } = req.body;
    if (!image_urls_combined) {
      return res.status(400).json({ error: 'Missing image_urls_combined' });
    }

    // Load service account credentials from local file
    const credentialsPath = path.join(__dirname, 'service-account.json');
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/documents']
    });

    const client = await auth.getClient();
    const docs = google.docs({ version: 'v1', auth: client });

    const imageUrls = image_urls_combined.split(',').map(url => url.trim());

    const requests = imageUrls.map(url => ({
      insertInlineImage: {
        uri: url,
        location: { index: 1 },
        objectSize: {
          height: { magnitude: 300, unit: 'PT' },
          width: { magnitude: 300, unit: 'PT' }
        }
      }
    }));

    const doc = await docs.documents.create({ requestBody: { title: 'Uploaded Images' } });

    await docs.documents.batchUpdate({
      documentId: doc.data.documentId,
      requestBody: { requests }
    });

    const publicUrl = `https://docs.google.com/document/d/${doc.data.documentId}/edit`;

    res.json({ success: true, url: publicUrl });

  } catch (err) {
    console.error('❌ Error in /upload:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});



