
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para makabasa ng JSON requests
app.use(express.json({ limit: "100kb" }));

// Serve frontend files mula sa public folder
app.use(express.static(path.join(__dirname, "public")));

// Home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Health check para malaman kung gumagana ang server
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "EcoScan backend is running"
  });
});

// Test endpoint para sa scan result
// Hindi ito nagse-save sa database.
// Local Storage sa frontend ang bahala sa permanenteng browser storage.
app.post("/api/scans", (req, res) => {
  const { predictedClass, confidence } = req.body || {};

  if (
    typeof predictedClass !== "string" ||
    predictedClass.trim().length === 0 ||
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
      message: "Confidence must be a number from 0 to 1"
    });
  }

  // Temporary response lamang
  res.status(201).json({
    success: true,
    message: "Scan result received",
    scan: {
      predictedClass: predictedClass.trim(),
      confidence,
      createdAt: new Date().toISOString()
    }
  });
});

// Handle invalid API routes
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found"
  });
});

// Start server
app.listen(PORT, () => {
  console.log("--------------------------------");
  console.log("EcoScan Backend Started");
  console.log(`Website: http://localhost:${PORT}`);
  console.log(`API Test: http://localhost:${PORT}/api/health`);
  console.log("--------------------------------");
});
