const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());

const SCOPES = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive'];
const KEYFILEPATH = './service-account.json';

// Auth
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

// Endpoint to create doc with images
app.post('/create-doc', async (req, res) => {
  const { image_urls_combined } = req.body;

  if (!image_urls_combined || image_urls_combined === 'No files uploaded') {
    return res.status(400).json({ error: 'No image URLs provided' });
  }

  try {
    const authClient = await auth.getClient();
    const docs = google.docs({ version: 'v1', auth: authClient });
    const drive = google.drive({ version: 'v3', auth: authClient });

    // 1. Create empty doc
    const docRes = await docs.documents.create({
      requestBody: {
        title: 'Uploaded Images from Voiceflow',
      },
    });

    const docId = docRes.data.documentId;

    // 2. Convert comma-separated URLs to array
    const imageUrls = image_urls_combined.split(',').map(url => url.trim());

    // 3. Create insert requests
    let requests = [];
    imageUrls.forEach((url, index) => {
      if (index !== 0) {
        requests.push({ insertParagraph: { location: { index: 1 }, paragraph: { elements: [{ textRun: { content: '\n' } }] } } });
      }
      requests.push({
        insertInlineImage: {
          uri: url,
          location: { index: 1 },
          objectSize: {
            height: { magnitude: 300, unit: 'PT' },
            width: { magnitude: 300, unit: 'PT' },
          },
        },
      });
    });

    // 4. Batch update to insert images
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests },
    });

    // 5. Make document public
    await drive.permissions.create({
      fileId: docId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // 6. Get shareable link
    const file = await drive.files.get({
      fileId: docId,
      fields: 'webViewLink',
    });

    return res.json({ doc_link: file.data.webViewLink });
  } catch (err) {
    console.error('❌ Error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Run
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
