const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

const auth = new google.auth.GoogleAuth({
  keyFile: 'service-account.json', // your service account JSON key
  scopes: ['https://www.googleapis.com/auth/documents'],
});

const docs = google.docs({ version: 'v1', auth });

app.post('/upload', async (req, res) => {
  try {
    console.log('📥 Incoming request:', req.body);

    const urlsRaw = req.body.image_urls_combined;
    if (!urlsRaw || typeof urlsRaw !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid image_urls_combined field' });
    }

    const urls = urlsRaw.split(',').map(url => url.trim()).filter(Boolean);
    if (!urls.length) {
      return res.status(400).json({ error: 'No valid image URLs provided' });
    }

    const docTitle = `Uploaded Images (${new Date().toLocaleString()})`;

    // Create the doc
    const createRes = await docs.documents.create({
      requestBody: {
        title: docTitle,
      },
    });

    const docId = createRes.data.documentId;

    // Build requests to insert each image
    const requests = urls.flatMap((url, index) => [
      {
        insertText: {
          location: {
            index: 1,
          },
          text: `Image ${index + 1}:\n`,
        },
      },
      {
        insertInlineImage: {
          location: {
            index: 1,
          },
          uri: url,
          objectSize: {
            height: { magnitude: 200, unit: 'PT' },
            width: { magnitude: 200, unit: 'PT' },
          },
        },
      },
      {
        insertText: {
          location: {
            index: 1,
          },
          text: '\n\n',
        },
      },
    ]);

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests,
      },
    });

    const publicDocLink = `https://docs.google.com/document/d/${docId}/edit`;
    res.json({ message: '✅ Images added to Google Doc!', link: publicDocLink });
  } catch (err) {
    console.error('❌ Error in /upload:', err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ Google Docs Uploader is live!');
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

