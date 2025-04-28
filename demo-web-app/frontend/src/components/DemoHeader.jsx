import React from "react";
import { Typography, Divider } from "antd";

const { Title, Paragraph, Text } = Typography;

const DemoHeader = () => {
  return (
    <Typography style={{ padding: 24 }}>
      <Title>PlatePatrol Sample Integration</Title>
      <Paragraph>
        Demo of real-time match alert integration for third-party systems. Chunk
        uploads are visualized here for demo purposes only.
      </Paragraph>

      <Paragraph>
        <Text strong>Registered Webhooks</Text>
        <Text>
          {" "}
          (pre-configured via plate subscriptions using{" "}
          <Text code>/plates/{"{plate_number}"}/webhooks</Text> APIs):
        </Text>
        <br />
        📸 <Text strong>Match Events</Text>:{" "}
        <Text code>https://18.222.109.39:4000/api/matches</Text>
        <br />
        📦 <Text strong>Chunk Upload Activity</Text> (internal demo only):{" "}
        <Text code>https://18.222.109.39:4000/api/chunks</Text>
      </Paragraph>

      <Paragraph>
        ⚡ In production, third-party systems will only receive{" "}
        <Text strong>match event notifications</Text> for plates they subscribed
        to. Chunk upload events are internal and not exposed externally.
      </Paragraph>

      <Divider style={{ margin: "8px 0" }} />
    </Typography>
  );
};

export default DemoHeader;
