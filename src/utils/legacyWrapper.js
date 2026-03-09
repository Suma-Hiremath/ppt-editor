let loaded = false;

export function loadLegacyEditor() {

  if (loaded) return;
  loaded = true;

  const loadScript = (src) =>
    new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = resolve;
      document.body.appendChild(script);
    });

  async function start() {
    await loadScript("/Support.js");
    await loadScript("/saveas.js");
    await loadScript("/script.js");
  }

  start();
}