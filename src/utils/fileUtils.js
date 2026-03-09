/**
 * fileUtils.js
 * Handles auto-save, Save As, and export logic for PPT Editor.
 * React-compatible version (works with Vite + Electron)
 */

export class AutoSaveManager {
  constructor(presentation) {
    this.presentation = presentation;
    this.autoSaveInterval = null;
    this.lastSavedState = null;
    this.isAutoSaving = false;
    this.init();
  }

  // ---------- Initialization ----------
  init() {
    this.startAutoSave();
    this.setupBeforeUnload();
    this.setupKeyboardShortcuts();
    this.lastSavedState = this.getCurrentState();
    setTimeout(() => this.enableSaveAsButton(), 1000);
  }

  // ---------- Auto-save core ----------
  startAutoSave() {
    this.autoSaveInterval = setInterval(() => this.autoSave(), 10000);
  }
  stopAutoSave() {
    clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = null;
  }
  getCurrentState() {
    return JSON.stringify({
      slides: this.presentation.slides,
      currentSlideIndex: this.presentation.currentSlideIndex,
      currentTheme: this.presentation.currentTheme,
      viewSettings: this.presentation.viewSettings,
    });
  }
  hasUnsavedChanges() {
    return this.getCurrentState() !== this.lastSavedState;
  }
  autoSave() {
    if (this.hasUnsavedChanges() && !this.isAutoSaving) {
      this.isAutoSaving = true;
      this.saveToLocalStorage();
      this.lastSavedState = this.getCurrentState();
      this.showToast("Auto-saved presentation", "success");
      this.showAutoSaveWorking();
      this.isAutoSaving = false;
    }
  }
  saveToLocalStorage() {
    const data = {
      slides: this.presentation.slides,
      currentSlideIndex: this.presentation.currentSlideIndex,
      currentTheme: this.presentation.currentTheme,
      viewSettings: this.presentation.viewSettings,
      timestamp: Date.now(),
    };
    localStorage.setItem("autoSavedPresentation", JSON.stringify(data));
  }

  // ---------- Before unload / shortcuts ----------
  setupBeforeUnload() {
    window.addEventListener("beforeunload", (e) => {
      if (this.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Save before leaving?";
        return e.returnValue;
      }
    });
  }
  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        this.autoSaveAndShowOptions();
      }
    });
  }
  autoSaveAndShowOptions() {
    this.saveToLocalStorage();
    this.lastSavedState = this.getCurrentState();
    this.showToast("Auto-saved before refresh", "success");
    setTimeout(() => this.showSavePrompt(), 500);
  }

  // ---------- Save-prompt dialog ----------
  showSavePrompt() {
    const dialog = this.createSaveDialog();
    document.body.appendChild(dialog);
  }
  createSaveDialog() {
    const dialog = document.createElement("div");
    dialog.className = "save-dialog-overlay";
    dialog.style.cssText = `
      position: fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:10000;
    `;
    const content = document.createElement("div");
    content.className = "save-dialog-content";
    content.style.cssText = `
      background:#fff; padding:30px; border-radius:10px; max-width:450px;
      text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.3); animation:slideIn .3s ease;
    `;
    content.innerHTML = `
      <h3><i class="fas fa-save"></i> Save Your Presentation</h3>
      <p>You have unsaved changes. Choose how to save:</p>
      <div style="display:grid;gap:12px;grid-template-columns:1fr 1fr;">
        <button id="save-html" class="save-btn save-html-btn"><i class="fas fa-code"></i> HTML</button>
        <button id="save-pdf" class="save-btn save-pdf-btn"><i class="fas fa-file-pdf"></i> PDF</button>
        <button id="save-json" class="save-btn save-json-btn"><i class="fas fa-file-code"></i> JSON</button>
        <button id="save-local" class="save-btn save-local-btn"><i class="fas fa-download"></i> Local</button>
      </div>
      <div style="margin-top:20px;padding-top:20px;border-top:1px solid #eee;">
        <button id="dont-save" class="save-btn save-cancel-btn"><i class="fas fa-times"></i> Don't Save</button>
      </div>`;
    dialog.appendChild(content);
    this.attachSaveDialogEvents(dialog);
    return dialog;
  }

  attachSaveDialogEvents(dialog) {
    const c = dialog.querySelector(".save-dialog-content");
    c.querySelector("#save-html").onclick = async () => {
      try {
        await this.presentation.saveAsHTML?.();
        this.lastSavedState = this.getCurrentState();
        this.showToast("Saved as HTML successfully!", "success");
        dialog.remove();
        location.reload();
      } catch (err) {
        this.showToast("Error saving as HTML: " + err.message, "error");
      }
    };
    c.querySelector("#save-pdf").onclick = async () => {
      try {
        await this.presentation.exportToPDF?.();
        this.lastSavedState = this.getCurrentState();
        this.showToast("Saved as PDF successfully!", "success");
        dialog.remove();
        location.reload();
      } catch (err) {
        this.showToast("Error saving as PDF: " + err.message, "error");
      }
    };
    c.querySelector("#save-json").onclick = async () => {
      try {
        await this.saveAsJSON();
        this.lastSavedState = this.getCurrentState();
        this.showToast("Saved as JSON successfully!", "success");
        dialog.remove();
        location.reload();
      } catch (err) {
        this.showToast("Error saving as JSON: " + err.message, "error");
      }
    };
    c.querySelector("#save-local").onclick = () => {
      this.saveToLocalStorage();
      this.lastSavedState = this.getCurrentState();
      this.showToast("Saved to local storage successfully!", "success");
      dialog.remove();
      location.reload();
    };
    c.querySelector("#dont-save").onclick = () => dialog.remove();
    dialog.addEventListener("click", (e) => e.target === dialog && dialog.remove());
    document.addEventListener("keydown", (e) => e.key === "Escape" && dialog.remove());
  }

  async saveAsJSON() {
    const data = {
      slides: this.presentation.slides,
      currentSlideIndex: this.presentation.currentSlideIndex,
      currentTheme: this.presentation.currentTheme,
      viewSettings: this.presentation.viewSettings,
      metadata: {
        created: new Date().toISOString(),
        version: "1.0",
        application: "PowerPoint Editor",
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `presentation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- UI helpers ----------
  showToast(msg, type = "info") {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background =
      type === "success"
        ? "#28a745"
        : type === "error"
        ? "#dc3545"
        : type === "warning"
        ? "#ffc107"
        : "#17a2b8";
    toast.style.opacity = "1";
    setTimeout(() => (toast.style.opacity = "0"), 3000);
  }

  manualSave() {
    this.saveToLocalStorage();
    this.lastSavedState = this.getCurrentState();
    this.showToast("Auto-saved presentation", "success");
    this.showSavePrompt();
  }
  enhancedSaveAs() {
    try {
      if (!this.presentation) return this.showToast("Presentation not available", "error");
      this.saveToLocalStorage();
      this.lastSavedState = this.getCurrentState();
      this.showToast("Auto-saved before Save As", "success");
      setTimeout(() => this.showSavePrompt(), 300);
    } catch (e) {
      console.error("enhanced Save As error:", e);
      this.showToast("Error: " + e.message, "error");
    }
  }
  checkUnsavedChanges() {
    return this.hasUnsavedChanges();
  }
  forceSave() {
    this.saveToLocalStorage();
    this.lastSavedState = this.getCurrentState();
    this.showToast("Presentation saved successfully!", "success");
  }
  trackElementChange() {
    setTimeout(() => this.autoSave(), 1000);
  }
  getAutoSaveStatus() {
    return {
      isActive: !!this.autoSaveInterval,
      lastSaved: this.lastSavedState
        ? new Date(JSON.parse(this.lastSavedState).timestamp || Date.now())
        : null,
      hasUnsavedChanges: this.hasUnsavedChanges(),
    };
  }
  enableSaveAsButton() {
    const btn = document.getElementById("saveAsBtn");
    if (!btn) return;
    btn.disabled = false;
    btn.style.opacity = "1";
    btn.title = "Save As – Auto-save active";
    if (!btn.querySelector(".auto-save-indicator")) {
      const dot = document.createElement("span");
      dot.className = "auto-save-indicator";
      dot.style.cssText = `
        position:absolute;top:-2px;right:-2px;width:8px;height:8px;
        background:#28a745;border-radius:50%;border:2px solid #fff;
        box-shadow:0 0 4px rgba(0,0,0,0.3);
      `;
      btn.style.position = "relative";
      btn.appendChild(dot);
    }
  }
  showAutoSaveWorking() {
    const btn = document.getElementById("saveAsBtn");
    const dot = btn?.querySelector(".auto-save-indicator");
    if (dot) {
      dot.style.background = "#ffc107";
      setTimeout(() => (dot.style.background = "#28a745"), 1000);
    }
  }
}

// ---------- Global initialization helpers ----------
export function initializeAutoSave(presentation) {
  const mgr = new AutoSaveManager(presentation);
  window.autoSaveManager = mgr;
  console.log("Auto-save manager initialized");
  setTimeout(() => mgr.enableSaveAsButton(), 1000);
  return mgr;
}

// Manual / quick save wrappers for buttons
export function manualSave() {
  const mgr = window.autoSaveManager;
  if (!mgr) return alert("Auto-save manager not ready – please wait.");
  try {
    mgr.enhancedSaveAs();
  } catch (e) {
    console.error("manual save error:", e);
    alert("Error saving presentation: " + e.message);
  }
}

export function quickSave() {
  const mgr = window.autoSaveManager;
  if (!mgr) return alert("Auto-save manager not ready – please wait.");
  try {
    mgr.forceSave();
  } catch (e) {
    console.error("quick save error:", e);
    alert("Error saving presentation: " + e.message);
  }
}

// ---------- Inject CSS styles ----------
const saveDialogStyles = `
<style>
@keyframes slideIn {from{opacity:0;transform:translateY(-20px);}to{opacity:1;transform:translateY(0);} }
.save-btn{padding:12px 16px;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:500;transition:all .2s ease;display:flex;flex-direction:column;align-items:center;gap:6px;min-height:60px;justify-content:center;}
.save-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.15);}
.save-html-btn{background:#007bff;color:#fff}.save-html-btn:hover{background:#0056b3}
.save-pdf-btn{background:#dc3545;color:#fff}.save-pdf-btn:hover{background:#c82333}
.save-json-btn{background:#28a745;color:#fff}.save-json-btn:hover{background:#218838}
.save-local-btn{background:#17a2b8;color:#fff}.save-local-btn:hover{background:#138496}
.save-cancel-btn{background:#6c757d;color:#fff}.save-cancel-btn:hover{background:#5a6268}
.save-btn i{font-size:16px}.save-btn span{font-size:12px}
</style>`;
if (typeof document !== "undefined") document.head.insertAdjacentHTML("beforeend", saveDialogStyles);