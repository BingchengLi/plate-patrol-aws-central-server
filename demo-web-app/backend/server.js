// server.js
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const webhookRoutes = require("./routes/webhook");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 4000;

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(bodyParser.json());

// ========== IN-MEMORY STORE ==========
let matches = [];
let chunks = [];

// ========== SOCKET.IO ==========
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Make `io` and `matches` available to routes
app.use((req, res, next) => {
  req.io = io;
  req.matches = matches;
  req.chunks = chunks;
  next();
});

// ========== ROUTES ==========
app.use("/webhook", webhookRoutes());

// API route for polling fallback
app.get("/api/matches", (req, res) => {
  res.json(matches.reverse()); // newest first
});

// API route for polling fallback
app.get("/api/chunks", (req, res) => {
  res.json(chunks.reverse()); // newest first
});

// ========== SERVER START ==========
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
