const express = require("express");

module.exports = function () {
  const router = express.Router();

  // ========== Match Complete Webhook ==========
  router.post("/image-complete", (req, res) => {
    const { plate_number, status, gps_location, timestamp, image_base64 } =
      req.body;

    if (!plate_number || !status) {
      return res.status(400).json({
        error: "Missing required fields: plate_number, status",
      });
    }

    console.log("Received webhook for plate_number:", plate_number);

    const newMatch = {
      plate_number,
      status,
      gps_location,
      timestamp,
      image_base64,
      received_at: new Date().toISOString(),
    };

    req.matches.push(newMatch); // this is fine now
    req.io.emit("new_match", newMatch); // broadcast real-time event

    res.status(200).json({ message: "Webhook received" });
  });

  // ========== Chunk Upload Activity Webhook ==========
  router.post("/chunk-upload-activity", (req, res) => {
    const { image_id, chunk_id, total_chunks, chunk_data } = req.body;

    if (!image_id || chunk_id === undefined || total_chunks === undefined) {
      return res.status(400).json({
        error: "Missing required fields: image_id, chunk_id, total_chunks",
      });
    }

    const newChunkEvent = {
      image_id,
      chunk_id,
      total_chunks,
      chunk_data, // base64 encoded data
      received_at: new Date().toISOString(),
    };

    chunks.push(newChunkEvent);
    req.io.emit("new_chunk", newChunkEvent);

    res.status(200).json({ message: "Chunk upload activity received" });
  });

  return router;
};
