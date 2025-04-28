import React, { useEffect, useState } from "react";
import { Card, List, Spin, Modal, message, Tag } from "antd";
import { io } from "socket.io-client";

const MatchFeed = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const response = await fetch("http://localhost:4000/api/matches");
        const data = await response.json();
        setMatches(data.reverse());
        setLoading(false);
      } catch (error) {
        console.error("Error fetching matches:", error);
      }
    };

    fetchMatches();

    const socket = io("http://localhost:4000");

    socket.on("new_match", (newMatch) => {
      console.log("New match received:", newMatch);

      setTimeout(() => {
        Modal.confirm({
          title: "New Match Detected",
          content: (
            <div>
              <p>
                <b>Plate:</b> {newMatch.plate_number}
              </p>
              <p>
                <b>Time:</b> {new Date(newMatch.timestamp).toLocaleString()}
              </p>
              {newMatch.gps_location && (
                <p>
                  <b>GPS:</b> {newMatch.gps_location}
                </p>
              )}
              {newMatch.image_base64 && (
                <img
                  src={`data:image/jpeg;base64,${newMatch.image_base64}`}
                  alt="Detected Plate"
                  style={{
                    width: "100%",
                    maxHeight: "400px",
                    objectFit: "contain",
                    marginTop: "16px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  }}
                />
              )}
            </div>
          ),
          okText: "Acknowledge",
          cancelText: "Dismiss",
          centered: true,
          width: 600,
          onOk: () => {
            setMatches((prev) => [
              { ...newMatch, acknowledged: true },
              ...prev,
            ]);
            message.success("Match saved to feed!");
          },
          onCancel: () => {
            setMatches((prev) => [
              { ...newMatch, acknowledged: false },
              ...prev,
            ]);
            message.info("Match dismissed.");
          },
        });
      }, 0);
    });

    return () => socket.disconnect();
  }, []);

  if (loading) return <Spin tip="Loading matches..." fullscreen />;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: "2rem", marginTop: "0px", marginBottom: "24px" }}>
        📸 Match Record
      </h2>
      <List
        grid={{ gutter: 16, column: 3 }}
        dataSource={matches}
        renderItem={(item) => (
          <List.Item>
            <Card
              title={`Plate: ${item.plate_number}`}
              extra={
                item.acknowledged !== undefined &&
                (item.acknowledged ? (
                  <Tag color="green">Acknowledged</Tag>
                ) : (
                  <Tag color="red">Dismissed</Tag>
                ))
              }
              bordered
            >
              {item.image_base64 ? (
                <img
                  src={`data:image/jpeg;base64,${item.image_base64}`}
                  alt="Detected Plate"
                  style={{ width: "100%", height: "auto", objectFit: "cover" }}
                />
              ) : (
                <p>No image available</p>
              )}
              <p>
                <b>Status:</b> {item.status}
              </p>
              <p>
                <b>Timestamp:</b> {new Date(item.timestamp).toLocaleString()}
              </p>
              {item.gps_location && (
                <p>
                  <b>GPS:</b> {item.gps_location}
                </p>
              )}
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

export default MatchFeed;
