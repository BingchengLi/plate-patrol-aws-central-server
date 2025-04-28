import React, { useEffect, useState } from "react";
import { Card, List, Spin, Modal, message, Tag, Alert } from "antd";
import { io } from "socket.io-client";

const ChunkFeed = () => {
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChunks = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/chunks");
        const data = await response.json();
        setChunks(data.reverse());
        setLoading(false);
      } catch (error) {
        console.error("Error fetching chunks:", error);
      }
    };

    fetchChunks();

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
                <b>GPS:</b>{" "}
                {newChunk.gps_location
                  ? newChunk.gps_location
                  : "Not included in chunk"}
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
            setChunks((prev) => [newChunk, ...prev]);
            message.success("Chunk added to feed!");
          },
        });
      }, 0);
    });

    return () => socket.disconnect();
  }, []);

  if (loading) return <Spin tip="Loading chunk uploads..." fullscreen />;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: "2rem", marginTop: "0px", marginBottom: "24px" }}>
        📦 Chunk Upload Tracker
      </h2>

      <Alert
        message="Partial Image Warning"
        description="Individual chunks may not always render a valid image. This happens because each chunk is only a fragment of the full file — the complete image will only be viewable after all chunks are assembled. Sometimes the first uploaded chunk may render a partial image, but most subsequent chunks will not display correctly. This is expected behavior."
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
                <b>GPS:</b>{" "}
                {item.gps_location
                  ? item.gps_location
                  : "Not included in chunk"}
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
