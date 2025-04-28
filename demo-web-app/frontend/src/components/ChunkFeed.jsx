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

      setTimeout(() => {
        Modal.info({
          title: "New Chunk Uploaded",
          content: (
            <div>
              <p>
                <b>Image ID:</b> {newChunk.image_id}
              </p>
              <p>
                <b>Chunk ID:</b> {newChunk.chunk_id}
              </p>
              <p>
                <b>Total Chunks:</b> {newChunk.total_chunks}
              </p>
              <p>
                <b>Timestamp:</b>{" "}
                {newChunk.timestamp
                  ? new Date(newChunk.timestamp).toLocaleString()
                  : "Not included in chunk"}
              </p>
              <p>
                <b>GPS:</b> {newChunk.gps_location || "Not included in chunk"}
              </p>
              {newChunk.data && (
                <img
                  src={`data:image/jpeg;base64,${newChunk.data}`}
                  alt="Chunk Data"
                  style={{
                    width: "100%",
                    maxHeight: "300px",
                    objectFit: "contain",
                    marginTop: "16px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                />
              )}
            </div>
          ),
          okText: "Confirm",
          centered: true,
          width: 600,
          onOk: () => {
            const updatedChunks = [newChunk, ...chunks];
            setChunks(updatedChunks);
            localStorage.setItem("chunks", JSON.stringify(updatedChunks));
            message.success("Chunk added to feed!");
          },
        });
      }, 0);
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
        description="Chunks may not render fully valid images. Only assembled images are complete. This is expected."
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
