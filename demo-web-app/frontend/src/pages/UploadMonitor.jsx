import React, { useEffect, useState } from "react";
import { Card, List, Spin } from "antd";

const UploadMonitor = () => {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Poll every 3 seconds
  useEffect(() => {
    const fetchUploads = async () => {
      try {
        const response = await fetch(
          "http://localhost:4000/api/uploads/status"
        );
        const data = await response.json();
        setUploads(data.reverse()); // latest on top
        setLoading(false);
      } catch (error) {
        console.error("Error fetching uploads:", error);
      }
    };

    fetchUploads();
    const interval = setInterval(fetchUploads, 3000); // refresh every 3s

    return () => clearInterval(interval); // clean up
  }, []);

  if (loading) return <Spin tip="Loading uploads..." />;

  return (
    <div style={{ padding: 24 }}>
      <h2>Upload Monitor</h2>
      <List
        grid={{ gutter: 16, column: 3 }}
        dataSource={uploads}
        renderItem={(item) => (
          <List.Item>
            <Card title={`Image ID: ${item.image_id}`} bordered={true}>
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
            </Card>
          </List.Item>
        )}
      />
    </div>
  );
};

export default UploadMonitor;
