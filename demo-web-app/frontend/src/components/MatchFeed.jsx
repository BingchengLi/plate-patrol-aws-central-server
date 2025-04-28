import React, { useEffect, useState } from "react";
import { Card, List, Spin, notification } from "antd";
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
      setMatches((prev) => [newMatch, ...prev]);

      notification.success({
        message: "New match detected!",
        description: `Plate number: ${newMatch.plate_number}`,
        placement: "topRight",
      });
    });

    return () => socket.disconnect();
  }, []);

  if (loading) return <Spin tip="Loading matches..." />;

  return (
    <div style={{ padding: 24 }}>
      <h2>Live Match Feed</h2>
      <List
        grid={{ gutter: 16, column: 3 }}
        dataSource={matches}
        renderItem={(item) => (
          <List.Item>
            <Card title={`Plate number: ${item.plate_number}`} bordered={true}>
              {item.image_base64 ? (
                <img
                  src={`data:image/jpeg;base64,${item.image_base64}`}
                  alt="Detected Plate"
                  style={{ width: "100%", height: "auto", objectFit: "cover" }}
                />
              ) : (
                <p>No image data available</p>
              )}
              <p>Status: {item.status}</p>
              <p>Timestamp: {new Date(item.timestamp).toLocaleString()}</p>
              {item.gps_location && <p>GPS: {item.gps_location}</p>}
              {item.received_at && (
                <p>
                  Received at: {new Date(item.received_at).toLocaleString()}
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
