import React, { useEffect } from "react";
import { loadLegacyEditor } from "../utils/legacyWrapper";
import Toolbar from "./Toolbar";
import Sidebar from "./Sidebar";
import SlideCanvas from "./SlideCanvas";

export default function App() {

  useEffect(() => {
    loadLegacyEditor();
  }, []);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      
      <Sidebar />

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Toolbar />
        <SlideCanvas />
      </div>

    </div>
  );
}