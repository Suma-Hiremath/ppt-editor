import React from "react";

export default function SlideCanvas() {
  return (
    <div
      id="canvas-container"
      style={{
        flex: 1,
        background: "#f5f5f5",
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <div
        id="currentSlide"
        style={{
          width: "960px",
          height: "540px",
          background: "white",
          border: "1px solid #ccc"
        }}
      ></div>
    </div>
  );
}