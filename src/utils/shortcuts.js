// src/utils/shortcuts.js
export function registerShortcuts() {
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      console.log("Save triggered");
    }
  });
}