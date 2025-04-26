const express = require("express");

module.exports = function (uploads) {
  const router = express.Router();

  router.post("/image-complete", (req, res) => {
    const { image_id, file, status, gps_location, timestamp, image_base64 } =
      req.body;

    if (!image_id || !status) {
      return res.status(400).json({ error: "Missing image_id or status" });
    }

    console.log("Received webhook for image_id:", image_id);

    // Save incoming tip
    uploads.push({
      image_id,
      file,
      status,
      gps_location,
      timestamp,
      image_base64,
      received_at: new Date().toISOString(),
    });

    res.status(200).json({ message: "Webhook received" });
  });

  return router;
};
