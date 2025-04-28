import React, { useEffect, useState } from "react";
import { Card, List, Spin, Modal, message, Tag, Alert, Button } from "antd";
import { io } from "socket.io-client";

const ChunkFeed = () => {
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedChunks = JSON.parse(localStorage.getItem("chunks") || "[]");
    setChunks(savedChunks);
    setLoading(false);

    const socket = io("http://localhost:4000");

    socket.on("new_chunk", (newChunk) => {
      console.log("New chunk received:", newChunk);

      setChunks((prevChunks) => {
        const updatedChunks = [newChunk, ...prevChunks];
        localStorage.setItem("chunks", JSON.stringify(updatedChunks));
        return updatedChunks;
      });

      const label = newChunk.plate_number
        ? `plate ${newChunk.plate_number}`
        : `(image ID ${newChunk.image_id})`;

      // Show a notification for the new chunk
      message.info({
        content: `Chunk ${newChunk.chunk_id + 1}/${
          newChunk.total_chunks
        } uploaded for ${label}`,
      });
    });

    return () => socket.disconnect();
  }, []);

  const handleClearChunks = () => {
    localStorage.removeItem("chunks");
    setChunks([]);
    message.success("Chunk upload records cleared!");
  };

  if (loading) return <Spin tip="Loading chunk uploads..." fullscreen />;

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: "2rem", margin: 0 }}>📦 Chunk Upload Tracker</h2>
        <Button danger onClick={handleClearChunks}>
          Clear Chunk Upload Records
        </Button>
      </div>

      <Alert
        message="Partial Image Warning"
        description="Individual chunks may not always render a valid image. Each chunk is only a fragment of the full file — the complete image will only be viewable after all chunks are assembled. Sometimes the first uploaded chunk may render a partial image, but most subsequent chunks will not display correctly. This is expected behavior."
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <List
        grid={{ gutter: 16, column: 3 }}
        dataSource={chunks}
        renderItem={(item) => (
          <List.Item>
            <Card
              title={`Image ID: ${item.image_id}`}
              extra={
                <Tag color="blue">
                  Chunk {item.chunk_id + 1} / {item.total_chunks}
                </Tag>
              }
            >
              {item.data ? (
                <img
                  src={`data:image/jpeg;base64,${item.data}`}
                  alt="Chunk Upload"
                  style={{ width: "100%", height: "auto", objectFit: "cover" }}
                />
              ) : (
                <p>No image available</p>
              )}
              <p>
                <b>Timestamp:</b>{" "}
                {item.timestamp
                  ? new Date(item.timestamp).toLocaleString()
                  : "Not included in chunk"}
              </p>
              <p>
                <b>GPS:</b> {item.gps_location || "Not included in chunk"}
              </p>
              {item.received_at && (
                <p>
                  <b>Received at:</b>{" "}
                  {new Date(item.received_at).toLocaleString()}
                </p>
              )}
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
};

export default ChunkFeed;
