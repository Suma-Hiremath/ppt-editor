import React from "react";
import Toolbar from "./components/Toolbar";
import SlideList from "./components/SlideList";
import SlideCanvas from "./components/SlideCanvas";
import usePresentation from "./hooks/usePresentation";

export default function App() {

  const {
    slides,
    currentSlide,
    addSlide,
    addText,
    addImage,
    selectSlide
  } = usePresentation();

  return (
    <div className="editor">

      <Toolbar
        addSlide={addSlide}
        addText={addText}
        addImage={addImage}
      />

      <div className="workspace">

        <SlideList
          slides={slides}
          currentSlide={currentSlide}
          selectSlide={selectSlide}
        />

        <SlideCanvas
          slide={slides[currentSlide]}
        />

      </div>

    </div>
  );
}