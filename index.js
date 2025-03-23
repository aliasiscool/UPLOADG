const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { google } = require("googleapis");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

// Load service account key
const auth = new google.auth.GoogleAuth({
  keyFile: "service-account.json",
  scopes: ["https://www.googleapis.com/auth/documents"],
});

app.post("/upload", async (req, res) => {
  try {
    const { image_urls_combined } = req.body;

    if (!image_urls_combined) {
      return res.status(400).json({ error: "Missing image_urls_combined" });
    }

    const imageUrls = image_urls_combined.split(",").map(url => url.trim());

    const authClient = await auth.getClient();
    const docs = google.docs({ version: "v1", auth: authClient });

    // Create a new document
    const doc = await docs.documents.create({
      requestBody: {
        title: "Uploaded Images",
      },
    });

    const documentId = doc.data.documentId;

    // Build the requests array with embedded images
    const requests = [];

    for (let url of imageUrls) {
      requests.push(
        {
          insertText: {
            location: { index: 1 },
            text: "\n\n",
          },
        },
        {
          insertInlineImage: {
            uri: url,
            location: {
              index: 1,
            },
            objectSize: {
              height: { magnitude: 300, unit: "PT" },
              width: { magnitude: 300, unit: "PT" },
            },
          },
        }
      );
    }

    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });

    const docLink = `https://docs.google.com/document/d/${documentId}/edit`;

    res.json({ success: true, docLink });
  } catch (err) {
    console.error("❌ Error in /upload:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});


