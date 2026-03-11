import React from "react";

export default function TextElement({ element }) {

  return (
    <div
      className="slide-element"
      contentEditable
      style={{
        position: "absolute",
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height
      }}
    >
      {element.content}
    </div>
  );
}