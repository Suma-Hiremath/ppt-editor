import React from "react";
import TextElement from "./TextElement";
import ImageElement from "./ImageElement";

export default function SlideElement({ element }) {

  switch (element.type) {

    case "text":
      return <TextElement element={element} />;

    case "image":
      return <ImageElement element={element} />;

    default:
      return null;
  }
}