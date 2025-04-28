import React from "react";
import MatchFeed from "./components/MatchFeed";

function App() {
  return (
    <div style={{ padding: "24px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: "8px" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "8px" }}>
          PlatePatrol Sample Integration
        </h1>
        <p style={{ fontSize: "1.1rem", color: "#666" }}>
          Demo for real-time match notifications via Webhook and WebSocket.
        </p>
        <p
          style={{
            fontSize: "0.95rem",
            color: "#999",
            marginTop: "8px",
            marginBottom: "0px",
          }}
        >
          Webhook registered at: <b>https://18.222.109.39:4000/api/matches</b>
        </p>
      </div>

      <MatchFeed />
    </div>
  );
}

export default App;
