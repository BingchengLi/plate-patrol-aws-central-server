import React from "react";
import DemoHeader from "./components/DemoHeader";
import MatchFeed from "./components/MatchFeed";
import ChunkFeed from "./components/ChunkFeed";
import { Divider } from "antd";

function App() {
  return (
    <div style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <DemoHeader />
      <MatchFeed />
      <Divider style={{ margin: "8px 0" }} />
      <ChunkFeed />
    </div>
  );
}

export default App;
