const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const webhookRoutes = require("./routes/webhook");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // Allow all origins
});

const PORT = process.env.PORT || 4000;

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(bodyParser.json());

// ========== IN-MEMORY STORE ==========
let uploads = [];

// ========== SOCKET.IO ==========
io.on("connection", (socket) => {
  console.log("New client connected");

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Make `io` available to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ========== ROUTES ==========
// Webhook route
app.use("/webhook", webhookRoutes(uploads));

// API route for polling fallback
app.get("/api/uploads", (req, res) => {
  res.json(uploads);
});

// ========== SERVER START ==========
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
