const express = require("express");

module.exports = function () {
  const router = express.Router();

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

  return router;
};
