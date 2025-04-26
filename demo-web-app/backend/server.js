const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const webhookRoutes = require("./routes/webhook");

const app = express();
const PORT = process.env.PORT || 4000;

// ========== MIDDLEWARE ==========
app.use(cors()); // Allow frontend to talk to backend
app.use(bodyParser.json()); // Parse JSON bodies

// ========== IN-MEMORY STORE ==========
let uploads = []; // In-memory uploads detected from webhook - for demo purposes

// ========== ROUTES ==========

// Webhook route
app.use("/webhook", webhookRoutes(uploads));

// API route to get current uploads
// Frontend: Use polling to get the current status of uploads for now
// We can add websocket connections later if we have time
app.get("/api/uploads/status", (req, res) => {
  res.json(uploads);
});

// ========== SERVER START ==========
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
