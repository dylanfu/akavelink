const express = require("express");
const AkaveIPCClient = require("./index");
const multer = require("multer");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const os = require("os");
const dotenv = require("dotenv");

dotenv.config();

// Initialize express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Configure multer for file upload handling
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
}).fields([
  { name: "file", maxCount: 1 },
  { name: "file1", maxCount: 1 },
]);

// Initialize Akave IPC client
const client = new AkaveIPCClient(
  process.env.NODE_ADDRESS,
  process.env.PRIVATE_KEY
);

// After client initialization
console.log("Initializing client with:", {
  nodeAddress: process.env.NODE_ADDRESS,
  privateKeyLength: process.env.PRIVATE_KEY
    ? process.env.PRIVATE_KEY.length
    : 0,
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Bucket endpoints
app.post("/buckets", async (req, res) => {
  try {
    const { bucketName } = req.body;
    const result = await client.createBucket(bucketName);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/buckets", async (req, res) => {
  try {
    const result = await client.listBuckets();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/buckets/:bucketName", async (req, res) => {
  try {
    const result = await client.viewBucket(req.params.bucketName);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/buckets/:bucketName", async (req, res) => {
  try {
    const result = await client.deleteBucket(req.params.bucketName);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// File endpoints
app.get("/buckets/:bucketName/files", async (req, res) => {
  try {
    const result = await client.listFiles(req.params.bucketName);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/buckets/:bucketName/files/:fileName", async (req, res) => {
  try {
    const result = await client.getFileInfo(
      req.params.bucketName,
      req.params.fileName
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Modified file upload endpoint
app.post("/buckets/:bucketName/files", upload, async (req, res) => {
  try {
    let result;
    const uploadedFile = req.files?.file?.[0] || req.files?.file1?.[0];

    if (uploadedFile) {
      // Handle buffer upload
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "akave-"));
      // Sanitize filename by replacing spaces and special chars with underscore
      const sanitizedFileName = uploadedFile.originalname.replace(
        /[^a-zA-Z0-9.]/g,
        "_"
      );
      const tempFilePath = path.join(tempDir, sanitizedFileName);
      try {
        // Write buffer to temporary file
        await fs.writeFile(tempFilePath, uploadedFile.buffer);

        // Upload the temporary file
        result = await client.uploadFile(req.params.bucketName, tempFilePath, {
          fileName: uploadedFile.originalname,
          cleanup: true, // Tell client to cleanup temp file
        });
      } finally {
        // Cleanup temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } else if (req.body.filePath) {
      // Handle file path upload
      result = await client.uploadFile(
        req.params.bucketName,
        req.body.filePath
      );
    } else {
      throw new Error("No file or filePath provided");
    }

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/buckets/:bucketName/files/:fileName/download", async (req, res) => {
  try {
    // Create downloads directory if it doesn't exist
    const downloadDir = path.join(process.cwd(), "downloads");
    await fs.mkdir(downloadDir, { recursive: true });

    const destinationPath = path.join(downloadDir, req.params.fileName);

    // Download the file
    await client.downloadFile(
      req.params.bucketName,
      req.params.fileName,
      downloadDir
    );

    // Check if file exists and is readable
    try {
      await fs.access(destinationPath, fsSync.constants.R_OK);
    } catch (err) {
      throw new Error("File download failed or file is not readable");
    }

    // Get file stats
    const stats = await fs.stat(destinationPath);

    // Set headers for file download
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${req.params.fileName}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", stats.size);

    // Stream the file to response
    const fileStream = fsSync.createReadStream(destinationPath);

    // Handle stream errors
    fileStream.on("error", (err) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Pipe the file to response
    fileStream.pipe(res);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
