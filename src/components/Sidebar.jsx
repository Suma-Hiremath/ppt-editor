import React from "react";

export default function Sidebar() {
  return (
    <div
      className="sidebar"
      style={{ width: "220px", borderRight: "1px solid #ccc", padding: "10px" }}
    >
      <h4>Slides</h4>

      <div id="slidesList"></div>

    </div>
  );
}