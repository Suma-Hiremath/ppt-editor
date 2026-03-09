import React from "react";

export default function Toolbar() {
  return (
    <div style={{ padding: "10px", background: "#eee" }}>
      
      <button id="newSlide">New Slide</button>

      <button id="addText">Text</button>

      <button id="addImage">Image</button>

      <button id="Delete">Delete</button>

      <button id="undo">Undo</button>

      <button id="redo">Redo</button>

      <button id="boldText">Bold</button>

      <button id="alignLeft">Align Left</button>

      <button id="alignCenter">Align Center</button>

      <button id="alignRight">Align Right</button>

      <button id="startPresentation">Start</button>

      <button id="quitApp">Quit</button>

    </div>
  );
}