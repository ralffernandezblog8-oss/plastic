
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "100kb" }));

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

// Homepage
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Backend health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "EcoScan backend is running"
  });
});

// Receive scan result
app.post("/api/scans", (req, res) => {
  const { predictedClass, confidence } = req.body || {};

  if (
    typeof predictedClass !== "string" ||
    !predictedClass.trim() ||
    predictedClass.length > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid predictedClass is required"
    });
  }

  if (
    typeof confidence !== "number" ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    return res.status(400).json({
      success: false,
      message: "Confidence must be between 0 and 1"
    });
  }

  return res.status(201).json({
    success: true,
    message: "Scan result received",
    scan: {
      predictedClass: predictedClass.trim(),
      confidence,
      createdAt: new Date().toISOString()
    }
  });
});

// Handle unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found"
  });
});

app.listen(PORT, () => {
  console.log(`EcoScan running at http://localhost:${PORT}`);
});
