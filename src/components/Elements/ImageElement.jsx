import React from "react";

export default function ImageElement({ element }) {

  return (
    <img
      src={element.src}
      style={{
        position: "absolute",
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height
      }}
    />
  );
}