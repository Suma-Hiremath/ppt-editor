// src/utils/canvas.js
import { initializeAutoSave } from "./fileUtils";
export function initCanvas() {
  console.log("Initializing PPT Canvas...");

 
// ✅ Track unsaved changes
let isModified = false;
let allowClose = false;
this.chartEditmode = null;
this. editingChartModel= null;


const currentSlide = document.getElementById('currentSlide');
let lastMutation = Date.now();

new MutationObserver(() => {
  const now = Date.now();
  if (now - lastMutation > 300) {
    isModified = true;
    lastMutation = now;
    scheduleAutosave(); // ✅ New line
  }
}).observe(currentSlide, { childList: true, subtree: true });


// ✅ Modal references
const saveModal = document.getElementById('savePromptModal');
const saveBtn = document.getElementById('saveBtn');
const dontSaveBtn = document.getElementById('dontSaveBtn');
const cancelBtn = document.getElementById('cancelBtn');

const formatModal = document.getElementById('formatPromptModal');
const savePdfBtn = document.getElementById('savePdfBtn');
const saveHtmlBtn = document.getElementById('saveHtmlBtn');
const formatCancelBtn = document.getElementById('formatCancelBtn');


function openNewEditorWindow() {
    const newWindow = window.open('index.html', '_blank');
}

const DEFAULT_PLACEHOLDER_TEXTS = [
  'Click to add title',
  'Click to add subtitle',
  'Click to add text'
];
function removeUnusedPlaceholders(clone) {
  const slideElements = clone.querySelectorAll('.slide-element.text-element');
  slideElements.forEach((el) => {
    const elementId = parseInt(el.dataset.elementId || el.dataset.id);
    const slide = presentation.slides[presentation.currentSlideIndex];
    const elementData = slide.elements.find((e) => e.id === elementId);

    if (elementData && elementData.isPlaceholder && DEFAULT_PLACEHOLDER_TEXTS.includes(elementData.content)) {
      el.remove(); // Remove from DOM clone
      // Optionally, remove from model if needed
      const index = slide.elements.findIndex((e) => e.id === elementId);
      if (index !== -1) {
        slide.elements.splice(index, 1);
      }
    }
  });
}

let autosaveTimer;

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    if (isModified) {
      presentation.saveState?.();
      console.log("✅ Autosaved");
    }
  }, 3000); // Wait 3 seconds after user stops editing
}


function getFilteredSlides() {
  return this.slides.map(slide => ({
    ...slide,
    elements: slide.elements.filter(el => !(el.isPlaceholder && (!el.content || el.content.toLowerCase().includes('click to'))))
  }));
}


// ✅ Save as PDF with file picker
function downloadPDF(callback) {
  const slide = document.getElementById('currentSlide');
  const clone = slide.cloneNode(true);
  removeUnusedPlaceholders(clone); // Apply the updated function

  // Rest of the function remains unchanged
  clone.querySelectorAll('.slide-element').forEach((el) => {
    const computed = getComputedStyle(el);
    el.style.left = computed.left;
    el.style.top = computed.top;
    el.style.width = computed.width;
    el.style.height = computed.height;
    el.style.position = 'absolute';
    el.style.transform = 'none';
  });
  clone.style.transform = 'none';

  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '-9999px';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  html2canvas(clone, { backgroundColor: null, scale: 2, }).then((canvas) => {
    canvas.toBlob(async (blob) => {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'presentation.pdf',
          types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        callback();
      } catch (err) {
        console.error('Save cancelled or failed', err);
      } finally {
        wrapper.remove();
      }
    }, 'application/pdf');
  });
}



async function downloadHTML(callback) {
  const currentSlideData = presentation.slides[presentation.currentSlideIndex];

  // Convert blob: URLs to base64
  const convertBlobToBase64 = async (blobUrl) => {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const sortedElements = [...currentSlideData.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  // Convert all blobs before building the HTML
  await Promise.all(
    sortedElements.map(async (el) => {
      if (el.content?.startsWith?.('blob:')) {
        el.content = await convertBlobToBase64(el.content);
      }
    })
  );

  const slideDiv = document.createElement('div');
  slideDiv.className = 'slide';
  slideDiv.style.width = '960px';
  slideDiv.style.height = '540px';
  slideDiv.style.position = 'relative';
  slideDiv.style.overflow = 'hidden';

  sortedElements.forEach(el => {
    const elDiv = document.createElement('div');
    elDiv.className = `slide-element ${el.type}-element`;
    elDiv.style.position = 'absolute';
    elDiv.style.left = `${el.x}px`;
    elDiv.style.top = `${el.y}px`;
    elDiv.style.width = `${el.width || 150}px`;
    elDiv.style.height = `${el.height || 100}px`;
    elDiv.style.zIndex = el.zIndex || 1;

    const rotate = el.rotation || 0;
    const scaleX = el.flip?.horizontal ? -1 : 1;
    const scaleY = el.flip?.vertical ? -1 : 1;
    elDiv.style.transform = `scale(${scaleX}, ${scaleY}) rotate(${rotate}deg)`;

    if (el.type === 'text') {
      const content = document.createElement('div');
      content.className = 'text-content';
      content.contentEditable = false;
      content.innerHTML = el.content || '';
      Object.assign(content.style, {
        fontSize: el.style?.fontSize || '16px',
        fontFamily: el.style?.fontFamily || 'Arial',
        color: el.style?.color || '#000',
        textAlign: el.style?.textAlign || 'left',
        fontWeight: el.style?.fontWeight || 'normal',
        fontStyle: el.style?.fontStyle || 'normal',
      });
      elDiv.appendChild(content);

    } else if (el.type === 'image') {
      const img = document.createElement('img');
      img.src = el.content;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'fill';
      elDiv.appendChild(img);

    } else if (el.type === 'video') {
      const video = document.createElement('video');
      video.src = el.content;
      video.controls = true;
      video.style.width = '100%';
      video.style.height = '100%';
      elDiv.appendChild(video);

    } else if (el.type === 'audio') {
      const audio = document.createElement('audio');
      audio.src = el.content;
      audio.controls = true;
      elDiv.appendChild(audio);

    } else if (el.type === 'shape') {
      elDiv.style.backgroundColor = el.fillColor || 'transparent';
      elDiv.style.border = `${el.borderWidth || 1}px solid ${el.borderColor || '#000'}`;
      elDiv.style.width = `${el.width || 100}px`;
      elDiv.style.height = `${el.height || 100}px`;
      elDiv.style.left = `${el.x || 0}px`;
      elDiv.style.top = `${el.y || 0}px`;

      if (el.backgroundImage) elDiv.style.backgroundImage = el.backgroundImage;
      if (el.style?.boxShadow) elDiv.style.boxShadow = el.style.boxShadow;

      if (el.shapeType === 'circle' && el.width === el.height) {
        elDiv.style.borderRadius = '50%';
      } else if (el.shapeType === 'circle') {
        elDiv.style.borderRadius = `${Math.min(el.width, el.height) / 2}px / ${Math.max(el.width, el.height) / 2}px`;
      }
    }

    slideDiv.appendChild(elDiv);
  });

  const finalHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Exported Slide</title>
  <style>
    body { margin: 0; padding: 0; background: #fff; }
    .slide { width: 960px; height: 540px; position: relative; border: 1px solid #ccc; margin: 20px auto; }
    .slide-element { position: absolute; }
  </style>
</head>
<body>
  ${slideDiv.outerHTML}
</body>
</html>`;

  const blob = new Blob([finalHTML], { type: 'text/html' });

  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: 'presentation.html',
      types: [{ description: 'HTML Document', accept: { 'text/html': ['.html'] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    callback?.();
  } catch (err) {
    console.error('Save failed or cancelled', err);
  }
}











// ✅ Ctrl+R reload interception
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'r') {
    if (!isModified) return;
    e.preventDefault();
    showSaveModals(() => location.reload());
  }
});

// ✅ Tab close / back navigation handler
window.addEventListener('beforeunload', (e) => {
  if (allowClose || !isModified) return;
  e.preventDefault();
  e.returnValue = '';
  showSaveModals(() => {
    allowClose = true;
    window.location.href = 'about:blank';
  });
});

// ✅ Show Save + Format modals
function showSaveModals(continueCallback) {
  saveModal.style.display = 'flex';

  saveBtn.onclick = () => {
    saveModal.style.display = 'none';
    formatModal.style.display = 'flex';

    savePdfBtn.onclick = () => {
      formatModal.style.display = 'none';
      downloadPDF(() => {
        isModified = false;
        continueCallback();
      });
    };

    saveHtmlBtn.onclick = () => {
      formatModal.style.display = 'none';
      downloadHTML(() => {
        isModified = false;
        continueCallback();
      });
    };

    formatCancelBtn.onclick = () => {
      formatModal.style.display = 'none';
    };
  };

  dontSaveBtn.onclick = () => {
    isModified = false;
    saveModal.style.display = 'none';
    continueCallback();
  };

  cancelBtn.onclick = () => {
    saveModal.style.display = 'none';
  };
}

function extractYouTubeId(url) {
  const match = url.match(/(?:youtube\.com.*[?&]v=|youtu\.be\/)([^&?/]+)/);
  return match ? match[1] : '';
}

function extractGoogleDriveId(url) {
  const match = url.match(/\/file\/d\/([^/]+)/);
  return match ? match[1] : '';
}



let uiUpdatePending = false;
function scheduleUIUpdate() {
  if (uiUpdatePending) return;
  uiUpdatePending = true;

  requestAnimationFrame(() => {
    presentation.updateUI?.(); // Safe check
    uiUpdatePending = false;
  });
}

let slideListUpdatePending = false;
function scheduleSlidesListUpdate() {
  if (slideListUpdatePending) return;
  slideListUpdatePending = true;

  requestAnimationFrame(() => {
    presentation.updateSlidesList?.();
    slideListUpdatePending = false;
  });
}




class Presentation {
    constructor() {
        this.slides = [];
        this.currentSlideIndex = 0;
        this.selectedElement = null;
        this.undoStack = [];
        this.redoStack = [];
        this.currentTheme = null;
        this.viewSettings = {
            showGrid: false,
            showRulers: false,
            showGuides: false,
            gridSize: 20
        };
        this.defaultSlideStyle = {
            backgroundImage: 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: '#333333'
        };
        this.init();
        this.initKeyboardShortcuts();
    }

   init() {
    this.currentSlideElement = document.getElementById('currentSlide'); 
    this.setupEventListeners();
    this.createNewSlide();
    this.addSelectionStyles();
    this.initBlankAreaSelector();
    this.initContextMenu();
    this.initElementSelection();

    this.currentSlideElement.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
        this.currentSlideElement.classList.add('drag-over');
    });

    this.currentSlideElement.addEventListener('dragleave', () => {
        this.currentSlideElement.classList.remove('drag-over');
    });




    // DROP handler (inside class, in setup/init)
this.currentSlideElement.addEventListener('drop', (e) => {
  e.preventDefault();
  this.currentSlideElement.classList.remove('drag-over');

  const files = e.dataTransfer.files;
  if (!files || files.length === 0) return;

  const slide = this.currentSlideElement;
  // capture drop coordinates now (reader is async)
  const rawX = e.offsetX;
  const rawY = e.offsetY;

  [...files].forEach(file => {
    const objectURL = URL.createObjectURL(file);
    const reader = new FileReader();

    reader.onload = (event) => {
      const base64Content = event.target.result;

      // default size (will be clamped to fit slide)
      let width = 300;
      let height = 200;

      // clamp initial position + size so element is fully inside slide
      const maxLeft = Math.max(0, slide.clientWidth - 30);
      const maxTop = Math.max(0, slide.clientHeight - 30);

      let x = Math.max(0, Math.min(rawX, maxLeft));
      let y = Math.max(0, Math.min(rawY, maxTop));

      // shrink width/height if necessary so element fits at (x,y)
      width = Math.min(width, slide.clientWidth - x);
      height = Math.min(height, slide.clientHeight - y);

      // ensure minimum reasonable size
      width = Math.max(40, width);
      height = Math.max(40, height);

      const element = {
        type: file.type.startsWith('image/') ? 'image' :
              file.type.startsWith('video/') ? 'video' :
              file.type.startsWith('audio/') ? 'audio' : 'unknown',
        content: base64Content,
        preview: objectURL,
        x,
        y,
        width,
        height,
        zIndex: this.getNextZIndex?.() || 1,
        id: Date.now()
      };

      this.slides[this.currentSlideIndex].elements.push(element);
      scheduleUIUpdate(); // keep your existing UI update flow
      scheduleAutosave?.(); // optional if you have autosave
    };

    reader.readAsDataURL(file);
  });
});

// // ... existing code ...
//    this.currentSlideElement.addEventListener('drop', (e) => {
//     e.preventDefault();
//     this.currentSlideElement.classList.remove('drag-over');

//     const files = e.dataTransfer.files;
//     if (!files || files.length === 0) return;

//     [...files].forEach(file => {
//         const objectURL = URL.createObjectURL(file); // fast preview
//         const reader = new FileReader();
//         const x = e.offsetX;
//         const y = e.offsetY;

//         reader.onload = (event) => {
//             const base64Content = event.target.result;

//             const element = {
//                 type: file.type.startsWith('image/') ? 'image' :
//                       file.type.startsWith('video/') ? 'video' :
//                       file.type.startsWith('audio/') ? 'audio' : 'unknown',
//                 content: base64Content,     // this is what gets saved
//                 preview: objectURL,         // used only while editing
//                 x,
//                 y,
//                 width: 300,
//                 height: 200,
//                 zIndex: this.getNextZIndex?.() || 1,
//                 id: Date.now()
//             };

//             this.slides[this.currentSlideIndex].elements.push(element);
//             scheduleUIUpdate();
//         };

//         reader.readAsDataURL(file); // load actual content
//     });
// });

}



makeElementDraggable(el) {
    let offsetX, offsetY;

    el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        offsetX = e.clientX - el.offsetLeft;
        offsetY = e.clientY - el.offsetTop;

        const onMouseMove = (eMove) => {
            el.style.left = `${eMove.clientX - offsetX}px`;
            el.style.top = `${eMove.clientY - offsetY}px`;
        };

    const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    el.style.zIndex = '';

    // ✅ Save updated width and height to model
    const elementId = parseInt(el.dataset.elementId);
    const modelEl = this.slides[this.currentSlideIndex].elements.find(e => e.id === elementId);
    if (modelEl) {
        modelEl.width = parseFloat(el.style.width);
        modelEl.height = parseFloat(el.style.height);
        modelEl.x = parseFloat(el.style.left);
        modelEl.y = parseFloat(el.style.top);
    }

    this.saveState(); // Save for undo/redo
   scheduleSlidesListUpdate(); // Refresh preview
};
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
    const elementId = el.dataset.elementId;
const modelElement = this.getCurrentSlide().elements.find(e => e.id === elementId);
if (modelElement) {
  modelElement.position.x = parseFloat(el.style.left);
  modelElement.position.y = parseFloat(el.style.top);
  this.saveState(); // ✅ Save after drag
}

}


confirmInsertByUrl() {
    const url = document.getElementById('mediaUrl').value.trim();
    const type = document.getElementById('mediaType').value;
    const x = 100;  // Default X position
    const y = 100;  // Default Y position

    if (!url) {
        alert("Please enter a valid URL.");
        return;
    }

    this.addDroppedMedia(type, url, x, y);
    document.getElementById('urlInsertModal').style.display = 'none';
}

    
    setupEventListeners() {
        const currentSlide = this.currentSlideElement; 
         const shapesSubmenu = document.getElementById('shapesSubmenu');
         
let selectionBox = null;
let startX, startY;

currentSlide.addEventListener('mousedown', (e) => {
    if (!e.shiftKey && !e.target.closest('.slide-element')) {
        currentSlide.querySelectorAll('.slide-element.selected').forEach(el => {
            el.classList.remove('selected');
            removeRotationHandle(el);
        });
    }

    if (!e.target.closest('.slide-element') && e.button === 0) {
        e.preventDefault();

        startX = e.offsetX;
        startY = e.offsetY;

        selectionBox = document.createElement('div');
        selectionBox.className = 'selection-box';
        selectionBox.style.position = 'absolute';
        selectionBox.style.left = `${startX}px`;
        selectionBox.style.top = `${startY}px`;
        currentSlide.appendChild(selectionBox);

        const onMouseMove = (moveEvent) => {
            const mouseX = moveEvent.offsetX;
            const mouseY = moveEvent.offsetY;

            const x = Math.min(startX, mouseX);
            const y = Math.min(startY, mouseY);
            const w = Math.abs(mouseX - startX);
            const h = Math.abs(mouseY - startY);

            Object.assign(selectionBox.style, {
                left: `${x}px`,
                top: `${y}px`,
                width: `${w}px`,
                height: `${h}px`
            });
        };

        const onMouseUp = () => {
            const id = parseInt(el.dataset.id || el.dataset.elementId);
const slideElement = this.slides[this.currentSlideIndex].elements.find(obj => obj.id === id);
if (slideElement) {
  slideElement.rotation = angle;
}
saveState();

            const boxRect = selectionBox.getBoundingClientRect();
            const slideRect = currentSlide.getBoundingClientRect();

            currentSlide.querySelectorAll('.slide-element').forEach(el => {
                const elRect = el.getBoundingClientRect();
                const overlaps = !(
                    elRect.right < boxRect.left ||
                    elRect.left > boxRect.right ||
                    elRect.bottom < boxRect.top ||
                    elRect.top > boxRect.bottom
                );
                if (overlaps) {
                    el.classList.add('selected');
                    addRotationHandle(el);
                }
            });

            selectionBox.remove();
            selectionBox = null;

            currentSlide.removeEventListener('mousemove', onMouseMove);
            currentSlide.removeEventListener('mouseup', onMouseUp);
        };

        currentSlide.addEventListener('mousemove', onMouseMove);
        currentSlide.addEventListener('mouseup', onMouseUp);
    }
});

// 🔁 Add rotation handle
function addRotationHandle(element) {
    removeRotationHandle(element); // avoid duplicates

    const handle = document.createElement('div');
    handle.className = 'rotation-handle';
    Object.assign(handle.style, {
        position: 'absolute',
        top: '-30px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '20px',
        height: '20px',
        background: '#0078D7',
        borderRadius: '50%',
        cursor: 'grab',
        zIndex: 10
    });

    handle.addEventListener('mousedown', function (e) {
        e.stopPropagation();
        e.preventDefault();

        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - centerX;
            const dy = moveEvent.clientY - centerY;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);

            element.dataset.rotation = angle;
            element.style.transform = `rotate(${angle}deg)`;
        };

        const onMouseUp = () => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);

  this.saveState(); // ✅ Save position to undo stack
};


        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    element.appendChild(handle);
    element.style.position = 'absolute'; // Ensure it's positioned
}

function addRotationHandle(element) {
    removeRotationHandle(element); // avoid duplicates

    const handle = document.createElement('div');
    handle.className = 'rotation-handle';
    handle.innerHTML = '⟳'; // rotation symbol

    Object.assign(handle.style, {
        position: 'absolute',
        top: '-30px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '18px',
        cursor: 'grab',
        userSelect: 'none',
        background: 'white',
        borderRadius: '50%',
        padding: '4px',
        boxShadow: '0 0 2px rgba(0,0,0,0.3)',
        zIndex: 1000
    });

    // Ensure element is positioned
    element.style.position = 'absolute';
    element.appendChild(handle);

    // Rotation logic
    handle.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();

        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const initialAngle = parseFloat(element.dataset.rotation) || 0;

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - centerX;
            const dy = moveEvent.clientY - centerY;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            const rotation = angle;

            element.dataset.rotation = rotation;
            element.style.transform = `rotate(${rotation}deg)`;
        };

        const onMouseUp = () => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);

  this.saveState(); // ✅ Save position to undo stack
};


        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

function removeRotationHandle(element) {
    const existing = element.querySelector('.rotation-handle');
    if (existing) existing.remove();
}

//quit
document.getElementById('quitApp').addEventListener('click', () => {
    if (confirm("Are you sure you want to quit?")) {
        window.close(); // This works only if the window was opened via script
        // fallback in case `window.close()` is blocked
        window.location.href = 'about:blank';
    }
});

let typingTimer;
this.currentSlideElement.addEventListener('input', (e) => {
    const target = e.target.closest('.text-element .text-content');
    if (!target) return;

    const elementDiv = target.closest('.slide-element');
    const elementId = parseInt(elementDiv.dataset.elementId || elementDiv.dataset.id);
    const elementData = this.slides[this.currentSlideIndex].elements.find((el) => el.id === elementId);

    if (elementData) {
        elementData.content = target.innerHTML;

        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            this.saveState();  // ✅ Save ONE state after user stops typing
        }, 300);
    }
});


document.getElementById('alignLeft').addEventListener('click', () => this.alignSelectedElements('left'));
document.getElementById('alignCenter').addEventListener('click', () => this.alignSelectedElements('center'));
document.getElementById('alignRight').addEventListener('click', () => this.alignSelectedElements('right'));



        // document.getElementById('addAudio').addEventListener('click', () => presentation.addAudioElement());
        document.getElementById('newSlide').addEventListener('click', () => this.createNewSlide());
        document.getElementById('deleteSlide').addEventListener('click', () => this.deleteCurrentSlide());
        document.getElementById('addText').addEventListener('click', () => this.addTextElement());
        document.getElementById('addText1').addEventListener('click', () => this.addTextElement());
        document.getElementById('Delete').addEventListener('click', ()=> this.deleteElement());
        // document.getElementById('duplicate').addEventListener('click', ()=> this.duplicateElement());
       
        document.getElementById('addImage').addEventListener('click', () => this.addImageElement());
        document.getElementById('addImage1').addEventListener('click', () => this.addImageElement());
        document.getElementById('startPresentation').addEventListener('click', () => this.startPresentation());
        document.getElementById('prevSlide').addEventListener('click', () => this.previousSlide());
        document.getElementById('nextSlide').addEventListener('click', () => this.nextSlide());
        document.getElementById('exitPresentation').addEventListener('click', () => this.exitPresentation());
   document.getElementById('boldText').addEventListener('mousedown', function(event) {
            event.preventDefault(); // Prevents focus loss from .text-content
            presentation.formatText('bold');
        });
        document.getElementById('italicText').addEventListener('click', () => {
            const selectedElement = document.querySelector('.slide-element.selected');
            if (selectedElement && selectedElement.classList.contains('text-element')) {
                this.formatText('italic');
                document.getElementById('italicText').classList.toggle('active');
            }
        });
    document.getElementById('underlineText').addEventListener('mousedown', function(event) {
            event.preventDefault(); // Prevents focus loss from .text-content
            presentation.formatText('underline');
        });
       
        document.getElementById('textColor').addEventListener('input', (e) => this.formatText('color', e.target.value));
        document.getElementById('fontSize').addEventListener('change', (e) => this.formatText('size', e.target.value));
        document.getElementById('addTable1').addEventListener('click', () => this.addTableElement());
        document.getElementById('importHTML').addEventListener('click', () => this.handleImportHTML());
        
        
        // document.getElementById('addVideo').addEventListener('click', () => this.addVideoElement());
        document.getElementById('addVideo1').addEventListener('click', () => this.addVideoElement());
        document.getElementById('addAudio1').addEventListener('click', () => this.addAudioElement());
        
        document.getElementById('moveUpward').addEventListener('click', () => this.moveElementToFront());
        document.getElementById('moveBackward').addEventListener('click', () => this.moveElementToBack());
        
        // document.getElementById('rotate').addEventListener('click', () => {
        //     presentation.rotateSelectedElement();
        // });
      document.getElementById('undo').addEventListener('click', () => {
    presentation.undo();  // ✅ Call the instance method
});

document.getElementById('redo').addEventListener('click', () => {
    presentation.redo();  // ✅ Not 'this'
});

        document.getElementById('exportPDF').addEventListener('click', () => {
            this.exportToPDF();
        });

        Presentation.prototype.startPresentationFromBeginning = function () {
  this.currentSlideIndex = 0;
  this.startPresentation();
};

Presentation.prototype.startPresentationFromCurrent = function () {
  this.startPresentation();
};
        

        // document.getElementById('currentSlide').addEventListener('click', (e) => {
        //     // Only deselect if you click on the background (not on a slide-element)
        //     if (!e.target.classList.contains('slide-element') && !e.target.closest('.slide-element')) {
        //         // Deselect all elements
        //         document.querySelectorAll('.slide-element.selected').forEach(el => {
        //             el.classList.remove('selected');
        //         });
        
        //         // Clear selectedElement reference if used
        //         this.selectedElementId = null;
        //     }

        //     if (event.target.classList.contains('slide-element')) {
        //         selectedElement = event.target;
        //         selectedElement.classList.add('selected');
            
        //         const elementId = selectedElement.dataset.elementId;
        //         const slide = this.slides[this.currentSlideIndex];
        //         const modelElement = slide.elements.find(el => el.id.toString() === elementId);
            
        //         this.selectedShape = (modelElement && modelElement.type === 'shape') ? modelElement : null;
        //     }
            
        // });

        document.getElementById('currentSlide').addEventListener('contextmenu', (e) => {
            
            e.preventDefault();
        
            const target = e.target.closest('.slide-element');
        
            if (target) {
                // Deselect other elements
                document.querySelectorAll('.slide-element.selected').forEach(el => {
                    el.classList.remove('selected');
                });
        
                // Select the right-clicked element
                target.classList.add('selected');
        
                // Optionally set it as selected in the model
                this.selectedElementId = target.dataset.elementId;
            }
        });


// const currentSlide = document.getElementById('currentSlide');
// if (currentSlide) {
//   currentSlide.addEventListener('contextmenu', (e) => {
//     if (!currentSlide.contains(e.target)) return; // 🔒 Prevent right-click from outside

//     e.preventDefault();

//     const target = e.target.closest('.slide-element');
//     if (target) {
//       // Deselect others
//       document.querySelectorAll('.slide-element.selected').forEach(el => {
//         el.classList.remove('selected');
//       });

//       // Select the right-clicked element
//       target.classList.add('selected');

//       // Update internal selection state
//       this.selectedElementId = target.dataset.elementId;
//     }
//   });
// }


        

// ✅ Hide right-click menu if user clicks outside it
document.addEventListener('click', (e) => {
    const menu = document.getElementById('customContextMenu');
    if (menu && !menu.contains(e.target)) {
      menu.style.display = 'none';
    }
  });
  
  // ✅ Hide when typing
  document.addEventListener('keydown', () => {
    const menu = document.getElementById('customContextMenu');
    if (menu) menu.style.display = 'none';
  });
  
  // ✅ Hide when editing text (input/typing)
  document.addEventListener('input', () => {
    const menu = document.getElementById('customContextMenu');
    if (menu) menu.style.display = 'none';
  });
  document.getElementById('textUppercase').addEventListener('click', () => {
    this.applyTextCase('uppercase');
});

document.getElementById('textLowercase').addEventListener('click', () => {
    this.applyTextCase('lowercase');
});

   // ✅ Keyboard shortcuts for Ctrl+Z (undo) and Ctrl+Y (redo)
// ✅ Global keyboard shortcuts (optimized)
document.addEventListener('keydown', (e) => {
  const isInput = (
    e.target.tagName === 'INPUT' ||
    e.target.tagName === 'TEXTAREA' ||
    e.target.isContentEditable
  );
  if (isInput) return;

  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'z': e.preventDefault(); presentation.undo(); break;
      case 'y': e.preventDefault(); presentation.redo(); break;
      case 's': e.preventDefault(); presentation.savePresentation(); break;
      case 'c': e.preventDefault(); presentation.copyElement(); break;
      case 'v': e.preventDefault(); presentation.pasteElement(); break;
      case 'x': e.preventDefault(); presentation.copyElement(); presentation.deleteElement(); break;
      case 'a': e.preventDefault(); presentation.selectAllElements(); break;
      case 'd': e.preventDefault(); presentation.duplicateElement(); break;
      case 'ArrowRight': case ' ': case 'n': e.preventDefault(); nextSlide(); break;
      case 'ArrowLeft': case 'Backspace': case 'p': e.preventDefault(); previousSlide(); break;
      case 'Home': e.preventDefault(); showSlide(0); break;
      case 'End': e.preventDefault(); showSlide(slides.length - 1); break;
    }
  } else {
    // For delete key (only if not inside input/text)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      presentation.deleteElement();
    }
  }
});


      
        
        // Hide dropdown if clicking outside
       document.addEventListener('click', () => {
    const shapesSubmenu = document.getElementById('shapesSubmenu');
    if (shapesSubmenu) {
        shapesSubmenu.style.display = 'none';
    }
});
// document.getElementById('gradientSelect').addEventListener('change', () => {
//   const selected = document.querySelector('.slide-element.selected');
//   if (!selected || !selected.classList.contains('shape')) return;

//   const gradient = document.getElementById('gradientSelect').value;
//   const shapeId = parseInt(selected.dataset.elementId, 10);
//   const shapeData = presentation.slides[presentation.currentSlideIndex].elements.find(el => el.id === shapeId);

//   if (!shapeData) return;

//   if (gradient) {
//     selected.style.backgroundImage = gradient;
//     selected.style.backgroundColor = 'transparent';
//     shapeData.backgroundType = 'gradient';
//     shapeData.gradient = gradient;
//     shapeData.fillColor = null;
//   }

//   presentation.updateSlidesList();
// });



        document.getElementById('cropImageBtn').addEventListener('click', () => {
            const selected = document.querySelector('.slide-element.selected img');
            if (selected) {
                enableImageCropping(selected);
            } else {
                alert("Please select an image first.");
            }
        });


        // document.getElementById('flipHorizontal').addEventListener('click', () => {
        //     presentation.flipElement('horizontal');
        // });
        
        // document.getElementById('flipVertical').addEventListener('click', () => {
        //     presentation.flipElement('vertical');
        // });

document.getElementById('duplicate').addEventListener('click', () => {
  const selected = document.querySelector('.slide-element.selected');
  if (!selected) return;

  const elementId = parseInt(selected.dataset.elementId);
  const slideElements = presentation.slides[presentation.currentSlideIndex].elements;

  // Find the selected element data
  const original = slideElements.find(el => el.id === elementId);
  if (!original) return;

  // Block re-duplicating clones
  if (original.originalId) {
    alert('Duplicated elements cannot be duplicated again.');
    return;
  }

  // Count all clones (including original)
  const originalId = original.id;
  const clones = slideElements.filter(el => el.originalId === originalId || el.id === originalId);
  if (clones.length >= 6) {
    alert('You can only duplicate this element up to 5 times.');
    return;
  }

  // ✅ Create duplicate
  const clone = structuredClone(original);
  clone.id = Date.now() + Math.floor(Math.random() * 1000);
  clone.x += 20;
  clone.y += 20;
  clone.originalId = originalId;
  clone.isDuplicate = true; // ✅ mark as duplicate for 🔂

  if (!clone.flip) {
    clone.flip = { horizontal: false, vertical: false };
  }

  slideElements.push(clone);
  presentation.updateUI();
});


// // DELETE BUTTON
// document.getElementById('delete').addEventListener('click', () => {
//     presentation.deleteElement();
// });

// // Initialize with one element
// presentation.slides[0].elements.push({
//     id: 1,
//     x: 100,
//     y: 100,
//     flip: { horizontal: false, vertical: false }
// });
// presentation.updateUI();


        // document.getElementById('duplicate').addEventListener('click', () => {
        //     const selected = document.querySelector('.slide-element.selected');
        //     if (!selected) return;
        
        //     const elementId = parseInt(selected.dataset.elementId);
        //     const original = presentation.slides[presentation.currentSlideIndex].elements.find(el => el.id === elementId);
        //     if (!original) return;
        
        //     // Clone the element
        //     const clone = structuredClone(original);
        //     clone.id = Date.now();
        //     clone.x += 20;
        //     clone.y += 20;
        
        //     // Ensure flip property exists in the clone
        //     if (!clone.flip) {
        //         clone.flip = { horizontal: false, vertical: false };
        //     }
        
        //     presentation.slides[presentation.currentSlideIndex].elements.push(clone);
        //     presentation.updateUI();
        // });

    

       document.getElementById('fontSize').addEventListener('change', (e) => {
    const size = e.target.value;
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const span = document.createElement('span');
        span.style.fontSize = `${size}px`;

        const range = selection.getRangeAt(0);
        try {
            range.surroundContents(span);
        } catch (err) {
            alert("Please select complete words or plain text.");
            return;
        }

        // Update model
        const selected = document.querySelector('.slide-element.selected');
        if (selected) {
            const content = selected.querySelector('.text-content');
            const elementId = parseInt(selected.dataset.elementId);
            const model = presentation.slides[presentation.currentSlideIndex].elements.find(el => el.id === elementId);
            if (model) model.content = content.innerHTML;
        }
    }
});

        
        document.getElementById('fontFamily').addEventListener('change', (e) => {
            this.formatText('fontFamily', e.target.value);
        });
        
        document.getElementById('textColor').addEventListener('input', (e) => {
            this.formatText('color', e.target.value);
        });
        
        
        // document.getElementById('addLink').addEventListener('click', () => this.createLink());
        document.getElementById('fontFamily').addEventListener('change', (e) => {this.formatText('fontFamily', e.target.value); });
        document.getElementById('fontSize').addEventListener('change', (e) => {this.formatText('fontSize', e.target.value); });        // Shape buttons
        document.querySelectorAll('[data-shape]').forEach(button => {
            button.addEventListener('click', (e) => {
                const shapeType = e.target.closest('button').dataset.shape;
                this.addShape(shapeType);
            });
        });

        // document.getElementById('applyGradientFill').addEventListener('click', () => {
        //     const selectedElement = document.querySelector('.slide-element.selected');
        //     if (selectedElement) {
        //         const gradient = 'linear-gradient(45deg, #ff9a9e, #fad0c4)';
        //         selectedElement.style.backgroundImage = gradient;
        //         selectedElement.style.backgroundSize = 'cover';
        //         selectedElement.style.backgroundRepeat = 'no-repeat';
        //         selectedElement.style.backgroundColor = 'transparent'; // Remove solid color
        //     } else {
        //         alert('Please select a shape first!');
        //     }
        // });
        
        // document.getElementById('uploadImageFill').addEventListener('click', () => {
        //     const selectedElement = document.querySelector('.slide-element.selected');
        //     if (!selectedElement) {
        //         alert('Please select a shape first!');
        //         return;
        //     }
        //     const input = document.createElement('input');
        //     input.type = 'file';
        //     input.accept = 'image/*';
        //     input.onchange = (e) => {
        //         const file = e.target.files[0];
        //         const reader = new FileReader();
        //         reader.onload = (event) => {
        //             selectedElement.style.backgroundImage = `url('${event.target.result}')`;
        //             selectedElement.style.backgroundSize = 'cover';
        //             selectedElement.style.backgroundRepeat = 'no-repeat';
        //             selectedElement.style.backgroundColor = 'transparent'; // Remove solid color
        //         };
        //         const objectURL = URL.createObjectURL(file);

        //     };
        //     input.click();
        // });
        
        document.getElementById('fillColor').addEventListener('input', (e) => {
            const selectedElement = document.querySelector('.slide-element.selected');
            
            if (selectedElement && selectedElement.classList.contains('shape')) {
                const color = e.target.value;
                
                // Set only the inside (background-color) of the shape
                selectedElement.style.backgroundColor = color;
                
                // Update the shape in slides model for saving
                const shapeId = parseInt(selectedElement.dataset.elementId, 10);
                const elementData = presentation.slides[presentation.currentSlideIndex].elements.find(el => el.id === shapeId);
                
                if (elementData) {
                    elementData.fillColor = color;
                    elementData.backgroundImage = null; // remove any previous image/gradient fill
                }
            } else {
                alert('Please select a shape first!');
            }
        });
        

        // Shape controls
       
        document.getElementById('fillColor').addEventListener('input', (e) => this.updateShapeStyle('fill', e.target.value));
        document.getElementById('borderColor').addEventListener('input', (e) => this.updateShapeStyle('border', e.target.value));
        document.getElementById('borderWeight').addEventListener('change', (e) => this.updateShapeStyle('borderWidth', e.target.value));
        document.getElementById('borderStyle').addEventListener('change', (e) => this.updateShapeStyle('borderStyle', e.target.value));
        
        // document.getElementById('savePresentation').addEventListener('click', () => {
        //     this.savePresentation();
        //     alert('Presentation saved to local storage!');
        // });

        document.getElementById('saveAsHTML').addEventListener('click', () => {
            this.saveAsHTML();
        });

        document.getElementById('loadPresentation').addEventListener('click', () => {
            this.loadPresentation();
        });

        // document.getElementById('boldText').addEventListener('click', () => {
        //     setTimeout(() => {
        //         document.execCommand('bold');
        //     }, 0);
        // });

   document.getElementById('currentSlide').addEventListener('click', (e) => {
    const target = e.target;
    
    // Case 1: If clicked inside the .text-content (editable area)
    if (target.closest('.text-content')) {
        return; // Don't select the text box
    }

    // Case 2: If clicked directly on the .slide-element (not inside .text-content)
    const slideElement = target.closest('.slide-element');

    if (slideElement && !target.closest('.text-content')) {
        const isMulti = e.ctrlKey || e.metaKey;

        if (!isMulti) {
            document.querySelectorAll('.slide-element.selected').forEach(el => {
                if (el !== slideElement) el.classList.remove('selected');
            });
        }

        slideElement.classList.add('selected');

        const elementId = slideElement.dataset.elementId || slideElement.dataset.id;
        this.selectedElementId = elementId;

        const slide = this.slides[this.currentSlideIndex];
        const modelElement = slide.elements.find(el => el.id.toString() === elementId);
        this.selectedShape = (modelElement && modelElement.type === 'shape') ? modelElement : null;

        return;
    }

    // Case 3: Clicked on empty space (outside any element)
    document.querySelectorAll('.slide-element.selected').forEach(el => el.classList.remove('selected'));
    this.selectedElementId = null;
    this.selectedShape = null;
});




        document.getElementById('applyFill').addEventListener('click', () => {
            const selected = document.querySelector('.slide-element.selected');
            if (!selected || !selected.classList.contains('shape')) {
              alert("Select a shape first.");
              return;
            }
          
            const color = document.getElementById('fillColorPicker').value;
            const gradient = document.getElementById('gradientSelect').value;
          
            const shapeId = parseInt(selected.dataset.elementId, 10);
            const shapeData = presentation.slides[presentation.currentSlideIndex].elements.find(el => el.id === shapeId);
          
            if (!shapeData) return;
          
            if (gradient) {
              selected.style.backgroundImage = gradient;
              selected.style.backgroundColor = 'transparent';
              shapeData.backgroundType = 'gradient';
              shapeData.gradient = gradient;
              shapeData.fillColor = null;
            } else {
              selected.style.backgroundColor = color;
              selected.style.backgroundImage = 'none';
              shapeData.backgroundType = 'color';
              shapeData.fillColor = color;
              shapeData.gradient = null;
            }
          
            presentation.updateSlidesList(); // Update preview
          });
          
        
        // Add keyboard shortcut for save
        document.body.addEventListener('click', (e) => {
            const isInsideText = e.target.closest('.text-element');
            if (!isInsideText && selectedElement) {
                selectedElement.classList.remove('selected');
                selectedElement = null;
            }
        });
        // Add navbar-specific listeners that aren't duplicates
        document.getElementById('toggleGrid').addEventListener('click', () => this.toggleGrid());
        document.getElementById('toggleRulers').addEventListener('click', () => this.toggleRulers());
        document.getElementById('toggleGuides').addEventListener('click', () => this.toggleGuides());
        document.getElementById('fullscreen').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('helpButton').addEventListener('click', () => this.showHelp());
        const selectedElement = document.querySelector('.slide-element.selected');
if (!selectedElement) {
    alert('Please select an element first.');
    return;
}
        // Media controls
        const addAudioBtn = document.getElementById('addAudio');
        if (addAudioBtn) {
            addAudioBtn.addEventListener('click', () => this.addAudioElement());
        }
       

        const addVideoBtn = document.getElementById('addVideo');
        if (addVideoBtn) {
            addVideoBtn.addEventListener('click', () => this.addVideoElement());
        }

        // Layer controls
        const moveUpBtn = document.getElementById('moveUpward');
        if (moveUpBtn) {
            moveUpBtn.addEventListener('click', () => this.moveElementUpward());
        }
        const moveDownBtn = document.getElementById('moveDownward');
        if (moveDownBtn) {
            moveDownBtn.addEventListener('click', () => this.moveElementDownward());
        }
        // Grid and Ruler controls
        // Grid and Ruler controls
        const toggleGridBtn = document.getElementById('toggleGrid');
        if (toggleGridBtn) {
            toggleGridBtn.addEventListener('click', () => this.toggleGrid());
        }

        const toggleRulersBtn = document.getElementById('toggleRulers');
        if (toggleRulersBtn) {
            toggleRulersBtn.addEventListener('click', () => this.toggleRulers());
        }
 
         const toggleGuidesBtn = document.getElementById('toggleGuides');
         if (toggleGuidesBtn) {
             toggleGuidesBtn.addEventListener('click', () => this.toggleGuides());
        }

        const active = document.activeElement;
        if (active && active.contentEditable === "true") {
        active.blur();
        }

        // Text formatting controls
        document.getElementById('fontSize').addEventListener('change', (e) => {
            const selectedElement = document.querySelector('.slide-element.selected');
            if (selectedElement && selectedElement.classList.contains('text-element')) {
                selectedElement.style.fontSize = `${e.target.value}px`;
                this.formatText('fontSize', e.target.value);
            }
        });

        document.getElementById('replaceMedia').addEventListener('click', () => {
            presentation.replaceSelectedMedia();
        });
        


        // Underline
document.getElementById('underlineBtn').addEventListener('click', () => {
    this.applyRichTextCommand('underline');
});


document.getElementById('saveAsJPEG').addEventListener('click', () => {
    const slide = document.getElementById('currentSlide');
  
    // Create a clone to render cleanly
    const clone = slide.cloneNode(true);
    clone.classList.add('export-slide');
    clone.style.position = 'static';
    clone.style.transform = 'none';
  
    // Wrap in a container and attach to body temporarily
    const wrapper = document.createElement('div');
    wrapper.style.width = `${slide.offsetWidth}px`;
    wrapper.style.height = `${slide.offsetHeight}px`;
    wrapper.style.position = 'fixed';
    wrapper.style.top = '-9999px';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);
  
    // Use html2canvas to render the clone
    html2canvas(clone, { backgroundColor: null, scale: 2 }).then(canvas => {
      const link = document.createElement('a');
      link.download = `slide-${Date.now()}.jpeg`;
      link.href = canvas.toDataURL('image/jpeg', 1.0);
      link.click();
      wrapper.remove();
    });
  });


// // Alignment
// document.getElementById('alignLeftBtn').addEventListener('click', () => {
//     this.applyRichTextCommand('justifyLeft');
// });

// document.getElementById('alignCenterBtn').addEventListener('click', () => {
//     this.applyRichTextCommand('justifyCenter');
// });

// document.getElementById('alignRightBtn').addEventListener('click', () => {
//     this.applyRichTextCommand('justifyRight');
// });

// Link
document.getElementById('insertLinkBtn').addEventListener('click', () => {
    const url = prompt('Enter URL:');
    if (url) {
        this.applyRichTextCommand('createLink', url);
    }
});

        document.getElementById('fontFamily').addEventListener('change', (e) => {
            const selectedElement = document.querySelector('.slide-element.selected');
            if (selectedElement && selectedElement.classList.contains('text-element')) {
                selectedElement.style.fontFamily = e.target.value;
                this.formatText('fontFamily', e.target.value);
            }
        });

        document.getElementById('textColor').addEventListener('input', (e) => {
            const selectedElement = document.querySelector('.slide-element.selected');
            if (selectedElement && selectedElement.classList.contains('text-element')) {
                selectedElement.style.color = e.target.value;
                this.formatText('color', e.target.value);
            }
        });

       document.getElementById('boldText').addEventListener('mousedown', function(event) {
            event.preventDefault(); // Prevents focus loss from .text-content
            presentation.formatText('bold');
        });
    // ✅ Keyboard shortcuts for Ctrl+Z (undo) and Ctrl+Y (redo)



        document.getElementById('italicText').addEventListener('click', () => {
            const selectedElement = document.querySelector('.slide-element.selected');
            if (selectedElement && selectedElement.classList.contains('text-element')) {
                const isItalic = selectedElement.style.fontStyle === 'italic';
                selectedElement.style.fontStyle = isItalic ? 'normal' : 'italic';
                this.formatText('italic');
            }
        });

        document.getElementById('slideBgColor').addEventListener('input', (e) => {
            this.setSlideBackgroundColor(e.target.value);
        });
        

        elementDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.slide-element').forEach(el => el.classList.remove('selected'));
            
            elementDiv.classList.add('selected');
            this.selectedElement = element; // Assign the model element
        });
        

        document.body.addEventListener('click', (e) => {
            if (!e.target.closest('.text-element')) {
                if (selectedElement) {
                    selectedElement.classList.remove('selected');
                    selectedElement = null;
                }
            }
        });

        // Update the link-related event listeners
        document.getElementById('addLink').addEventListener('click', () => this.createLink());
        document.getElementById('createLink').addEventListener('click', () => this.createLink());

       document.getElementById('boldText').addEventListener('mousedown', function(event) {
            event.preventDefault(); // Prevents focus loss from .text-content
            presentation.formatText('bold');
        });

        // ✅ Keyboard shortcuts for Ctrl+Z (undo) and Ctrl+Y (redo)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        this.undo(); // Replace with your presentation object reference
    }
    if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
      this.redo(); // Replace with your presentation object reference
    }
});


        document.getElementById('italicText').addEventListener('click', () => {
            const selectedElement = document.querySelector('.slide-element.selected');
            if (selectedElement && selectedElement.classList.contains('text-element')) {
                this.formatText('italic');
                document.getElementById('italicText').classList.toggle('active');
            }
        });

       
 document.getElementById('underlineText').addEventListener('click', () => {
            const selectedElement = document.querySelector('.slide-element.selected');
            if (selectedElement && selectedElement.classList.contains('text-element')) {
                this.formatText('underline');
                document.getElementById('underlineText').classList.toggle('active');
            }
        });

        // Update the text element selection handler to set active states
        document.addEventListener('click', (e) => {
            const textElement = e.target.closest('.text-element');
            if (!textElement) {
                // Reset all formatting buttons when clicking outside
                document.getElementById('boldText').classList.remove('active');
                document.getElementById('italicText').classList.remove('active');
                document.getElementById('underlineText').classList.remove('active');
                return;
            }

            const textContent = textElement.querySelector('.text-content');
            if (textContent) {
                // Update formatting button states based on current text styles
                document.getElementById('boldText').classList.toggle('active', 
                    textContent.style.fontWeight === 'bold');
                document.getElementById('italicText').classList.toggle('active', 
                    textContent.style.fontStyle === 'italic');
                document.getElementById('underlineText').classList.toggle('active', 
                    textContent.style.textDecoration === 'underline');
            }
        });
    }


    //     createNewSlide() {
    //     const slide = {
    //         elements: [],
    //         id: Date.now(),
    //         theme: this.currentTheme ? {
    //             backgroundImage: themes[this.currentTheme].backgroundImage,
    //             textColor: themes[this.currentTheme].textColor
    //         } : null
    //     };
        
    //     this.slides.push(slide);
    //     this.currentSlideIndex = this.slides.length - 1;
        
    //     // Add a default "Click to edit" text element to the new slide with better styling
    //     const placeholderElement = {
    //         type: 'text',
    //         content: 'Click to edit',
    //         x: 300,
    //         y: 200,
    //         style: {
    //             fontSize: '24px',
    //             fontFamily: 'Arial',
    //             color: '#666666',
    //             fontWeight: 'normal',
    //             fontStyle: 'italic',
    //             textAlign: 'center',
    //             opacity: '0.7'
    //         },
    //         id: Date.now()
    //     };
        
    //     this.slides[this.currentSlideIndex].elements.push(placeholderElement);
        
    //    scheduleUIUpdate();
    // }
alignSelectedElements(direction) {
    this.saveState(); // ✅ Save undo state

    const slide = document.getElementById("currentSlide");
    const selected = [...slide.querySelectorAll(".slide-element.selected")];
    if (selected.length === 0) return;

    selected.forEach(el => {
        const style = el.style;
        const slideW = slide.clientWidth;
        const slideH = slide.clientHeight;
        const elW = el.offsetWidth;
        const elH = el.offsetHeight;

        let left = parseFloat(style.left);
        let top = parseFloat(style.top);

        // ✅ Check for text content inside element
        const textContent = el.querySelector('.text-content');
        const selection = window.getSelection();
        const isInside = selection && selection.anchorNode && textContent && textContent.contains(selection.anchorNode);

        if (isInside && !selection.isCollapsed) {
            // ✅ Align selected text (wrap in span with style)
            document.execCommand('justify' + direction);
        } else {
            // ✅ Align the element itself as before
            switch (direction) {
                case 'left':
                    left = 0;
                    this.setTextAlign(el, 'left');
                    break;
                case 'center':
                    left = (slideW - elW) / 2;
                    this.setTextAlign(el, 'center');
                    break;
                case 'right':
                    left = slideW - elW;
                    this.setTextAlign(el, 'right');
                    break;
                case 'top':
                    top = 0;
                    break;
                case 'middle':
                    top = (slideH - elH) / 2;
                    break;
                case 'bottom':
                    top = slideH - elH;
                    break;
            }

            if (!isNaN(left)) style.left = `${left}px`;
            if (!isNaN(top)) style.top = `${top}px`;

            // ✅ Update Model
            const elementId = parseInt(el.dataset.elementId);
            const modelEl = this.slides[this.currentSlideIndex].elements.find(e => e.id === elementId);
            if (modelEl) {
                if (!isNaN(left)) modelEl.x = left;
                if (!isNaN(top)) modelEl.y = top;

                if (['left', 'center', 'right'].includes(direction)) {
                    modelEl.style = modelEl.style || {};
                    modelEl.style.textAlign = direction;
                }
            }
        }
    });

   scheduleSlidesListUpdate();
}




 setTextAlign(el, alignment) {
    if (el.classList.contains('text-element')) {
        const contentDiv = el.querySelector('.text-content');
        if (contentDiv) {
            contentDiv.style.textAlign = alignment;
        }
    }
}
   createNewSlide() {
        const slide = {
            elements: [],
            id: Date.now(),
            theme: this.currentTheme ? {
                backgroundImage: themes[this.currentTheme].backgroundImage,
                textColor: themes[this.currentTheme].textColor
            } : null
        };
        const titleElement = {
    id: Date.now(),
    type: 'text',
    content: 'Click to add title',
    x: 100,
    y: 50,
    isPlaceholder: true,
    width: 750,
    height: 250,
    style: { fontSize: '34px', color: '#888', textAlign: 'center' }
};

const subtitleElement = {
    id: Date.now() + 1,
    type: 'text',
    content: 'Click to add subtitle',
    x: 100,
    y: 320,
    isPlaceholder: true,
    width: 750,
    height: 150,
    style: { fontSize: '24px', color: '#888', textAlign: 'center' }
};

        // Add a default text element at the center
        // const defaultTextElement = {
        //     id: Date.now(),
        //     type: 'text',
        //     content: 'Click to add title',
        //     x: 100, // Centered for 960px width
        //     y: 50, // Centered for 540px height
        //        isPlaceholder: true, // ✅ Important!
        //     width: 750,
        //     height: 250,
        //     style: { fontSize: '24px', color: '#888', textAlign: 'center' }
        // };
        //  const defaultTextElement1 = {
        //     id: Date.now(),
        //     type: 'text',
        //     content: 'Click to add subtitle',
        //     x: 100, // Centered for 960px width
        //     y: 320, // Centered for 540px height
        //        isPlaceholder: true, // ✅ Important!
        //     width: 750,
        //     height: 150,
        //     style: { fontSize: '24px', color: '#888', textAlign: 'center' }
        // };
        slide.elements.push(titleElement ,subtitleElement);
         
        this.slides.push(slide);
        this.currentSlideIndex = this.slides.length - 1;
       scheduleUIUpdate();
}


 
    deleteCurrentSlide() {
        if (this.slides.length <= 1) return;
        this.slides.splice(this.currentSlideIndex, 1);
        this.currentSlideIndex = Math.max(0, this.currentSlideIndex - 1);
       scheduleUIUpdate();
    }
    


    deleteObject() {
        if (this.slides.length <= 1) return;
        this.slides.splice(this.currentSlideIndex, 1);
        this.currentSlideIndex = Math.max(0, this.currentSlideIndex - 1);
        this.saveState();
       scheduleUIUpdate();
    }

//    creating new slide along with the texts
    createNewPresentation() {
        if (confirm("Are you sure you want to create a new presentation? All unsaved changes will be lost.")) {
            // Reset the presentation to its initial state
            this.slides = [];
            this.currentSlideIndex = 0;
            this.undoStack = [];
            this.redoStack = [];
     this.currentTheme = null;
            // Create an initial slide
            this.createNewSlide();
            alert("New presentation created!");
        }
    }


saveState() {
    const state = {
        slides: JSON.parse(JSON.stringify(this.slides)),
        currentSlideIndex: this.currentSlideIndex
    };

    this.undoStack.push(state);
    this.redoStack = [];
    if (this.undoStack.length > 100) this.undoStack.shift();

    console.log("✅ [saveState] Undo stack:", this.undoStack.length, "Redo stack:", this.redoStack.length);
}


undo() {
    if (this.undoStack.length < 2) return;

    const currentState = this.undoStack.pop();        // ✅ Pop latest state
    this.redoStack.push(currentState);                // ✅ Push it to redo

    const previousState = this.undoStack[this.undoStack.length - 1];
    this.slides = JSON.parse(JSON.stringify(previousState.slides));
    this.currentSlideIndex = previousState.currentSlideIndex;

    this.updateUI();
    this.updateSlidesList();
}



redo() {
  if (this.redoStack.length === 0) return;

  const state = this.redoStack.pop();
  this.undoStack.push(state);

  this.slides = JSON.parse(JSON.stringify(state.slides));
  this.currentSlideIndex = state.currentSlideIndex;

  this.updateUI();
  this.updateSlidesList();

  console.log("↪️ [redo] Undo stack:", this.undoStack.length, "Redo stack:", this.redoStack.length);
}


   replaceSelectedMedia() {
    const selectedElement = document.querySelector('.slide-element.selected');
    if (!selectedElement) {
        alert('Please select an image or media element to replace.');
        return;
    }

    const elementId = selectedElement.dataset.id;
    const slide = this.slides[this.currentSlideIndex];
    const element = slide.elements.find(el => el.id.toString() === elementId);

    if (!element || !['image', 'video', 'audio'].includes(element.type)) {
        alert('Selected element is not an image, video, or audio.');
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';

    if (element.type === 'image') {
        input.accept = 'image/*';
    } else if (element.type === 'video') {
        input.accept = 'video/*';
    } else if (element.type === 'audio') {
        input.accept = 'audio/*';
    }

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const objectURL = URL.createObjectURL(file);

        // ✅ Set preview immediately for editing
        element.content = objectURL;
        element.preview = objectURL;
        this.updateCurrentSlide();

        // ✅ Set permanent base64 for export
        const reader = new FileReader();
        reader.onload = (event) => {
            element.content = event.target.result; // base64
        };
        reader.readAsDataURL(file);
    };

    input.click();
}



    setSlideBackgroundColor() {
        const color = document.getElementById('slideBgColor').value;
        const slide = this.slides[this.currentSlideIndex];
    
        if (!slide.customStyle) {
            slide.customStyle = {};
        }
    
        // Clear theme so it doesn't override custom background
        slide.theme = null;
    
        slide.customStyle.backgroundColor = color;
       scheduleUIUpdate(); // Make sure both thumbnail and slide update
    }

    applyGradientFill() {
        const selectedElement = document.querySelector('.slide-element.selected');
        if (!selectedElement) {
            alert('Please select a shape first!');
            return;
        }

        const gradient = 'linear-gradient(45deg, #ff9a9e, #fad0c4)';
        selectedElement.style.backgroundImage = gradient;
        selectedElement.style.backgroundSize = 'cover';
        selectedElement.style.backgroundRepeat = 'no-repeat';
        selectedElement.style.backgroundColor = 'transparent';

        const elementId = parseInt(selectedElement.dataset.elementId || selectedElement.dataset.id);
        const shape = this.slides[this.currentSlideIndex].elements.find(el => el.id === elementId);
        if (shape) {
            shape.backgroundImage = gradient;
            shape.backgroundType = 'gradient';
            shape.fillColor = null;
            shape.gradient = gradient;
        }

       scheduleSlidesListUpdate();
       scheduleUIUpdate();
    }


uploadImageFill() {
    const selectedElement = document.querySelector('.slide-element.selected');
    if (!selectedElement) {
        alert('Please select a shape first!');
        return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = (event) => {
            const imageURL = event.target.result;
            selectedElement.style.backgroundImage = `url('${imageURL}')`;
            selectedElement.style.backgroundSize = 'cover';
            selectedElement.style.backgroundRepeat = 'no-repeat';
            selectedElement.style.backgroundColor = 'transparent';

            const id = parseInt(selectedElement.dataset.elementId || selectedElement.dataset.id);
            const shape = this.slides[this.currentSlideIndex].elements.find(el => el.id === id);
            if (shape) {
                shape.backgroundImage = `url('${imageURL}')`;
                shape.fillColor = null;
            }

           scheduleSlidesListUpdate();
        };

        const objectURL = URL.createObjectURL(file);

    };

    input.click();
}


applyFillToShape() {
    const selected = document.querySelector('.slide-element.selected');
    if (!selected || !selected.classList.contains('shape')) {
        alert("Select a shape first.");
        return;
    }

    const color = document.getElementById('fillColorPicker').value;
    const gradient = document.getElementById('gradientSelect').value;
    const shapeId = parseInt(selected.dataset.elementId || selected.dataset.id, 10);
    const shapeData = this.slides[this.currentSlideIndex].elements.find(el => el.id === shapeId);

    if (!shapeData) return;

    if (gradient) {
        selected.style.backgroundImage = gradient;
        selected.style.backgroundColor = 'transparent';
        shapeData.backgroundImage = gradient;
        shapeData.fillColor = null;
    } else {
        selected.style.backgroundImage = 'none';
        selected.style.backgroundColor = color;
        shapeData.backgroundImage = null;
        shapeData.fillColor = color;
    }

   scheduleSlidesListUpdate();
}


    // addCodeBlock() {
    //     const language = prompt("Enter language (e.g., javascript, html, css):", "javascript");
    //     if (!language) return;
    
    //     const codeContent = prompt("Paste your code here:");
    //     if (!codeContent) return;
    
    //     const element = {
    //         type: 'code',
    //         language: language,
    //         content: codeContent,
    //         x: 100,
    //         y: 100,
    //         width: 400,
    //         height: 200,
    //         id: Date.now(),
    //         zIndex: 1
    //     };
    
    //     this.slides[this.currentSlideIndex].elements.push(element);
    //    scheduleUIUpdate();
    // }

    

applyTextCase(caseType) {
    const selected = document.querySelectorAll('.slide-element.selected.text-element');

    selected.forEach(el => {
        const content = el.querySelector('.text-content');
        if (!content) return;

        const selection = window.getSelection();
        const isInside = selection && selection.anchorNode && content.contains(selection.anchorNode);

        if (isInside && !selection.isCollapsed) {
            // ✅ Change only selected text
            const range = selection.getRangeAt(0);
            const selectedText = range.toString();

            if (!selectedText) return;

            const transformedText = caseType === 'uppercase' ?
                selectedText.toUpperCase() :
                selectedText.toLowerCase();

            // Replace selected text
            range.deleteContents();
            range.insertNode(document.createTextNode(transformedText));
        } else {
            // ✅ No selection — change entire element text
            if (caseType === 'uppercase') {
                content.innerText = content.innerText.toUpperCase();
            } else if (caseType === 'lowercase') {
                content.innerText = content.innerText.toLowerCase();
            }
        }

        // ✅ Update model
        const elementId = parseInt(el.dataset.elementId);
        const model = this.slides[this.currentSlideIndex].elements.find(e => e.id === elementId);
        if (model) {
            model.content = content.innerHTML;  // ✅ Save HTML content
        }
    });

   scheduleSlidesListUpdate();
}

// ✅ Ensure saveState only once when adding text
addTextElement(content = 'click to add text', x = 100, y = 100) {
    const element = {
        type: 'text',
        content: content,
        x: x,
        y: y,
        width: 300,
        height: 80,
        isPlaceholder: true,
        style: {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#000000',
            fontWeight: 'normal',
            fontStyle: 'normal'
        },
        id: Date.now(),
        zIndex: this.getNextZIndex()
    };

    this.slides[this.currentSlideIndex].elements.push(element);
    scheduleUIUpdate();
    this.saveState(); // ✅ Save state after one insert only
}



    getNextZIndex() {
    const elements = this.slides[this.currentSlideIndex].elements;
    return elements.length ? Math.max(...elements.map(el => el.zIndex || 0)) + 1 : 1;
}


   
   addImageElement() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';

  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const objectURL = URL.createObjectURL(file); // fast preview

    const element = {
      type: 'image',
      content: objectURL,   // temporary blob (gets replaced below)
      preview: objectURL,   // used during editing
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      zIndex: this.getNextZIndex?.() || 1,
      id: Date.now()
    };

    this.slides[this.currentSlideIndex].elements.push(element);
    scheduleUIUpdate();

    // ✅ Use FileReader to permanently store base64 into `.content`
    const reader = new FileReader();
    reader.onload = (event) => {
      element.content = event.target.result; // base64 string
    };
    reader.readAsDataURL(file);
  };
  input.click();
  this.saveState();
}




addDroppedMedia(type, src, x, y) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const element = {
        id,
        type,
        x,
        y,
        src,
        width: 120,
        height: 120,
        flip: { horizontal: false, vertical: false }
    };

    this.slides[this.currentSlideIndex].elements.push(element);

    const el = document.createElement('div');
    el.className = `slide-element url-link-element`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${element.width}px`;
    el.style.height = `${element.height}px`;
    el.dataset.elementId = element.id;

    // Create clickable link
    el.innerHTML = `
        <a href="${src}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; background: #f0f0f0; border: 1px solid #ccc; border-radius: 8px; text-decoration: none;">
            🔗 Open Link
        </a>
    `;

    this.currentSlideElement.appendChild(el);
    this.saveState?.();
}





   applyShadowToElement() {
    const selectedElements = document.querySelectorAll('.slide-element.selected');
    if (!selectedElements.length) {
        alert('Please select one or more elements or highlight text to apply shadow.');
        return;
    }

    const color = document.getElementById('shadowColor').value;
    const blur = document.getElementById('shadowBlur').value;
    const offsetX = document.getElementById('shadowOffsetX').value;
    const offsetY = document.getElementById('shadowOffsetY').value;
    const shadowStyle = `${offsetX}px ${offsetY}px ${blur}px ${color}`;
    const selection = window.getSelection();

    selectedElements.forEach(selectedElement => {
        const contentDiv = selectedElement.querySelector('.text-content[contenteditable]');

        // ✅ If it's a textbox with selected text
        if (
            contentDiv &&
            selection.rangeCount > 0 &&  
            contentDiv.contains(selection.anchorNode)
        ) {
            const range = selection.getRangeAt(0);
            const selectedText = range.toString();

            if (!selectedText.trim()) {
                // Skip whitespace-only selections
                return;
            }

            const span = document.createElement('span');
            span.style.textShadow = shadowStyle;

            try {
                range.surroundContents(span);
            } catch (e) {
                alert('Cannot apply shadow on partially selected elements. Try selecting plain text only.');
                return;
            }

            // Save to data model
            const id = selectedElement.dataset.elementId;
            const slide = this.slides[this.currentSlideIndex];
            const element = slide.elements.find(el => el.id == id);
            if (element) {
                element.content = contentDiv.innerHTML;
                this.saveState();
               scheduleSlidesListUpdate();
            }
        }

        // ✅ If it's a non-text element (image, shape)
        // else {
        //     selectedElement.style.boxShadow = shadowStyle;

        //     const id = selectedElement.dataset.elementId;
        //     const slide = this.slides[this.currentSlideIndex];
        //     const element = slide.elements.find(el => el.id == id);
        //     if (element) {
        //         element.style = element.style || {};
        //         element.style.boxShadow = shadowStyle;
        //         this.saveState();
        //        scheduleSlidesListUpdate();
        //     }
        // }
    });
}


    
clearShadowFromElement() {
    const selectedElement = document.querySelector('.slide-element.selected');
    if (!selectedElement) {
        alert('Please select an element to clear shadow.');
        return;
    }

    const contentDiv = selectedElement.querySelector('.text-content[contenteditable]');
    const selection = window.getSelection();

    // ✅ Case: Selected text inside a textbox
    if (
        contentDiv &&
        selection.rangeCount > 0 &&
        !selection.isCollapsed &&
        contentDiv.contains(selection.anchorNode)
    ) {
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        if (!selectedText.trim()) {
            alert('Please select non-empty text.');
            return;
        }

        // Extract the selected text and remove it from DOM
        const extracted = range.extractContents();
        const span = document.createElement('span');
        span.textContent = selectedText;
        span.style.textShadow = 'none';

        // Insert new clean span
        range.insertNode(span);

        // ✅ Merge text if needed
        contentDiv.normalize();

        // Update model
        const id = selectedElement.dataset.elementId;
        const slide = this.slides[this.currentSlideIndex];
        const element = slide.elements.find(el => el.id == id);
        if (element) {
            element.content = contentDiv.innerHTML;
            this.saveState();
           scheduleSlidesListUpdate();
        }
    }

    // ✅ Case: For shapes/images
    else if (!contentDiv) {
        selectedElement.style.boxShadow = 'none';

        const id = selectedElement.dataset.elementId;
        const slide = this.slides[this.currentSlideIndex];
        const element = slide.elements.find(el => el.id == id);
        if (element && element.style) {
            delete element.style.boxShadow;
            this.saveState();
           scheduleSlidesListUpdate();
        }
    }
}
   
    deleteElement(index) {
           this.slides[this.currentSlideIndex].elements.splice(index, 1);
           this.saveState(); // ✅ Save after the change
         scheduleUIUpdate();
          this.updateCurrentSlide();
    }
 





// rotateSelectedElement() {
//     const selected = document.querySelector('.slide-element.selected');
//     if (!selected) return;

//     const elementId = parseInt(selected.dataset.id || selected.dataset.elementId);
//     const element = this.slides[this.currentSlideIndex].elements.find(el => el.id === elementId);
//     if (!element) return;

//     // Add rotation (15 degrees per click)
//     element.rotation = (element.rotation || 0) + 3;
//     if (element.rotation >= 360) {
//         element.rotation -= 360;
//     }

//     // Handle flip (if exists) along with rotation
//     const flip = element.flip || { horizontal: false, vertical: false };
//     const scaleX = flip.horizontal ? -1 : 1;
//     const scaleY = flip.vertical ? -1 : 1;

//     selected.style.transform = `scale(${scaleX}, ${scaleY}) rotate(${element.rotation}deg)`;
//     // Save state so it's available in downloads
//     saveState();
//     console.log(presentation.slides[presentation.currentSlideIndex].elements);

// }

rotateSelectedElement() {
    const selected = document.querySelector('.slide-element.selected');
    if (!selected) return;

    const elementId = parseInt(selected.dataset.id || selected.dataset.elementId);
    const element = this.slides[this.currentSlideIndex].elements.find(el => el.id === elementId);
    if (!element) return;

    // Rotate 3 degrees per click
    element.rotation = (element.rotation || 0) + 3;
    if (element.rotation >= 360) element.rotation -= 360;

    const flip = element.flip || { horizontal: false, vertical: false };
    const scaleX = flip.horizontal ? -1 : 1;
    const scaleY = flip.vertical ? -1 : 1;

    selected.style.transform = `scale(${scaleX}, ${scaleY}) rotate(${element.rotation}deg)`;

    // ✅ Add or update the rotation handle
    this.makeElementRotatable(selected);

    saveState();
}



//     rotateSelectedElement(elementDiv, elementModel) {
//     // Remove existing rotation handle
//     const existing = elementDiv.querySelector('.rotation-handle');
//     if (existing) existing.remove();

//     // Create new rotation handle
//     const handle = document.createElement('div');
//     handle.className = 'rotation-handle';
//     elementDiv.appendChild(handle);

//     let isRotating = false;

//     handle.addEventListener('mousedown', (e) => {
//         e.stopPropagation();
//         isRotating = true;

//         const rect = elementDiv.getBoundingClientRect();
//         elementDiv.dataset.centerX = rect.left + rect.width / 2;
//         elementDiv.dataset.centerY = rect.top + rect.height / 2;
//         document.body.style.cursor = 'grabbing';
//     });

//     const onMouseMove = (e) => {
//         if (!isRotating) return;

//         const cx = parseFloat(elementDiv.dataset.centerX);
//         const cy = parseFloat(elementDiv.dataset.centerY);
//         const dx = e.clientX - cx;
//         const dy = e.clientY - cy;

//         const angle = Math.atan2(dy, dx) * (180 / Math.PI);
//         elementModel.rotation = angle;

//         const scaleX = elementModel.flip?.horizontal ? -1 : 1;
//         const scaleY = elementModel.flip?.vertical ? -1 : 1;

//         elementDiv.style.transform = `scale(${scaleX}, ${scaleY}) rotate(${angle}deg)`;
//     };

//     const onMouseUp = () => {
//         if (isRotating) {
//             isRotating = false;
//             document.body.style.cursor = 'default';
//             if (typeof presentation.saveState === 'function') {
//                 presentation.saveState();
//             }
//         }
//     };

//     document.addEventListener('mousemove', onMouseMove);
//     document.addEventListener('mouseup', onMouseUp);
// }

    
    


   addChart() {
        const modal = document.getElementById('chartModal');
        const datasetContainer = document.getElementById('datasetContainer');
        const chartTypeInput = document.getElementById('chartType');
        const createBtn = document.getElementById('createChartBtn');
        const cancelBtn = document.getElementById('cancelChartBtn');
        const addDatasetBtn = document.getElementById('addDatasetBtn');
        const previewCanvas = document.getElementById('chartPreview');
        let previewChart = null;
        this.chartEditMode= 'add';
    
        datasetContainer.innerHTML = '';
    
        const renderPreview = () => {
            const allLabels = new Set();
            const datasets = [];
    
            datasetContainer.querySelectorAll('.dataset').forEach(datasetDiv => {
                const name = datasetDiv.querySelector('.dataset-name').value;
                const color = datasetDiv.querySelector('.dataset-color').value;
                const labels = Array.from(datasetDiv.querySelectorAll('.data-label')).map(el => el.value);
                const values = Array.from(datasetDiv.querySelectorAll('.data-value')).map(el => parseFloat(el.value));
    
                labels.forEach(l => allLabels.add(l));
    
                datasets.push({
                    label: name,
                    backgroundColor: color,
                    borderColor: color,
                    fill: chartTypeInput.value !== 'line',
                    data: { labels, values }
                });
            });
    
            const sortedLabels = [...allLabels];
            const formattedDatasets = datasets.map(ds => ({
                label: ds.label,
                backgroundColor: ds.backgroundColor,
                borderColor: ds.borderColor,
                fill: ds.fill,
                data: sortedLabels.map(l => {
                    const idx = ds.data.labels.indexOf(l);
                    return idx !== -1 ? ds.data.values[idx] : 0;
                })
            }));
    
            if (previewChart) previewChart.destroy();
    
            previewChart = new Chart(previewCanvas.getContext('2d'), {
                type: chartTypeInput.value,
                data: {
                    labels: sortedLabels,
                    datasets: formattedDatasets
                },
                options: {
                    responsive: false,
                    maintainAspectRatio: false
                }
            });
        };
    
        const addDataset = (name = '', labels = ['Label 1', 'Label 2'], values = [10, 20], color = '#36a2eb') => {
            const datasetDiv = document.createElement('div');
            datasetDiv.className = 'dataset';
    
            datasetDiv.innerHTML = `
                <label>Dataset Name: <input type="text" class="dataset-name" value="${name}" /></label>
                <label>Color: <input type="color" class="dataset-color" value="${color}" /></label>
                <div class="data-pairs">
                    ${labels.map((label, i) => `
                        <div class="pair">
                            <input type="text" class="data-label" value="${label}" />
                            <input type="number" class="data-value" value="${values[i]}" />
                            <button class="deletePairBtn" type="button">Delete Row</button>
                        </div>
                    `).join('')}
                </div>
                <button class="addPairBtn" type="button">Add Row</button>
                <hr/>
            `;
    
            datasetDiv.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', renderPreview);
            });
    
            // Add delete row logic
            datasetDiv.querySelectorAll('.deletePairBtn').forEach(btn => {
                btn.onclick = (e) => {
                    e.target.closest('.pair').remove();
                    renderPreview();
                };
            });
    
            datasetDiv.querySelector('.addPairBtn').onclick = () => {
                const newPair = document.createElement('div');
                newPair.className = 'pair';
                newPair.innerHTML = `
                    <input type="text" class="data-label" placeholder="Label" />
                    <input type="number" class="data-value" placeholder="Value" />
                    <button class="deletePairBtn" type="button">Delete Row</button>
                `;
                datasetDiv.querySelector('.data-pairs').appendChild(newPair);
                newPair.querySelectorAll('input').forEach(input => {
                    input.addEventListener('input', renderPreview);
                });
                newPair.querySelector('.deletePairBtn').onclick = (e) => {
                    e.target.closest('.pair').remove();
                    renderPreview();
                };
            };
    
            datasetContainer.appendChild(datasetDiv);
            renderPreview();
        };
    
        chartTypeInput.addEventListener('change', renderPreview);
    
        addDataset(); // Start with one dataset
        addDatasetBtn.onclick = () => addDataset();
    
        modal.style.display = 'flex';
        
        const cleanup = () => {
            if (previewChart) {
                previewChart.destroy();
                previewChart = null;
            }
            modal.style.display = 'none';
        };
        
        cancelBtn.onclick = cleanup;
        
        createBtn.onclick = () => {
            if(this.chartEditMode !== 'add') return;
            const chartType = chartTypeInput.value;
            const finalDatasets = [];
            const allLabels = new Set();
    
            datasetContainer.querySelectorAll('.dataset').forEach(datasetDiv => {
                const name = datasetDiv.querySelector('.dataset-name').value;
                const color = datasetDiv.querySelector('.dataset-color').value;
                const labelInputs = datasetDiv.querySelectorAll('.data-label');
                const valueInputs = datasetDiv.querySelectorAll('.data-value');
    
                const data = [];
                const labels = [];
    
                labelInputs.forEach((labelInput, i) => {
                    const label = labelInput.value;
                    const value = parseFloat(valueInputs[i].value);
                    if (label && !isNaN(value)) {
                        data.push(value);
                        labels.push(label);
                        allLabels.add(label);
                    }
                });
    
                finalDatasets.push({ label: name, data, color, labels });
            });
    
            const element = {
                type: 'chart',
                chartType,
                datasets: finalDatasets,
                allLabels: [...allLabels],
                x: 100,
                y: 100,
                width: 400,
                height: 300,
                id: Date.now()
            };
    
            this.slides[this.currentSlideIndex].elements.push(element);
            if (previewChart) {
                previewChart.destroy();
                previewChart = null;
            }
            modal.style.display = 'none';
           scheduleUIUpdate();
            this.saveState(); // Save state after creating new chart
        };
    }
    
    

   editChart(chartModel) {
    if (!chartModel || !chartModel.datasets) {
        console.error('Invalid chart model provided to editChart');
        return;
    }

    this.chartEditMode = 'edit';
    this.editingChartModel = chartModel;

    const modal = document.getElementById('chartModal');
    const chartTypeInput = document.getElementById('chartType');
    const datasetContainer = document.getElementById('datasetContainer');
    const addDatasetBtn = document.getElementById('addDatasetBtn');
    const createBtn = document.getElementById('createChartBtn');
    const cancelBtn = document.getElementById('cancelChartBtn');
    const previewCanvas = document.getElementById('chartPreview');
    let previewChart = null;

    modal.style.display = 'flex';
    chartTypeInput.value = chartModel.chartType;
    datasetContainer.innerHTML = '';

    const renderPreview = () => {
        const allLabels = new Set();
        const datasets = [];

        datasetContainer.querySelectorAll('.dataset').forEach(datasetDiv => {
            const name = datasetDiv.querySelector('.dataset-name').value;
            const color = datasetDiv.querySelector('.dataset-color').value;
            const labels = Array.from(datasetDiv.querySelectorAll('.data-label')).map(el => el.value);
            const values = Array.from(datasetDiv.querySelectorAll('.data-value')).map(el => parseFloat(el.value));

            labels.forEach(l => allLabels.add(l));

            datasets.push({
                label: name,
                backgroundColor: color,
                borderColor: color,
                fill: chartTypeInput.value !== 'line',
                data: { labels, values }
            });
        });

        const sortedLabels = [...allLabels];
        const formattedDatasets = datasets.map(ds => ({
            label: ds.label,
            backgroundColor: ds.backgroundColor,
            borderColor: ds.borderColor,
            fill: ds.fill,
            data: sortedLabels.map(l => {
                const idx = ds.data.labels.indexOf(l);
                return idx !== -1 ? ds.data.values[idx] : 0;
            })
        }));

        if (previewChart) previewChart.destroy();

        previewChart = new Chart(previewCanvas.getContext('2d'), {
            type: chartTypeInput.value,
            data: {
                labels: sortedLabels,
                datasets: formattedDatasets
            },
            options: {
                responsive: false,
                maintainAspectRatio: false
            }
        });
    };

    const addDataset = (name = '', labels = ['Label 1'], values = [10], color = '#36a2eb') => {
        const datasetDiv = document.createElement('div');
        datasetDiv.className = 'dataset';

        datasetDiv.innerHTML = `
            <label>Dataset Name: <input type="text" class="dataset-name" value="${name}" /></label>
            <label>Color: <input type="color" class="dataset-color" value="${color}" /></label>
            <div class="data-pairs">
                ${labels.map((label, i) => `
                    <div class="pair">
                        <input type="text" class="data-label" value="${label}" />
                        <input type="number" class="data-value" value="${values[i]}" />
                        <button class="deletePairBtn" type="button">Delete Row</button>
                    </div>
                `).join('')}
            </div>
            <button class="addPairBtn" type="button">Add Row</button>
            <hr/>
        `;

        datasetDiv.querySelectorAll('input').forEach(input => input.addEventListener('input', renderPreview));

        datasetDiv.querySelectorAll('.deletePairBtn').forEach(btn => {
            btn.onclick = (e) => {
                e.target.closest('.pair').remove();
                renderPreview();
            };
        });

        datasetDiv.querySelector('.addPairBtn').onclick = () => {
            const pair = document.createElement('div');
            pair.className = 'pair';
            pair.innerHTML = `
                <input type="text" class="data-label" placeholder="Label" />
                <input type="number" class="data-value" placeholder="Value" />
                <button class="deletePairBtn" type="button">Delete Row</button>
            `;
            datasetDiv.querySelector('.data-pairs').appendChild(pair);
            pair.querySelectorAll('input').forEach(input => input.addEventListener('input', renderPreview));
            pair.querySelector('.deletePairBtn').onclick = (e) => {
                e.target.closest('.pair').remove();
                renderPreview();
            };
        };

        datasetContainer.appendChild(datasetDiv);
        renderPreview();
    };

    chartModel.datasets.forEach(ds => {
        addDataset(ds.label, ds.labels, ds.data, ds.color);
    });

    addDatasetBtn.onclick = () => addDataset();

    chartTypeInput.addEventListener('change', renderPreview);

    const cleanup = () => {
        if (previewChart) previewChart.destroy();
        previewChart = null;
        modal.style.display = 'none';
        datasetContainer.innerHTML = '';
        this.chartEditMode = null;
        this.editingChartModel = null;
    };

    cancelBtn.onclick = cleanup;

    createBtn.onclick = () => {
        const newDatasets = [];
        const allLabels = new Set();

        datasetContainer.querySelectorAll('.dataset').forEach(datasetDiv => {
            const name = datasetDiv.querySelector('.dataset-name').value;
            const color = datasetDiv.querySelector('.dataset-color').value;
            const labelInputs = datasetDiv.querySelectorAll('.data-label');
            const valueInputs = datasetDiv.querySelectorAll('.data-value');

            const labels = [];
            const values = [];

            labelInputs.forEach((input, i) => {
                const label = input.value;
                const value = parseFloat(valueInputs[i].value);
                if (label && !isNaN(value)) {
                    labels.push(label);
                    values.push(value);
                    allLabels.add(label);
                }
            });

            newDatasets.push({ label: name, data: values, labels, color });
        });

        if (this.chartEditMode === 'edit' && this.editingChartModel) {
            this.editingChartModel.chartType = chartTypeInput.value;
            this.editingChartModel.datasets = newDatasets;
            this.editingChartModel.allLabels = [...allLabels];
        }

        cleanup();
       scheduleUIUpdate();
        this.saveState();
    };
}

    
    
    
   editTable(tableModel) {
    if (!tableModel || !tableModel.content) {
        console.error('Invalid table model');
        return;
    }

    // ✅ Extract existing cell content from HTML
    const cellContentMap = {};
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(tableModel.content, 'text/html');
        const rows = doc.querySelectorAll('table tr');
        rows.forEach((row, r) => {
            const cells = row.querySelectorAll('th, td');
            cells.forEach((cell, c) => {
                cellContentMap[`${r}-${c}`] = cell.innerHTML;
            });
        });
    } catch (err) {
        console.warn('Error parsing table content:', err);
    }

    const dialog = document.createElement('div');
    dialog.className = 'table-dialog';
    dialog.innerHTML = `
        <div class="table-dialog-content">
            <h3>Edit Table</h3>
            <div class="table-inputs">
                <div class="input-group"><label for="tableRows">Rows:</label><input type="number" id="tableRows" min="1" max="20" value="${tableModel.rows}"></div>
                <div class="input-group"><label for="tableCols">Columns:</label><input type="number" id="tableCols" min="1" max="20" value="${tableModel.cols}"></div>
                <div class="input-group"><label for="tableBorderColor">Border Color:</label><input type="color" id="tableBorderColor" value="${tableModel.borderColor}"></div>
                <div class="input-group"><label for="tableBorderWidth">Border Width:</label><input type="number" id="tableBorderWidth" min="1" max="5" value="${tableModel.borderWidth}"></div>
                <div class="input-group"><label for="tableBorderStyle">Border Style:</label><select id="tableBorderStyle">
                    <option value="solid" ${tableModel.borderStyle === 'solid' ? 'selected' : ''}>Solid</option>
                    <option value="dashed" ${tableModel.borderStyle === 'dashed' ? 'selected' : ''}>Dashed</option>
                    <option value="dotted" ${tableModel.borderStyle === 'dotted' ? 'selected' : ''}>Dotted</option>
                    <option value="double" ${tableModel.borderStyle === 'double' ? 'selected' : ''}>Double</option>
                </select></div>
                <div class="input-group"><label for="headerBgColor">Header Background:</label><input type="color" id="headerBgColor" value="${tableModel.headerBgColor}"></div>
                <div class="input-group"><label for="cellBgColor">Cell Background:</label><input type="color" id="cellBgColor" value="${tableModel.cellBgColor}"></div>
                <div class="input-group"><label for="headerTextColor">Header Text Color:</label><input type="color" id="headerTextColor" value="${tableModel.headerTextColor}"></div>
                <div class="input-group"><label for="cellTextColor">Cell Text Color:</label><input type="color" id="cellTextColor" value="${tableModel.cellTextColor}"></div>
            </div>
            <div class="table-dialog-buttons">
                <button id="updateTableBtn">Update</button>
                <button id="cancelTableEditBtn">Cancel</button>
            </div>
        </div>
    `;
    document.body.appendChild(dialog);

    document.getElementById('updateTableBtn').addEventListener('click', () => {
        const rows = parseInt(document.getElementById('tableRows').value);
        const cols = parseInt(document.getElementById('tableCols').value);
        const borderColor = document.getElementById('tableBorderColor').value;
        const borderWidth = document.getElementById('tableBorderWidth').value;
        const borderStyle = document.getElementById('tableBorderStyle').value;
        const headerBgColor = document.getElementById('headerBgColor').value;
        const cellBgColor = document.getElementById('cellBgColor').value;
        const headerTextColor = document.getElementById('headerTextColor').value;
        const cellTextColor = document.getElementById('cellTextColor').value;

        if (rows > 0 && cols > 0) {
            this.saveState();

            tableModel.rows = rows;
            tableModel.cols = cols;
            tableModel.borderColor = borderColor;
            tableModel.borderWidth = borderWidth;
            tableModel.borderStyle = borderStyle;
            tableModel.headerBgColor = headerBgColor;
            tableModel.cellBgColor = cellBgColor;
            tableModel.headerTextColor = headerTextColor;
            tableModel.cellTextColor = cellTextColor;

            tableModel.content = this.createTableHTML(
                rows, cols, borderColor, borderWidth, borderStyle,
                headerBgColor, cellBgColor, headerTextColor, cellTextColor,
                cellContentMap // ✅ preserve original content
            );

            scheduleUIUpdate();
        }

        document.body.removeChild(dialog);
    });

    document.getElementById('cancelTableEditBtn').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
}

    
    
    
    addTableElement() {
    const dialog = document.createElement('div');
    dialog.className = 'table-dialog';
    dialog.innerHTML = `
        <div class="table-dialog-content">
            <h3>Create Table</h3>
            <div class="table-inputs">
                <div class="input-group"><label for="tableRows">Rows:</label><input type="number" id="tableRows" min="1" max="20" value="3"></div>
                <div class="input-group"><label for="tableCols">Columns:</label><input type="number" id="tableCols" min="1" max="20" value="3"></div>
                <div class="input-group"><label for="tableBorderColor">Border Color:</label><input type="color" id="tableBorderColor" value="#000000"></div>
                <div class="input-group"><label for="tableBorderWidth">Border Width:</label><input type="number" id="tableBorderWidth" min="1" max="5" value="1"></div>
                <div class="input-group"><label for="tableBorderStyle">Border Style:</label><select id="tableBorderStyle">
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="double">Double</option>
                </select></div>
                <div class="input-group"><label for="headerBgColor">Header Background:</label><input type="color" id="headerBgColor" value="#f0f0f0"></div>
                <div class="input-group"><label for="cellBgColor">Cell Background:</label><input type="color" id="cellBgColor" value="#ffffff"></div>
                <div class="input-group"><label for="headerTextColor">Header Text Color:</label><input type="color" id="headerTextColor" value="#000000"></div>
                <div class="input-group"><label for="cellTextColor">Cell Text Color:</label><input type="color" id="cellTextColor" value="#000000"></div>
            </div>
            <div class="table-dialog-buttons">
                <button id="createTableBtn">Create</button>
                <button id="cancelTableBtn">Cancel</button>
            </div>
        </div>`;
    document.body.appendChild(dialog);

    document.getElementById('createTableBtn').addEventListener('click', () => {
        const rows = parseInt(document.getElementById('tableRows').value);
        const cols = parseInt(document.getElementById('tableCols').value);
        const borderColor = document.getElementById('tableBorderColor').value;
        const borderWidth = document.getElementById('tableBorderWidth').value;
        const borderStyle = document.getElementById('tableBorderStyle').value;
        const headerBgColor = document.getElementById('headerBgColor').value;
        const cellBgColor = document.getElementById('cellBgColor').value;
        const headerTextColor = document.getElementById('headerTextColor').value;
        const cellTextColor = document.getElementById('cellTextColor').value;

        if (rows > 0 && cols > 0) {
            const element = {
                type: 'table',
                rows, cols, borderColor, borderWidth, borderStyle,
                headerBgColor, cellBgColor, headerTextColor, cellTextColor,
                content: this.createTableHTML(rows, cols, borderColor, borderWidth, borderStyle, headerBgColor, cellBgColor, headerTextColor, cellTextColor),
                x: 100,
                y: 100,
                width: 300,
                height: 200,
                zIndex: this.getNextZIndex?.() || 1,
                id: Date.now()
            };

            this.saveState(); // support undo
            this.slides[this.currentSlideIndex].elements.push(element);
            scheduleUIUpdate();
        }

        document.body.removeChild(dialog);
    });

    document.getElementById('cancelTableBtn').addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
    this.saveState();
}


    createTableHTML(rows, cols, borderColor, borderWidth, borderStyle, headerBgColor, cellBgColor, headerTextColor, cellTextColor, cellContentMap = {}) {
    let html = '<table style="border-collapse: collapse; width: 100%; height: 100%;">';

    // Header row
    html += '<thead><tr>';
    for (let c = 0; c < cols; c++) {
        const key = `0-${c}`;
        const content = cellContentMap[key] || `Header ${c + 1}`;
        html += `<th style="
            border: ${borderWidth}px ${borderStyle} ${borderColor};
            background: ${headerBgColor};
            color: ${headerTextColor};
            padding: 4px;
            font-weight: bold;
        ">${content}</th>`;
    }
    html += '</tr></thead>';

    // Body rows
    html += '<tbody>';
    for (let r = 1; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
            const key = `${r}-${c}`;
            const content = cellContentMap[key] || '';
            html += `<td style="
                border: ${borderWidth}px ${borderStyle} ${borderColor};
                background: ${cellBgColor};
                color: ${cellTextColor};
                padding: 4px;
            ">${content}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table>';

    return html;
}


    
    

savePage() {
    localStorage.setItem('slides', JSON.stringify(this.slides));
}

loadPage() {
    const savedSlides = localStorage.getItem('slides');
    if (savedSlides) {
        this.slides = JSON.parse(savedSlides);
        this.updateCurrentSlide();
    }
}

    updateUI() {
       scheduleSlidesListUpdate();
        this.updateCurrentSlide();
    }
confirmInsertByUrl() {
    const url = document.getElementById('mediaUrl').value.trim();
    const type = document.getElementById('mediaType').value;
    const x = 100;
    const y = 100;

    if (!url) {
        alert("Please enter a valid URL.");
        return;
    }

    if ((type === 'video' && url.includes('youtube.com')) || url.includes('youtu.be')) {
        const videoId = extractYouTubeId(url);
        if (videoId) {
            const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

            const wrapper = document.createElement('div');
            wrapper.className = 'slide-element image-element';
            wrapper.dataset.type = 'youtube-thumbnail';
            wrapper.dataset.href = url;
            wrapper.style.left = `${x}px`;
            wrapper.style.top = `${y}px`;
            wrapper.style.width = `200px`;
            wrapper.style.height = `150px`;
            wrapper.style.position = 'absolute';

            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';

            const img = document.createElement('img');
            img.src = thumbnailUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            link.appendChild(img);
            wrapper.appendChild(link);

            this.currentSlideElement.appendChild(wrapper);
            this.makeElementDraggable(wrapper);
this.makeElementResizable(wrapper);
scheduleUIUpdate();
scheduleAutosave(); 


            this.slides[this.currentSlideIndex].elements.push({
                id: Date.now(),
                type: 'youtube-thumbnail',
                url,
                videoId,
                x,
                y,
                width: 200,
                height: 150
            });

           
        }
    }

    // 📸 Image
  else if   (type === 'image') {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element image-element';
    wrapper.dataset.type = 'image-thumbnail';
    wrapper.dataset.href = url;
    wrapper.style.left = `${x}px`;
    wrapper.style.top = `${y}px`;
    wrapper.style.width = `200px`;
    wrapper.style.height = `150px`;
    wrapper.style.position = 'absolute';

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';

    const img = document.createElement('img');
    img.src = url;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
       link.textContent = 'url 📸 Image';

    link.appendChild(img);
    wrapper.appendChild(link);

    this.currentSlideElement.appendChild(wrapper);
    this.makeElementDraggable(wrapper);
    // this.makeElementDraggable(wrapper);
this.makeElementResizable(wrapper);

    this.slides[this.currentSlideIndex].elements.push({
        id: Date.now(),
        type: 'image-thumbnail',
        url,
        x,
        y,
        width: 200,
        height: 150
    });

   scheduleUIUpdate();
        scheduleAutosave(); 
}


    // 🔈 Audio
    else if (type === 'audio' && url) {
    const wrapper = document.createElement('div');
    wrapper.className = 'slide-element image-element';
    wrapper.dataset.type = 'audio-thumbnail';
    wrapper.dataset.href = url;
    wrapper.style.left = `${x}px`;
    wrapper.style.top = `${y}px`;
    wrapper.style.width = `200px`;
    wrapper.style.height = `150px`;
    wrapper.style.position = 'absolute';

    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';

    const img = document.createElement('img');
    img.src = `https://www.google.com/s2/favicons?domain=${(new URL(url)).hostname}&sz=128`;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';

    link.appendChild(img);
    wrapper.appendChild(link);
    this.currentSlideElement.appendChild(wrapper);
    this.makeElementDraggable(wrapper);
this.makeElementResizable(wrapper);


    // Add to data model
    this.slides[this.currentSlideIndex].elements.push({
        id: Date.now(),
        type: 'audio-thumbnail',
        url,
        x,
        y,
        width: 200,
        height: 150
    });

  scheduleUIUpdate();
        scheduleAutosave(); 
    document.getElementById('urlInsertModal').style.display = 'none';
    this.makeElementResizable();
    this.makeElementDraggable();
    this.makeElementRotatable();
    return; // 🔁 skip calling addDroppedMedia
}


    // 🔁 All other media types
    else {
        this.addDroppedMedia(type, url, x, y);
    }

    document.getElementById('urlInsertModal').style.display = 'none';
    this.makeElementResizable();
}
updateSlidesList() {
    const slidesList = document.getElementById('slidesList');
    if (!slidesList) return;

    slidesList.innerHTML = '';

    const THUMBNAIL_WIDTH = 160;
    const THUMBNAIL_HEIGHT = 90;
    const SLIDE_WIDTH = 960;
    const SLIDE_HEIGHT = 540;
    const scale = Math.min(THUMBNAIL_WIDTH / SLIDE_WIDTH, THUMBNAIL_HEIGHT / SLIDE_HEIGHT);

    this.slides.forEach((slide, index) => {
        const thumbnail = document.createElement('div');
        thumbnail.className = `slide-thumbnail ${index === this.currentSlideIndex ? 'active' : ''}`;
        thumbnail.draggable = true;
        thumbnail.dataset.index = index;

        // Drag/drop logic
        thumbnail.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
            thumbnail.classList.add('dragging');
        });
        thumbnail.addEventListener('dragover', (e) => {
            e.preventDefault();
            thumbnail.classList.add('drag-over');
        });
        thumbnail.addEventListener('dragleave', () => thumbnail.classList.remove('drag-over'));
        thumbnail.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const targetIndex = parseInt(thumbnail.dataset.index);
            if (draggedIndex !== targetIndex) {
                const draggedSlide = this.slides.splice(draggedIndex, 1)[0];
                this.slides.splice(targetIndex, 0, draggedSlide);
                if (this.currentSlideIndex === draggedIndex) {
                    this.currentSlideIndex = targetIndex;
                } else if (draggedIndex < this.currentSlideIndex && targetIndex >= this.currentSlideIndex) {
                    this.currentSlideIndex--;
                } else if (draggedIndex > this.currentSlideIndex && targetIndex <= this.currentSlideIndex) {
                    this.currentSlideIndex++;
                }
                scheduleUIUpdate();
            }
            thumbnail.classList.remove('drag-over');
        });
        thumbnail.addEventListener('dragend', () => {
            document.querySelectorAll('.slide-thumbnail').forEach(el => el.classList.remove('dragging'));
        });

        thumbnail.addEventListener('click', () => {
            this.currentSlideIndex = index;
            scheduleUIUpdate();
        });

        // Apply slide background
        if (slide.customStyle?.backgroundColor) {
            thumbnail.style.background = slide.customStyle.backgroundColor;
        } else if (slide.theme) {
            thumbnail.style.background = slide.theme.backgroundImage;
            thumbnail.style.backgroundSize = 'cover';
            thumbnail.style.backgroundPosition = 'center';
            thumbnail.style.color = slide.theme.textColor;
        }

        const slideContent = document.createElement('div');
        slideContent.className = 'slide-thumbnail-content';
        slideContent.style.position = 'relative';
        slideContent.style.width = `${SLIDE_WIDTH * scale}px`;
        slideContent.style.height = `${SLIDE_HEIGHT * scale}px`;
        slideContent.style.overflow = 'hidden';

        // Slide number label
        const slideNumber = document.createElement('div');
        slideNumber.className = 'slide-number';
        slideNumber.textContent = `Slide ${index + 1}`;
        slideContent.appendChild(slideNumber);

        slide.elements.forEach(element => {
            const el = document.createElement('div');
            el.className = `mini-element mini-${element.type}`;
            el.style.position = 'absolute';
            el.style.left = `${element.x * scale}px`;
            el.style.top = `${element.y * scale}px`;
            el.style.width = `${(element.width || 100) * scale}px`;
            el.style.height = `${(element.height || 100) * scale}px`;
            el.style.zIndex = element.zIndex || 1;
            el.style.transformOrigin = 'center center'; // ✅ fix flip anchor

            // Handle flip and rotation
            const rotation = element.rotation || 0;
            const scaleX = element.flip?.horizontal ? -1 : 1;
            const scaleY = element.flip?.vertical ? -1 : 1;
            el.style.transform = `scale(${scaleX}, ${scaleY}) rotate(${rotation}deg)`;

            // Box shadow
            if (element.style?.boxShadow) {
                el.style.boxShadow = element.style.boxShadow;
            }

            if (element.backgroundImage) {
                el.style.backgroundImage = element.backgroundImage;
                el.style.backgroundSize = 'cover';
                el.style.backgroundRepeat = 'no-repeat';
            }

            switch (element.type) {
                case 'text':
                    el.textContent = element.content.length > 30 ? element.content.substring(0, 30) + '...' : element.content;
                    el.style.fontSize = `${Math.max(4, parseInt(element.style?.fontSize || 16) * scale)}px`;
                    el.style.fontFamily = element.style?.fontFamily || 'Arial';
                    el.style.fontWeight = element.style?.fontWeight || 'normal';
                    el.style.fontStyle = element.style?.fontStyle || 'normal';
                    el.style.color = element.style?.color || '#000';
                    el.style.textAlign = element.style?.textAlign || 'left';
                    el.style.overflow = 'hidden';
                    el.style.whiteSpace = 'nowrap';
                    el.style.textOverflow = 'ellipsis';
                    el.style.padding = '2px';
                    break;

                case 'image':
                    const img = document.createElement('img');
                    img.src = element.content;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'fill';
                    el.appendChild(img);
                    break;

               case 'shape':
    // Clear default border/box
    el.style.border = 'none';
    el.style.background = 'transparent';
    el.style.overflow = 'visible'; // Allow shape to go beyond container if needed

    // SVG rendering for complex shapes
    if (['triangle', 'star', 'arrow', 'polygon', 'diamond', 'pentagon', 'hexagon', 'cloud', 'line'].includes(element.shapeType)) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('viewBox', '0 0 100 100');

        let shape;
        if (element.shapeType === 'cloud') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            shape.setAttribute('d', 'M20 60 Q20 30 50 30 Q80 30 80 60 Q80 80 50 80 Q20 80 20 60 Z');
        } else if (element.shapeType === 'line') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            shape.setAttribute('x1', '0');
            shape.setAttribute('y1', '50');
            shape.setAttribute('x2', '100');
            shape.setAttribute('y2', '50');
        } else {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const pointsMap = {
                triangle: '50,0 100,100 0,100',
                star: '50,5 61,35 95,35 68,57 78,90 50,70 22,90 32,57 5,35 39,35',
                arrow: '0,40 60,40 60,20 100,50 60,80 60,60 0,60',
                polygon: '50,0 95,25 80,75 20,75 5,25',
                diamond: '50,0 100,50 50,100 0,50',
                pentagon: '50,0 100,38 82,100 18,100 0,38',
                hexagon: '25,0 75,0 100,50 75,100 25,100 0,50'
            };
            shape.setAttribute('points', pointsMap[element.shapeType]);
        }

        shape.setAttribute('fill', element.fillColor || 'transparent');
        shape.setAttribute('stroke', element.borderColor || '#000');
        shape.setAttribute('stroke-width', element.borderWidth || 1);

        svg.appendChild(shape);
        el.appendChild(svg);
    } else if (element.shapeType === 'circle') {
        el.style.borderRadius = '50%';
        el.style.backgroundColor = element.fillColor || 'transparent';
    } else {
        // default to filled rectangle if no specific shape
        el.style.backgroundColor = element.fillColor || 'transparent';
    }
    break;


                case 'chart':
                    el.innerHTML = '<i class="fas fa-chart-bar"></i>';
                    break;

                case 'video':
                    el.innerHTML = '<i class="fas fa-video"></i>';
                    break;

                case 'audio':
                    el.innerHTML = '<i class="fas fa-music"></i>';
                    break;

                case 'table':
                    el.innerHTML = '<i class="fas fa-table"></i>';
                    break;

                case 'code':
                    el.innerHTML = '<i class="fas fa-code"></i>';
                    break;
            }

            slideContent.appendChild(el);
        });

        thumbnail.appendChild(slideContent);
        slidesList.appendChild(thumbnail);
    });
}



    
        
    
    

    updateCurrentSlide() {
        const slide = this.slides[this.currentSlideIndex];
    const container = document.getElementById('currentSlide');
    container.innerHTML = '';

    slide.elements.forEach(el => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('slide-element', `${el.type}-element`);
        wrapper.dataset.elementId = el.id;
        wrapper.style.position = 'absolute';
        wrapper.style.left = `${el.x}px`;
        wrapper.style.top = `${el.y}px`;
        wrapper.style.width = `${el.width}px`;
        wrapper.style.height = `${el.height}px`;

        let domElement;

        switch (el.type) {
            case 'image':
                domElement = document.createElement('img');
                domElement.src = el.content || 'assets/placeholder.png'; // ✅ Use content with fallback
                domElement.style.width = '100%';
                domElement.style.height = '100%';
                domElement.draggable = false;
                domElement.style.pointerEvents = 'auto'; // ✅ fix mouse issue
                break;addDroppedMedia

            case 'video':
                domElement = document.createElement('video');
                domElement.src = el.src;
                domElement.controls = true;
                domElement.style.width = '100%';
                domElement.style.height = '100%';
                domElement.style.pointerEvents = 'auto'; // ✅ fix mouse issue
                break;

            case 'audio':
                domElement = document.createElement('audio');
                domElement.src = el.src;
                domElement.controls = true;
                domElement.style.width = '100%';
                domElement.style.height = '40px';
                domElement.style.pointerEvents = 'auto'; // ✅ fix mouse issue
                break;

            // add more cases like 'text', 'shape', 'table' if needed
        }

        if (domElement) {
            wrapper.appendChild(domElement);
            container.appendChild(wrapper);
        }
    });

    
        const currentSlideElement = document.getElementById('currentSlide');
this.currentSlideElement = currentSlideElement; // only if you need to track it


        if (!currentSlide) return;
        
        currentSlide.innerHTML = '';
        
        // const slide = this.slides[this.currentSlideIndex];
        if (!slide) return;
      
      

              
        // Apply theme if it exists
        if (slide.customStyle?.backgroundColor) {
            currentSlide.style.background = slide.customStyle.backgroundColor;
            currentSlide.style.backgroundImage = 'none'; // Remove any theme background
        } else if (slide.theme) {
            currentSlide.style.background = slide.theme.backgroundImage;
            currentSlide.style.backgroundSize = 'cover';
            currentSlide.style.backgroundPosition = 'center';
            currentSlide.style.color = slide.theme.textColor;
        } else {
            currentSlide.style.background = '#ffffff';
        }

         // Apply grid and ruler states
 
const grid = document.createElement('div');
grid.className = 'grid-overlay';
currentSlide.appendChild(grid);

if (slide.showRulers) {
const rulerH = document.createElement('div');
rulerH.className = 'ruler-horizontal';
currentSlide.appendChild(rulerH);

const rulerV = document.createElement('div');
rulerV.className = 'ruler-vertical';
currentSlide.appendChild(rulerV);
    
    currentSlide.classList.add('show-rulers');
} else {
    currentSlide.classList.remove('show-rulers');
}

if (slide.showGrid) {
    currentSlide.classList.add('show-grid');
} else {
    currentSlide.classList.remove('show-grid');
}

// ... existing code ...

if (slide.showGuides) {
    const guidesOverlay = document.createElement('div');
    guidesOverlay.className = 'guides-overlay';

    const guideH = document.createElement('div');
    guideH.className = 'guide-horizontal';

    const guideV = document.createElement('div');
    guideV.className = 'guide-vertical';

    guidesOverlay.appendChild(guideH);
    guidesOverlay.appendChild(guideV);
    currentSlide.appendChild(guidesOverlay);
}



     
        

        slide.elements.forEach(element => {
            let elementDiv;
            switch(element.type) {
                case 'image':
                    elementDiv = document.createElement('div');
                       elementDiv.className = 'slide-element image-element';
                       elementDiv.dataset.elementId = element.id;
                       const img = document.createElement('img');
                       img.src = element.content;
                       elementDiv.appendChild(img);
                       img.style.objectFit = 'contain';
                       img.style.objectFit = 'fill'; // or try 'cover' if you want aspect ratio kept while filling
                       img.style.pointerEvents = 'none';  // ✅ allow rotation/drag
                       elementDiv.style.overflow = 'visible';
                       elementDiv.style.zIndex = element.zIndex || 1;

                      this.makeElementResizable(elementDiv);
    if (element.isDuplicate) {
        const badge = document.createElement('div');
        badge.className = 'duplicate-badge';
        badge.innerText = '🔂';
        badge.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: gold;
            color: black;
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 50%;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        `;
        elementDiv.appendChild(badge);
    }
                       //     // ✅ Apply rotation transform
                           elementDiv.style.transform = `rotate(${element.rotation || 0}deg)`;
                           elementDiv.style.transformOrigin = 'center';
                       //  ✅ Add rotation handle
                           this.makeElementRotatable(elementDiv);
                       // Add link functionality
                       if (element.link) {
                           elementDiv.style.cursor = 'pointer';
                           elementDiv.style.position = 'relative';
                           
                           // Add link indicator
                           const linkIndicator = document.createElement('div');
                           linkIndicator.className = 'link-indicator';
                           linkIndicator.innerHTML = '<i class="fas fa-link"></i>';
                           linkIndicator.style.cssText = `
                               position: absolute;
                               top: 5px;
                               right: 5px;
                               background: rgba(255, 255, 255, 0.8);
                               padding: 5px;
                               border-radius: 50%;
                               z-index: 1000;
                               pointer-events: none;
                           `;
                           elementDiv.appendChild(linkIndicator);
   
                           // Handle link clicks
                           const handleClick = (e) => {
                               e.preventDefault();
                               e.stopPropagation();
                               
                               if (element.link.type === 'url') {
                                   window.open(element.link.url, '_blank');
                               } else if (element.link.type === 'slide') {
                                   this.currentSlideIndex = parseInt(element.link.targetSlide);
                                  scheduleUIUpdate();
                               }
                           };
   
                           // Remove any existing click listeners
                           elementDiv.removeEventListener('click', handleClick);
                           // Add the new click listener
                           elementDiv.addEventListener('click', handleClick);
   
                           // Prevent selection when clicking on linked elements
                           elementDiv.addEventListener('mousedown', (e) => {
                               if (element.link) {
                                   e.preventDefault();
                                   e.stopPropagation();
                               }
                           });
                       } else {
                           // Only add selection click handler if element is not a link
                           elementDiv.addEventListener('click', (e) => {
                               if (!window.getSelection().toString()) {
                                 elementDiv.focus(); // Only focus if no text is selected
                               }
                             });
                       }
                               this.makeElementDraggable(elementDiv);
                               this.makeElementResizable(elementDiv);
                               currentSlide.appendChild(elementDiv);
                       break;
               
case 'text':
        elementDiv = document.createElement('div');
        elementDiv.className = 'slide-element text-element';
        elementDiv.dataset.elementId = element.id;
        
        // Create inner container for text content
        const textContainer = document.createElement('div');
        textContainer.className = 'text-content';
        textContainer.contentEditable = true;
        textContainer.innerHTML = element.content || 'click to add text';
        elementDiv.appendChild(textContainer);

        // Apply styles to the container
      // Ensure default textAlign if not set
if (!element.style) element.style = {};
if (!element.style.textAlign) element.style.textAlign = 'center'; // ✅ Force default center

Object.assign(textContainer.style, element.style);

element.style?.textAlign || 'center'
        elementDiv.style.position = 'absolute';
        elementDiv.style.left = `${element.x}px`;
        elementDiv.style.top = `${element.y}px`;
        elementDiv.style.userSelect = 'none'; // Prevent selection of outer div
        elementDiv.style.cursor = 'move';
        textContainer.style.userSelect = 'text'; // Allow text selection in inner div
        textContainer.style.cursor = 'text';
        textContainer.style.whiteSpace = 'pre-wrap';     // Allows wrapping
        textContainer.style.wordBreak = 'break-word';    // Breaks long words
        textContainer.style.overflow = 'hidden';         // Prevents scrollbars
        textContainer.style.textOverflow = 'ellipsis';   // Adds "..." if overflowed
        textContainer.style.display = 'block';
        textContainer.style.width = '100%';
        textContainer.style.height = '100%';
        textContainer.style.boxSizing = 'border-box';    // Ensures padding doesn't cause overflow
           // ✅ Add 🔂 badge if duplicate
    if (element.isDuplicate) {
        const badge = document.createElement('div');
        badge.className = 'duplicate-badge';
        badge.innerText = '🔂';
        badge.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: gold;
            color: black;
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 50%;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        `;
        elementDiv.appendChild(badge);
    }

        // Handle text selection and cursor placement
        textContainer.addEventListener('mousedown', (e) => {
            // Only handle left click (button 0)
            if (e.button !== 0) return;
            
            e.stopPropagation();
            elementDiv.classList.add('selected');
            
            // Ensure the text container gets focus
            textContainer.focus();
            
            // Use a timeout to ensure the focus is set before placing cursor
            setTimeout(() => {
                // Place cursor at click position
                const range = document.createRange();
                const sel = window.getSelection();
                
                // Get click coordinates relative to the text container
                const rect = textContainer.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Find the closest text node and offset
                let closestNode = null;
                let closestOffset = 0;
                let minDistance = Infinity;
                
                const walk = document.createTreeWalker(textContainer, NodeFilter.SHOW_TEXT);
                let node;
                while (node = walk.nextNode()) {
                    const nodeRect = node.getBoundingClientRect();
                    const nodeX = nodeRect.left - rect.left;
                    const nodeY = nodeRect.top - rect.top;
                    const distance = Math.sqrt(Math.pow(x - nodeX, 2) + Math.pow(y - nodeY, 2));
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestNode = node;
                        closestOffset = Math.min(
                            Math.round((x - nodeX) / (nodeRect.width / node.length)),
                            node.length
                        );
                    }
                }
                
                if (closestNode) {
                    range.setStart(closestNode, closestOffset);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }, 10);
        });
        
        // Add click handler for left clicks to ensure cursor placement
        textContainer.addEventListener('click', (e) => {
            // Only handle left click (button 0)
            if (e.button !== 0) return;
            
            e.stopPropagation();
            elementDiv.classList.add('selected');
            
            // Ensure the text container gets focus
            textContainer.focus();
            
            // Use a timeout to ensure the focus is set before placing cursor
            setTimeout(() => {
                // If no selection exists, place cursor at click position
                const sel = window.getSelection();
                if (sel.rangeCount === 0) {
                    const range = document.createRange();
                    
                    // Get click coordinates relative to the text container
                    const rect = textContainer.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    
                    // Find the closest text node and offset
                    let closestNode = null;
                    let closestOffset = 0;
                    let minDistance = Infinity;
                    
                    const walk = document.createTreeWalker(textContainer, NodeFilter.SHOW_TEXT);
                    let node;
                    while (node = walk.nextNode()) {
                        const nodeRect = node.getBoundingClientRect();
                        const nodeX = nodeRect.left - rect.left;
                        const nodeY = nodeRect.top - rect.top;
                        const distance = Math.sqrt(Math.pow(x - nodeX, 2) + Math.pow(y - nodeY, 2));
                        
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestNode = node;
                            closestOffset = Math.min(
                                Math.round((x - nodeX) / (nodeRect.width / node.length)),
                                node.length
                            );
                        }
                    }
                    
                    if (closestNode) {
                        range.setStart(closestNode, closestOffset);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            }, 10);
        });
        
        // Prevent right-click from placing cursor
        // textContainer.addEventListener('contextmenu', (e) => {
        //     e.preventDefault();
        //     e.stopPropagation();
        //     // Don't place cursor on right-click
        // });
        
        // Handle keyboard events
        textContainer.addEventListener('keydown', (e) => {
            // Allow backspace and delete to work normally when editing text
            if (e.key === 'Backspace' || e.key === 'Delete') {
                // Only prevent default if there's no text selected and we're at the start of the text
                if (!window.getSelection().toString() && 
                    e.key === 'Backspace' && 
                    textContainer.textContent.length > 0 && 
                    window.getSelection().anchorOffset === 0) {
                    e.stopPropagation(); // Prevent the element from being deleted
                }
                return;
            }

            // Handle other keyboard shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        document.execCommand('bold', false, null);
                        break;
                    case 'i':
                        e.preventDefault();
                        document.execCommand('italic', false, null);
                        break;
                    case 'u':
                        e.preventDefault();
                        document.execCommand('underline', false, null);
                        break;
                }
            }
        });
        
        // Save content on blur
        textContainer.addEventListener('blur', () => {
            element.content = textContainer.innerHTML;
            element.style = {
                fontSize: textContainer.style.fontSize,
                fontFamily: textContainer.style.fontFamily,
                color: textContainer.style.color,
                fontWeight: textContainer.style.fontWeight,
                fontStyle: textContainer.style.fontStyle
            };
           scheduleSlidesListUpdate();
        });

        // Handle drag start
        elementDiv.addEventListener('mousedown', (e) => {
            // Only start drag if clicking the outer div, not the text content
            if (e.target === elementDiv) {
                e.stopPropagation();
                const isMulti = e.ctrlKey || e.metaKey;

                if (!isMulti) {
                    document.querySelectorAll('.slide-element.selected').forEach(el => {
                        if (el !== elementDiv) el.classList.remove('selected');
                    });
                }
                elementDiv.classList.add('selected');
            }
        });
  //  ✅ Add rotation handle
 scheduleSlidesListUpdate();

                        this.makeElementRotatable(elementDiv);
                    // Add link functionality
                    if (element.link) {
                        elementDiv.style.cursor = 'pointer';
                        elementDiv.style.position = 'relative';
                        
                        // Add link indicator
                        const linkIndicator = document.createElement('div');
                        linkIndicator.className = 'link-indicator';
                        linkIndicator.innerHTML = '<i class="fas fa-link"></i>';
                        linkIndicator.style.cssText = `
                            position: absolute;
                            top: 5px;
                            right: 5px;
                            background: rgba(255, 255, 255, 0.8);
                            padding: 5px;
                            border-radius: 50%;
                            z-index: 1000;
                            pointer-events: none;
                        `;
                        elementDiv.appendChild(linkIndicator);

                        // Handle link clicks
                        const handleClick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            if (element.link.type === 'url') {
                                window.open(element.link.url, '_blank');
                            } else if (element.link.type === 'slide') {
                                this.currentSlideIndex = parseInt(element.link.targetSlide);
                               scheduleUIUpdate();
                            }
                        };

                        // Remove any existing click listeners
                        elementDiv.removeEventListener('click', handleClick);
                        // Add the new click listener
                        elementDiv.addEventListener('click', handleClick);

                        // Prevent selection when clicking on linked elements
                        elementDiv.addEventListener('mousedown', (e) => {
                            if (element.link) {
                                e.preventDefault();
                                e.stopPropagation();
                            }
                        });
                    } else {
                        // Only add selection click handler if element is not a link
                        elementDiv.addEventListener('click', (e) => {
                            if (!window.getSelection().toString()) {
                              elementDiv.focus(); // Only focus if no text is selected
                            }
                          });
                    }
    //   (function bindTextEvents(element, textContainer) {
    // const PLACEHOLDER_TEXTS = ['Click to add title', 'Click to add subtitle', 'Click to add text'];
(function bindTextEvents(element, textContainer) {
    const PLACEHOLDER_MAP = {
    'Click to add title': 'Click to add title',
    'Click to add subtitle': 'Click to add subtitle',
    'Click to add text': 'Click to add text'
};

// const placeholder = PLACEHOLDER_MAP[element.subtype || 'text'];

    textContainer.addEventListener('focus', function () {
        if (element.isPlaceholder) {
            this.innerText = '';
            element.isPlaceholder = true;
        }else {
            element.isPlaceholder = false;
        }

    });

    textContainer.addEventListener('blur', function () {
        if (this.innerText.trim() === '') {
            this.innerText = PLACEHOLDER_MAP[element.type] || '';
            //  this.innerText = element.content;  // ✅ Reset to the original content placeholder
            element.isPlaceholder = true;
        } else {
            element.isPlaceholder = false;
            //   element.content = this.innerHTML;  // ✅ Save actual user input
        }

        element.content = this.innerHTML;
        if (typeof this.updateSlidesList === 'function') {
            
           scheduleSlidesListUpdate();
        }
    });

    textContainer.addEventListener('input', function () {
        if (this.innerText.trim() === '') {
            element.isPlaceholder = true;
        } else {
            element.isPlaceholder = false;
        }
        autoResizeFont(this);
    });
})(element, textContainer);

// })(element, textContainer);



        // Auto-resize font
        const DEFAULT_FONT_SIZE = 32; // or whatever your default is
        const MIN_FONT_SIZE = 8;      // set a minimum to avoid unreadable text
// const DEFAULT_FONT_SIZE = 32;
// const MIN_FONT_SIZE = 8;

function autoResizeFont(textContent) {
    const DEFAULT_FONT_SIZE = 32;
    const MIN_FONT_SIZE = 8;

    let fontSize = parseInt(window.getComputedStyle(textContent).fontSize, 10) || DEFAULT_FONT_SIZE;
    textContent.style.fontSize = fontSize + 'px';

    while (textContent.scrollHeight > textContent.clientHeight && fontSize > MIN_FONT_SIZE) {
        fontSize -= 1;
        textContent.style.fontSize = fontSize + 'px';
    }

    if (textContent.scrollHeight > textContent.clientHeight) {
        const parent = textContent.parentElement;
        const currentHeight = parseFloat(window.getComputedStyle(parent).height) || parent.clientHeight;
        parent.style.height = (currentHeight + 10) + 'px';
    }

    if (textContent.scrollHeight > textContent.clientHeight) {
        textContent.style.overflowY = 'auto';
    } else {
        textContent.style.overflowY = 'hidden';
    }

    while (textContent.scrollHeight <= textContent.clientHeight && fontSize < DEFAULT_FONT_SIZE) {
        fontSize += 1;
        textContent.style.fontSize = fontSize + 'px';

        if (textContent.scrollHeight > textContent.clientHeight) {
            fontSize -= 1;
            textContent.style.fontSize = fontSize + 'px';
            break;
        }
    }

    // ✅ Return final font size
    return fontSize;
}
const resizeObserver = new ResizeObserver(() => {
    const updatedFontSize = autoResizeFont(textContainer);

    // 🔁 Save the updated font size into the slide state
    const elementId = textContainer.parentElement.dataset.id;
    const currentSlide = presentation.slides[presentation.currentSlideIndex];
    const element = currentSlide.elements.find(el => el.id === elementId);
 if (element) {
        element.styles.fontSize = updatedFontSize + 'px';
        isModified = true;

        // ✅ Call saveState after updating
        if (typeof presentation.saveState === 'function') {
            presentation.saveState();
        }
    
      }
    
});
resizeObserver.observe(textContainer);


        // Attach to input event
        // textContainer.addEventListener('input', function() {
        //     autoResizeFont(this);
        // });
//         textContainer.addEventListener('input', function () {
//     autoResizeFontAndScroll(this);
// });

this.updateSlidesList();

        break;
                   case 'chart':
                                const wrapper = document.createElement('div');
                                wrapper.className = 'slide-element chart-element';
                                wrapper.dataset.elementId = element.id;
                                wrapper.style.position = 'absolute';
                                wrapper.style.left = `${element.x}px`;
                                wrapper.style.top = `${element.y}px`;
                                wrapper.style.width = `${element.width}px`;
                                wrapper.style.height = `${element.height}px`;
                                elementDiv = wrapper;
                                const canvas = document.createElement('canvas');
                                canvas.width = element.width;
                                canvas.height = element.height;
                                canvas.style.width = '100%';
                                canvas.style.height = '100%';
                                wrapper.appendChild(canvas);
 if (element.isDuplicate) {
        const badge = document.createElement('div');
        badge.className = 'duplicate-badge';
        badge.innerText = '🔂';
        badge.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: gold;
            color: black;
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 50%;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        `;
        elementDiv.appendChild(badge);
    }

                                // Add resize handles
                                const positions = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
                                positions.forEach(pos => {
                                    const handle = document.createElement('div');
                                    handle.className = `resize-handle resize-${pos}`;
                                    wrapper.appendChild(handle);
                                });

                                // Add selection capability
                                wrapper.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    const isMulti = e.ctrlKey || e.metaKey;

                                    if (!isMulti) {
                                        document.querySelectorAll('.slide-element.selected').forEach(el => {
                                            if (el !== wrapper) el.classList.remove('selected');
                                        });
                                    }
                                    wrapper.classList.toggle('selected');
                                    
                                    // Update selected elements array
                                    this.selectedElements = Array.from(document.querySelectorAll('.slide-element.selected')).map(el => {
                                        const id = parseInt(el.dataset.elementId);
                                        return this.slides[this.currentSlideIndex].elements.find(elem => elem.id === id);
                                    }).filter(Boolean);
                                    
                                    this.selectedElement = this.selectedElements[this.selectedElements.length - 1] || null;
                                });

                                // Context menu is handled by the main initContextMenu() system
                            wrapper.style.transform = `rotate(${element.rotation || 0}deg)`;
                            this.makeElementRotatable(wrapper);
                                currentSlide.appendChild(wrapper);
                                // Initialize chart
                                new Chart(canvas.getContext('2d'), {
                                    type: element.chartType,
                                    data: {
                                        labels: element.allLabels,
                                        datasets: element.datasets.map(ds => ({
                                            label: ds.label,
                                            data: element.allLabels.map(l => {
                                                const idx = ds.labels.indexOf(l);
                                                return idx >= 0 ? ds.data[idx] : 0;
                                            }),
                                            backgroundColor: ds.color,
                                            borderColor: ds.color,
                                            fill: element.chartType !== 'line'
                                        }))
                                    },
                                    options: {
                                        responsive: true,
                                        maintainAspectRatio: false
                                    }
                                });


                                // Make draggable and resizable
                                this.    makeElementDraggable(wrapper);
                                this.makeElementResizable(wrapper);
                                //   this.makeElementRotatable(wrapper);

                                // Update chart on resize and save state
                                wrapper.addEventListener('mouseup', () => {
                                    const chart = Chart.getChart(canvas);
                                    if (chart) {
                                        chart.resize();
                                        
                                        // Update the element's position and size in the model
                                        const elementId = parseInt(wrapper.dataset.elementId);
                                        const element = this.slides[this.currentSlideIndex].elements.find(el => el.id === elementId);
                                        if (element) {
                                            element.x = parseInt(wrapper.style.left);
                                            element.y = parseInt(wrapper.style.top);
                                            element.width = parseInt(wrapper.style.width);
                                            element.height = parseInt(wrapper.style.height);
                                            this.saveState(); // Save state after updating position/size
                                        }
                                    }
                                });
                                break;


                    
        case 'shape':
        elementDiv = document.createElement('div');
        elementDiv.className = `slide-element shape ${element.shapeType}`;
        elementDiv.dataset.elementId = element.id;
        elementDiv.style.position = 'absolute';
        elementDiv.style.left = `${element.x}px`;
        elementDiv.style.top = `${element.y}px`;
        elementDiv.style.width = `${element.width}px`;
        elementDiv.style.height = `${element.height}px`;
        elementDiv.style.background = 'transparent';
        elementDiv.style.display = 'flex';
        elementDiv.style.justifyContent = 'center';
        elementDiv.style.alignItems = 'center';
        elementDiv.style.overflow = 'hidden';
     if (element.isDuplicate) {
        const badge = document.createElement('div');
        badge.className = 'duplicate-badge';
        badge.innerText = '🔂';
        badge.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: gold;
            color: black;
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 50%;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        `;
        elementDiv.appendChild(badge);
    }
        const fillColor = (typeof element.fillColor === 'string') ? element.fillColor : 'transparent';
        const borderColor = element.borderColor || '#000000';
        const borderWidth = element.borderWidth || '2';

        // Handle gradient fills
        if (element.backgroundType === 'gradient' && element.gradient) {
            elementDiv.style.backgroundImage = element.gradient;
            elementDiv.style.backgroundSize = 'cover';
            elementDiv.style.backgroundRepeat = 'no-repeat';
            elementDiv.style.backgroundColor = 'transparent';
        }
        // Handle image fills
         if (element.backgroundImage) {
            elementDiv.style.backgroundImage = element.backgroundImage;
            elementDiv.style.backgroundSize = 'cover';
            elementDiv.style.backgroundRepeat = 'no-repeat';
            elementDiv.style.backgroundColor = 'transparent';
        } 
        
        //updated
    
        switch (element.shapeType) {
            case 'rectangle':
                elementDiv.style.backgroundColor = fillColor;
                elementDiv.style.border = `${borderWidth}px solid ${borderColor}`;
                break;
    
            case 'circle':
                elementDiv.style.backgroundColor = fillColor;
                elementDiv.style.border = `${borderWidth}px solid ${borderColor}`;
                elementDiv.style.borderRadius = '50%';
                break;
    
            case 'triangle': {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                svg.setAttribute('viewBox', '0 0 100 100');
    
                const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', '50,0 100,100 0,100');
                shape.setAttribute('fill', fillColor);
                shape.setAttribute('stroke', borderColor);
                shape.setAttribute('stroke-width', borderWidth);
    
                svg.appendChild(shape);
                elementDiv.appendChild(svg);
                break;
            }
    
            // case 'line': {
            //     const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            //     svg.setAttribute('width', '100%');
            //     svg.setAttribute('height', '100%');
            //     svg.setAttribute('viewBox', '0 0 100 100');
    
            //     const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            //     line.setAttribute('x1', '0');
            //     line.setAttribute('y1', '50');
            //     line.setAttribute('x2', '100');
            //     line.setAttribute('y2', '50');
            //     line.setAttribute('stroke', borderColor);
            //     line.setAttribute('stroke-width', '2');
    
            //     svg.appendChild(line);
            //     elementDiv.appendChild(svg);
            //     break;
            // }
    
            case 'arrow': {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                svg.setAttribute('viewBox', '0 0 100 100');
    
                const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', '0,40 60,40 60,20 100,50 60,80 60,60 0,60');
                shape.setAttribute('fill', fillColor);
                shape.setAttribute('stroke', borderColor);
                shape.setAttribute('stroke-width', borderWidth);
    
                svg.appendChild(shape);
                elementDiv.appendChild(svg);
                break;
            }
    
            case 'polygon': {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                svg.setAttribute('viewBox', '0 0 100 100');

                const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', '50,0 95,25 80,75 20,75 5,25');
                shape.setAttribute('fill', fillColor);
                shape.setAttribute('stroke', borderColor);
                shape.setAttribute('stroke-width', borderWidth);

                svg.appendChild(shape);
                elementDiv.appendChild(svg);
                break;
            }
    
            case 'diamond': {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                svg.setAttribute('viewBox', '0 0 100 100');
    
                const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', '50,0 100,50 50,100 0,50');
                shape.setAttribute('fill', fillColor);
                shape.setAttribute('stroke', borderColor);
                shape.setAttribute('stroke-width', borderWidth);
    
                svg.appendChild(shape);
                elementDiv.appendChild(svg);
                break;
            }
    
            case 'pentagon': {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                svg.setAttribute('viewBox', '0 0 100 100');
    
                const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', '50,0 100,38 82,100 18,100 0,38');
                shape.setAttribute('fill', fillColor);
                shape.setAttribute('stroke', borderColor);
                shape.setAttribute('stroke-width', borderWidth);
    
                svg.appendChild(shape);
                elementDiv.appendChild(svg);
                break;
            }
    
            case 'hexagon': {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                svg.setAttribute('viewBox', '0 0 100 100');
    
                const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', '25,0 75,0 100,50 75,100 25,100 0,50');
                shape.setAttribute('fill', fillColor);
                shape.setAttribute('stroke', borderColor);
                shape.setAttribute('stroke-width', borderWidth);
    
                svg.appendChild(shape);
                elementDiv.appendChild(svg);
                break;
            }
    
            // case 'cloud': {
            //     const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            //     svg.setAttribute('width', '100%');
            //     svg.setAttribute('height', '100%');
            //     svg.setAttribute('viewBox', '0 0 100 100');
    
            //     const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            //     shape.setAttribute('d', 'M20 60 Q20 30 50 30 Q80 30 80 60 Q80 80 50 80 Q20 80 20 60 Z');
            //     shape.setAttribute('fill', fillColor);
            //     shape.setAttribute('stroke', borderColor);
            //     shape.setAttribute('stroke-width', borderWidth);
    
            //     svg.appendChild(shape);
            //     elementDiv.appendChild(svg);
            //     break;
            // }
    
            case 'star': {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('width', '100%');
                svg.setAttribute('height', '100%');
                svg.setAttribute('viewBox', '0 0 100 100');
    
                const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', '50,5 61,35 95,35 68,57 78,90 50,70 22,90 32,57 5,35 39,35');
                shape.setAttribute('fill', fillColor);
                shape.setAttribute('stroke', borderColor);
                shape.setAttribute('stroke-width', borderWidth);
    
                svg.appendChild(shape);
                elementDiv.appendChild(svg);
                break;
            }
        }
    
        currentSlide.appendChild(elementDiv);
        break;
                   
                    case 'Delete':
                        elementDiv = document.createElement('div');
                        elementDiv.className = 'slide-element presentation-text';
                        elementDiv.deleteObject = element.content;
                    break;
                    case 'video':
                        // Create wrapper div
                        elementDiv = document.createElement('div');
                        elementDiv.className = 'slide-element video-wrapper';
                        elementDiv.dataset.elementId = element.id;
                        elementDiv.style.position = 'absolute';
                        elementDiv.style.left = `${element.x}px`;
                        elementDiv.style.top = `${element.y}px`;
                        elementDiv.style.width = `${element.width}px`;
                        elementDiv.style.height = `${element.height}px`;
                     if (element.isDuplicate) {
        const badge = document.createElement('div');
        badge.className = 'duplicate-badge';
        badge.innerText = '🔂';
        badge.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: gold;
            color: black;
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 50%;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        `;
        elementDiv.appendChild(badge);
    }
                        // Make wrapper draggable/resizable
                        this.makeElementDraggable(elementDiv);
                        this.makeElementResizable(elementDiv);
                          this.makeElementRotatable(elementDiv);
                    
                        // Create video
                        const video = document.createElement('video');
                        video.src = element.content;
                        video.controls = true;
                        video.style.width = '100%';
                        video.style.height = '100%';
                        video.style.display = 'block';
                        video.style.pointerEvents = 'none';  // ✅ disable pointer events so drag works
                    
                        elementDiv.appendChild(video);
                        currentSlide.appendChild(elementDiv);
                    
                        // ✅ When selected, enable pointer events (so user can play/pause)
                        elementDiv.addEventListener('click', (e) => {
                            e.stopPropagation();
                            document.querySelectorAll('.slide-element').forEach(el => el.classList.remove('selected'));
                            elementDiv.classList.add('selected');
                            video.style.pointerEvents = 'auto';  // allow clicking
                        });
                    
                        break;
                    

                    
                    
                case 'audio':
                    elementDiv = document.createElement('div');
                    elementDiv.className = 'slide-element audio-element';
                    elementDiv.style.position = 'absolute';
                    elementDiv.style.left = `${element.x}px`;
                    elementDiv.style.top = `${element.y}px`;
                    elementDiv.style.width = `${element.width}px`;
                    elementDiv.style.height = `${element.height}px`;
                     if (element.isDuplicate) {
        const badge = document.createElement('div');
        badge.className = 'duplicate-badge';
        badge.innerText = '🔂';
        badge.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: gold;
            color: black;
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 50%;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        `;
        elementDiv.appendChild(badge);
    }
                    elementDiv.innerHTML = `
                        <div class="audio-wrapper">
                            <img src="${element.playButtonImage}" class="audio-play-button" alt="Play Audio">
                            <audio>
                                <source src="${element.content}" type="audio/mp3">
                                Your browser does not support the audio element.
                            </audio>
                        </div>`;
                    
                    const audioWrapper = elementDiv.querySelector('.audio-wrapper');
                    const audio = elementDiv.querySelector('audio');
                    const playButton = elementDiv.querySelector('.audio-play-button');
                    
                    // Make the element resizable
                    this.makeElementResizable(elementDiv);
                    
                    // Add play/pause functionality
                    const handleAudioClick = (e) => {
                        e.stopPropagation();
                        if (audio.paused) {
                            // Stop all other playing audio
                            document.querySelectorAll('audio').forEach(a => {
                                if (a !== audio) {
                                    a.pause();
                                    a.currentTime = 0;
                                    const btn = a.previousElementSibling;
                                    if (btn) btn.classList.remove('playing');
                                }
                            });
                            
                            audio.play().then(() => {
                                playButton.classList.add('playing');
                            }).catch(err => {
                                console.error('Audio play failed:', err);
                                alert('Failed to play audio. Please try again.');
                            });
                        } else {
                            audio.pause();
                            audio.currentTime = 0;
                            playButton.classList.remove('playing');
                        }
                    };

                    elementDiv.addEventListener('click', handleAudioClick);
                    audioWrapper.addEventListener('click', handleAudioClick);
                    playButton.addEventListener('click', handleAudioClick);
                    
                    audio.addEventListener('ended', () => {
                        playButton.classList.remove('playing');
                    });
                    break;
                case 'table':
                    elementDiv = document.createElement('div');
                    elementDiv.className = 'slide-element table-element';
                    elementDiv.innerHTML = element.content;
                    elementDiv.style.position = 'absolute';
                    elementDiv.style.left = `${element.x}px`;
                    elementDiv.style.top = `${element.y}px`;
                     if (element.isDuplicate) {
        const badge = document.createElement('div');
        badge.className = 'duplicate-badge';
        badge.innerText = '🔂';
        badge.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: gold;
            color: black;
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 50%;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        `;
        elementDiv.appendChild(badge);
    }
                    // Make table cells and headers editable
                    const cells = elementDiv.querySelectorAll('td, th');
                    cells.forEach(cell => {
                        // Enable cell editing on click
                        cell.addEventListener('click', (e) => {
                            e.stopPropagation();
                            cell.contentEditable = true;
                            cell.focus();
                        });

                        // Save changes when clicking outside or pressing Enter
                        cell.addEventListener('blur', () => {
                            cell.contentEditable = false;
                            // Update the element's content in the model
                            const tableElement = elementDiv.querySelector('table');
                            if (tableElement) {
                                element.content = tableElement.outerHTML;
                                this.updateElementInModel(elementDiv, { content: element.content });
                                this.saveState(); // Save state after table content changes
                            }
                        });

                        cell.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                cell.contentEditable = false;
                                cell.blur();
                            }
                        });
                    });

                    // Prevent table drag when editing cells
                    elementDiv.addEventListener('mousedown', (e) => {
                        if (e.target.tagName !== 'TD' && e.target.tagName !== 'TH') {
                            this.makeElementDraggable(elementDiv);
                              this.makeElementRotatable(elementDiv);
                        }
                    });
                    break;

                    case 'code':
    elementDiv = document.createElement('pre');
    elementDiv.className = 'slide-element code-element';
    const codeTag = document.createElement('code');
    codeTag.className = `language-${element.language}`;
    codeTag.textContent = element.content;
    elementDiv.appendChild(codeTag);
    Prism.highlightElement(codeTag); // Apply Prism syntax highlighting
     if (element.isDuplicate) {
        const badge = document.createElement('div');
        badge.className = 'duplicate-badge';
        badge.innerText = '🔂';
        badge.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: gold;
            color: black;
            font-size: 12px;
            padding: 2px 6px;
            border-radius: 50%;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        `;
        elementDiv.appendChild(badge);
    }
    break;

            }


// bold, italics, font fam, px, color ------------------------------------------------------------------------------------------------------------------------------
// elementDiv.addEventListener('click', (e) => {
//     e.stopPropagation();
//     document.querySelectorAll('.slide-element').forEach(el => el.classList.remove('selected'));
//     elementDiv.classList.add('selected');
//     this.selectedElementId = element.id;
// });
// elementDiv.addEventListener('click', () => {
//     // Clear other selections
//     document.querySelectorAll('.slide-element.selected').forEach(el => {
//         el.classList.remove('selected');
//         const rh = el.querySelector('.rotation-handle');
//         if (rh) rh.remove();
//     });

//     elementDiv.classList.add('selected');

//     const model = this.findElementModelFromDOM(elementDiv);
//     rotateSelectedElement(elementDiv, model);
// });



                // Add event listeners for bold and italic buttons-----------------------------------------------------
                            document.getElementById('boldText').addEventListener('click', () => {
                                if (!selectedElement || selectedElement.type !== 'text') return;

                                // Toggle bold style
                                selectedElement.isBold = !selectedElement.isBold;
                                this.updateCurrentSlide(); // Refresh the slide with the new style
                            });

                            document.getElementById('italicText').addEventListener('click', () => {
                                if (!selectedElement || selectedElement.type !== 'text') return;

                                // Toggle italic style
                                selectedElement.isItalic = !selectedElement.isItalic;
                                this.updateCurrentSlide(); // Refresh the slide with the new style
                            });


                 // Event listener for font family selection--------------------------------------------------------------
                            document.getElementById('fontFamily').addEventListener('change', (event) => {
                                if (!selectedElement || selectedElement.type !== 'text') return;

                                // Apply the selected font family
                                selectedElement.fontFamily = event.target.value;
                                this.updateCurrentSlide(); // Refresh the slide with the new font family
                            });

                            document.getElementById('borderStyle').addEventListener('change', function() {
                                // const selectedBorderStyle = this.value; // Get the selected border style
                                // if (!selectedElement) return; // Check if a text or shape element is selected
                                if (!selectedElement || selectedElement.type !== 'text') return;
                                selectedElement.borderStyle = event.target.value;
                                this.updateCurrentSlide(); // Refresh the slide with the new font family
                            });
             // Event listener for fontsize selection-------------------------------------------------------------
                                                                
                        

              // Add event listener for color picker--------------------------------------------------------------------
                            document.getElementById('colorPicker').addEventListener('input', (e) => {
                                if (!selectedElement) return; // If no element is selected, do nothing

                                const newColor = e.target.value; // Get the selected color

                                if (selectedElement.type === 'text') {
                                    // Update text color
                                    selectedElement.fillColor = newColor; // Update the model
                                    // Update the DOM for the currently selected element
                                    const textElement = [...document.querySelectorAll('.text-element')]
                                        .find(el => el.textContent === selectedElement.content); // Match the DOM element
                                    if (textElement) {
                                        textElement.style.color = newColor;
                                    }
                                } else if (selectedElement.type === 'shape') {
                                    // Update shape fill color
                                    selectedElement.fillColor = newColor; // Update the model
                                    this.updateCurrentSlide(); // Refresh the slide
                                }
                            });
                            currentSlide.appendChild(elementDiv);

// delete option---------------------------------------------------------------------------------------------------------------
                            const deleteBtn = document.createElement('btn');
                            deleteBtn.className = 'delete-button';
                            // deleteBtn.textContent = '🗑️';
                            deleteBtn.onclick = () => {
                                this.deleteElement(index);
                            };
                                //   deleteBtn.addEventListener('click', () => {
                                //       this.slides[this.currentSlideIndex].elements = this.slides[this.currentSlideIndex].elements.filter(
                                //           (el) => el.id !== element.id
                                //       );
                                //      scheduleUIUpdate();
                                //   });
                            elementDiv.appendChild(deleteBtn);

                            currentSlide.appendChild(elementDiv);  



// Rotate--------------------------------------------------------------------------------------------------------------

// Event listener for selecting an element
                        document.getElementById('currentSlide').addEventListener('click', (event) => {
                            if (event.target.classList.contains('slide-element')) {
                                // Remove selection from previously selected element
                                if (selectedElement) {
                                    selectedElement.classList.remove('selected');
                                }
                                // Mark the clicked element as selected
                                selectedElement = event.target;
                                selectedElement.classList.add('selected');
                            }
                        });


 
                            

            if (elementDiv) {
                elementDiv.dataset.id = element.id;
                elementDiv.style.left = `${element.x}px`;
                elementDiv.style.top = `${element.y}px`;
                elementDiv.style.width = element.width ? `${element.width}px` : 'auto';
                elementDiv.style.height = element.height ? `${element.height}px` : 'auto';
                elementDiv.style.zIndex = element.zIndex || 1;
                
                // Make elements selectable
                elementDiv.tabIndex = 0;
                elementDiv.addEventListener('click', () => {
                    elementDiv.focus();
                });
    
// ✅ Apply rotation + flip
const rotation = element.rotation || 0;
const flip = element.flip || { horizontal: false, vertical: false };
const scaleX = flip.horizontal ? -1 : 1;
const scaleY = flip.vertical ? -1 : 1;
elementDiv.style.transform = `scale(${scaleX}, ${scaleY}) rotate(${rotation}deg)`;
elementDiv.tabIndex = 0;
elementDiv.addEventListener('click', (e) => {
e.stopPropagation();
const isMulti = e.ctrlKey || e.metaKey;

if (!isMulti) {
document.querySelectorAll('.slide-element.selected').forEach(el => el.classList.remove('selected'));
}
elementDiv.classList.toggle('selected');

this.selectedElements = Array.from(document.querySelectorAll('.slide-element.selected')).map(el => {
const id = parseInt(el.dataset.id);
return this.slides[this.currentSlideIndex].elements.find(el => el.id === id);
});

 

this.selectedElement = this.selectedElements[this.selectedElements.length - 1] || null;
});
                // Apply saved styles
                if (element.style) {
                    Object.assign(elementDiv.style, element.style);
            }
            this.makeElementDraggable(elementDiv);
            this.makeElementResizable(elementDiv);
                  this.makeElementRotatable(elementDiv);

                // Update element position when dragged
                elementDiv.addEventListener('mouseup', () => {
                    element.x = parseInt(elementDiv.style.left);
                    element.y = parseInt(elementDiv.style.top);
                    element.width = parseInt(elementDiv.style.width);
                    element.height = parseInt(elementDiv.style.height);
                    element.zIndex = parseInt(elementDiv.style.zIndex);
                });

            currentSlide.appendChild(elementDiv);
            }
        });
    }


    
// makeElementDraggable(element) {
//         let isDragging = false;
//         let startX, startY;
//         let originalX, originalY;
    
//         element.addEventListener('mousedown', (e) => {
//             if (e.target.classList.contains('resize-handle')) return;
//             isDragging = true;
//             startX = e.clientX;
//             startY = e.clientY;
//             originalX = element.offsetLeft;
//             originalY = element.offsetTop;
//             element.style.cursor = 'grabbing';
//         });
    
//             const onMouseMove = (e) => {
//                 if (!isDragging) return;
    
//             const deltaX = e.clientX - startX;
//             const deltaY = e.clientY - startY;
    
//             element.style.left = `${originalX + deltaX}px`;
//             element.style.top = `${originalY + deltaY}px`;
            
//             // Update element position in the model
//             const elementModel = this.findElementModelFromDOM(element);
//             if (elementModel) {
//                 elementModel.x = originalX + deltaX;
//                 elementModel.y = originalY + deltaY;
//             }
//             };
    
//           const onMouseUp = () => {
//   document.removeEventListener('mousemove', onMouseMove);
//   document.removeEventListener('mouseup', onMouseUp);

//   // ✅ Save updated position and size to model
//   const elementId = parseInt(el.dataset.elementId || el.dataset.id);
//   const modelEl = this.slides[this.currentSlideIndex].elements.find(e => e.id === elementId);

//   if (modelEl) {
//     modelEl.x = parseFloat(el.style.left);
//     modelEl.y = parseFloat(el.style.top);
//     modelEl.width = parseFloat(el.style.width);
//     modelEl.height = parseFloat(el.style.height);
//   }

//   this.saveState();         // for undo
//  scheduleSlidesListUpdate();  // to refresh thumbnail preview
// };


    
//             document.addEventListener('mousemove', onMouseMove);
//             document.addEventListener('mouseup', onMouseUp);
//     }
    

// class method: makeElementDraggable(element)
makeElementDraggable(element) {
  const slide = this.currentSlideElement;
  let isDragging = false;
  let startX = 0, startY = 0;
  const initialMap = new Map(); // DOM -> { left, top, width, height }

  const onMouseDown = (e) => {
    // ignore right-clicks and clicks on resize/rotation handles
    if (e.button !== 0) return;
    if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotation-handle')) return;

    e.stopPropagation();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    // Selection logic (preserve multi-select with Shift/Ctrl)
    if (!element.classList.contains('selected') && !e.shiftKey) {
      document.querySelectorAll('.slide-element.selected').forEach(el => el.classList.remove('selected'));
      element.classList.add('selected');
    } else {
      element.classList.add('selected');
    }

    // gather selected elements
    const selectedEls = Array.from(document.querySelectorAll('.slide-element.selected'));

    // store initial positions/sizes for all selected elements
    selectedEls.forEach(el => {
      initialMap.set(el, {
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight
      });
    });

    // attach move/up
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;

    const dxRaw = e.clientX - startX;
    const dyRaw = e.clientY - startY;

    // compute allowed dx/dy range so none of selected elements leave the slide
    const selectedEls = Array.from(initialMap.keys());
    if (!selectedEls.length) return;

    const slideW = slide.clientWidth;
    const slideH = slide.clientHeight;

    // per-element min/max allowed deltas
    const minDxArr = [];
    const maxDxArr = [];
    const minDyArr = [];
    const maxDyArr = [];

    selectedEls.forEach(el => {
      const pos = initialMap.get(el);
      minDxArr.push(-pos.left); // can't move left more than this
      maxDxArr.push(slideW - (pos.left + pos.width)); // can't move right more than this
      minDyArr.push(-pos.top);
      maxDyArr.push(slideH - (pos.top + pos.height));
    });

    const minDx = Math.max(...minDxArr);
    const maxDx = Math.min(...maxDxArr);
    const minDy = Math.max(...minDyArr);
    const maxDy = Math.min(...maxDyArr);

    // clamp raw deltas into allowed range
    const dx = Math.max(minDx, Math.min(dxRaw, maxDx));
    const dy = Math.max(minDy, Math.min(dyRaw, maxDy));

    // apply to every selected element and update model
    selectedEls.forEach(el => {
      const pos = initialMap.get(el);
      const newLeft = Math.round(pos.left + dx);
      const newTop = Math.round(pos.top + dy);

      el.style.left = `${newLeft}px`;
      el.style.top = `${newTop}px`;

      // keep model in sync
      const elementId = parseInt(el.dataset.elementId || el.dataset.id);
      const modelEl = this.slides[this.currentSlideIndex].elements.find(m => m.id === elementId);
      if (modelEl) {
        modelEl.x = newLeft;
        modelEl.y = newTop;
      }
    });
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // final save for undo + thumbnail update
    this.saveState?.();
    scheduleSlidesListUpdate();
  };

  element.addEventListener('mousedown', onMouseDown);
}

    makeElementRotatable(element) {
    let isRotating = false;
    let centerX, centerY, startAngle;
    let rotationHandle;

    // Create rotation handle
    rotationHandle = document.createElement('div');
    rotationHandle.classList.add('rotation-handle');
    rotationHandle.style.width = '20px';
    rotationHandle.style.height = '20px';
    // rotationHandle.style.background = 'orange';
    rotationHandle.style.borderRadius = '50%';
    rotationHandle.style.position = 'absolute';
    rotationHandle.style.top = '-30px'; // place above element
    rotationHandle.style.left = '50%';
    rotationHandle.style.transform = 'translateX(-50%)';
    rotationHandle.style.cursor = 'grab';

    element.appendChild(rotationHandle);

    rotationHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // prevent drag
        isRotating = true;

        const rect = element.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;

        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        startAngle = Math.atan2(dy, dx) * (180 / Math.PI) - (parseFloat(element.getAttribute('data-rotation')) || 0);

        rotationHandle.style.cursor = 'grabbing';
    });

    const onMouseMove = (e) => {
        if (!isRotating) return;

        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) - startAngle;

        element.style.transform = `rotate(${angle}deg)`;
        element.setAttribute('data-rotation', angle);

        // Update element rotation in the model
        const elementModel = this.findElementModelFromDOM(element);
        if (elementModel) {
            elementModel.rotation = angle;
        }
    };

    const onMouseUp = () => {
        if (isRotating) {
            isRotating = false;
            rotationHandle.style.cursor = 'grab';
            this.saveState();
        }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

    
    
startPresentation() {
    const presentationMode = document.getElementById('presentationMode');
    if (!presentationMode) return;

    // Clear old content and listeners
    presentationMode.innerHTML = '';

    let slideContainer = document.createElement('div');
    slideContainer.className = 'presentation-slide';
    presentationMode.appendChild(slideContainer);

    const controls = document.createElement('div');
    controls.className = 'presentation-controls';
    controls.innerHTML = `
        <button id="prevSlide"><i class="fas fa-chevron-left"></i></button>
        <button id="nextSlide"><i class="fas fa-chevron-right"></i></button>
        <button id="exitPresentation"><i class="fas fa-times"></i></button>
    `;
    presentationMode.appendChild(controls);

    presentationMode.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Fullscreen entry
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();

    this.updatePresentationSlide();

    document.getElementById('prevSlide').addEventListener('click', () => this.previousSlide());
    document.getElementById('nextSlide').addEventListener('click', () => this.nextSlide());
    document.getElementById('exitPresentation').addEventListener('click', () => this.exitPresentation());

    let keyPressedRecently = false;
    const handleKeyPress = (e) => {
        if (keyPressedRecently) return;
        keyPressedRecently = true;
        setTimeout(() => keyPressedRecently = false, 100); // debounce

        switch (e.key) {
            case 'ArrowLeft':
            case 'Backspace':
            case 'p':
                e.preventDefault();
                this.previousSlide();
                break;
            case 'ArrowRight':
            case ' ':
            case 'n':
                e.preventDefault();
                this.nextSlide();
                break;
            case 'Escape':
                this.exitPresentation();
                break;
            case 'Home':
                e.preventDefault();
                this.currentSlideIndex = 0;
                this.updatePresentationSlide();
                break;
            case 'End':
                e.preventDefault();
                this.currentSlideIndex = this.slides.length - 1;
                this.updatePresentationSlide();
                break;
            case 'f':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case 'g':
                e.preventDefault();
                this.toggleGrid();
                break;
            case 'r':
                e.preventDefault();
                this.toggleRulers();
                break;
            case 'h':
                e.preventDefault();
                this.showHelp();
                break;
        }
    };

    document.addEventListener('keydown', handleKeyPress);
    this.presentationKeyListener = handleKeyPress;

    let cursorTimeout;
    const hideCursor = () => {
        presentationMode.classList.add('cursor-hidden');
    };
    const resetCursorTimeout = () => {
        presentationMode.classList.remove('cursor-hidden');
        clearTimeout(cursorTimeout);
        cursorTimeout = setTimeout(hideCursor, 3000);
    };
    presentationMode.addEventListener('mousemove', resetCursorTimeout);
    resetCursorTimeout();
}

exitPresentation() {
    const presentationMode = document.getElementById('presentationMode');
    if (!presentationMode) return;

    presentationMode.classList.remove('active');
    document.body.style.overflow = '';

    if (document.exitFullscreen) document.exitFullscreen();

    if (this.presentationKeyListener) {
        document.removeEventListener('keydown', this.presentationKeyListener);
        this.presentationKeyListener = null;
    }

    const slideContainer = presentationMode.querySelector('.presentation-slide');
    if (slideContainer) slideContainer.innerHTML = '';

    presentationMode.innerHTML = '';
}

nextSlide() {
    if (this.isNavigating) return;
    this.isNavigating = true;

    if (this.currentSlideIndex < this.slides.length - 1) {
        this.currentSlideIndex++;
        this.updatePresentationSlide();
    }

    setTimeout(() => this.isNavigating = false, 200); // debounce
}

previousSlide() {
    if (this.isNavigating) return;
    this.isNavigating = true;

    if (this.currentSlideIndex > 0) {
        this.currentSlideIndex--;
        this.updatePresentationSlide();
    }

    setTimeout(() => this.isNavigating = false, 200); // debounce
}




    updatePresentationSlide() {
       const presentationMode = document.getElementById('presentationMode');
    const slideContainer = presentationMode.querySelector('.presentation-slide');
    if (!slideContainer) return;

    const currentSlide = this.slides[this.currentSlideIndex];
    if (!currentSlide) {
        console.warn('No slide found at index', this.currentSlideIndex);
        return;
    }

    slideContainer.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'presentation-content-wrapper';
    slideContainer.appendChild(wrapper);

    const slideWidth = 960;
    const slideHeight = 540;
    const scaleX = window.innerWidth / slideWidth;
    const scaleY = window.innerHeight / slideHeight;
    const scale = Math.min(scaleX, scaleY);

    wrapper.style.width = `${slideWidth}px`;
    wrapper.style.height = `${slideHeight}px`;
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.position = 'relative';

    // ✅ Apply theme or background color
    if (currentSlide.customStyle?.backgroundColor) {
        wrapper.style.backgroundColor = currentSlide.customStyle.backgroundColor;
        wrapper.style.backgroundImage = 'none';
    } else if (currentSlide.theme) {
        if (currentSlide.theme.backgroundImage) {
            wrapper.style.backgroundImage = currentSlide.theme.backgroundImage;
            wrapper.style.backgroundSize = 'cover';
            wrapper.style.backgroundPosition = 'center';
        }
        wrapper.style.color = currentSlide.theme.textColor || '#000000';
        wrapper.style.backgroundColor = currentSlide.theme.backgroundColor || '#ffffff';
    } else {
        wrapper.style.backgroundColor = '#ffffff';
    }

    // 🧪 Debug slide number
    const debugIndex = document.createElement('div');
    debugIndex.textContent = `Slide ${this.currentSlideIndex + 1}`;
    debugIndex.style.position = 'absolute';
    debugIndex.style.top = '10px';
    debugIndex.style.left = '10px';
    debugIndex.style.fontSize = '20px';
    debugIndex.style.color = 'red';
    wrapper.appendChild(debugIndex);

    

        currentSlide.elements.forEach(element => {
            let elementDiv;
            switch(element.type) {
                case 'shape':
                    elementDiv = document.createElement('div');
                    elementDiv.className = 'slide-element presentation-shape';
                    
                    const shape = document.createElement('div');
                    shape.className = `shape ${element.shapeType}`;
                    
                    // Apply shape styles
                    if (element.style) {
                        Object.assign(shape.style, element.style);
                    }

                    // Set shape dimensions
                    shape.style.width = '100%';
                    shape.style.height = '100%';
                    
                    // Apply specific styles based on shape type
                    switch(element.shapeType) {
                        case 'rectangle':
                            shape.style.backgroundColor = element.fillColor || '#000000';
                            shape.style.border = element.borderWidth ? `${element.borderWidth}px solid ${element.borderColor || '#000000'}` : 'none';
                            break;
                        case 'circle':
                            shape.style.backgroundColor = element.fillColor || '#000000';
                            shape.style.borderRadius = '50%';
                            shape.style.border = element.borderWidth ? `${element.borderWidth}px solid ${element.borderColor || '#000000'}` : 'none';
                            break;
                        case 'triangle':
                            shape.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
                            shape.style.backgroundColor = element.fillColor || '#000000';
                            break;
                        case 'line':
                            shape.style.width = '2px';
                            shape.style.height = '100%';
                            shape.style.backgroundColor = element.fillColor || '#000000';
                            shape.style.transformOrigin = 'center';
                            break;
                        case 'arrow':
                            shape.style.clipPath = 'polygon(0% 40%, 60% 40%, 60% 20%, 100% 50%, 60% 80%, 60% 60%, 0% 60%)';
                            shape.style.backgroundColor = element.fillColor || '#000000';
                            break;
                        case 'polygon':
                            shape.style.clipPath = 'polygon(50% 0%, 95% 25%, 80% 75%, 20% 75%, 5% 25%)';
                            shape.style.backgroundColor = element.fillColor || '#000000';
                            break;
                        case 'diamond':
                            shape.style.width = '100%';
                            shape.style.height = '100%';
                            shape.style.position = 'relative';
                            shape.style.transform = 'rotate(45deg)';
                            shape.style.backgroundColor = element.fillColor || '#000000';
                            shape.style.border = element.borderWidth ? `${element.borderWidth}px solid ${element.borderColor || '#000000'}` : 'none';
                            break;
                        case 'pentagon':
                            shape.style.clipPath = 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)';
                            shape.style.backgroundColor = element.fillColor || '#000000';
                            break;
                        case 'hexagon':
                            shape.style.clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
                            shape.style.backgroundColor = element.fillColor || '#000000';
                            break;
                        case 'cloud':
                            shape.style.clipPath = 'path("M 25,60 Q 25,40 40,40 Q 55,40 55,60 Q 70,60 70,45 Q 85,45 85,60 Q 85,75 70,75 L 40,75 Q 25,75 25,60 Z")';
                            shape.style.backgroundColor = element.fillColor || '#000000';
                            break;
                        case 'star':
                            shape.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
                            shape.style.backgroundColor = element.fillColor || '#000000';
                            break;
                    }

                    // Apply rotation if specified
                    if (element.rotation) {
                        shape.style.transform = `rotate(${element.rotation}deg)`;
                            }

                    // Apply shadow if specified
                    if (element.shadow) {
                        shape.style.boxShadow = `${element.shadow.offsetX}px ${element.shadow.offsetY}px ${element.shadow.blur}px ${element.shadow.color}`;
                    }

                    elementDiv.appendChild(shape);
                    elementDiv.style.left = `${element.x}px`;
                    elementDiv.style.top = `${element.y}px`;
                    elementDiv.style.width = `${element.width}px`;
                    elementDiv.style.height = `${element.height}px`;
                    break;

                case 'text':
                    elementDiv = document.createElement('div');
                    elementDiv.className = 'slide-element presentation-text';
                    elementDiv.innerHTML = element.content; // Changed from textContent to innerHTML
                    
                    // Apply text styles
                    if (element.style) {
                        Object.assign(elementDiv.style, {
                            fontSize: element.style.fontSize || '16px',
                            fontFamily: element.style.fontFamily || 'Arial',
                            color: element.style.color || '#000000',
                            fontWeight: element.style.fontWeight || 'normal',
                            fontStyle: element.style.fontStyle || 'normal',
                            textDecoration: element.style.textDecoration || 'none',
                            textAlign: element.style.textAlign || 'left',
                            lineHeight: element.style.lineHeight || 'normal',
                            letterSpacing: element.style.letterSpacing || 'normal'
                        });
                    }
                    elementDiv.style.left = `${element.x}px`;
                    elementDiv.style.top = `${element.y}px`;
                    elementDiv.style.width = `${element.width || 'auto'}px`;
                    elementDiv.style.height = `${element.height || 'auto'}px`;
                    elementDiv.style.whiteSpace = 'pre-wrap';
                    elementDiv.style.wordBreak = 'break-word';
                    break;

             case 'image':
                    elementDiv = document.createElement('div');
                    elementDiv.className = 'slide-element presentation-image';
                    const img = document.createElement('img');
                    img.src = element.content;
                    elementDiv.appendChild(img);
                    elementDiv.style.position = 'absolute';
                    elementDiv.style.left = `${element.x}px`;
                    elementDiv.style.top = `${element.y}px`;
                    elementDiv.style.width = `${element.width || 200}px`;
                    elementDiv.style.height = `${element.height || 150}px`;
                break;

            case 'audio':
                elementDiv = document.createElement('div');
                    elementDiv.className = 'slide-element presentation-audio';
                    const audio = document.createElement('audio');
                    audio.src = element.content;
                    audio.autoplay = true;
                    audio.loop = true;
                    audio.style.display = 'none';
                    elementDiv.appendChild(audio);
                    elementDiv.style.left = `${element.x}px`;
                    elementDiv.style.top = `${element.y}px`;
                    elementDiv.style.width = `${element.width}px`;
                    elementDiv.style.height = `${element.height}px`;
                    break;

                case 'table':
                    elementDiv = document.createElement('div');
                    elementDiv.className = 'slide-element presentation-table';
                    elementDiv.innerHTML = element.content;
                    elementDiv.style.left = `${element.x}px`;
                    elementDiv.style.top = `${element.y}px`;
                    break;

                case 'code':
                    elementDiv = document.createElement('pre');
                    elementDiv.className = 'slide-element presentation-code';
                    const codeTag = document.createElement('code');
                    codeTag.className = `language-${element.language}`;
                    codeTag.textContent = element.content;
                    elementDiv.appendChild(codeTag);
                    Prism.highlightElement(codeTag);
                    elementDiv.style.left = `${element.x}px`;
                    elementDiv.style.top = `${element.y}px`;
                    elementDiv.style.width = `${element.width}px`;
                    elementDiv.style.height = `${element.height}px`;
                break;
                
            case 'video':
                elementDiv = document.createElement('div');
                    elementDiv.className = 'slide-element presentation-video';
                    const video = document.createElement('video');
                    video.src = element.content;
                    video.controls = true;
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.style.display = 'block';
                    elementDiv.appendChild(video);
                    elementDiv.style.left = `${element.x}px`;
                    elementDiv.style.top = `${element.y}px`;
                    elementDiv.style.width = `${element.width}px`;
                    elementDiv.style.height = `${element.height}px`;
                break;
            case 'chart':
                elementDiv = document.createElement('div');
                elementDiv.className = 'slide-element presentation-chart';
                elementDiv.style.position = 'absolute';
                elementDiv.style.left = `${element.x}px`;
                elementDiv.style.top = `${element.y}px`;
                elementDiv.style.width = `${element.width}px`;
                elementDiv.style.height = `${element.height}px`;
                elementDiv.style.display = 'flex';
                elementDiv.style.alignItems = 'center';
                elementDiv.style.justifyContent = 'center';
                // Create canvas for chart
                const chartCanvas = document.createElement('canvas');
                chartCanvas.width = element.width;
                chartCanvas.height = element.height;
                chartCanvas.style.width = '100%';
                chartCanvas.style.height = '100%';
                elementDiv.appendChild(chartCanvas);
                // Render chart using Chart.js
                setTimeout(() => {
                    new Chart(chartCanvas.getContext('2d'), {
                        type: element.chartType,
                        data: {
                            labels: element.allLabels,
                            datasets: element.datasets.map(ds => ({
                                label: ds.label,
                                data: element.allLabels.map(l => {
                                    const idx = ds.labels.indexOf(l);
                                    return idx >= 0 ? ds.data[idx] : 0;
                                }),
                                backgroundColor: ds.color,
                                borderColor: ds.color,
                                fill: element.chartType !== 'line'
                            }))
                        },
                        options: {
                            responsive: false,
                            maintainAspectRatio: false
                        }
                    });
                }, 0);
                break;
            }

            if (elementDiv) {
                // Apply z-index
                elementDiv.style.zIndex = element.zIndex || 1;
                
                // Add link functionality if element has a link
                    if (element.link) {
                        elementDiv.classList.add('link-element');
                    elementDiv.style.cursor = 'pointer';
                    elementDiv.style.textDecoration = 'underline';
                    elementDiv.style.color = '#0066cc';
                        
                        elementDiv.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                            if (element.link.type === 'url') {
                                window.open(element.link.url, '_blank');
                            } else if (element.link.type === 'slide') {
                                this.currentSlideIndex = parseInt(element.link.targetSlide);
                                this.updatePresentationSlide();
                            }
                        });
                }
                
                wrapper.appendChild(elementDiv);
            }
        });
    }

formatText(style, value) {
    const selectedElement = document.querySelector('.slide-element.selected');
    if (!selectedElement || !selectedElement.classList.contains('text-element')) return;

    const textContent = selectedElement.querySelector('.text-content');
    if (!textContent) return;

    const elementId = selectedElement.dataset.id;
    const element = this.slides[this.currentSlideIndex].elements.find(
        el => el.id.toString() === elementId
    );
    if (!element) return;

    if (!element.style) element.style = {};

    const selection = window.getSelection();
    let range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    // Restore saved range (for right-click)
    if ((!range || selection.isCollapsed) && this.savedTextRange) {
        selection.removeAllRanges();
        selection.addRange(this.savedTextRange);
        range = this.savedTextRange;
    }
  
const hasSelectedText = selection && !selection.isCollapsed && selection.toString().trim().length > 0;
    // const hasSelectedText = range && !selection.isCollapsed;

    // 🔧 Span wrapper to apply inline styles
    const wrapWithSpan = (styleObj) => {
        if (!range) return;

        const span = document.createElement('span');
        let styleString = '';
        for (let key in styleObj) {
            const cssKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
            styleString += `${cssKey}:${styleObj[key]};`;
        }
        span.setAttribute('style', styleString);

        const extracted = range.extractContents();
        span.appendChild(extracted);
        range.deleteContents();
        range.insertNode(span);

        // Restore selection to span
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(newRange);
    };

 

switch (style) {
       case 'bold':
        case 'italic':
        case 'underline':
            document.execCommand(style, false, null);
            break;


        case 'fontSize':
            if (hasSelectedText) {
                this.saveState();
                wrapWithSpan({ fontSize: `${value}px` });
            } else {
                element.style.fontSize = `${value}px`;
                textContent.style.fontSize = `${value}px`;
            }
            break;

        case 'fontFamily':
            if (hasSelectedText) {
                this.saveState();
                wrapWithSpan({ fontFamily: value });
            } else {
                element.style.fontFamily = value;
                textContent.style.fontFamily = value;
            }
            break;

        case 'color':
            if (hasSelectedText) {
                this.saveState();
                wrapWithSpan({ color: value });
            } else {
                element.style.color = value;
                textContent.style.color = value;
            }
            break;
    }

    // Save HTML + style to model
    element.content = textContent.innerHTML;
    element.style = {
        ...element.style,
        fontSize: textContent.style.fontSize,
        fontFamily: textContent.style.fontFamily,
        color: textContent.style.color,
        fontWeight: textContent.style.fontWeight,
        fontStyle: textContent.style.fontStyle,
        textDecoration: textContent.style.textDecoration
    };

    this.updateElementInModel(selectedElement, {
        style: element.style,
        content: element.content
    });

    scheduleSlidesListUpdate();
    textContent.focus();

    // Clear saved range
    this.savedTextRange = null;
}



async exportToPDF() {
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('landscape', 'px', [960, 540]);

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '960px';
    container.style.height = '540px';
    document.body.appendChild(container);

    for (let s = 0; s < this.slides.length; s++) {
        const slide = this.slides[s];
        const slideDiv = document.createElement('div');
        slideDiv.style.width = '960px';
        slideDiv.style.height = '540px';
        slideDiv.style.position = 'relative';
        slideDiv.style.overflow = 'hidden';
        slideDiv.style.boxSizing = 'border-box';
        slideDiv.style.background = slide.customStyle?.backgroundColor || '#fff';

        if (slide.theme?.backgroundImage) {
            slideDiv.style.backgroundImage = slide.theme.backgroundImage;
            slideDiv.style.backgroundSize = 'cover';
            slideDiv.style.backgroundPosition = 'center';
        }

        for (let e = 0; e < slide.elements.length; e++) {
            const el = slide.elements[e];

            // ❌ Skip if audio/video or empty text/table/image
            if (
                el.type === 'audio' ||
                el.type === 'video' ||
                (el.type === 'text' && (!el.content || el.content.trim() === '')) ||
                (el.type === 'image' && !el.content) ||
                (el.type === 'table' && (!el.content || el.content.trim() === ''))
            ) continue;

if (el.type === 'shape') {
        const canvasShape = document.createElement('canvas');
        canvasShape.width = el.width || 200;
        canvasShape.height = el.height || 100;
        canvasShape.style.position = 'absolute';
        canvasShape.style.left = el.x + 'px';
        canvasShape.style.top = el.y + 'px';
        canvasShape.style.zIndex = el.zIndex || 1;

        const ctx = canvasShape.getContext('2d');
        ctx.fillStyle = el.fillColor || 'transparent';
        ctx.strokeStyle = el.borderColor || '#000';
        ctx.lineWidth = el.borderWidth || 2;

        const w = canvasShape.width;
        const h = canvasShape.height;
        ctx.beginPath();

          switch (el.shapeType) {
        case 'rectangle':
            ctx.rect(0, 0, w, h);
            break;
        case 'circle':
            ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - ctx.lineWidth, 0, 2 * Math.PI);
            break;
        case 'triangle':
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(0, h);
            ctx.lineTo(w, h);
            ctx.closePath();
            break;
        case 'line':
            ctx.moveTo(0, 0);
            ctx.lineTo(w, h);
            break;
        case 'polygon':
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(w, h / 3);
            ctx.lineTo(w * 0.85, h);
            ctx.lineTo(w * 0.15, h);
            ctx.lineTo(0, h / 3);
            ctx.closePath();
            break;
        case 'arrow':
            ctx.moveTo(0, h * 0.4);
            ctx.lineTo(w * 0.6, h * 0.4);
            ctx.lineTo(w * 0.6, h * 0.2);
            ctx.lineTo(w, h * 0.5);
            ctx.lineTo(w * 0.6, h * 0.8);
            ctx.lineTo(w * 0.6, h * 0.6);
            ctx.lineTo(0, h * 0.6);
            ctx.closePath();
            break;
        case 'diamond':
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(w, h / 2);
            ctx.lineTo(w / 2, h);
            ctx.lineTo(0, h / 2);
            ctx.closePath();
            break;
        case 'pentagon':
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(w, h * 0.38);
            ctx.lineTo(w * 0.82, h);
            ctx.lineTo(w * 0.18, h);
            ctx.lineTo(0, h * 0.38);
            ctx.closePath();
            break;
        case 'hexagon':
            ctx.moveTo(w * 0.25, 0);
            ctx.lineTo(w * 0.75, 0);
            ctx.lineTo(w, h * 0.5);
            ctx.lineTo(w * 0.75, h);
            ctx.lineTo(w * 0.25, h);
            ctx.lineTo(0, h * 0.5);
            ctx.closePath();
            break;
        case 'cloud':
            // Simple approximation
            ctx.moveTo(w * 0.2, h * 0.6);
            ctx.bezierCurveTo(w * 0.2, h * 0.4, w * 0.4, h * 0.4, w * 0.4, h * 0.6);
            ctx.bezierCurveTo(w * 0.4, h * 0.3, w * 0.7, h * 0.3, w * 0.7, h * 0.6);
            ctx.bezierCurveTo(w * 0.8, h * 0.6, w * 0.9, h * 0.7, w * 0.8, h * 0.8);
            ctx.lineTo(w * 0.2, h * 0.8);
            ctx.closePath();
            break;
        case 'star':
            const cx = w / 2;
            const cy = h / 2;
            const spikes = 5;
            const outerRadius = Math.min(w, h) / 2 - ctx.lineWidth;
            const innerRadius = outerRadius * 0.5;
            let rot = Math.PI / 2 * 3;
            let step = Math.PI / spikes;
            ctx.moveTo(cx, cy - outerRadius);
            for (let i = 0; i < spikes; i++) {
                ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
                rot += step;
                ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
                rot += step;
            }
            ctx.lineTo(cx, cy - outerRadius);
            ctx.closePath();
            break;
    }

        if (el.fillColor !== 'transparent') ctx.fill();
        ctx.stroke();

        slideDiv.appendChild(canvasShape);
        continue; // ✅ skip elDiv for shape
    }


            const elDiv = document.createElement('div');
            elDiv.style.position = 'absolute';
            elDiv.style.left = el.x + 'px';
            elDiv.style.top = el.y + 'px';
            elDiv.style.width = (el.width || 200) + 'px';
            elDiv.style.height = (el.height || 100) + 'px';
            elDiv.style.zIndex = el.zIndex || 1;

            switch (el.type) {
                case 'text':
    const isPlaceholder = el.isPlaceholder;
    const placeholderTexts = ['Click to add title', 'Click to add subtitle', 'Click to add text'];

    // ❌ Skip rendering if it's a placeholder
    if (isPlaceholder && placeholderTexts.includes(el.content)) break;

    elDiv.innerHTML = el.content.trim().replace(/\n/g, '<br>');

    Object.assign(elDiv.style, {
        fontSize: el.style?.fontSize || '16px',
        fontFamily: el.style?.fontFamily || 'Arial',
        color: el.style?.color || '#000',
        fontWeight: el.style?.fontWeight || 'normal',
        fontStyle: el.style?.fontStyle || 'normal',
        textDecoration: el.style?.textDecoration || 'none',
        lineHeight: el.style?.lineHeight || 'normal',
        letterSpacing: el.style?.letterSpacing || 'normal',
        textAlign: el.style?.textAlign || 'center', // ✅ use stored or default to center
        padding: '4px',
        whiteSpace: 'pre-wrap'
    });
    break;
                case 'image':
                    const img = document.createElement('img');
                    img.src = el.content;
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'contain';
                    elDiv.appendChild(img);
                    break;
  case 'shape':
    const canvasShape = document.createElement('canvas');
    canvasShape.width = el.width || 200;
    canvasShape.height = el.height || 100;
    canvasShape.style.position = 'absolute';
    canvasShape.style.left = el.x + 'px';
    canvasShape.style.top = el.y + 'px';
    canvasShape.style.zIndex = el.zIndex || 1;

    const ctx = canvasShape.getContext('2d');

    // Fill and stroke
    ctx.fillStyle = el.fillColor || 'transparent';
    ctx.strokeStyle = el.borderColor || '#000';
    ctx.lineWidth = el.borderWidth || 2;

    const w = canvasShape.width;
    const h = canvasShape.height;
    ctx.beginPath();

    switch (el.shapeType) {
        case 'circle':
            ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - ctx.lineWidth, 0, 2 * Math.PI);
            break;
        case 'triangle':
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(0, h);
            ctx.lineTo(w, h);
            ctx.closePath();
            break;
        case 'arrow':
            ctx.moveTo(0, h * 0.4);
            ctx.lineTo(w * 0.6, h * 0.4);
            ctx.lineTo(w * 0.6, h * 0.2);
            ctx.lineTo(w, h * 0.5);
            ctx.lineTo(w * 0.6, h * 0.8);
            ctx.lineTo(w * 0.6, h * 0.6);
            ctx.lineTo(0, h * 0.6);
            ctx.closePath();
            break;
        case 'diamond':
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(w, h / 2);
            ctx.lineTo(w / 2, h);
            ctx.lineTo(0, h / 2);
            ctx.closePath();
            break;
        case 'pentagon':
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(w, h * 0.38);
            ctx.lineTo(w * 0.82, h);
            ctx.lineTo(w * 0.18, h);
            ctx.lineTo(0, h * 0.38);
            ctx.closePath();
            break;
        case 'hexagon':
            ctx.moveTo(w * 0.25, 0);
            ctx.lineTo(w * 0.75, 0);
            ctx.lineTo(w, h * 0.5);
            ctx.lineTo(w * 0.75, h);
            ctx.lineTo(w * 0.25, h);
            ctx.lineTo(0, h * 0.5);
            ctx.closePath();
            break;
        case 'star':
            // Draw 5-point star
            const cx = w / 2, cy = h / 2;
            const spikes = 5;
            const outerRadius = Math.min(w, h) / 2 - ctx.lineWidth;
            const innerRadius = outerRadius * 0.5;
            let rot = Math.PI / 2 * 3;
            let step = Math.PI / spikes;
            ctx.moveTo(cx, cy - outerRadius);
            for (let i = 0; i < spikes; i++) {
                ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
                rot += step;
                ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
                rot += step;
            }
            ctx.lineTo(cx, cy - outerRadius);
            ctx.closePath();
            break;
        default: // rectangle
            ctx.rect(0, 0, w, h);
    }

    if (el.fillColor !== 'transparent') ctx.fill();
    ctx.stroke();

    slideDiv.appendChild(canvasShape);
    break;
                case 'table':
                    elDiv.innerHTML = el.content.trim();
                    elDiv.querySelectorAll('table').forEach(table => {
                        table.style.borderCollapse = 'collapse';
                        table.style.width = '100%';
                        table.querySelectorAll('td, th').forEach(cell => {
                            cell.style.border = '1px solid #000';
                            cell.style.padding = '4px';
                        });
                    });
                    break;
                case 'code':
                    const pre = document.createElement('pre');
                    pre.textContent = el.content.trim();
                    pre.style.fontFamily = 'monospace';
                    pre.style.fontSize = '12px';
                    pre.style.padding = '8px';
                    pre.style.whiteSpace = 'pre-wrap';
                    pre.style.background = '#f4f4f4';
                    elDiv.appendChild(pre);
                    break;
                case 'chart':
                    const canvas = document.createElement('canvas');
                    canvas.width = el.width;
                    canvas.height = el.height;
                    canvas.style.width = '100%';
                    canvas.style.height = '100%';
                    elDiv.appendChild(canvas);
                    slideDiv.appendChild(elDiv);
                    await new Promise(resolve => setTimeout(resolve, 10));
                    new Chart(canvas.getContext('2d'), {
                        type: el.chartType,
                        data: {
                            labels: el.allLabels,
                            datasets: el.datasets.map(ds => ({
                                label: ds.label,
                                data: el.allLabels.map(l => {
                                    const idx = ds.labels.indexOf(l);
                                    return idx >= 0 ? ds.data[idx] : 0;
                                }),
                                backgroundColor: ds.color,
                                borderColor: ds.color,
                                fill: el.chartType !== 'line'
                            }))
                        },
                        options: {
                            responsive: false,
                            maintainAspectRatio: false,
                            animation: false
                        }
                    });
                    break;
                case 'link':
                    const link = document.createElement('a');
                    link.href = el.link?.url || '#';
                    link.innerText = el.content || 'Link';
                    link.style.textDecoration = 'underline';
                    link.style.color = '#007bff';
                    elDiv.appendChild(link);
                    break;
            }
            slideDiv.appendChild(elDiv);
        }


 container.appendChild(slideDiv);
        await new Promise(resolve => setTimeout(resolve, 500));
        const canvas = await html2canvas(slideDiv, {
            scale: 2,
            useCORS: true,
            backgroundColor: null
        });
        const imgData = canvas.toDataURL('image/png');
        if (s > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, 960, 540);
    }

    container.remove();

    const blob = pdf.output('blob');

    try {
        if ('showSaveFilePicker' in window) {
            const opts = {
                types: [{
                    description: 'PDF file',
                    accept: { 'application/pdf': ['.pdf'] },
                }],
                suggestedName: 'presentation.pdf'
            };

            const handle = await window.showSaveFilePicker(opts);
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();

            alert('PDF saved successfully as: ' + handle.name);
            // Note: handle.name is only the filename, not full path.
        } else {
            let fileName = prompt('Enter PDF file name', 'presentation.pdf');
            if (!fileName) fileName = 'presentation.pdf';
            else if (!fileName.toLowerCase().endsWith('.pdf')) fileName += '.pdf';
            pdf.save(fileName);
        }
    } catch (err) {
        console.error('Error saving PDF:', err);
        alert('Error saving PDF: ' + err.message);
    }
}
    
exportAsJPEG() {
    const slide = document.getElementById('currentSlide');
    const clone = slide.cloneNode(true);

    clone.classList.add('export-slide');
    clone.style.position = 'static';
    clone.style.transform = 'none';

    const wrapper = document.createElement('div');
    wrapper.style.width = `${slide.offsetWidth}px`;
    wrapper.style.height = `${slide.offsetHeight}px`;
    wrapper.style.position = 'fixed';
    wrapper.style.top = '-9999px';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    html2canvas(clone, { backgroundColor: null, scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `slide-${Date.now()}.jpeg`;
        link.href = canvas.toDataURL('image/jpeg', 1.0);
        link.click();
        wrapper.remove();
    });
}
    copyCurrentSlide() {
        const currentSlide = this.slides[this.currentSlideIndex];
        localStorage.setItem('copiedSlide', JSON.stringify(currentSlide));
    }

    pasteSlide() {
        const copiedSlide = localStorage.getItem('copiedSlide');
        if (copiedSlide) {
            const slide = JSON.parse(copiedSlide);
            slide.id = Date.now(); // Give new ID to avoid duplicates
            this.slides.splice(this.currentSlideIndex + 1, 0, slide);
            this.currentSlideIndex++;
           scheduleUIUpdate();
        }
    } 
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
    toggleGrid() {
        this.currentSlideElement = document.getElementById('currentSlide');

        if (!currentSlide) return;

        this.viewSettings.showGrid = !this.viewSettings.showGrid;
        const gridButton = document.getElementById('toggleGrid');

        if (this.viewSettings.showGrid) {
            currentSlide.classList.add('show-grid');
            // Create grid overlay if it doesn't exist
            let gridOverlay = currentSlide.querySelector('.grid-overlay');
            if (!gridOverlay) {
                gridOverlay = document.createElement('div');
                gridOverlay.className = 'grid-overlay';
                currentSlide.appendChild(gridOverlay);
            }
            this.updateGrid();
            if (gridButton) {
                gridButton.style.backgroundColor = '#a33939';
                gridButton.classList.add('active');
            }
        } else {
            currentSlide.classList.remove('show-grid');
            const gridOverlay = currentSlide.querySelector('.grid-overlay');
            if (gridOverlay) {
                gridOverlay.remove();
            }
            if (gridButton) {
                gridButton.style.backgroundColor = '#2c2b2bb9';
                gridButton.classList.remove('active');
            }
        }
        // Save grid state to current slide
            const slide = this.slides[this.currentSlideIndex];
            if (slide) {
            slide.showGrid = this.viewSettings.showGrid;
        }
    }

    updateGrid() {
        this.currentSlideElement = document.getElementById('currentSlide');

        if (!currentSlide || !this.viewSettings.showGrid) return;

        const gridOverlay = currentSlide.querySelector('.grid-overlay');
        if (!gridOverlay) return;

        const gridSize = this.viewSettings.gridSize;
        const width = currentSlide.offsetWidth;
        const height = currentSlide.offsetHeight;

        // Clear existing grid lines
        gridOverlay.innerHTML = '';

        // Create vertical grid lines
        for (let x = 0; x <= width; x += gridSize) {
            const line = document.createElement('div');
            line.className = 'grid-line vertical';
            line.style.left = `${x}px`;
            gridOverlay.appendChild(line);
        }

        // Create horizontal grid lines
        for (let y = 0; y <= height; y += gridSize) {
            const line = document.createElement('div');
            line.className = 'grid-line horizontal';
            line.style.top = `${y}px`;
            gridOverlay.appendChild(line);
        }
    }

    toggleRulers() {
        this.currentSlideElement = document.getElementById('currentSlide');

        if (!currentSlide) return;

        this.viewSettings.showRulers = !this.viewSettings.showRulers;
        
        // Remove any existing rulers first
        const existingRulers = currentSlide.querySelectorAll('.ruler, .ruler-corner');
        existingRulers.forEach(ruler => ruler.remove());

        if (this.viewSettings.showRulers) {
            // Create horizontal ruler
            const rulerH = document.createElement('div');
            rulerH.className = 'ruler ruler-horizontal';
            for (let i = 0; i <= currentSlide.offsetWidth; i += 50) {
                const majorMark = document.createElement('div');
                majorMark.className = 'ruler-mark horizontal major';
                majorMark.style.left = `${i}px`;
                
                const number = document.createElement('div');
                number.className = 'ruler-number';
                number.textContent = i;
                majorMark.appendChild(number);
                rulerH.appendChild(majorMark);

                // Add minor marks
                for (let j = 10; j < 50 && i + j <= currentSlide.offsetWidth; j += 10) {
                    const minorMark = document.createElement('div');
                    minorMark.className = 'ruler-mark horizontal';
                    minorMark.style.left = `${i + j}px`;
                    rulerH.appendChild(minorMark);
                }
            }
            currentSlide.appendChild(rulerH);

            // Create vertical ruler
            const rulerV = document.createElement('div');
            rulerV.className = 'ruler ruler-vertical';
            for (let i = 0; i <= currentSlide.offsetHeight; i += 50) {
                const majorMark = document.createElement('div');
                majorMark.className = 'ruler-mark vertical major';
                majorMark.style.top = `${i}px`;
                
                const number = document.createElement('div');
                number.className = 'ruler-number';
                number.textContent = i;
                majorMark.appendChild(number);
                rulerV.appendChild(majorMark);

                // Add minor marks
                for (let j = 10; j < 50 && i + j <= currentSlide.offsetHeight; j += 10) {
                    const minorMark = document.createElement('div');
                    minorMark.className = 'ruler-mark vertical';
                    minorMark.style.top = `${i + j}px`;
                    rulerV.appendChild(minorMark);
                }
            }
            currentSlide.appendChild(rulerV);

            // Create corner square
            const rulerCorner = document.createElement('div');
            rulerCorner.className = 'ruler-corner';
            currentSlide.appendChild(rulerCorner);

            // Update button state
            const rulerButton = document.getElementById('toggleRulers');
            if (rulerButton) {
                rulerButton.classList.add('active');
                rulerButton.style.backgroundColor = '#a33939';
            }

            currentSlide.classList.add('show-rulers');
        } else {
            // Update button state
            const rulerButton = document.getElementById('toggleRulers');
            if (rulerButton) {
                rulerButton.classList.remove('active');
                rulerButton.style.backgroundColor = '#2c2b2bb9';
            }

            currentSlide.classList.remove('show-rulers');
        }

        // Save ruler state to current slide
        const slide = this.slides[this.currentSlideIndex];
        if (slide) {
            slide.showRulers = this.viewSettings.showRulers;
        }

        // Adjust slide elements position when rulers are shown/hidden
        const slideElements = currentSlide.querySelectorAll('.slide-element');
        slideElements.forEach(element => {
            if (this.viewSettings.showRulers) {
                element.style.transform = 'translate(30px, 30px)';
            } else {
                element.style.transform = 'none';
            }
        });
    }

    removeRulers() {
        this.currentSlideElement = document.getElementById('currentSlide');

        if (!currentSlide) return;

        const rulers = currentSlide.querySelectorAll('.ruler, .ruler-corner');
        rulers.forEach(ruler => ruler.remove());
        currentSlide.classList.remove('show-rulers');
    }

    createRulers() {
        this.currentSlideElement = document.getElementById('currentSlide');

        if (!currentSlide) return;

        // Remove any existing rulers first
        this.removeRulers();

        // Create horizontal ruler
        const rulerH = document.createElement('div');
        rulerH.className = 'ruler ruler-horizontal';
        currentSlide.appendChild(rulerH);

        // Create vertical ruler
        const rulerV = document.createElement('div');
        rulerV.className = 'ruler ruler-vertical';
        currentSlide.appendChild(rulerV);

        // Create corner square where rulers meet
        const rulerCorner = document.createElement('div');
        rulerCorner.className = 'ruler-corner';
        currentSlide.appendChild(rulerCorner);

        this.updateRulers();
    }

    toggleGuides() {
        this.currentSlideElement = document.getElementById('currentSlide');

        if (!currentSlide) return;

        this.viewSettings.showGuides = !this.viewSettings.showGuides;
        const guidesButton = document.getElementById('toggleGuides');

        // Remove any existing guides overlay
        const existingOverlay = currentSlide.querySelector('.guides-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        if (this.viewSettings.showGuides) {
            // Create guides overlay
            const guidesOverlay = document.createElement('div');
            guidesOverlay.className = 'guides-overlay';

            // Create horizontal guide
            const guideH = document.createElement('div');
            guideH.className = 'guide-horizontal';
            guideH.style.top = '50%';

            // Create vertical guide
            const guideV = document.createElement('div');
            guideV.className = 'guide-vertical';
            guideV.style.left = '50%';

            // Add drag functionality
            [guideH, guideV].forEach(guide => {
                guide.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const isHorizontal = guide.classList.contains('guide-horizontal');
                    const startPos = isHorizontal ? e.clientY : e.clientX;
                    const startOffset = isHorizontal ? guide.offsetTop : guide.offsetLeft;
                    const slideRect = currentSlide.getBoundingClientRect();

                    const handleDrag = (moveEvent) => {
                        const currentPos = isHorizontal ? moveEvent.clientY : moveEvent.clientX;
                        const delta = currentPos - startPos;
                        const newPos = Math.max(0, Math.min(
                            startOffset + delta,
                            isHorizontal ? slideRect.height : slideRect.width
                        ));
                        
                        if (isHorizontal) {
                            guide.style.top = `${newPos}px`;
                        } else {
                            guide.style.left = `${newPos}px`;
                        }
                    };

                    const stopDrag = () => {
                        document.removeEventListener('mousemove', handleDrag);
                        document.removeEventListener('mouseup', stopDrag);
                    };

                    document.addEventListener('mousemove', handleDrag);
                    document.addEventListener('mouseup', stopDrag);
                });
            });

            guidesOverlay.appendChild(guideH);
            guidesOverlay.appendChild(guideV);
            currentSlide.appendChild(guidesOverlay);

            if (guidesButton) {
                guidesButton.style.backgroundColor = '#a33939';
                guidesButton.classList.add('active');
            }
        } else {
            if (guidesButton) {
                guidesButton.style.backgroundColor = '#2c2b2bb9';
                guidesButton.classList.remove('active');
            }
        }

        // Save guides state to current slide
        const slide = this.slides[this.currentSlideIndex];
        if (slide) {
            slide.showGuides = this.viewSettings.showGuides;
        }
    }

    addGuides() {
        const slide = this.slides[this.currentSlideIndex];
        slide.showGuides = !slide.showGuides;
        this.updateCurrentSlide();
    }

    updateRulers() {
        this.currentSlideElement = document.getElementById('currentSlide');

        if (!currentSlide || !this.viewSettings.showRulers) return;

        const rulerH = currentSlide.querySelector('.ruler-horizontal');
        const rulerV = currentSlide.querySelector('.ruler-vertical');
        if (!rulerH || !rulerV) return;

        const width = currentSlide.offsetWidth - 30; // Adjust for vertical ruler width
        const height = currentSlide.offsetHeight - 30; // Adjust for horizontal ruler height

        // Update horizontal ruler
        let rulerHHTML = '';
        for (let x = 0; x <= width; x += 50) {
            rulerHHTML += `
                <div class="ruler-mark horizontal major" style="left: ${x}px">
                    <div class="ruler-number">${x}</div>
                </div>
            `;
            // Add minor marks every 10px
            for (let i = 10; i < 50 && x + i <= width; i += 10) {
                rulerHHTML += `<div class="ruler-mark horizontal" style="left: ${x + i}px"></div>`;
            }
        }
        rulerH.innerHTML = rulerHHTML;

        // Update vertical ruler
        let rulerVHTML = '';
        for (let y = 0; y <= height; y += 50) {
            rulerVHTML += `
                <div class="ruler-mark vertical major" style="top: ${y}px">
                    <div class="ruler-number">${y}</div>
                </div>
            `;
            // Add minor marks every 10px
            for (let i = 10; i < 50 && y + i <= height; i += 10) {
                rulerVHTML += `<div class="ruler-mark vertical" style="top: ${y + i}px"></div>`;
        }
        }
        rulerV.innerHTML = rulerVHTML;
    }

    showHelp() {
        const helpContent = `
            <div class="help-dialog">
                <h2>Keyboard Shortcuts</h2>
                <ul>

                    <li>Ctrl + S: Save presentation</li>
                    <li>Ctrl + Z: Undo</li>
                    <li>Ctrl + Y: Redo</li>
                    <li>Ctrl + C: Copy slide</li>
                    <li>Ctrl + V: Paste slide</li>
                    <li>delete: Delete selected element</li>
                    <li>F5: Start presentation</li>
                    <li>Esc: Exit presentation</li>
                </ul>
            </div>
        `;
        
        const dialog = document.createElement('div');
        dialog.className = 'modal';
        dialog.innerHTML = helpContent;
        document.body.appendChild(dialog);
        
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });
    }

   

    addVideoElement() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*'; // Only video files

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Create fast preview link
        const objectURL = URL.createObjectURL(file);

        const element = {
            type: 'video',
            content: objectURL,   // Used during editing
            preview: objectURL,   // Optional - in case you handle fallback
            x: 100,
            y: 100,
            width: 480,
            height: 270,
            zIndex: this.getNextZIndex?.() || 1,
            id: Date.now()
        };

        this.slides[this.currentSlideIndex].elements.push(element);
        scheduleUIUpdate();

        // Optional: If you want to save base64 for export
        const reader = new FileReader();
        reader.onload = (event) => {
            element.content = event.target.result; // base64
            // (preview remains as objectURL for editing)
        };
        reader.readAsDataURL(file);
    };

    input.click();
    this.saveState();
}

    
    createLink() {
        const selectedElement = document.querySelector('.slide-element.selected');
        if (!selectedElement) {
            alert('Please select an element first to create a link.');
            return;
        }
        this.selectedElementId = parseInt(selectedElement.dataset.id || selectedElement.dataset.elementId);
        
        const element = this.slides[this.currentSlideIndex].elements.find(el => el.id === this.selectedElementId);
        if (!element) {
            alert('Element not found in the model');
            return;
        }

        const dialog = document.createElement('div');
        dialog.className = 'dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>Create Link</h3>
                <div class="link-options">
                    <label>
                        <input type="radio" name="linkType" value="url" checked> External URL
                    </label>
                    <label>
                        <input type="radio" name="linkType" value="slide"> Slide Link
                    </label>
                </div>
                <div id="urlInput" class="link-input">
                    <input type="text" placeholder="Enter URL (e.g., https://example.com)" class="url-input-field" />
                </div>
                <div id="slideInput" class="link-input" style="display: none;">
                    <select>
                        ${this.slides.map((_, index) => `
                            <option value="${index}">Slide ${index + 1}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="dialog-buttons">
                    <button class="confirm">Create Link</button>
                    <button class="cancel">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const urlInput = dialog.querySelector('#urlInput');
        const slideInput = dialog.querySelector('#slideInput');
        const linkTypeRadios = dialog.querySelectorAll('input[name="linkType"]');
        const urlInputField = dialog.querySelector('.url-input-field');

        // Prevent the URL input field from being affected by element selection prevention
        urlInputField.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        // Enable proper paste handling
        urlInputField.addEventListener('paste', (e) => {
            e.stopPropagation();
        });

        // Enable proper keyboard input handling
        urlInputField.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });

        // Focus the URL input field when dialog opens
        setTimeout(() => urlInputField.focus(), 100);

        linkTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'url') {
                    urlInput.style.display = 'block';
                    slideInput.style.display = 'none';
                    setTimeout(() => urlInputField.focus(), 100);
                } else {
                    urlInput.style.display = 'none';
                    slideInput.style.display = 'block';
                }
            });
        });

        const handleConfirm = () => {
            const linkType = dialog.querySelector('input[name="linkType"]:checked').value;
            
            if (linkType === 'url') {
                const url = dialog.querySelector('#urlInput input').value.trim();
                if (!url) {
                    alert('Please enter a valid URL');
                return;
            }

                const formattedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;

                // Update the model
                element.link = {
                    type: 'url',
                    url: formattedUrl
                };

                // Update the DOM element
                selectedElement.style.cursor = 'pointer';
                selectedElement.style.textDecoration = 'underline';
                selectedElement.style.color = '#0066cc';

                // Add click handler that prevents selection
                const handleClick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                        window.open(formattedUrl, '_blank');
                };

                selectedElement.removeEventListener('click', handleClick);
                selectedElement.addEventListener('click', handleClick);

            } else {
                const targetSlideIndex = parseInt(dialog.querySelector('#slideInput select').value);
                
                // Update the model
            element.link = {
                type: 'slide',
                    targetSlide: targetSlideIndex
                };

                // Update the DOM element
                selectedElement.style.cursor = 'pointer';
                selectedElement.style.textDecoration = 'underline';

                // Add click handler that prevents selection
                const handleClick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.currentSlideIndex = targetSlideIndex;
                   scheduleUIUpdate();
                };

                selectedElement.removeEventListener('click', handleClick);
                selectedElement.addEventListener('click', handleClick);
            }

            // Add link indicator
            const existingIndicator = selectedElement.querySelector('.link-indicator');
            if (!existingIndicator) {
            const linkIndicator = document.createElement('div');
            linkIndicator.className = 'link-indicator';
            linkIndicator.innerHTML = '<i class="fas fa-link"></i>';
            linkIndicator.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: rgba(255, 255, 255, 0.8);
                padding: 5px;
                border-radius: 50%;
                z-index: 1000;
                pointer-events: none;
            `;
            selectedElement.appendChild(linkIndicator);
            }

            // Prevent selection on mousedown
            selectedElement.addEventListener('mousedown', (e) => {
                if (element.link) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            });

            // Save the state for undo/redo
            this.saveState();
            
            dialog.remove();
        };

        const handleCancel = () => {
            dialog.remove();
        };

        dialog.querySelector('.confirm').addEventListener('click', handleConfirm);
        dialog.querySelector('.cancel').addEventListener('click', handleCancel);
    }

    // Helper method to add URL link handler
    addUrlLinkHandler(element, url) {
        element.style.cursor = 'pointer';
        element.style.textDecoration = 'underline';
        element.style.color = '#0066cc';
        
        // Prevent selection on mousedown
        element.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        // Handle link click
        const handleClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(url, '_blank');
        };
        
        // Remove any existing click listeners
        element.removeEventListener('click', handleClick);
        // Add the new click listener
        element.addEventListener('click', handleClick);
    }

    // Helper method to add slide link handler
    addSlideLinkHandler(element, targetSlideIndex) {
        element.style.cursor = 'pointer';
        element.style.textDecoration = 'underline';
        element.style.color = '#0066cc';
        
        // Prevent selection on mousedown
        element.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        // Handle link click
        const handleClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
            this.currentSlideIndex = parseInt(targetSlideIndex);
           scheduleUIUpdate();
            if (document.fullscreenElement) {
                this.updatePresentationSlide();
            }
        };
        
        // Remove any existing click listeners
        element.removeEventListener('click', handleClick);
        // Add the new click listener
        element.addEventListener('click', handleClick);
    }

    // Helper method to add link indicator
    addLinkIndicator(element) {
        const linkIndicator = document.createElement('div');
        linkIndicator.className = 'link-indicator';
        linkIndicator.innerHTML = '<i class="fas fa-link"></i>';
        linkIndicator.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(255, 255, 255, 0.8);
            padding: 5px;
            border-radius: 50%;
            z-index: 1000;
            pointer-events: none;
        `;
        element.appendChild(linkIndicator);
    }

    makeTableEditable(tableElement) {
        const cells = tableElement.querySelectorAll('th, td');
        cells.forEach(cell => {
            // Enable cell editing on click
            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                cell.contentEditable = true;
                cell.focus();
                
                // Add formatting controls for the active cell
                this.showTableFormattingControls(cell);
            });

            // Save changes when clicking outside or pressing Enter
            cell.addEventListener('blur', () => {
                cell.contentEditable = false;
                this.hideTableFormattingControls();
            });

            cell.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    cell.contentEditable = false;
                    cell.blur();
                }
            });
        });
    }

    showTableFormattingControls(cell) {
        // Remove any existing formatting controls
        this.hideTableFormattingControls();

        // Create formatting controls
        const controls = document.createElement('div');
        controls.className = 'table-formatting-controls';
        controls.innerHTML = `
            <div class="formatting-group">
                <button class="format-btn" data-format="bold"><i class="fas fa-bold"></i></button>
                <button class="format-btn" data-format="italic"><i class="fas fa-italic"></i></button>
                <button class="format-btn" data-format="underline"><i class="fas fa-underline"></i></button>
            </div>
            <div class="formatting-group">
                <input type="color" class="text-color" title="Text Color">
                <input type="color" class="bg-color" title="Background Color">
            </div>
            <div class="formatting-group">
                <select class="align-select">
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                </select>
            </div>
        `;

        // Position controls near the cell
        const rect = cell.getBoundingClientRect();
        controls.style.position = 'fixed';
        controls.style.top = `${rect.top - 40}px`;
        controls.style.left = `${rect.left}px`;
        controls.style.zIndex = '1000';

        // Add event listeners
        controls.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const format = btn.dataset.format;
                document.execCommand(format, false, null);
                btn.classList.toggle('active');
            });
        });

        controls.querySelector('.text-color').addEventListener('input', (e) => {
            document.execCommand('foreColor', false, e.target.value);
        });

        controls.querySelector('.bg-color').addEventListener('input', (e) => {
            cell.style.backgroundColor = e.target.value;
        });

        controls.querySelector('.align-select').addEventListener('change', (e) => {
            document.execCommand('justifyLeft', false, null);
            document.execCommand('justifyCenter', false, null);
            document.execCommand('justifyRight', false, null);
            cell.style.textAlign = e.target.value;
        });

        document.body.appendChild(controls);
    }

    hideTableFormattingControls() {
        const existingControls = document.querySelector('.table-formatting-controls');
        if (existingControls) {
            existingControls.remove();
        }
    }

    getYouTubeVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

// makeElementResizable(element) {
//         const directions = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];
    
//         directions.forEach(dir => {
//         const handle = document.createElement('div');
//             handle.className = `resize-handle resize-${dir}`;
//         element.appendChild(handle);

//         handle.addEventListener('mousedown', (e) => {
//             e.preventDefault();
//             e.stopPropagation();
    
//                 const startX = e.clientX;
//                 const startY = e.clientY;
//                 const startWidth = element.offsetWidth;
//                 const startHeight = element.offsetHeight;
//                 const startTop = element.offsetTop;
//                 const startLeft = element.offsetLeft;
    
//                 function onMouseMove(e) {
//                     const dx = e.clientX - startX;
//                     const dy = e.clientY - startY;
    
//                     let newWidth = startWidth;
//                     let newHeight = startHeight;
//                     let newTop = startTop;
//                     let newLeft = startLeft;
    
//                     if (dir.includes('e')) newWidth = startWidth + dx;
//                     if (dir.includes('s')) newHeight = startHeight + dy;
//                     if (dir.includes('w')) {
//                         newWidth = startWidth - dx;
//                         newLeft = startLeft + dx;
//                     }
//                     if (dir.includes('n')) {
//                         newHeight = startHeight - dy;
//                         newTop = startTop + dy;
//                     }
    
//                     if (newWidth > 30) {
//                         element.style.width = `${newWidth}px`;
//                         element.style.left = `${newLeft}px`;
//                     }
    
//                     if (newHeight > 30) {
//                         element.style.height = `${newHeight}px`;
//                         element.style.top = `${newTop}px`;
//                     }
//                 }
    
//                 function onMouseUp() {
//                     document.removeEventListener('mousemove', onMouseMove);
//                     document.removeEventListener('mouseup', onMouseUp);
//                     element.classList.remove('resizing');
//                 }
    
//                 document.addEventListener('mousemove', onMouseMove);
//                 document.addEventListener('mouseup', onMouseUp);
//                 element.classList.add('resizing');
//             });
//         });
//     }

//     initResize(e, element, position) {
//         e.preventDefault();
        
//         const startX = e.clientX;
//         const startY = e.clientY;
//         const startWidth = element.offsetWidth;
//         const startHeight = element.offsetHeight;
//         const startLeft = element.offsetLeft;
//         const startTop = element.offsetTop;
        
//         const minSize = 20;

//         const wrapper = document.createElement('div');
// wrapper.className = 'slide-element chart-wrapper';
// wrapper.style.position = 'absolute';
// wrapper.style.left = `${element.x}px`;
// wrapper.style.top = `${element.y}px`;
// wrapper.style.width = `${element.width}px`;
// wrapper.style.height = `${element.height}px`;
// wrapper.dataset.elementId = element.id;

// const canvas = document.createElement('canvas');
// canvas.width = element.width;
// canvas.height = element.height;
// wrapper.appendChild(canvas);
// currentSlide.appendChild(wrapper);

// this.makeElementDraggable(wrapper);
// this.makeElementResizable(wrapper);
//   this.makeElementRotatable(wrapper);

        
//         const onMouseMove = (e) => {
//             const dx = e.clientX - startX;
//             const dy = e.clientY - startY;
            
//             let newWidth = startWidth;
//             let newHeight = startHeight;
//             let newLeft = startLeft;
//             let newTop = startTop;
            
//             switch(position) {
//                 case 'n':
//                     newHeight = Math.max(startHeight - dy, minSize);
//                     newTop = startTop + (startHeight - newHeight);
//                     break;
//                 case 's':
//                     newHeight = Math.max(startHeight + dy, minSize);
//                     break;
//                 case 'e':
//                     newWidth = Math.max(startWidth + dx, minSize);
//                     break;
//                 case 'w':
//                     newWidth = Math.max(startWidth - dx, minSize);
//                     newLeft = startLeft + (startWidth - newWidth);
//                     break;
//                 case 'ne':
//                     newWidth = Math.max(startWidth + dx, minSize);
//                     newHeight = Math.max(startHeight - dy, minSize);
//                     newTop = startTop + (startHeight - newHeight);
//                     break;
//                 case 'nw':
//                     newWidth = Math.max(startWidth - dx, minSize);
//                     newHeight = Math.max(startHeight - dy, minSize);
//                     newLeft = startLeft + (startWidth - newWidth);
//                     newTop = startTop + (startHeight - newHeight);
//                     break;
//                 case 'se':
//                     newWidth = Math.max(startWidth + dx, minSize);
//                     newHeight = Math.max(startHeight + dy, minSize);
//                     break;
//                 case 'sw':
//                     newWidth = Math.max(startWidth - dx, minSize);
//                     newHeight = Math.max(startHeight + dy, minSize);
//                     newLeft = startLeft + (startWidth - newWidth);
//                     break;
//             }
            
//             element.style.width = `${newWidth}px`;
//             element.style.height = `${newHeight}px`;
//             element.style.left = `${newLeft}px`;
//             element.style.top = `${newTop}px`;
//         };
        
//         const onMouseUp = () => {
//             document.removeEventListener('mousemove', onMouseMove);
//             document.removeEventListener('mouseup', onMouseUp);
//             element.classList.remove('resizing');
            
//             // Update model and thumbnails when resizing ends
//             this.updateElementInModel(element, {
//                 width: parseInt(element.style.width),
//                 height: parseInt(element.style.height),
//                 x: parseInt(element.style.left),
//                 y: parseInt(element.style.top)
//             });
//         };
        
//         element.classList.add('resizing');
//         document.addEventListener('mousemove', onMouseMove);
//         document.addEventListener('mouseup', onMouseUp);
//     }


// class method: makeElementResizable(element)
makeElementResizable(element) {
  if (element._resizableInitialized) return; // avoid duplicate wiring
  element._resizableInitialized = true;

  const slide = this.currentSlideElement;
  const minSize = 24;

  // ensure handles exist (if your render already adds handles, this will skip creation)
  if (!element.querySelector('.resize-handle')) {
    const directions = ['n','e','s','w','ne','nw','se','sw'];
    directions.forEach(dir => {
      const handle = document.createElement('div');
      handle.className = `resize-handle resize-${dir}`;
      // small visible handle style (you already have CSS but ensure it exists)
      handle.style.position = 'absolute';
      handle.style.width = '10px';
      handle.style.height = '10px';
      handle.style.background = 'transparent';
      handle.style.zIndex = '999';
      // position via CSS classes in your stylesheet is preferred
      element.appendChild(handle);
    });
  }

  // bind handlers for every handle
  const handles = Array.from(element.querySelectorAll('.resize-handle'));

  handles.forEach(handle => {
    // determine direction from class e.g. resize-se => 'se'
    const dirClass = Array.from(handle.classList).find(c => c.startsWith('resize-') && c !== 'resize-handle');
    const dir = dirClass ? dirClass.split('-')[1] : 'se';

    const onMouseDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = element.offsetWidth;
      const startH = element.offsetHeight;
      const startL = element.offsetLeft;
      const startT = element.offsetTop;

      const slideW = slide.clientWidth;
      const slideH = slide.clientHeight;

      const onMouseMove = (m) => {
        let dx = m.clientX - startX;
        let dy = m.clientY - startY;

        let newW = startW;
        let newH = startH;
        let newL = startL;
        let newT = startT;

        if (dir.includes('e')) newW = startW + dx;
        if (dir.includes('s')) newH = startH + dy;
        if (dir.includes('w')) {
          newW = startW - dx;
          newL = startL + dx;
        }
        if (dir.includes('n')) {
          newH = startH - dy;
          newT = startT + dy;
        }

        // clamp minimum
        newW = Math.max(minSize, newW);
        newH = Math.max(minSize, newH);

        // clamp so element remains inside slide
        if (newL < 0) {
          // push width so left stays inside
          newW = newW + newL; // newL is negative
          newL = 0;
          newW = Math.max(minSize, newW);
        }
        if (newT < 0) {
          newH = newH + newT;
          newT = 0;
          newH = Math.max(minSize, newH);
        }
        if (newL + newW > slideW) {
          newW = slideW - newL;
          newW = Math.max(minSize, newW);
        }
        if (newT + newH > slideH) {
          newH = slideH - newT;
          newH = Math.max(minSize, newH);
        }

        // apply
        element.style.width = `${Math.round(newW)}px`;
        element.style.height = `${Math.round(newH)}px`;
        element.style.left = `${Math.round(newL)}px`;
        element.style.top = `${Math.round(newT)}px`;

        // update model immediately
        const elementId = parseInt(element.dataset.elementId || element.dataset.id);
        const modelEl = this.slides[this.currentSlideIndex].elements.find(e => e.id === elementId);
        if (modelEl) {
          modelEl.width = parseInt(element.style.width);
          modelEl.height = parseInt(element.style.height);
          modelEl.x = parseInt(element.style.left);
          modelEl.y = parseInt(element.style.top);
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        this.saveState?.();
        scheduleSlidesListUpdate();
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
  });
}

// makeElementResizable(element) {
//         const directions = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];
    
//         directions.forEach(dir => {
//         const handle = document.createElement('div');
//             handle.className = `resize-handle resize-${dir}`;
//         element.appendChild(handle);

//         handle.addEventListener('mousedown', (e) => {
//             e.preventDefault();
//             e.stopPropagation();
    
//                 const startX = e.clientX;
//                 const startY = e.clientY;
//                 const startWidth = element.offsetWidth;
//                 const startHeight = element.offsetHeight;
//                 const startTop = element.offsetTop;
//                 const startLeft = element.offsetLeft;
    
//                 function onMouseMove(e) {
//                     const dx = e.clientX - startX;
//                     const dy = e.clientY - startY;
    
//                     let newWidth = startWidth;
//                     let newHeight = startHeight;
//                     let newTop = startTop;
//                     let newLeft = startLeft;
    
//                     if (dir.includes('e')) newWidth = startWidth + dx;
//                     if (dir.includes('s')) newHeight = startHeight + dy;
//                     if (dir.includes('w')) {
//                         newWidth = startWidth - dx;
//                         newLeft = startLeft + dx;
//                     }
//                     if (dir.includes('n')) {
//                         newHeight = startHeight - dy;
//                         newTop = startTop + dy;
//                     }
    
//                     if (newWidth > 30) {
//                         element.style.width = `${newWidth}px`;
//                         element.style.left = `${newLeft}px`;
//                     }
    
//                     if (newHeight > 30) {
//                         element.style.height = `${newHeight}px`;
//                         element.style.top = `${newTop}px`;
//                     }
//                 }
    
//                 function onMouseUp() {
//                     document.removeEventListener('mousemove', onMouseMove);
//                     document.removeEventListener('mouseup', onMouseUp);
//                     element.classList.remove('resizing');
//                      // ✅ Update model
//     const elementId = parseInt(element.dataset.elementId);
//     const modelEl = presentation.slides[presentation.currentSlideIndex].elements.find(e => e.id === elementId);
//     if (modelEl) {
//         modelEl.width = parseFloat(element.style.width);
//         modelEl.height = parseFloat(element.style.height);
//         modelEl.x = parseFloat(element.style.left);
//         modelEl.y = parseFloat(element.style.top);
//     }
//                      presentation.saveState();
//     presentation.updateSlide();
//     presentation.updateSlidesList();
//                 }
    
//                 document.addEventListener('mousemove', onMouseMove);
//                 document.addEventListener('mouseup', onMouseUp);
//                 element.classList.add('resizing');
//                 presentation.saveState();              // Save undo state
// presentation.updateSlide();            // Rerender main slide (you likely already have this)
// presentation.updateSlidesList();       // 🔁 Rerender the sidebar thumbnail preview

//             });
//         });
//     }
 

    initResize(e, element, position) {
        e.preventDefault();
        
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = element.offsetWidth;
        const startHeight = element.offsetHeight;
        const startLeft = element.offsetLeft;
        const startTop = element.offsetTop;
        
        const minSize = 20;

        const wrapper = document.createElement('div');
wrapper.className = 'slide-element chart-wrapper';
wrapper.style.position = 'absolute';
wrapper.style.left = `${element.x}px`;
wrapper.style.top = `${element.y}px`;
wrapper.style.width = `${element.width}px`;
wrapper.style.height = `${element.height}px`;
wrapper.dataset.elementId = element.id;

const canvas = document.createElement('canvas');
canvas.width = element.width;
canvas.height = element.height;
wrapper.appendChild(canvas);
currentSlide.appendChild(wrapper);

this.makeElementDraggable(wrapper);
this.makeElementResizable(wrapper);
  this.makeElementRotatable(wrapper);

        
        const onMouseMove = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            
            let newWidth = startWidth;
            let newHeight = startHeight;
            let newLeft = startLeft;
            let newTop = startTop;
            
            switch(position) {
                case 'n':
                    newHeight = Math.max(startHeight - dy, minSize);
                    newTop = startTop + (startHeight - newHeight);
                    break;
                case 's':
                    newHeight = Math.max(startHeight + dy, minSize);
                    break;
                case 'e':
                    newWidth = Math.max(startWidth + dx, minSize);
                    break;
                case 'w':
                    newWidth = Math.max(startWidth - dx, minSize);
                    newLeft = startLeft + (startWidth - newWidth);
                    break;
                case 'ne':
                    newWidth = Math.max(startWidth + dx, minSize);
                    newHeight = Math.max(startHeight - dy, minSize);
                    newTop = startTop + (startHeight - newHeight);
                    break;
                case 'nw':
                    newWidth = Math.max(startWidth - dx, minSize);
                    newHeight = Math.max(startHeight - dy, minSize);
                    newLeft = startLeft + (startWidth - newWidth);
                    newTop = startTop + (startHeight - newHeight);
                    break;
                case 'se':
                    newWidth = Math.max(startWidth + dx, minSize);
                    newHeight = Math.max(startHeight + dy, minSize);
                    break;
                case 'sw':
                    newWidth = Math.max(startWidth - dx, minSize);
                    newHeight = Math.max(startHeight + dy, minSize);
                    newLeft = startLeft + (startWidth - newWidth);
                    break;
            }
            
            element.style.width = `${newWidth}px`;
            element.style.height = `${newHeight}px`;
            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
        };
        
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            element.classList.remove('resizing');
            
            // Update model and thumbnails when resizing ends
            this.updateElementInModel(element, {
                width: parseInt(element.style.width),
                height: parseInt(element.style.height),
                x: parseInt(element.style.left),
                y: parseInt(element.style.top)
            });
             presentation.saveState();
    presentation.updateSlide();
    presentation.updateSlidesList();
        };
        
        element.classList.add('resizing');
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        presentation.saveState();              // Save undo state
presentation.updateSlide();            // Rerender main slide (you likely already have this)
presentation.updateSlidesList();       // 🔁 Rerender the sidebar thumbnail preview

    }
    
    addShape(shapeType) {
        const element = {
            type: 'shape',
            shapeType,
            x: 100,
            y: 100,
            width: 100,
            height: 100,
            fillColor: 'transparent', // ✅ no default blue
            borderColor: '#000000',
            borderWidth: 2,
            id: Date.now()
        };
        
    
        this.slides[this.currentSlideIndex].elements.push(element);
       scheduleUIUpdate();
       this.saveState();
    }
    

updateShapeStyle(property, value) {
    const slide = this.slides[this.currentSlideIndex];
    const shape = slide.elements.find(el => el.id.toString() === this.selectedElementId && el.type === 'shape');

    if (!shape) return;

    if (property === 'fill') shape.fillColor = value;
    if (property === 'border') shape.borderColor = value;
    if (property === 'borderWidth') shape.borderWidth = parseInt(value);
    if (property === 'borderStyle') shape.borderStyle = value;

   scheduleUIUpdate();
}



    updateShapeStyle(property, value) {
        const selectedElement = document.querySelector('.slide-element.selected');
        if (!selectedElement) return;
    
        const elementId = selectedElement.dataset.elementId || selectedElement.dataset.id;
        const slide = this.slides[this.currentSlideIndex];
        const modelElement = slide.elements.find(el => el.id.toString() === elementId);
    
        if (!modelElement || modelElement.type !== 'shape') return;
    
        switch (property) {
            case 'fill':
                modelElement.fillColor = value;
    
                if (modelElement.shapeType === 'triangle') {
                    selectedElement.style.borderBottom = `${modelElement.height}px solid ${value}`;
                } else if (['lineChart', 'graph'].includes(modelElement.shapeType)) {
                    const svg = selectedElement.querySelector('svg');
                    if (svg) {
                        svg.querySelectorAll('[stroke], [fill]').forEach(el => {
                            if (el.hasAttribute('stroke')) el.setAttribute('stroke', value);
                            if (el.hasAttribute('fill')) el.setAttribute('fill', value);
                        });
                    }
                } else {
                    selectedElement.style.backgroundColor = value;
                }
                break;
    
            case 'border':
                modelElement.borderColor = value;
                selectedElement.style.borderColor = value;
                break;
    
            case 'borderWidth':
                modelElement.borderWidth = value;
                selectedElement.style.borderWidth = `${value}px`;
                break;
    
            case 'borderStyle':
                modelElement.borderStyle = value;
                selectedElement.style.borderStyle = value;
                break;
        }
    
       scheduleSlidesListUpdate(); // Update thumbnail previews
    }
    
    
    

    createShape(element, shapeType) {
        const shapeDiv = document.createElement('div');
        shapeDiv.className = `slide-element shape ${shapeType}`;
        shapeDiv.style.position = 'absolute';
        shapeDiv.style.left = element.x + 'px';
        shapeDiv.style.top = element.y + 'px';
        shapeDiv.style.width = element.width ? element.width + 'px' : '100px';
        shapeDiv.style.height = element.height ? element.height + 'px' : '100px';
    
        // Apply shape-specific styles
        switch (shapeType) {
            case 'line':
                shapeDiv.style.height = '2px';
                shapeDiv.style.backgroundColor = element.fillColor || '#000000';
                shapeDiv.style.transform = element.rotation ? `rotate(${element.rotation}deg)` : '';
                shapeDiv.style.transformOrigin = 'left center';
                shapeDiv.style.cursor = 'move';
                
                // Add resize handles for the line
                const startHandle = document.createElement('div');
                startHandle.className = 'resize-handle line-start';
                startHandle.style.cssText = `
                    position: absolute;
                    width: 10px;
                    height: 10px;
                    background: white;
                    border: 2px solid #007bff;
                    border-radius: 50%;
                    left: -5px;
                    top: -4px;
                    cursor: ew-resize;
                `;

                const endHandle = document.createElement('div');
                endHandle.className = 'resize-handle line-end';
                endHandle.style.cssText = `
                    position: absolute;
                    width: 10px;
                    height: 10px;
                    background: white;
                    border: 2px solid #007bff;
                    border-radius: 50%;
                    right: -5px;
                    top: -4px;
                    cursor: ew-resize;
                `;

                shapeDiv.appendChild(startHandle);
                shapeDiv.appendChild(endHandle);
                break;
            
            case 'rectangle':
                shapeDiv.style.backgroundColor = element.fillColor || '#007bff';
                break;
            
            case 'circle':
                shapeDiv.style.backgroundColor = element.fillColor || '#28a745';
                shapeDiv.style.borderRadius = '50%';
                break;
            
            case 'triangle':
                shapeDiv.style.width = '0';
                shapeDiv.style.height = '0';
                shapeDiv.style.borderLeft = `${element.width / 2}px solid transparent`;
                shapeDiv.style.borderRight = `${element.width / 2}px solid transparent`;
                shapeDiv.style.borderBottom = `${element.height}px solid ${element.fillColor || '#dc3545'}`;
                break;
        }

        // Add border styles if specified
        if (element.borderWidth) {
            shapeDiv.style.border = `${element.borderWidth}px ${element.borderStyle || 'solid'} ${element.borderColor || '#000'}`;
        }

        return shapeDiv;
    }

    moveElementToFront() {
    const selectedElement = this.selectedElement;
    if (!selectedElement) return;

    const elementModel = this.findElementModelFromDOM(selectedElement);
    if (!elementModel) return;

    const elements = this.currentSlide.elements;
    const index = elements.indexOf(elementModel);

    if (index > -1) {
        elements.splice(index, 1);
        elements.push(elementModel);

        // ✅ Update zIndex for all elements
        elements.forEach((el, i) => {
            el.zIndex = i + 1;
        });

       scheduleUIUpdate();
        this.saveState();
    }
}

 moveElementToBack() {
    const selectedElement = this.selectedElement;
    if (!selectedElement) return;

    const elementModel = this.findElementModelFromDOM(selectedElement);
    if (!elementModel) return;

    const elements = this.currentSlide.elements;
    const index = elements.indexOf(elementModel);

    if (index > -1) {
        elements.splice(index, 1);
        elements.unshift(elementModel);

        // ✅ Update zIndex for all elements
        elements.forEach((el, i) => {
            el.zIndex = i + 1;
        });

       scheduleUIUpdate();
        this.saveState();
    }
}


    savePresentation() {
        const presentationData = {
            slides: this.slides.map(slide => ({
                id: slide.id,
                elements: slide.elements.map(element => ({
                    ...element,
                    // Save the current position and size for each element
                    x: element.x,
                    y: element.y,
                    width: element.width || 200, // Default width if not set
                    height: element.height || 'auto',
                    style: {
                        backgroundColor: element.fillColor,
                        borderColor: element.borderColor,
                        borderWidth: element.borderWidth,
                        borderStyle: element.borderStyle,
                        transform: element.transform,
                        zIndex: element.zIndex,
                        fontSize: element.style?.fontSize,
                        fontFamily: element.style?.fontFamily,
                        color: element.style?.color,
                        fontWeight: element.style?.fontWeight,
                        fontStyle: element.style?.fontStyle,
                        textDecoration: element.style?.textDecoration,
                        lineHeight: element.style?.lineHeight,
                        letterSpacing: element.style?.letterSpacing,
                        textAlign: element.style?.textAlign
                    }
                }))
            }))
        };

        // Save to localStorage
        localStorage.setItem('savedPresentation', JSON.stringify(presentationData));
        alert('Presentation saved successfully!');
    }

    loadPresentation() {
        const savedData = localStorage.getItem('savedPresentation');
        if (savedData) {
            const presentationData = JSON.parse(savedData);
            this.slides = presentationData.slides.map(slide => ({
                ...slide,
                elements: slide.elements.map(element => ({
                    ...element,
                    // Ensure all properties are restored
                    x: element.x || 100,
                    y: element.y || 100,
                    width: element.width || 200,
                    height: element.height || 'auto',
                    fillColor: element.style?.backgroundColor || element.fillColor,
                    borderColor: element.style?.borderColor || element.borderColor,
                    borderWidth: element.style?.borderWidth || element.borderWidth,
                    borderStyle: element.style?.borderStyle || element.borderStyle,
                    transform: element.style?.transform || element.transform,
                      zIndex: element.style?.zIndex || element.zIndex,
                    style: {
                        fontSize: element.style?.fontSize,
                        fontFamily: element.style?.fontFamily,
                        color: element.style?.color,
                        fontWeight: element.style?.fontWeight,
                        fontStyle: element.style?.fontStyle,
                        textDecoration: element.style?.textDecoration,
                        lineHeight: element.style?.lineHeight,
                        letterSpacing: element.style?.letterSpacing,
                        textAlign: element.style?.textAlign
                    }
                }))
            }));
            this.currentSlideIndex = 0;
           scheduleUIUpdate();
            alert('Presentation loaded successfully!');
        }
    }

async saveAsHTML() {
        try {
            // First, convert all theme background images to base64
            const themeImages = {};
            for (const [themeName, theme] of Object.entries(themes)) {
                if (theme.backgroundImage && theme.backgroundImage !== 'none') {
                    const imageUrl = theme.backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1');
                    try {
                        const response = await fetch(imageUrl);
                        const blob = await response.blob();
                        const base64Data = await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                        themeImages[themeName] = base64Data;
                    } catch (err) {
                        console.error(`Failed to convert theme image for ${themeName}:`, err);
                        themeImages[themeName] = theme.backgroundImage; // Fallback to original URL
                    }
                }
            }

            // Include the presentation data and theme images as JSON strings in the HTML
            const presentationData = {
                slides: this.slides.map(slide => {
                    if (slide.theme) {
                        // Find the theme name and replace the background image with base64 version
                        const themeName = Object.keys(themes).find(name => 
                            themes[name].backgroundImage === slide.theme.backgroundImage
                        );
                        if (themeName && themeImages[themeName]) {
                            return {
                                ...slide,
                                theme: {
                                    ...slide.theme,
                                    backgroundImage: `url('${themeImages[themeName]}')`
                                }
                            };
                        }
                    }
                    return slide;
                }),
                currentTheme: this.currentTheme,
                viewSettings: this.viewSettings
            };

            const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Presentation</title>
                <style>
                    body, html {
                        margin: 0;
                        padding: 0;
                        width: 100vw;
                        height: 100vh;
                        object-fit: cover;
                        overflow: hidden;
                        background: #fff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .slide {
                        position: absolute;
                        width: 960px;
                        height: 540px;
                        background: white;
                        display: none;
                        transform-origin: center;
                        transition: opacity 0.5s ease-in-out;
                    }
                    .slide.active { display: block; opacity: 1; }
                    .slide.fade-out { opacity: 0; }
                    .slide.fade-in { opacity: 1; }
                    .slide-element { position: absolute; }
                    .slide-element img, .slide-element video { width: 100%; height: 100%; display: block; }
                    .chart-container { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                    .chart-container canvas { width: 100% !important; height: 100% !important; }
                    .link-element { cursor: pointer; text-decoration: underline; color: #0066cc; }
                    .link-indicator { position: absolute; top: 5px; right: 5px; background: rgba(255,255,255,0.8); padding: 5px; border-radius: 50%; z-index: 1000; pointer-events: none; }
                    table { border-collapse: collapse; width: 100%; }
                    td { padding: 8px; border: 1px solid #000; }
                    /* Shape styles */
                    .slide-element[class*="shape-"] {
                        background-size: cover;
                        background-repeat: no-repeat;
                        background-position: center;
                    }
                    .shape-rectangle { border-radius: 0; }
                    .shape-circle { border-radius: 50%; }
                    .shape-triangle { clip-path: polygon(50% 0%, 0% 100%, 100% 100%); }
                    .shape-line { 
                        width: 2px;
                        height: 100%;
                        transform-origin: center;
                    }
                    .shape-polygon { 
                        clip-path: polygon(50% 0%, 95% 25%, 80% 75%, 20% 75%, 5% 25%); 
                    }
                    .shape-arrow { 
                        clip-path: polygon(0% 40%, 60% 40%, 60% 20%, 100% 50%, 60% 80%, 60% 60%, 0% 60%); 
                    }
                    .shape-diamond { 
                        clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); 
                    }
                    .shape-pentagon { 
                        clip-path: polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%); 
                    }
                    .shape-hexagon { 
                        clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%); 
                    }
                    .shape-cloud {
                        clip-path: path('M 25,60 Q 25,40 40,40 Q 55,40 55,60 Q 70,60 70,45 Q 85,45 85,60 Q 85,75 70,75 L 40,75 Q 25,75 25,60 Z');
                    }
                    .shape-star { 
                        clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); 
                    }
                    .audio-container { position: relative; }
                    .audio-controls { display: flex; align-items: center; }
                    .play-pause-btn { border: none; background: #007bff; color: white; border-radius: 4px; }
                    .play-pause-btn:hover { background: #0056b3; }
                </style>
                <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
                <!-- Prism.js for code highlighting -->
                <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css" rel="stylesheet" />
                <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
                <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"></script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markup.min.js"></script>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
                <style>
                    .code-block {
                        background: #2d2d2d;
                        border-radius: 4px;
                        padding: 15px;
                        overflow: auto;
                    }
                    .code-block pre {
                        margin: 0;
                        padding: 0;
                        background: transparent;
                    }
                    .code-block code {
                        font-family: 'Fira Code', monospace;
                        font-size: 14px;
                        line-height: 1.5;
                    }
                </style>
            </head>
            <body>
                <script>
                    // Embed the presentation data
                    const presentationData = ${JSON.stringify(presentationData)};
                </script>
                ${this.slides.map((slide, index) => {
                    let bgStyle = '';
                    if (slide.customStyle?.backgroundColor) {
                        bgStyle = `background:${slide.customStyle.backgroundColor};`;
                    } else if (slide.theme) {
                        // Use the base64 image if available, otherwise fallback to original URL
                        const themeName = Object.keys(themes).find(name => 
                            themes[name].backgroundImage === slide.theme.backgroundImage
                        );
                        const bgImage = themeName && themeImages[themeName] 
                            ? `url('${themeImages[themeName]}')`
                            : slide.theme.backgroundImage;
                        
                        bgStyle = `
                            background: ${bgImage};
                            background-size: cover;
                            background-position: center;
                            color: ${slide.theme.textColor};
                        `;
                    }

                    return `
                        <div class="slide ${index === 0 ? 'active' : ''}" data-index="${index}" style="${bgStyle}">
                            ${slide.elements.map((element, eIndex) => {
                                let style = `position:absolute;left:${element.x}px;top:${element.y}px;width:${element.width || 200}px;height:${element.height || 100}px;z-index:${element.zIndex || 1};`;
                               let transform = '';
if (element.rotation) transform += `rotate(${element.rotation}deg) `;
if (element.flip) {
    if (element.flip.horizontal) transform += 'scaleX(-1) ';
    if (element.flip.vertical) transform += 'scaleY(-1) ';
}
if (transform) style += `transform:${transform.trim()};transform-origin:center;`;


                                let elementHtml = '';
                
                switch(element.type) {
                   case 'text':
    const isPlaceholder = element.isPlaceholder;
    const placeholderTexts = ['Click to add title', 'Click to add subtitle', 'Click to add text'];

    // ❌ Skip rendering if it's a placeholder and content not edited
    if (isPlaceholder && placeholderTexts.includes(element.content)) {
        elementHtml = ''; // explicitly set empty
        break;
    }

    const textStyle = element.style || {};
    elementHtml = `
        <div class="slide-element"
         style="
            position: absolute;
            left: ${element.x}px;
            top: ${element.y}px;
            width: ${element.width || 300}px;
            height: ${element.height || 100}px;
            font-size: ${textStyle.fontSize || '16px'};
            font-family: ${textStyle.fontFamily || 'Arial'};
            color: ${textStyle.color || '#000000'};
            font-weight: ${textStyle.fontWeight || 'normal'};
            font-style: ${textStyle.fontStyle || 'normal'};
            text-decoration: ${textStyle.textDecoration || 'none'};
            line-height: ${textStyle.lineHeight || 'normal'};
            letter-spacing: ${textStyle.letterSpacing || 'normal'};
            text-align: ${textStyle.textAlign || 'center'};
            white-space: pre-wrap;
            word-break: break-word;
            overflow: hidden;
        ">
        ${element.content}
    </div>`;
    break;

                                    
                                    case 'code':
                                        elementHtml = `
                                            <div class="slide-element code-block" style="${style}">
                                                <pre style="margin: 0; height: 100%; overflow: auto;"><code class="language-${element.language}">${element.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                                            </div>`;
                                        break;

                                   case 'image':
    elementHtml = `
        <div class="slide-element ${element.link ? 'link-element' : ''}" 
             style="position:absolute;
                    left:${element.x}px;
                    top:${element.y}px;
                    width:${element.width}px;
                    height:${element.height}px;
                    z-index:${element.zIndex || 1};
                    ${element.rotation ? `transform: rotate(${element.rotation}deg);` : ''}"
             ${element.link ? `data-link-type="${element.link.type}" 
                              data-link-target="${element.link.type === 'url' ? element.link.url : element.link.targetSlide}"` : ''}>
            <img src="${element.content}" 
                 style="width:100%; height:100%; object-fit:fill; background:transparent;">
            ${element.link ? '<div class="link-indicator"><i class="fas fa-link"></i></div>' : ''}
        </div>`;
    break;


                                    case 'video':
                                        elementHtml = `
                                            <div class="slide-element" style="${style}">
                                                <video src="${element.content}" controls></video>
                                            </div>`;
                                        break;

                                case 'audio':
    elementHtml = `
        <div class="slide-element" style="${style}">
            <audio src="${element.content}" 
                   data-slide-audio="true"
                   muted
                   playsinline
                   style="display:none;"></audio>
            <div class="audio-click-area" 
                 style="position:absolute;top:0;left:0;width:100%;height:100%;cursor:pointer;"></div>
            <script>
                (function(){
                    const audio = document.currentScript.previousElementSibling;
                    const clickArea = document.currentScript.previousElementSibling.previousElementSibling;
                    const slideElement = clickArea.closest('.slide-element'); // parent slide
                    if (!audio || !clickArea || !slideElement) return;

                    let isPlaying = false;

                    function toggleAudio() {
                        audio.muted = false;
                        if (isPlaying) {
                            audio.pause();
                        } else {
                            audio.play().catch(err => console.warn("Audio play failed:", err));
                        }
                        isPlaying = !isPlaying;
                    }

                    // Toggle audio by clicking the audio area
                    clickArea.addEventListener('click', function(e){
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        toggleAudio();
                    }, true);

                    // Toggle audio by pressing spacebar anywhere on slide
                    document.addEventListener('keydown', function(e){
                        if(e.code === 'Space') {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            toggleAudio();
                        }
                    }, true);

                    // Prevent slide change for clicks anywhere except links
                    slideElement.addEventListener('click', function(e){
                        if(!e.target.closest('a')) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                        }
                    }, true);
                })();
            </script>
        </div>`;
    break;






                               
case 'shape': {
    const width = element.width || 100;
    const height = element.height || 100;
    const stroke = `${element.borderColor || '#000'}`;
    const strokeWidth = element.borderWidth || 2;
    const fill = element.fillColor || 'transparent';
    const svgViewBox = `0 0 ${width} ${height}`;
    let shapeSVG = '';

    switch (element.shapeType) {
        case 'rectangle':
            shapeSVG = `<rect x="0" y="0" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
            break;
       case 'circle': {
    const cx = width / 2;
    const cy = height / 2;
    const rx = width / 2;
    const ry = height / 2;

    shapeSVG = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    break;
}

        case 'triangle':
            shapeSVG = `<polygon points="${width / 2},0 0,${height} ${width},${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
            break;
        case 'arrow':
            shapeSVG = `<polygon points="0,${height * 0.4} ${width * 0.6},${height * 0.4} ${width * 0.6},${height * 0.2} ${width},${height / 2} ${width * 0.6},${height * 0.8} ${width * 0.6},${height * 0.6} 0,${height * 0.6}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
            break;
        case 'diamond':
            shapeSVG = `<polygon points="${width / 2},0 ${width},${height / 2} ${width / 2},${height} 0,${height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
            break;
        case 'pentagon':
            shapeSVG = `<polygon points="${width / 2},0 ${width},${height * 0.38} ${width * 0.82},${height} ${width * 0.18},${height} 0,${height * 0.38}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
            break;
        case 'hexagon':
            shapeSVG = `<polygon points="${width * 0.25},0 ${width * 0.75},0 ${width},${height / 2} ${width * 0.75},${height} ${width * 0.25},${height} 0,${height / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
            break;
        case 'cloud':
            shapeSVG = `
                <path d="M ${width * 0.25},${height * 0.6} Q ${width * 0.25},${height * 0.4} ${width * 0.4},${height * 0.4} 
                         Q ${width * 0.55},${height * 0.4} ${width * 0.55},${height * 0.6} 
                         Q ${width * 0.7},${height * 0.6} ${width * 0.7},${height * 0.45} 
                         Q ${width * 0.85},${height * 0.45} ${width * 0.85},${height * 0.6} 
                         Q ${width * 0.85},${height * 0.75} ${width * 0.7},${height * 0.75} 
                         L ${width * 0.4},${height * 0.75} 
                         Q ${width * 0.25},${height * 0.75} ${width * 0.25},${height * 0.6} Z"
                      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
            break;
        case 'star':
            shapeSVG = `<polygon points="${width * 0.5},0 ${width * 0.61},${height * 0.35} ${width * 0.98},${height * 0.35} ${width * 0.68},${height * 0.57} ${width * 0.79},${height * 0.91} ${width * 0.5},${height * 0.7} ${width * 0.21},${height * 0.91} ${width * 0.32},${height * 0.57} ${width * 0.02},${height * 0.35} ${width * 0.39},${height * 0.35}" 
                        fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
            break;
        case 'line':
            shapeSVG = `<line x1="0" y1="0" x2="${width}" y2="${height}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
            break;
        case 'polygon':
            shapeSVG = `<polygon points="${width * 0.5},0 ${width * 0.95},${height * 0.25} ${width * 0.8},${height * 0.75} ${width * 0.2},${height * 0.75} ${width * 0.05},${height * 0.25}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
            break;
        default:
            shapeSVG = `<rect x="0" y="0" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }

   elementHtml = `
    <div class="slide-element" 
         style="position:absolute;
                left:${element.x}px;
                top:${element.y}px;
                width:${width}px;
                height:${height}px;
                z-index:${element.zIndex || 1};
                ${element.rotation ? `transform: rotate(${element.rotation}deg); transform-origin: center;` : ''}">
        <svg viewBox="${svgViewBox}" 
             width="100%" 
             height="100%" 
             preserveAspectRatio="none">
            ${shapeSVG}
        </svg>
    </div>`;

    break;
}


    case 'table':
                                        elementHtml = `
                                            <div class="slide-element" style="${style}">${element.content}</div>`;
                                        break;

                                    case 'chart':
                                        elementHtml = `
                                            <div class="slide-element chart-container" style="${style}">
                                                <canvas id="chart${index}_${eIndex}" width="${element.width}" height="${element.height}"></canvas>
                                            </div>`;
                                        break;
                                }
                                return elementHtml;
                            }).join('')}
                        </div>`;
                }).join('')}

                <script>
                    let currentSlideIndex = 0;
                    const slides = document.querySelectorAll('.slide');
                    
                    // Initialize presentation
                    function initPresentation() {
                        showSlide(0);
                        setupControls();
                        scaleSlides();
                        setupLinks();
                        renderCharts();
                        // Highlight all code blocks
                        document.querySelectorAll('pre code').forEach((block) => {
                            Prism.highlightElement(block);
                        });
                    }
                    
                    // Setup links
                    function setupLinks() {
                        document.querySelectorAll('.link-element').forEach(element => {
                            element.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const linkType = element.dataset.linkType;
                                const linkTarget = element.dataset.linkTarget;
                                if (linkType === 'url') {
                                    window.open(linkTarget, '_blank');
                                } else if (linkType === 'slide') {
                                    showSlide(parseInt(linkTarget));
                                }
                            });
                        });
                    }
                    
                    function showSlide(index) {
                        // Stop and reset any currently playing audio
                        document.querySelectorAll('audio[data-slide-audio="true"]').forEach(audio => {
                            audio.pause();
                            audio.currentTime = 0;
                            audio.muted = true;
                        });

                        slides.forEach(slide => {
                            slide.classList.remove('active');
                            slide.classList.add('fade-out');
                        });
                        
                        slides[index].classList.remove('fade-out');
                        slides[index].classList.add('active', 'fade-in');
                        currentSlideIndex = index;

                        // Play audio elements in the new slide
                        const newSlideAudios = slides[index].querySelectorAll('audio[data-slide-audio="true"]');
                        newSlideAudios.forEach(audio => {
                            audio.muted = false;
                            audio.play().catch(error => {
                                console.warn('Auto-play failed:', error);
                                // If autoplay fails, we'll unmute but require user interaction to play
                                audio.muted = false;
                            });
                        });
                    }
                    
                    function nextSlide() {
                        const nextIndex = Math.min(currentSlideIndex + 1, slides.length - 1);
                        showSlide(nextIndex);
                    }
                    
                    function previousSlide() {
                        const prevIndex = Math.max(currentSlideIndex - 1, 0);
                        showSlide(prevIndex);
                    }
                    
                    // Controls
                    function setupControls() {
                        document.addEventListener('keydown', (e) => {
                            switch(e.key) {
                                case 'ArrowRight': case ' ': case 'n': e.preventDefault(); nextSlide(); break;
                                case 'ArrowLeft': case 'Backspace': case 'p': e.preventDefault(); previousSlide(); break;
                                case 'Home': e.preventDefault(); showSlide(0); break;
                                case 'End': e.preventDefault(); showSlide(slides.length - 1); break;
                            }
                        });
                        document.addEventListener('click', (e) => {
                            if (e.target.closest('.link-element')) return;
                            const clickX = e.clientX, windowWidth = window.innerWidth;
                            if (clickX < windowWidth * 0.3) previousSlide();
                            else if (clickX > windowWidth * 0.7) nextSlide();
                        });
                        let touchStartX = 0;
                        document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
                        document.addEventListener('touchend', (e) => {
                            const deltaX = touchStartX - e.changedTouches[0].clientX;
                            if (Math.abs(deltaX) > 50) deltaX > 0 ? nextSlide() : previousSlide();
                        });
                    }
                    
                    // Scale slides to fit viewport
                    function scaleSlides() {
                        const viewportWidth = window.innerWidth;
                        const viewportHeight = window.innerHeight;
                        const slideWidth = 960;
                        const slideHeight = 540;
                        const scale = Math.min(viewportWidth / slideWidth, viewportHeight / slideHeight);
                        
                        slides.forEach(slide => {
                            slide.style.transform = \`scale(\${scale})\`;
                        });
                    }
                    
                    window.addEventListener('resize', scaleSlides);
                    
                    // Render Charts
                    function renderCharts() {
                        ${this.slides.map((slide, sIndex) => 
                            slide.elements.map((element, eIndex) => 
                                element.type === 'chart' ? `
                                new Chart(document.getElementById('chart${sIndex}_${eIndex}').getContext('2d'), {
                                    type: '${element.chartType}',
                                    data: {
                                        labels: ${JSON.stringify(element.allLabels)},
                                        datasets: ${JSON.stringify(element.datasets.map(ds => ({
                                            label: ds.label,
                                            data: element.allLabels.map(l => {
                                                const idx = ds.labels.indexOf(l);
                                                return idx >= 0 ? ds.data[idx] : 0;
                                            }),
                                            backgroundColor: ds.color,
                                            borderColor: ds.color,
                                            fill: element.chartType !== 'line',
                                            tension: 0.4
                                        })))}
                                    },
                                    options: {
                                        responsive: true,
                                        maintainAspectRatio: false,
                                        plugins: {
                                            legend: {
                                                position: 'top',
                                                labels: {
                                                    padding: 10,
                                                    usePointStyle: true
                                                }
                                            },
                                            tooltip: {
                                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                                padding: 10,
                                                cornerRadius: 4
                                            }
                                        },
                                        scales: {
                                            x: {
                                                grid: {
                                                    display: false
                                                }
                                            },
                                            y: {
                                                beginAtZero: true,
                                                grid: {
                                                    color: 'rgba(0, 0, 0, 0.1)'
                                                }
                                            }
                                        },
                                        animation: {
                                            duration: 1000,
                                            easing: 'easeInOutQuart'
                                        }
                                    }
                                });` : ''
                            ).join('')
                        ).join('')}
                    }
                    document.addEventListener('DOMContentLoaded', initPresentation);
                </script>
            </body>
            </html>`;
            // Download
           const blob = new Blob([htmlContent], { type: 'text/html' });
        // ✅ Use File Picker if supported
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'presentation.html',
                    types: [{
                        description: 'HTML Files',
                        accept: { 'text/html': ['.html'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();

                showToast("Presentation saved successfully.");
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log("Save cancelled by user.");
                    showToast("Save cancelled.");
                } else {
                    console.error("Save error:", error);
                    alert("Error saving file: " + error.message);
                }
            }
        } else {
            // ❌ Fallback to auto-download (no folder dialog)
            let filename = prompt("Enter the file name", "presentation.html");
            if (!filename) return; // Cancel if empty

            if (!filename.toLowerCase().endsWith('.html')) {
                filename += '.html';
            }
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
            showToast("File downloaded (browser default folder).");
        }
    } catch (err) {
        console.error('Error during saveAsHTML:', err);
        alert('Error: ' + err.message);
    }
}


   addAudioElement() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const objectURL = URL.createObjectURL(file);

        const element = {
            type: 'audio',
            content: objectURL,           // Used in editor
            preview: objectURL,           // Optional fallback logic
            autoplay: false,
            loop: false,
            x: 100,
            y: 100,
            width: 100,
            height: 50,
            id: Date.now(),
            zIndex: this.getNextZIndex?.() || 1,
            playButtonImage: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwb2x5Z29uIHBvaW50cz0iMTAgOCAxNiAxMiAxMCAxNiAxMCA4Ii8+PC9zdmc+'
        };

        this.slides[this.currentSlideIndex].elements.push(element);
        scheduleUIUpdate();

        // Optional: if you want to export later, load as base64
        const reader = new FileReader();
        reader.onload = (event) => {
            element.content = event.target.result; // base64 for saving/export
        };
        reader.readAsDataURL(file);
    };

    input.click();
    this.saveState();
}


    
normalizeZIndices() {
    const slideElements = this.slides[this.currentSlideIndex].elements;

    // Sort by current zIndex ascending
    slideElements.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

    // Reassign sequential zIndex starting from 1
    slideElements.forEach((el, index) => {
        el.zIndex = index + 1;
        const dom = document.querySelector(`.slide-element[data-element-id="${el.id}"]`);
        if (dom) dom.style.zIndex = el.zIndex;
    });
}

moveElementUpward() {
    const selectedElement = document.querySelector('.slide-element.selected');
    if (!selectedElement) return;

    const currentZ = parseInt(selectedElement.style.zIndex) || 1;
    const elementId = parseInt(selectedElement.dataset.elementId);
    const slide = this.slides[this.currentSlideIndex];

    // Find all elements
    const elements = slide.elements;

    // Find element in model
    const current = elements.find(el => el.id === elementId);
    if (!current) return;

    // Find next element with higher zIndex
    const above = elements.find(el => el.zIndex === current.zIndex + 1);
    if (above) above.zIndex -= 1;

    current.zIndex += 1;

    this.normalizeZIndices();

    selectedElement.classList.add('moving-up');
    setTimeout(() => selectedElement.classList.remove('moving-up'), 200);

    this.saveState?.();
    scheduleUIUpdate?.();
    scheduleSlidesListUpdate?.();
}

moveElementDownward() {
    const selectedElement = document.querySelector('.slide-element.selected');
    if (!selectedElement) return;

    const currentZ = parseInt(selectedElement.style.zIndex) || 1;
    const elementId = parseInt(selectedElement.dataset.elementId);
    const slide = this.slides[this.currentSlideIndex];

    const elements = slide.elements;
    const current = elements.find(el => el.id === elementId);
    if (!current) return;

    // Find element just below
    const below = elements.find(el => el.zIndex === current.zIndex - 1);
    if (below) below.zIndex += 1;

    current.zIndex = Math.max(current.zIndex - 1, 1);

    this.normalizeZIndices();

    selectedElement.classList.add('moving-down');
    setTimeout(() => selectedElement.classList.remove('moving-down'), 200);

    this.saveState?.();
    scheduleUIUpdate?.();
    scheduleSlidesListUpdate?.();
}


applyTheme(themeName) {
    const theme = themes[themeName];
    
    if (!theme) {
        console.error('Theme not found:', themeName);
        return;
    }

    // Save current state to undo stack
    this.saveState();

    // Apply theme to current slide
    this.currentSlideElement = document.getElementById('currentSlide');

    if (currentSlide) {
        currentSlide.style.background = theme.backgroundImage;
        currentSlide.style.backgroundSize = 'cover';
        currentSlide.style.backgroundPosition = 'center';
        currentSlide.style.color = theme.textColor;
    }

    // Store current theme
    this.currentTheme = themeName;

    // Update all slides in the data model with the theme
    this.slides = this.slides.map(slide => ({
        ...slide,
        theme: {
            backgroundImage: theme.backgroundImage,
            textColor: theme.textColor
        }
    }));

    // Update the UI to reflect changes
   scheduleUIUpdate();
}

addSlideLink(element, targetSlideIndex) {
    // 1. Style cursor and mark as linked
    element.style.cursor = 'pointer';
    element.dataset.linkToSlide = targetSlideIndex;
    element.classList.add('has-link');

    // 2. Avoid adding duplicate visual indicators
    if (!element.querySelector('.link-indicator')) {
        const linkIndicator = document.createElement('div');
        linkIndicator.className = 'link-indicator';
        linkIndicator.innerHTML = '<i class="fas fa-link"></i>';
        linkIndicator.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(255, 255, 255, 0.8);
            padding: 5px;
            border-radius: 50%;
            z-index: 1000;
            pointer-events: none;
        `;
        element.appendChild(linkIndicator);
    }

    // 3. Remove existing conflicting click handlers (if any)
    const newClickHandler = (e) => {
        if (!document.querySelector('.presentation-mode.active')) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        this.currentSlideIndex = parseInt(targetSlideIndex);
        this.updatePresentationSlide();
    };

    element.removeEventListener('click', newClickHandler); // No-op (won't work unless same ref)
    element.onclick = null; // Clear direct handler if exists
    element.addEventListener('click', newClickHandler);

    // 4. Prevent drag/select conflict
    element.addEventListener('mousedown', (e) => {
        if (element.dataset.linkToSlide) {
            e.preventDefault();
            e.stopPropagation();
        }
    });
}

// Add this method to track element changes
updateElementInModel(element, changes) {
    const elementId = parseInt(element.dataset.id);
    const slideElement = this.slides[this.currentSlideIndex].elements.find(el => el.id === elementId);
    if (slideElement) {
        this.saveState(); // Save state before updating
        Object.assign(slideElement, changes);
        this.saveState(); // Save state after updating
       scheduleSlidesListUpdate();
    }
}

// Add this method to your Presentation class
initBlankAreaSelector() {
    this.currentSlideElement = document.getElementById('currentSlide');

    if (!currentSlide) return;
    
    let selectionBox = null;
    let isSelecting = false;
    let startX, startY;

    currentSlide.addEventListener('mousedown', (e) => {
        // Only start selection if clicking on the currentSlide or its direct children
        if (e.target === currentSlide || e.target.parentElement === currentSlide) {
            e.preventDefault();
            
            // Remove any existing selection boxes first
            const existingBoxes = document.querySelectorAll('.selection-box');
            existingBoxes.forEach(box => box.remove());

            isSelecting = true;
            const rect = currentSlide.getBoundingClientRect();
            startX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            startY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

            selectionBox = document.createElement('div');
            selectionBox.className = 'selection-box';
            selectionBox.style.left = `${startX}px`;
            selectionBox.style.top = `${startY}px`;
            selectionBox.style.width = '0';
            selectionBox.style.height = '0';
            currentSlide.appendChild(selectionBox);

            if (!e.shiftKey) {
                document.querySelectorAll('.slide-element.selected').forEach(el => {
                    el.classList.remove('selected');
                });
            }
        }
    });

    const updateSelection = (e) => {
        if (!isSelecting || !selectionBox) return;

        const rect = currentSlide.getBoundingClientRect();
        const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        selectionBox.style.left = `${left}px`;
        selectionBox.style.top = `${top}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;

        const selectionRect = {
            left,
            right: left + width,
            top,
            bottom: top + height
        };

        // Only select elements that are within the currentSlide
        currentSlide.querySelectorAll('.slide-element').forEach(element => {
            const elementRect = element.getBoundingClientRect();
            const elementRelativeRect = {
                left: elementRect.left - rect.left,
                right: elementRect.right - rect.left,
                top: elementRect.top - rect.top,
                bottom: elementRect.bottom - rect.top
            };

            // Check if the element is within the slide boundaries
            if (elementRelativeRect.left >= 0 && 
                elementRelativeRect.right <= rect.width &&
                elementRelativeRect.top >= 0 && 
                elementRelativeRect.bottom <= rect.height) {
                
                const intersects = !(
                    elementRelativeRect.right < selectionRect.left ||
                    elementRelativeRect.left > selectionRect.right ||
                    elementRelativeRect.bottom < selectionRect.top ||
                    elementRelativeRect.top > selectionRect.bottom
                );

                if (intersects) {
                    element.classList.add('selected');
                } else if (!e.shiftKey) {
                    element.classList.remove('selected');
                }
            }
        });
    };

    document.addEventListener('mousemove', updateSelection);

    document.addEventListener('mouseup', () => {
        if (isSelecting) {
            isSelecting = false;
            if (selectionBox) {
                const selectedElements = Array.from(currentSlide.querySelectorAll('.slide-element.selected'));
                selectionBox.remove();
                selectionBox = null;

                // Update the model
                this.selectedElements = selectedElements.map(el => {
                    const id = parseInt(el.dataset.id || el.dataset.elementId);
                    return this.slides[this.currentSlideIndex].elements.find(elem => elem.id === id);
                }).filter(Boolean);

                // Ensure selected state is maintained
                selectedElements.forEach(el => {
                    el.classList.add('selected');
                });
            }
        }
    });

    // Prevent text selection during drag
    currentSlide.addEventListener('selectstart', (e) => {
        if (isSelecting) {
            e.preventDefault();
        }
    });
}

// Add this to your CSS
addSelectionStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .selection-box {
            position: absolute;
            border: 2px dashed #4a90e2;
            background-color: rgba(74, 144, 226, 0.1);
            pointer-events: none;
            z-index: 1000;
        }

        .slide-element.selected {
            outline: 2px solid #4a90e2;
            outline-offset: 2px;
        }

        .current-slide {
            position: relative;
            user-select: none;
        }
    `;
    document.head.appendChild(style);
}

// Add this method to show the quick action menu
showQuickActionMenu(x, y, width, height) {
    const menu = document.createElement('div');
    menu.className = 'quick-action-menu';
    menu.innerHTML = `
        <div class="quick-action-item" data-action="text">
            <i class="fas fa-font"></i> Add Text
        </div>
        <div class="quick-action-item" data-action="image">
            <i class="fas fa-image"></i> Add Image
        </div>
        <div class="quick-action-item" data-action="shape">
            <i class="fas fa-shapes"></i> Add Shape
        </div>
        <div class="quick-action-item" data-action="table">
            <i class="fas fa-table"></i> Add Table
        </div>
    `;

    // Position menu near selection
    menu.style.left = `${x + width/2}px`;
    menu.style.top = `${y + height/2}px`;

    this.currentSlideElement = document.getElementById('currentSlide');

    currentSlide.appendChild(menu);

    // Handle menu item clicks
    menu.addEventListener('click', (e) => {
        const action = e.target.closest('.quick-action-item')?.dataset.action;
        if (action) {
            switch(action) {
                case 'text':
                    this.addTextElement('click to edit', x, y, width, height);
                    break;
                case 'image':
                    this.addImageElement(x, y, width, height);
                    break;
                case 'shape':
                    this.addShape('rectangle', x, y, width, height);
                    break;
                case 'table':
                    this.addTableElement(x, y, width, height);
                    break;
            }
            currentSlide.removeChild(menu);
        }
    });

    // Remove menu when clicking outside
    const removeMenu = (e) => {
        if (!menu.contains(e.target)) {
            currentSlide.removeChild(menu);
            document.removeEventListener('click', removeMenu);
        }
    };
    
    // Delay adding the click listener to prevent immediate removal
    setTimeout(() => {
        document.addEventListener('click', removeMenu);
    }, 0);
}

// Add this method to your Presentation class
// initContextMenu() {
//     const contextMenu = document.createElement('div');
//     contextMenu.className = 'context-menu';
//     contextMenu.style.display = 'none';
//     document.body.appendChild(contextMenu);

//     document.addEventListener('contextmenu', (e) => {
//         e.preventDefault();
//         const currentSlide = document.getElementById('currentSlide');
//         if (!currentSlide) return;
        
//         const element = e.target.closest('.slide-element');
//         const isEmptyArea = e.target === currentSlide;
        
//         // Position menu at cursor, but keep it within the slide area and viewport
//         const menuWidth = 180; // Adjust if your menu is wider
//         const menuHeight = 260; // Adjust if your menu is taller
//         const padding = 8;
//         const slideRect = currentSlide.getBoundingClientRect();

//         let left = e.clientX - slideRect.left;
//         let top = e.clientY - slideRect.top;

//         // Clamp right edge to slide
//         if (left + menuWidth > slideRect.right) {
//             left = slideRect.right - menuWidth - padding;
//         }
//         // If not enough space below, always show above the cursor
//         if (top + menuHeight > slideRect.bottom) {
//             top = top - menuHeight - padding;
//             if (top < slideRect.top + padding) top = slideRect.top + padding;
//         }
//         // Clamp left edge to slide
//         if (left < slideRect.left + padding) left = slideRect.left + padding;
//         // Clamp top edge to slide
//         if (top < slideRect.top + padding) top = slideRect.top + padding;

//         contextMenu.style.left = `${left}px`;
//         contextMenu.style.top = `${top}px`;
        
//         let menuItems = '';

//         if (element) {
//             // Get the element data using both possible attribute names
//             const elementId = element.dataset.elementId || element.dataset.id;
//             const elementData = this.slides[this.currentSlideIndex].elements
//                 .find(el => el.id.toString() === elementId);

//             if (!elementData) return;

//             // Store the element ID in the context menu for later use
//             contextMenu.dataset.elementId = elementId;

//             // Common menu items for all elements
//             menuItems = `
//                 <div class="context-menu-item" data-action="copy">
//                     <i class="fas fa-copy"></i> Copy (Ctrl+C)
//                 </div>
//                 <div class="context-menu-item" data-action="cut">
//                     <i class="fas fa-cut"></i> Cut (Ctrl+X)
//                 </div>
//                 <div class="context-menu-item" data-action="duplicate">
//                     <i class="fas fa-clone"></i> Duplicate
//                 </div>
//                 <div class="context-menu-separator"></div>
//                 <div class="context-menu-item" data-action="delete">
//                     <i class="fas fa-trash"></i> Delete
//                 </div>
//                 <div class="context-menu-separator"></div>
//             `;

//             // Add type-specific options
//             if (elementData.type === 'text') {
//                 menuItems += `
//                     <div class="context-menu-item" data-action="bold">
//                         <i class="fas fa-bold"></i> Bold
//                     </div>
//                     <div class="context-menu-item" data-action="italic">
//                         <i class="fas fa-italic"></i> Italic
//                     </div>
//                     <div class="context-menu-item" data-action="underline">
//                         <i class="fas fa-underline"></i> Underline
//                     </div>
//                     <div class="context-menu-separator"></div>
//                 `;
//             } else if (elementData.type === 'audio') {
//                 const isPlaying = element.querySelector('audio')?.paused === false;
//                 menuItems += `
//                     <div class="context-menu-item" data-action="${isPlaying ? 'pause-audio' : 'play-audio'}">
//                         <i class="fas fa-${isPlaying ? 'pause' : 'play'}"></i> ${isPlaying ? 'Pause' : 'Play'} Audio
//                     </div>
//                     <div class="context-menu-item" data-action="replace-audio">
//                         <i class="fas fa-exchange-alt"></i> Replace Audio
//                     </div>
//                     <div class="context-menu-separator"></div>
//                 `;
//             }  else if (elementData.type === 'chart') {
//                 menuItems += `
//                     <div class="context-menu-item" data-action="edit-chart">
//                         <i class="fas fa-edit"></i> Edit Chart
//                     </div>
//                     <div class="context-menu-separator"></div>
//                 `;
//             } else if (elementData.type === 'table') {
//                 menuItems += `
//                     <div class="context-menu-item" data-action="edit-table">
//                         <i class="fas fa-edit"></i> Edit Table
//                     </div>
//                     <div class="context-menu-separator"></div>
//                 `;
//             }

//             // Add link/unlink options
//             if (elementData.link) {
//                 menuItems += `
//                     <div class="context-menu-item" data-action="unlink">
//                         <i class="fas fa-unlink"></i> Remove Link
//                     </div>
//                 `;
//             } else {
//                 menuItems += `
//                     <div class="context-menu-item" data-action="addlink">
//                         <i class="fas fa-link"></i> Add Link
//                     </div>
//                 `;
//             }

//             menuItems += `
//                 <div class="context-menu-separator"></div>
//                 <div class="context-menu-item" data-action="bring-front">
//                     <i class="fas fa-level-up-alt"></i> Bring to Front
//                 </div>
//                 <div class="context-menu-item" data-action="send-back">
//                     <i class="fas fa-level-down-alt"></i> Send to Back
//                 </div>
//             `;

//         } else if (isEmptyArea) {
//             const copiedData = localStorage.getItem('copiedElement');

//             menuItems = `
//                 ${copiedData ? `
//                     <div class="context-menu-item" data-action="paste">
//                         <i class="fas fa-paste"></i> Paste (Ctrl+V)
//                     </div>
//                     <div class="context-menu-separator"></div>
//                 ` : ''}
//                 <div class="context-menu-item" data-action="addtext">
//                     <i class="fas fa-font"></i> Add Text
//                 </div>
//                 <div class="context-menu-item" data-action="addimage">
//                     <i class="fas fa-image"></i> Add Image
//                 </div>
//                 <div class="context-menu-item" data-action="addaudio">
//                     <i class="fas fa-music"></i> Add Audio
//                 </div>
//                 <div class="context-menu-item" data-action="addshape">
//                     <i class="fas fa-shapes"></i> Add Shape
//                 </div>
//                 <div class="context-menu-item" data-action="addtable">
//                     <i class="fas fa-table"></i> Add Table
//                 </div>
//                 <div class="context-menu-item" data-action="saveAsHTML">
//                     <i class="fas fa-code"></i> save as HTML
//                 </div>
//                  <div class="context-menu-item" data-action="saveaspdf">
//                     <i class="fas fa-file-pdf"></i> save as Pdf
//                 </div>
//             `;
//         }

//         // menuItems += `
//         //     <div class="context-menu-separator"></div>
//         //     <div class="context-menu-item" data-action="properties">
//         //         <i class="fas fa-cog"></i> Properties
//         //     </div>
//         // `;

//         contextMenu.innerHTML = menuItems;
//         contextMenu.style.display = 'block';
//     });

//     // Handle context menu item clicks
//     contextMenu.addEventListener('click', (e) => {
//         const action = e.target.closest('.context-menu-item')?.dataset.action;
//         if (!action) return;

//         const elementId = contextMenu.dataset.elementId;
//         let element = null;
//         let elementDiv = null;

//         if (elementId) {
//             element = this.slides[this.currentSlideIndex].elements
//                 .find(el => el.id.toString() === elementId);

//             if (element) {
//                 this.selectedElement = element;
//                 this.selectedElementId = element.id;

//                 elementDiv = document.querySelector(`.slide-element[data-element-id="${elementId}"], .slide-element[data-id="${elementId}"]`);
//                 if (elementDiv) {
//                     document.querySelectorAll('.slide-element').forEach(el => el.classList.remove('selected'));
//                     elementDiv.classList.add('selected');
//                 }
//             }
//         }

//         switch(action) {
//             // Element actions
//             case 'copy':
//                 this.copyElement(element);
//                 break;
//             case 'cut':
//                 this.copyElement(element);
//                 this.deleteElement();
//                 break;
//             case 'paste':
//                 this.pasteElement();
//                 break
//             case 'duplicate':
//                 this.duplicateElement();
//                 break;
//             case 'delete':
//                 this.deleteElement();
//                 break;
//             case 'unlink':
//                 this.removeLink();
//                 break;
//             case 'addlink':
//                 this.createLink();
//                 break;
//             case 'bring-front':
//                 this.moveElementUpward();
//                 break;
//             case 'send-back':
//                 this.moveElementDownward();
//                 break;
//             // Text formatting
//             case 'bold':
//                 this.formatText('bold');
//                 break;
//             case 'italic':
//                 this.formatText('italic');
//                 break;
//             case 'underline':
//                 this.formatText('underline');
//                 break;
//             // Audio controls
//             case 'play-audio':
//                 if (elementDiv) {
//                     const audio = elementDiv.querySelector('audio');
//                     if (audio) audio.play();
//                 }
//                 break;
//             case 'pause-audio':
//                 if (elementDiv) {
//                     const audio = elementDiv.querySelector('audio');
//                     if (audio) audio.pause();
//                 }
//                 break;
//             case 'replace-audio':
//                 if (element) this.replaceSelectedMedia('audio');
//                 break;
//                  case 'edit-chart':
//                 if (element && element.type === 'chart') {
//                     this.editChart(element);
//                 }
//                 break;
//             case 'edit-table':
//                 if (element && element.type === 'table') {
//                     this.editTable(element);
//                 }
//                 break;
//             // Empty area actions
//             case 'addtext':
//                 this.addTextElement('click to edit', e.clientX, e.clientY);
//                 break;
//             case 'addimage':
//                 this.addImageElement();
//                 break;
//             case 'addaudio':
//                 this.addAudioElement();
//                 break;
//             case 'addshape':
//                 this.addShape('rectangle', e.clientX, e.clientY);
//                 break;
//             case 'addtable':
//                 this.addTableElement();
//                 break;
//             case 'saveAsHTML':
//                     this.saveAsHTML();
//                     break; 
//                     case 'saveaspdf':
//                        this.exportToPDF()
//                         break;
//             // case 'properties':
//             //     if (element) {
//             //         this.showElementProperties(element);
//             //     } else {
//             //         this.showSlideProperties();
//             //     }
//                 break;
//         }
        
//         contextMenu.style.display = 'none';
//     });

//     // Hide context menu when clicking outside
//     document.addEventListener('click', () => {
//         contextMenu.style.display = 'none';
//     });

//     // Hide context menu when scrolling
//     document.addEventListener('scroll', () => {
//         contextMenu.style.display = 'none';
//     });
//     // Hide context menu when typing (keyboard input)
// document.addEventListener('keydown', () => {
//     contextMenu.style.display = 'none';
// });

// // Hide context menu when user types in editable text
// document.addEventListener('input', () => {
//     contextMenu.style.display = 'none';
// });

// }









// initContextMenu() {
//     const contextMenu = document.createElement('div');
//     contextMenu.className = 'context-menu';
//     contextMenu.style.display = 'none';
//     document.body.appendChild(contextMenu);

//     document.addEventListener('contextmenu', (e) => {
//         e.preventDefault();
//         const currentSlide = document.getElementById('currentSlide');
//         if (!currentSlide) return;

//         const element = e.target.closest('.slide-element');
//         const isEmptyArea = e.target === currentSlide;

//         // Handle selected text copying
//         const selection = window.getSelection();
//         const selectedText = selection && selection.toString().trim();
//         const isTextSelected = selectedText && element?.querySelector('[contenteditable="true"]')?.contains(selection.anchorNode);

//         let menuItems = '';

//         if (isTextSelected) {
//             contextMenu.dataset.textOnly = 'true';
//             localStorage.setItem('copiedTextOnly', selectedText);
//             menuItems = `
//                 <div class="context-menu-item" data-action="copy-text-only">
//                     <i class="fas fa-copy"></i> Copy
//                 </div>
//             `;
//             contextMenu.innerHTML = menuItems;
//             contextMenu.style.left = `${e.clientX}px`;
//             contextMenu.style.top = `${e.clientY}px`;
//             contextMenu.style.display = 'block';
//             return;
//         }

//         // Position menu at cursor, but keep it within the slide area and viewport
//         const menuWidth = 180;
//         const menuHeight = 260;
//         const padding = 8;
//         const slideRect = currentSlide.getBoundingClientRect();

//         let left = e.clientX - slideRect.left;
//         let top = e.clientY - slideRect.top;

//         if (left + menuWidth > slideRect.right) {
//             left = slideRect.right - menuWidth - padding;
//         }
//         if (top + menuHeight > slideRect.bottom) {
//             top = top - menuHeight - padding;
//             if (top < slideRect.top + padding) top = slideRect.top + padding;
//         }
//         if (left < slideRect.left + padding) left = slideRect.left + padding;
//         if (top < slideRect.top + padding) top = slideRect.top + padding;

//         contextMenu.style.left = `${left}px`;
//         contextMenu.style.top = `${top}px`;

//         if (element) {
//             const elementId = element.dataset.elementId || element.dataset.id;
//             const elementData = this.slides[this.currentSlideIndex].elements.find(el => el.id.toString() === elementId);
//             if (!elementData) return;

//             contextMenu.dataset.elementId = elementId;

//             menuItems = `


initContextMenu() {
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.style.display = 'none';
    document.body.appendChild(contextMenu);

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // const currentSlide = document.getElementById('currentSlide');
        //   if (!currentSlide || !currentSlide.contains(e.target)) return; 
        // if (!currentSlide) return;
const currentSlide = document.getElementById('currentSlide');
if (!currentSlide || !currentSlide.contains(e.target)) return; // Don't allow outside

const slideRect = currentSlide.getBoundingClientRect();
let left = e.clientX - slideRect.left;
let top = e.clientY - slideRect.top;


        const element = e.target.closest('.slide-element');
        const isEmptyArea = e.target === currentSlide;

        const selection = window.getSelection();
        const selectedText = selection && selection.toString().trim();
        const isTextSelected = selectedText && element?.querySelector('[contenteditable="true"]')?.contains(selection.anchorNode);

        let menuItems = '';
 



        // Store full element if right-clicked on an element
        if (element) {
            const elementId = element.dataset.elementId || element.dataset.id;
            const elementData = this.slides[this.currentSlideIndex].elements.find(el => el.id.toString() === elementId);
            if (elementData) {
                contextMenu.dataset.elementId = elementId;
                localStorage.setItem('copiedElement', JSON.stringify(elementData));
            }
        }

        // Store selected text if applicable
      if (isTextSelected) {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        this.savedTextRange = sel.getRangeAt(0).cloneRange(); // 👈 Add this
    }
            menuItems += `
                <div class="context-menu-item" data-action="copy-text-only">
                    <i class="fas fa-copy"></i> Copy Text
                </div>
                <div class="context-menu-item" data-action="cut-text-only">
                    <i class="fas fa-cut"></i> Cut Text
                </div>
                 <div class="context-menu-item" data-action="delete-text-only">
                    <i class="fas fa-times"></i> Delete Text
                </div>
            `;
        }

        if (element) {
            const elementId = element.dataset.elementId || element.dataset.id;
            const elementData = this.slides[this.currentSlideIndex].elements.find(el => el.id.toString() === elementId);
            if (!elementData) return;

            menuItems += `
                <div class="context-menu-item" data-action="copy">
                    <i class="fas fa-copy"></i> Copy Element
                </div>
                <div class="context-menu-item" data-action="cut">
                    <i class="fas fa-cut"></i> Cut
                </div>
                <div class="context-menu-item" data-action="duplicate">
                    <i class="fas fa-clone"></i> Duplicate
                </div>
                <div class="context-menu-separator"></div>
                <div class="context-menu-item" data-action="delete">
                    <i class="fas fa-trash"></i> Delete
                </div>
                    <div class="context-menu-item" data-action="bold">
                        <i class="fas fa-bold"></i> Bold
                    </div>
                    <div class="context-menu-item" data-action="italic">
                        <i class="fas fa-italic"></i> Italic
                    </div>
                    <div class="context-menu-item" data-action="underline">
                        <i class="fas fa-underline"></i> Underline
                    </div>
                    <div class="context-menu-separator"></div>
                `;
             if (elementData) {
    // Type-specific actions
    if (elementData.type === 'audio') {
        const isPlaying = element.querySelector('audio')?.paused === false;
        menuItems += `
            <div class="context-menu-item" data-action="${isPlaying ? 'pause-audio' : 'play-audio'}">
                <i class="fas fa-${isPlaying ? 'pause' : 'play'}"></i> ${isPlaying ? 'Pause' : 'Play'} Audio
            </div>
            <div class="context-menu-item" data-action="replace-audio">
                <i class="fas fa-exchange-alt"></i> Replace Audio
            </div>
            <div class="context-menu-separator"></div>
        `;
    } else if (elementData.type === 'chart') {
        menuItems += `
            <div class="context-menu-item" data-action="edit-chart">
                <i class="fas fa-chart-bar"></i> Edit Chart
            </div>
            <div class="context-menu-separator"></div>
        `;
    } else if (elementData.type === 'table') {
        menuItems += `
            <div class="context-menu-item" data-action="edit-table">
                <i class="fas fa-table"></i> Edit Table
            </div>
            <div class="context-menu-separator"></div>
        `;
    }

    // Link options
    if (elementData.link) {
        menuItems += `
            <div class="context-menu-item" data-action="unlink">
                <i class="fas fa-unlink"></i> Remove Link
            </div>
        `;
    } else {
        menuItems += `
            <div class="context-menu-item" data-action="addlink">
                <i class="fas fa-link"></i> Add Link
            </div>
        `;
    }

    // Bring to front / Send to back
    menuItems += `
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" data-action="bring-front">
            <i class="fas fa-layer-group"></i> Bring to Front
        </div>
        <div class="context-menu-item" data-action="send-back">
            <i class="fas fa-layer-group fa-flip-vertical"></i> Send to Back
        </div>
    `;
    
                // Add link/unlink options
            if (elementData.link) {
                menuItems += `
                    <div class="context-menu-item" data-action="unlink">
                        <i class="fas fa-unlink"></i> Remove Link
                    </div>
                `;
            } else {
                menuItems += `
                    <div class="context-menu-item" data-action="addlink">
                        <i class="fas fa-link"></i> Add Link
                    </div>
                `;
            }

} else if (isEmptyArea) {
    // User right-clicked blank space
    const copiedData = localStorage.getItem('copiedElement');
    let hasValidPaste = false;

    try {
        const parsed = JSON.parse(copiedData);
        if (parsed && (typeof parsed.content === 'string' || typeof parsed.x === 'number')) {
            hasValidPaste = true;
        }
    } catch (e) {
        hasValidPaste = false;
    }

    menuItems += `
        <div class="context-menu-item" data-action="add-text">
            <i class="fas fa-font"></i> Add Text
        </div>
        <div class="context-menu-item" data-action="insert-image">
            <i class="fas fa-image"></i> Insert Image
        </div>
        <div class="context-menu-item" data-action="insert-audio">
            <i class="fas fa-volume-up"></i> Insert Audio
        </div>
        <div class="context-menu-item" data-action="insert-chart">
            <i class="fas fa-chart-bar"></i> Insert Chart
        </div>
        <div class="context-menu-item" data-action="insert-table">
            <i class="fas fa-table"></i> Insert Table
        </div>
        <div class="context-menu-separator"></div>
    `;

    if (hasValidPaste) {
        menuItems += `
            <div class="context-menu-item" data-action="paste">
                <i class="fas fa-paste"></i> Paste
            </div>
        `;
    }
}



           const copiedText = localStorage.getItem('copiedTextOnly');
if ((isTextSelected || (elementData?.type === 'text' && copiedText))) {
    menuItems += `
        <div class="context-menu-item" data-action="paste-text-only">
            <i class="fas fa-paste"></i> Paste Text
        </div>
    `;
}

            menuItems += `
                <div class="context-menu-item" data-action="paste">
                    <i class="fas fa-paste"></i> Paste Element
                </div>
            `;
            
        } else if (isEmptyArea) {
            const copiedData = localStorage.getItem('copiedElement');
            const copiedText = localStorage.getItem('copiedTextOnly');

            if (copiedText) {
                menuItems += `
                    <div class="context-menu-item" data-action="paste-text-only">
                        <i class="fas fa-paste"></i> Paste Text
                    </div>
                `;
            }

            if (copiedData) {
                menuItems += `
                    <div class="context-menu-item" data-action="paste">
                        <i class="fas fa-paste"></i> Paste Element
                    </div>
                `;
            }

            menuItems += `
                <div class="context-menu-separator"></div>
                <div class="context-menu-item" data-action="addtext">
                    <i class="fas fa-font"></i> Add Text
                </div>
                <div class="context-menu-item" data-action="addimage">
                    <i class="fas fa-image"></i> Add Image
                </div>
                <div class="context-menu-item" data-action="addaudio">
                    <i class="fas fa-music"></i> Add Audio
                </div>
                <div class="context-menu-item" data-action="addshape">
                    <i class="fas fa-shapes"></i> Add Shape
                </div>
                <div class="context-menu-item" data-action="addtable">
                    <i class="fas fa-table"></i> Add Table
                </div>
                <div class="context-menu-item" data-action="saveAsHTML">
                    <i class="fas fa-code"></i> Save as HTML
                </div>
                <div class="context-menu-item" data-action="saveaspdf">
                    <i class="fas fa-file-pdf"></i> Save as PDF
                </div>
            `;
        }
contextMenu.innerHTML = menuItems;

// ✅ Position calculation to avoid overflow
contextMenu.style.display = 'block';
contextMenu.style.left = '0px';
contextMenu.style.top = '0px';

const menuRect = contextMenu.getBoundingClientRect();

if (left + menuRect.width > slideRect.width) {
    left = slideRect.width - menuRect.width - 8;
}
if (top + menuRect.height > slideRect.height) {
    top = top - menuRect.height;
    if (top < 8) top = 8;
}

contextMenu.style.left = `${slideRect.left + left}px`;
contextMenu.style.top = `${slideRect.top + top}px`;

        contextMenu.style.display = 'block';
    });

    contextMenu.addEventListener('click', (e) => {
        const action = e.target.closest('.context-menu-item')?.dataset.action;
        if (!action) return;

        const elementId = contextMenu.dataset.elementId;
        const elementDiv = document.querySelector(`.slide-element[data-element-id="${elementId}"], .slide-element[data-id="${elementId}"]`);
        const element = this.slides[this.currentSlideIndex].elements.find(el => el.id.toString() === elementId);

        switch (action) {
            case 'copy-text-only': {
    const editable = elementDiv?.querySelector('[contenteditable="true"]');
    const range = this.savedTextRange;
    if (editable && range && editable.contains(range.startContainer)) {
        editable.focus();
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const copied = sel.toString();
        if (copied) {
            localStorage.setItem('copiedTextOnly', copied);
            sel.removeAllRanges();
            this.savedTextRange = null;
            this.showNotification?.('Text copied');
        }
    }
    break;
}

   case 'cut-text-only': {
    const editable = elementDiv?.querySelector('[contenteditable="true"]');
    const range = this.savedTextRange;
    if (editable && range && editable.contains(range.startContainer)) {
        editable.focus();
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const cutText = sel.toString();
        if (cutText) {
            localStorage.setItem('copiedTextOnly', cutText);
            range.deleteContents();
            sel.removeAllRanges();
            this.savedTextRange = null;
            this.showNotification?.('Text cut');

            const id = elementDiv.dataset.elementId || elementDiv.dataset.id;
            const slide = this.slides[this.currentSlideIndex];
            const element = slide.elements.find(el => el.id == id);
            if (element) {
                element.content = editable.innerHTML;
                this.saveState(); // ✅ Save after cut
            }
        }
    }
    break;



}case 'delete-text-only': {
    const editable = elementDiv?.querySelector('[contenteditable="true"]');
    if (editable && this.savedTextRange) {
        editable.focus();
        const range = this.savedTextRange;
        if (editable.contains(range.startContainer)) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            range.deleteContents();
            sel.removeAllRanges();
            this.savedTextRange = null;
            this.showNotification?.('Text deleted');

            // ✅ Update model
            const id = elementDiv.dataset.elementId || elementDiv.dataset.id;
            const slide = this.slides[this.currentSlideIndex];
            const element = slide.elements.find(el => el.id == id);
            if (element) {
                element.content = editable.innerHTML;
                this.saveState(); // ✅ Save for undo/redo
            }
        }
    }
    break;
}



         case 'paste-text-only': {
    const copied = localStorage.getItem('copiedTextOnly');
    if (!copied) return;

    const editable = elementDiv?.querySelector('[contenteditable="true"]');
    if (!editable) return;

    editable.focus();

    const sel = window.getSelection();
    sel.removeAllRanges();

    let range = this.savedTextRange;

    // Make sure range is valid and still inside the editable div
    if (!range || !editable.contains(range.startContainer)) {
        // fallback: place cursor at end
        range = document.createRange();
        range.selectNodeContents(editable);
        range.collapse(false); // collapse to end
    }

    sel.addRange(range);
    range.deleteContents();
    range.insertNode(document.createTextNode(copied));
    range.collapse(false);

    this.savedTextRange = null;
    this.showNotification?.('Text pasted');
    break;
}

            case 'copy':
                this.copyElement(element);
                break;
            case 'cut':
                this.copyElement(element);
                this.deleteElement();
                break;
            case 'paste':
                this.pasteElement();
                break;
            case 'duplicate':
                this.duplicateElement();
                break;
            case 'delete':
                this.deleteElement();
                break;
             case 'unlink':
                this.removeLink();
                break;
            case 'addlink':
                this.createLink();
                break;
            case 'bring-front':
                this.moveElementUpward();
                break;
            case 'send-back':
                this.moveElementDownward();
                break;
            case 'bold':
                this.formatText('bold');
                break;
            case 'italic':
                this.formatText('italic');
                break;
            case 'underline':
                this.formatText('underline');
                break;
            case 'play-audio':
                if (elementDiv) elementDiv.querySelector('audio')?.play();
                break;
            case 'pause-audio':
                if (elementDiv) elementDiv.querySelector('audio')?.pause();
                break;
            case 'replace-audio':
                if (element) this.replaceSelectedMedia('audio');
                break;
            case 'edit-chart':
                if (element && element.type === 'chart') this.editChart(element);
                break;
            case 'edit-table':
                if (element && element.type === 'table') this.editTable(element);
                break;
            case 'addtext':
                this.addTextElement('click to edit', e.clientX, e.clientY);
                break;
            case 'addimage':
                this.addImageElement();
                break;
            case 'addaudio':
                this.addAudioElement();
                break;
            case 'addshape':
                this.addShape('rectangle', e.clientX, e.clientY);
                break;
            case 'addtable':
                this.addTableElement();
                break;
            case 'saveAsHTML':
                this.saveAsHTML();
                break;
            case 'saveaspdf':
                this.exportToPDF();
                break;
        }

        contextMenu.style.display = 'none';
    });

    ['click', 'scroll', 'keydown', 'input'].forEach(evt => {
        document.addEventListener(evt, () => {
            contextMenu.style.display = 'none';
        });
    });
    document.addEventListener('mousedown', (e) => {
    const editable = e.target.closest('[contenteditable="true"]');
    if (editable) {
        setTimeout(() => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0).cloneRange();
                this.savedTextRange = range;
            }
        }, 0); // wait for cursor to place
    }
});

}

// initContextMenu() {
//     const contextMenu = document.createElement('div');
//     contextMenu.className = 'context-menu';
//     contextMenu.style.display = 'none';
//     document.body.appendChild(contextMenu);

//     document.addEventListener('contextmenu', (e) => {
//         e.preventDefault();
//         const currentSlide = document.getElementById('currentSlide');
//         if (!currentSlide) return;

//         const element = e.target.closest('.slide-element');
//         const isEmptyArea = e.target === currentSlide;

//         // Handle selected text copying
//         const selection = window.getSelection();
//         const selectedText = selection && selection.toString().trim();
//         const isTextSelected = selectedText && element?.querySelector('[contenteditable="true"]')?.contains(selection.anchorNode);

//         let menuItems = '';

//         if (isTextSelected) {
//             contextMenu.dataset.textOnly = 'true';
//             localStorage.setItem('copiedTextOnly', selectedText);
//             menuItems = `
//                 <div class="context-menu-item" data-action="copy-text-only">
//                     <i class="fas fa-copy"></i> Copy
//                 </div>
//             `;
//             contextMenu.innerHTML = menuItems;
//             contextMenu.style.left = `${e.clientX}px`;
//             contextMenu.style.top = `${e.clientY}px`;
//             contextMenu.style.display = 'block';
//             return;
//         }

//         // Position menu at cursor, but keep it within the slide area and viewport
//         const menuWidth = 180;
//         const menuHeight = 260;
//         const padding = 8;
//         const slideRect = currentSlide.getBoundingClientRect();

//         let left = e.clientX - slideRect.left;
//         let top = e.clientY - slideRect.top;

//         if (left + menuWidth > slideRect.right) {
//             left = slideRect.right - menuWidth - padding;
//         }
//         if (top + menuHeight > slideRect.bottom) {
//             top = top - menuHeight - padding;
//             if (top < slideRect.top + padding) top = slideRect.top + padding;
//         }
//         if (left < slideRect.left + padding) left = slideRect.left + padding;
//         if (top < slideRect.top + padding) top = slideRect.top + padding;

//         contextMenu.style.left = `${left}px`;
//         contextMenu.style.top = `${top}px`;

//         if (element) {
//             const elementId = element.dataset.elementId || element.dataset.id;
//             const elementData = this.slides[this.currentSlideIndex].elements.find(el => el.id.toString() === elementId);
//             if (!elementData) return;

//             contextMenu.dataset.elementId = elementId;

//             menuItems = `
//                 <div class="context-menu-item" data-action="copy">
//                     <i class="fas fa-copy"></i> Copy (Ctrl+C)
//                 </div>
//                 <div class="context-menu-item" data-action="cut">
//                     <i class="fas fa-cut"></i> Cut (Ctrl+X)
//                 </div>
//                 <div class="context-menu-item" data-action="duplicate">
//                     <i class="fas fa-clone"></i> Duplicate
//                 </div>
//                 <div class="context-menu-separator"></div>
//                 <div class="context-menu-item" data-action="delete">
//                     <i class="fas fa-trash"></i> Delete
//                 </div>
//                 <div class="context-menu-separator"></div>
//             `;

//             if (elementData.type === 'text' && localStorage.getItem('copiedTextOnly')) {
//                 menuItems += `
//                     <div class="context-menu-item" data-action="paste-text-only">
//                         <i class="fas fa-paste"></i> Paste
//                     </div>
//                     <div class="context-menu-separator"></div>
                
           
//                     <div class="context-menu-item" data-action="bold">
//                         <i class="fas fa-bold"></i> Bold
//                     </div>
//                     <div class="context-menu-item" data-action="italic">
//                         <i class="fas fa-italic"></i> Italic
//                     </div>
//                     <div class="context-menu-item" data-action="underline">
//                         <i class="fas fa-underline"></i> Underline
//                     </div>
//                     <div class="context-menu-separator"></div>
//                 `;
//             } else if (elementData.type === 'audio') {
//                 const isPlaying = element.querySelector('audio')?.paused === false;
//                 menuItems += `
//                     <div class="context-menu-item" data-action="${isPlaying ? 'pause-audio' : 'play-audio'}">
//                         <i class="fas fa-${isPlaying ? 'pause' : 'play'}"></i> ${isPlaying ? 'Pause' : 'Play'} Audio
//                     </div>
//                     <div class="context-menu-item" data-action="replace-audio">
//                         <i class="fas fa-exchange-alt"></i> Replace Audio
//                     </div>
//                     <div class="context-menu-separator"></div>
//                 `;
//             }  else if (elementData.type === 'chart') {
//                 menuItems += `
//                     <div class="context-menu-item" data-action="edit-chart">
//                         <i class="fas fa-edit"></i> Edit Chart
//                     </div>
//                     <div class="context-menu-separator"></div>
//                 `;
//             } else if (elementData.type === 'table') {
//                 menuItems += `
//                     <div class="context-menu-item" data-action="edit-table">
//                         <i class="fas fa-edit"></i> Edit Table
//                     </div>
//                     <div class="context-menu-separator"></div>
//                 `;
//             }

//             // Add link/unlink options
//             if (elementData.link) {
//                 menuItems += `
//                     <div class="context-menu-item" data-action="unlink">
//                         <i class="fas fa-unlink"></i> Remove Link
//                     </div>
//                 `;
//             } else {
//                 menuItems += `
//                     <div class="context-menu-item" data-action="addlink">
//                         <i class="fas fa-link"></i> Add Link
//                     </div>
//                 `;
//             }

//             menuItems += `
//                 <div class="context-menu-separator"></div>
//                 <div class="context-menu-item" data-action="bring-front">
//                     <i class="fas fa-level-up-alt"></i> Bring to Front
//                 </div>
//                 <div class="context-menu-item" data-action="send-back">
//                     <i class="fas fa-level-down-alt"></i> Send to Back
//                 </div>
//             `;

//         } else if (isEmptyArea) {
//             const copiedData = localStorage.getItem('copiedElement');

//             menuItems = `
//                 ${copiedData ? `
//                     <div class="context-menu-item" data-action="paste">
//                         <i class="fas fa-paste"></i> Paste (Ctrl+V)
//                     </div>
//                     <div class="context-menu-separator"></div>
//                 ` : ''}
//                 <div class="context-menu-item" data-action="addtext">
//                     <i class="fas fa-font"></i> Add Text
//                 </div>
//                 <div class="context-menu-item" data-action="addimage">
//                     <i class="fas fa-image"></i> Add Image
//                 </div>
//                 <div class="context-menu-item" data-action="addaudio">
//                     <i class="fas fa-music"></i> Add Audio
//                 </div>
//                 <div class="context-menu-item" data-action="addshape">
//                     <i class="fas fa-shapes"></i> Add Shape
//                 </div>
//                 <div class="context-menu-item" data-action="addtable">
//                     <i class="fas fa-table"></i> Add Table
//                 </div>
//                 <div class="context-menu-item" data-action="saveAsHTML">
//                     <i class="fas fa-code"></i> save as HTML
//                 </div>
//                  <div class="context-menu-item" data-action="saveaspdf">
//                     <i class="fas fa-file-pdf"></i> save as Pdf
//                 </div>
//             `;
//         }

//         // menuItems += `
//         //     <div class="context-menu-separator"></div>
//         //     <div class="context-menu-item" data-action="properties">
//         //         <i class="fas fa-cog"></i> Properties
//         //     </div>
//         // `;
    
//         contextMenu.innerHTML = menuItems;
//         contextMenu.style.display = 'block';
//     });

//     contextMenu.addEventListener('click', (e) => {
//         const action = e.target.closest('.context-menu-item')?.dataset.action;
//         if (!action) return;

//         const elementId = contextMenu.dataset.elementId;
//         const elementDiv = document.querySelector(`.slide-element[data-element-id="${elementId}"]`);

//         switch (action) {
//             case 'copy-text-only':
//                 this.showNotification?.('Text copied');
//                 break;

//             case 'paste-text-only': {
//                 const copied = localStorage.getItem('copiedTextOnly');
//                 if (!copied) return;
//                 const editable = elementDiv?.querySelector('[contenteditable="true"]');
//                 if (editable) {
//                     editable.focus();
//                     const sel = window.getSelection();
//                     if (!sel.rangeCount) return;
//                     const range = sel.getRangeAt(0);
//                     range.deleteContents();
//                     range.insertNode(document.createTextNode(copied));
//                     range.collapse(false);
//                     sel.removeAllRanges();
//                     sel.addRange(range);
//                     this.showNotification?.('Text pasted');
//                 }
//                 break;
//             }
//             case 'copy ': 
//             this.copyElement();
//             break;
//              case 'cut':
//                 this.copyElement(element);
//                 this.deleteElement();
//                 break;
//             case 'paste':
//                 this.pasteElement();
//                 break
//             case 'duplicate':
//                 this.duplicateElement();
//                 break;
//             case 'delete':
//                 this.deleteElement();
//                 break;
//             case 'unlink':
//                 this.removeLink();
//                 break;
//             case 'addlink':
//                 this.createLink();
//                 break;
//             case 'bring-front':
//                 this.moveElementUpward();
//                 break;
//             case 'send-back':
//                 this.moveElementDownward();
//                 break;
//             // Text formatting
//             case 'bold':
//                 this.formatText('bold');
//                 break;
//             case 'italic':
//                 this.formatText('italic');
//                 break;
//             case 'underline':
//                 this.formatText('underline');
//                 break;
//             // Audio controls
//             case 'play-audio':
//                 if (elementDiv) {
//                     const audio = elementDiv.querySelector('audio');
//                     if (audio) audio.play();
//                 }
//                 break;
//             case 'pause-audio':
//                 if (elementDiv) {
//                     const audio = elementDiv.querySelector('audio');
//                     if (audio) audio.pause();
//                 }
//                 break;
//             case 'replace-audio':
//                 if (element) this.replaceSelectedMedia('audio');
//                 break;
//                  case 'edit-chart':
//                 if (element && element.type === 'chart') {
//                     this.editChart(element);
//                 }
//                 break;
//             case 'edit-table':
//                 if (element && element.type === 'table') {
//                     this.editTable(element);
//                 }
//                 break;
//             // Empty area actions
//             case 'addtext':
//                 this.addTextElement('click to edit', e.clientX, e.clientY);
//                 break;
//             case 'addimage':
//                 this.addImageElement();
//                 break;
//             case 'addaudio':
//                 this.addAudioElement();
//                 break;
//             case 'addshape':
//                 this.addShape('rectangle', e.clientX, e.clientY);
//                 break;
//             case 'addtable':
//                 this.addTableElement();
//                 break;
//             case 'saveAsHTML':
//                     this.saveAsHTML();
//                     break; 
//                     case 'saveaspdf':
//                        this.exportToPDF()
//                         break;
//         }

//         contextMenu.style.display = 'none';
//     });

//     document.addEventListener('click', () => {
//         contextMenu.style.display = 'none';
//     });

//     document.addEventListener('scroll', () => {
//         contextMenu.style.display = 'none';
//     });

//     document.addEventListener('keydown', () => {
//         contextMenu.style.display = 'none';
//     });

//     document.addEventListener('input', () => {
//         contextMenu.style.display = 'none';
//     });
// }

// Remove the second initContextMenu function
// ... existing code ...

// Add these methods to handle copy/paste functionality


copyElement(element) {
   const selectedEls = Array.from(document.querySelectorAll('.slide-element.selected'));
  if (!selectedEls.length) return;

  const slideModel = this.slides[this.currentSlideIndex];
  const copied = [];

  selectedEls.forEach(el => {
    const id = parseInt(el.dataset.elementId || el.dataset.id);
    const modelEl = slideModel.elements.find(m => m.id === id);
    if (modelEl) {
      copied.push(JSON.parse(JSON.stringify(modelEl)));
    }
  });

  // ✅ Only keep this copy, discard old one
  this.clipboard = copied;
  this.cutMode = false;
}



pasteElement() {
 if (!this.clipboard || !this.clipboard.length) return;

  const slideModel = this.slides[this.currentSlideIndex];

  this.clipboard.forEach(item => {
    const clone = JSON.parse(JSON.stringify(item));
    clone.id = Date.now() + Math.floor(Math.random() * 1000);
    clone.x = (item.x || 20) + 20;
    clone.y = (item.y || 20) + 20;
    slideModel.elements.push(clone);
  });

  if (this.cutMode) {
    this.clipboard = null;
    this.cutMode = false;
  }

  scheduleUIUpdate();
  this.saveState();
}



// duplicateElement() {
//     const selectedElements = document.querySelectorAll('.slide-element.selected');
//     if (selectedElements.length === 0) return;

//     // Save current state for undo
//     this.saveState();

//     const offsetX = 20;
//     const offsetY = 20;
//     const timestamp = Date.now();

//     selectedElements.forEach((element, index) => {
//         const elementId = parseInt(element.dataset.elementId);
//         const elementData = this.slides[this.currentSlideIndex].elements.find(el => el.id === elementId);
        
//         if (elementData) {
//             // Create a deep clone of the element data
//             const newElement = JSON.parse(JSON.stringify(elementData));
            
//             // Update necessary properties
//             newElement.id = timestamp + index; // Ensure unique ID
//             newElement.x = elementData.x + offsetX;
//             newElement.y = elementData.y + offsetY;
            
//             // Ensure all required properties exist
//             if (!newElement.flip) {
//                 newElement.flip = { horizontal: false, vertical: false };
//             }
//             if (!newElement.rotation) {
//                 newElement.rotation = 0;
//             }
//             if (!newElement.zIndex) {
//                 newElement.zIndex = elementData.zIndex || 1;
//             }
            
//             // Preserve style properties
//             if (elementData.style) {
//                 newElement.style = { ...elementData.style };
//             }
            
//             // Preserve element-specific properties
//             if (elementData.type === 'shape') {
//                 newElement.shapeType = elementData.shapeType;
//                 newElement.fillColor = elementData.fillColor;
//                 newElement.borderColor = elementData.borderColor;
//                 newElement.borderWidth = elementData.borderWidth;
//                 newElement.borderStyle = elementData.borderStyle;
//             } else if (elementData.type === 'text') {
//                 newElement.content = elementData.content;
//                 newElement.fontSize = elementData.fontSize;
//                 newElement.fontFamily = elementData.fontFamily;
//                 newElement.textColor = elementData.textColor;
//                 newElement.textAlign = elementData.textAlign;
//             }
            
//             // Add the new element to the slide
//             this.slides[this.currentSlideIndex].elements.push(newElement);
//         }
//     });

//     // Update the UI to reflect changes
//    scheduleUIUpdate();
// }

// duplicateElement() {
//     const selectedElements = document.querySelectorAll('.slide-element.selected');
//     if (selectedElements.length === 0) return;

//     // Save current state for undo
//     this.saveState();

//     const offsetX = 20;
//     const offsetY = 20;
//     const timestamp = Date.now();

//     selectedElements.forEach((element, index) => {
//         const elementId = parseInt(element.dataset.elementId);
//         const slideElements = this.slides[this.currentSlideIndex].elements;
//         const elementData = slideElements.find(el => el.id === elementId);

//         if (elementData) {
//             // Count existing duplicates (including original)
//             const originalId = elementData.originalId || elementData.id;
//             const clones = slideElements.filter(el => el.originalId === originalId || el.id === originalId);

//             if (clones.length >= 6) {
//                 alert('You can only duplicate this element up to 5 times.');
//                 return;
//             }

//             // Create a deep clone of the element data
//             const newElement = JSON.parse(JSON.stringify(elementData));

//             // Update necessary properties
//             newElement.id = timestamp + index; // Ensure unique ID
//             newElement.x = elementData.x + offsetX;
//             newElement.y = elementData.y + offsetY;

//             // Store reference to originalId for tracking clones
//             newElement.originalId = originalId;

//             // Ensure flip, rotation, zIndex exist
//             if (!newElement.flip) newElement.flip = { horizontal: false, vertical: false };
//             if (newElement.rotation === undefined) newElement.rotation = 0;
//             if (!newElement.zIndex) newElement.zIndex = elementData.zIndex || 1;

//             // Preserve style properties if present
//             if (elementData.style) {
//                 newElement.style = { ...elementData.style };
//             }

//             // No type-specific property preservation to keep it generic for all elements

//             // Add the new element to the slide
//             slideElements.push(newElement);
//         }
//     });

//     // Update the UI to reflect changes
//    scheduleUIUpdate();
// }


duplicateElement() {
  const selectedElements = document.querySelectorAll('.slide-element.selected');
  if (selectedElements.length === 0) return;

  this.saveState();

  const offsetX = 20;
  const offsetY = 20;
  const timestamp = Date.now();

  selectedElements.forEach((element, index) => {
    const elementId = parseInt(element.dataset.elementId);
    const slideElements = this.slides[this.currentSlideIndex].elements;
    const elementData = slideElements.find((el) => el.id === elementId);

    if (!elementData) return;

    const isClone = !!elementData.originalId;
    const originalId = elementData.originalId || elementData.id;
    const clones = slideElements.filter((el) => el.originalId === originalId || el.id === originalId);

    if (!isClone && clones.length >= 6) {
      alert('You can only duplicate this original element up to 5 times.');
      return;
    }

    if (isClone && clones.length > 0) {
      alert('Duplicated elements cannot be duplicated.');
      return;
    }

    const newElement = JSON.parse(JSON.stringify(elementData));
    newElement.id = timestamp + index;
    newElement.x = elementData.x + offsetX;
    newElement.y = elementData.y + offsetY;
    newElement.originalId = originalId;
    newElement.isDuplicate = true;
    newElement.content = elementData.content;
    newElement.isPlaceholder = elementData.isPlaceholder; // Ensure placeholder status is copied

    if (!newElement.flip) newElement.flip = { horizontal: false, vertical: false };
    if (newElement.rotation === undefined) newElement.rotation = 0;
    if (!newElement.zIndex) newElement.zIndex = elementData.zIndex || 1;
    if (elementData.style) {
      newElement.style = { ...elementData.style };
    }

    slideElements.push(newElement);
  });

 scheduleUIUpdate();
 this.saveState();
}


// ... existing code ...

// Add this method to handle element selection
initElementSelection() {
    this.currentSlideElement = document.getElementById('currentSlide');

    if (!currentSlide) return;

    currentSlide.addEventListener('click', (e) => {
        const clickedElement = e.target.closest('.slide-element');
        if (!clickedElement) {
            // Deselect all elements if clicking on empty space
            document.querySelectorAll('.slide-element.selected').forEach(el => {
            el.classList.remove('selected');
        });
            return;
        }

        // If shift is not pressed, deselect all other elements
        if (!e.shiftKey) {
            document.querySelectorAll('.slide-element.selected').forEach(el => {
                if (el !== clickedElement) {
                    el.classList.remove('selected');
                }
            });
        }

        // Toggle selection of clicked element
        clickedElement.classList.toggle('selected');
    });
}

importFromHTML(htmlContent) {
    try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    
        // Find slides in the imported HTML
        const slides = Array.from(doc.querySelectorAll('.slide'));
        if (slides.length === 0) {
            throw new Error('No valid slides found in the imported HTML.');
        }

        // Store current state for undo
        const previousState = JSON.stringify(this.slides);

        // Clear existing slides
    this.slides = [];
    
        slides.forEach((slideElement, index) => {
        const slide = {
                id: Date.now() + index,
            elements: [],
                theme: null,
                customStyle: null,
                transition: slideElement.dataset.transition || 'none',
                duration: parseInt(slideElement.dataset.duration) || 0
            };

            // Parse slide background and theme
            const bgColor = slideElement.style.backgroundColor;
            const bgImage = slideElement.style.backgroundImage;
            if (bgColor) {
                slide.customStyle = { 
                    backgroundColor: bgColor,
                    backgroundSize: slideElement.style.backgroundSize || 'cover',
                    backgroundPosition: slideElement.style.backgroundPosition || 'center'
                };
            } else if (bgImage) {
                slide.theme = {
                    backgroundImage: bgImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1'),
                    textColor: slideElement.style.color || '#000000',
                    backgroundSize: slideElement.style.backgroundSize || 'cover',
                    backgroundPosition: slideElement.style.backgroundPosition || 'center'
                };
            }

            // Parse elements inside the slide
            const elements = slideElement.querySelectorAll('.slide-element');
            elements.forEach((el) => {
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            
            // Parse element based on type
            let element;
            
                // Check for shape elements first
                const shapeTypes = ['rectangle', 'circle', 'triangle', 'line', 'arrow', 'star', 'diamond', 'pentagon', 'hexagon', 'cloud', 'polygon'];
                let isShape = shapeTypes.some(type => el.classList.contains(`shape-${type}`));
                // Additional check for polygon via clip-path
                if (!isShape && el.style.clipPath && el.style.clipPath.includes('polygon(50% 0%, 95% 25%, 80% 75%, 20% 75%, 5% 25%)')) {
                    isShape = true;
                }
                if (isShape) {
                    let shapeType = shapeTypes.find(type => el.classList.contains(`shape-${type}`));
                    // If not found, but clip-path matches polygon, force polygon
                    if (!shapeType && el.style.clipPath && el.style.clipPath.includes('polygon(50% 0%, 95% 25%, 80% 75%, 20% 75%, 5% 25%)')) {
                        shapeType = 'polygon';
                    }
                    const computedStyle = window.getComputedStyle(el);
                    element = {
                        type: 'shape',
                        shapeType: shapeType,
                        x: parseInt(el.style.left) || parseInt(computedStyle.left) || 0,
                        y: parseInt(el.style.top) || parseInt(computedStyle.top) || 0,
                        width: parseInt(el.style.width) || parseInt(computedStyle.width) || 100,
                        height: parseInt(el.style.height) || parseInt(computedStyle.height) || 100,
                        zIndex: parseInt(el.style.zIndex) || parseInt(computedStyle.zIndex) || 1,
                        id: Date.now() + Math.random(),
                        fillColor: el.style.backgroundColor || computedStyle.backgroundColor || 'transparent',
                        borderColor: el.style.borderColor || computedStyle.borderColor || '#000000',
                        borderWidth: parseInt(el.style.borderWidth) || parseInt(computedStyle.borderWidth) || 2,
                        borderStyle: el.style.borderStyle || computedStyle.borderStyle || 'solid',
                        rotation: parseInt(el.style.transform?.match(/rotate\(([-\d.]+)deg\)/)?.[1]) || 0
                    };
                    // Special handling for specific shapes
                    switch(shapeType) {
                        case 'circle':
                            element.borderRadius = '50%';
                            break;
                        case 'polygon':
                            element.clipPath = 'polygon(50% 0%, 95% 25%, 80% 75%, 20% 75%, 5% 25%)';
                            break;
                        case 'diamond':
                            element.transform = 'rotate(45deg)';
                            break;
                    }
                } else if (el.querySelector('img')) {
                    // Image element
                    const img = el.querySelector('img');
                    element = {
                        type: 'image',
                        content: img.src,
                        x: parseInt(el.style.left) || parseInt(style.left) || 0,
                        y: parseInt(el.style.top) || parseInt(style.top) || 0,
                        width: parseInt(el.style.width) || parseInt(style.width) || img.width || 200,
                        height: parseInt(el.style.height) || parseInt(style.height) || img.height || 150,
                        zIndex: parseInt(el.style.zIndex) || parseInt(style.zIndex) || 1,
                        id: Date.now() + Math.random(),
                        style: {
                            transform: el.style.transform || style.transform,
                            boxShadow: el.style.boxShadow || style.boxShadow,
                            opacity: el.style.opacity || style.opacity,
                            objectFit: el.style.objectFit || style.objectFit || 'cover'
                        }
                    };
                } else if (el.querySelector('video')) {
                    // Video element
                    const video = el.querySelector('video');
                    element = {
                        type: 'video',
                        content: video.querySelector('source')?.src || video.src,
                        x: parseInt(el.style.left) || parseInt(style.left) || 0,
                        y: parseInt(el.style.top) || parseInt(style.top) || 0,
                        width: parseInt(el.style.width) || parseInt(style.width) || 400,
                        height: parseInt(el.style.height) || parseInt(style.height) || 225,
                        zIndex: parseInt(el.style.zIndex) || parseInt(style.zIndex) || 1,
                        id: Date.now() + Math.random(),
                        autoplay: video.hasAttribute('autoplay'),
                        loop: video.hasAttribute('loop'),
                        muted: video.hasAttribute('muted'),
                        controls: video.hasAttribute('controls'),
                        style: {
                            transform: el.style.transform || style.transform,
                            boxShadow: el.style.boxShadow || style.boxShadow,
                            opacity: el.style.opacity || style.opacity
                        }
                    };
                } else if (el.querySelector('audio')) {
                    // Audio element
                    const audio = el.querySelector('audio');
                    element = {
                        type: 'audio',
                        content: audio.querySelector('source')?.src || audio.src,
                        x: parseInt(el.style.left) || parseInt(style.left) || 0,
                        y: parseInt(el.style.top) || parseInt(style.top) || 0,
                        width: parseInt(el.style.width) || parseInt(style.width) || 300,
                        height: parseInt(el.style.height) || parseInt(style.height) || 50,
                        zIndex: parseInt(el.style.zIndex) || parseInt(style.zIndex) || 1,
                        id: Date.now() + Math.random(),
                        autoplay: audio.hasAttribute('autoplay'),
                        loop: audio.hasAttribute('loop'),
                        controls: audio.hasAttribute('controls'),
                        style: {
                            transform: el.style.transform || style.transform,
                            boxShadow: el.style.boxShadow || style.boxShadow,
                            opacity: el.style.opacity || style.opacity
                        }
                    };
                } else if (el.querySelector('canvas')) {
                    // Chart element
                const canvas = el.querySelector('canvas');
                    const chartId = canvas.id;
                    const chartData = window[chartId]?.data;
                
                    if (chartData) {
                element = {
                    type: 'chart',
                            chartType: window[chartId].config.type,
                            allLabels: chartData.labels,
                            datasets: chartData.datasets.map(ds => ({
                                label: ds.label,
                                data: ds.data,
                                color: ds.backgroundColor || ds.borderColor,
                                borderColor: ds.borderColor,
                                borderWidth: ds.borderWidth,
                                fill: ds.fill,
                                tension: ds.tension
                            })),
                            options: window[chartId].config.options,
                            x: parseInt(el.style.left) || parseInt(style.left) || 0,
                            y: parseInt(el.style.top) || parseInt(style.top) || 0,
                            width: parseInt(el.style.width) || parseInt(style.width) || 400,
                            height: parseInt(el.style.height) || parseInt(style.height) || 300,
                            zIndex: parseInt(el.style.zIndex) || parseInt(style.zIndex) || 1,
                    id: Date.now() + Math.random()
                };
            }
                } else if (el.querySelector('table')) {
                    // Table element
                    const table = el.querySelector('table');
                    element = {
                        type: 'table',
                        content: table.outerHTML,
                        x: parseInt(el.style.left) || parseInt(style.left) || 0,
                        y: parseInt(el.style.top) || parseInt(style.top) || 0,
                        width: parseInt(el.style.width) || parseInt(style.width) || 400,
                        height: parseInt(el.style.height) || parseInt(style.height) || 300,
                        zIndex: parseInt(el.style.zIndex) || parseInt(style.zIndex) || 1,
                        id: Date.now() + Math.random(),
                        style: {
                            transform: el.style.transform || style.transform,
                            boxShadow: el.style.boxShadow || style.boxShadow,
                            opacity: el.style.opacity || style.opacity,
                            borderCollapse: table.style.borderCollapse || 'collapse'
                        }
                    };
                } else if (el.querySelector('pre code')) {
                    // Code block element
                    const code = el.querySelector('pre code');
                    element = {
                        type: 'code',
                        content: code.textContent,
                        language: code.className.replace('language-', ''),
                        x: parseInt(el.style.left) || parseInt(style.left) || 0,
                        y: parseInt(el.style.top) || parseInt(style.top) || 0,
                        width: parseInt(el.style.width) || parseInt(style.width) || 400,
                        height: parseInt(el.style.height) || parseInt(style.height) || 300,
                        zIndex: parseInt(el.style.zIndex) || parseInt(style.zIndex) || 1,
                        id: Date.now() + Math.random(),
                        style: {
                            transform: el.style.transform || style.transform,
                            boxShadow: el.style.boxShadow || style.boxShadow,
                            opacity: el.style.opacity || style.opacity,
                            backgroundColor: el.style.backgroundColor || style.backgroundColor || '#f5f5f5',
                            color: el.style.color || style.color || '#333'
                        }
                    };
                } else {
                    // Text element (default)
                    element = {
                        type: 'text',
                        content: el.textContent || '',
                        x: parseInt(el.style.left) || parseInt(style.left) || 0,
                        y: parseInt(el.style.top) || parseInt(style.top) || 0,
                        width: parseInt(el.style.width) || parseInt(style.width) || 200,
                        height: parseInt(el.style.height) || parseInt(style.height) || 'auto',
                        zIndex: parseInt(el.style.zIndex) || parseInt(style.zIndex) || 1,
                        id: Date.now() + Math.random(),
                        style: {
                            color: el.style.color || style.color,
                            fontSize: el.style.fontSize || style.fontSize,
                            fontFamily: el.style.fontFamily || style.fontFamily,
                            fontWeight: el.style.fontWeight || style.fontWeight,
                            fontStyle: el.style.fontStyle || style.fontStyle,
                            textAlign: el.style.textAlign || style.textAlign,
                            transform: el.style.transform || style.transform,
                            boxShadow: el.style.boxShadow || style.boxShadow,
                            opacity: el.style.opacity || style.opacity,
                            lineHeight: el.style.lineHeight || style.lineHeight,
                            letterSpacing: el.style.letterSpacing || style.letterSpacing,
                            textDecoration: el.style.textDecoration || style.textDecoration
                        }
                    };
                }

                // Check for and add link data if present
                if (el.dataset.linkType) {
                    element.link = {
                        type: el.dataset.linkType,
                        targetSlide: el.dataset.linkType === 'slide' ? parseInt(el.dataset.linkTarget) : null,
                        url: el.dataset.linkType === 'url' ? el.dataset.linkTarget : null
                    };
                }

                // Add animation data if present
                if (el.dataset.animation) {
                    element.animation = {
                        type: el.dataset.animation,
                        duration: parseInt(el.dataset.animationDuration) || 1000,
                        delay: parseInt(el.dataset.animationDelay) || 0,
                        easing: el.dataset.animationEasing || 'ease'
                    };
                }
            
            if (element) {
                slide.elements.push(element);
            }
        });
        
        this.slides.push(slide);
    });
    
        // Save state for undo
        this.undoStack.push(previousState);
        this.redoStack = [];

    this.currentSlideIndex = 0;
   scheduleUIUpdate();
        alert('HTML file imported successfully!');
    } catch (error) {
        console.error('Error importing HTML:', error);
        alert('Failed to import HTML file: ' + error.message);
    }
}

handleImportHTML() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                this.importFromHTML(event.target.result);
            };
            reader.readAsText(file);
        }
    };
    input.click();
}



removeLink() {
    if (!this.selectedElement) {
        this.showNotification?.('Please select an element first', 'warning');
        return;
    }

    if (!this.selectedElement.link) {
        this.showNotification?.('Selected element has no link', 'warning');
        return;
    }

    this.saveState(); // Save for undo

    // Remove from model
    delete this.selectedElement.link;

    // Remove link styles from DOM
    const elId = this.selectedElement.id;
    const domElement = document.querySelector(`.slide-element[data-id="${elId}"], .slide-element[data-element-id="${elId}"]`);

    if (domElement) {
        domElement.style.cursor = 'default';
        domElement.style.textDecoration = 'none';
        domElement.style.color = '';
        
        const linkIndicator = domElement.querySelector('.link-indicator');
        if (linkIndicator) linkIndicator.remove();

        // Remove any click handlers for navigation
        const clone = domElement.cloneNode(true);
        domElement.replaceWith(clone);
    }

   scheduleUIUpdate();
    this.showNotification?.('Link removed successfully', 'success');
}


// Add this method to handle operations on selected elements
handleSelectedElements(operation) {
    const selectedElements = document.querySelectorAll('.slide-element.selected');
    selectedElements.forEach(element => {
        if (operation) {
            operation(element);
        }
    });
}

// Update the makeElementDraggable method to handle multiple selections
makeElementDraggable(element) {
    let startX = 0, startY = 0;
    let isDragging = false;
    let initialPositions = new Map();

    element.addEventListener('mousedown', (e) => {
        if (e.target.isContentEditable && window.getSelection().toString()) return;
        if (e.button !== 0) return;

        e.stopPropagation();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        // If clicking an unselected element without shift, clear other selections
        if (!element.classList.contains('selected') && !e.shiftKey) {
            document.querySelectorAll('.slide-element.selected').forEach(el => {
                el.classList.remove('selected');
            });
        }

        // Add this element to selection
        element.classList.add('selected');

        // Store initial positions of all selected elements
        document.querySelectorAll('.slide-element.selected').forEach(el => {
            initialPositions.set(el, {
                x: el.offsetLeft,
                y: el.offsetTop
            });
        });

        const onMouseMove = (e) => {
            if (!isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            // Move all selected elements
            document.querySelectorAll('.slide-element.selected').forEach(el => {
                const initial = initialPositions.get(el);
                if (initial) {
                    el.style.left = `${initial.x + dx}px`;
                    el.style.top = `${initial.y + dy}px`;
                }
            });
        };

        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            // Update model for all selected elements
            document.querySelectorAll('.slide-element.selected').forEach(el => {
                this.updateElementInModel(el, {
                    x: parseInt(el.style.left),
                    y: parseInt(el.style.top)
                });
            });

            initialPositions.clear();
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

// Update deleteElement method to handle multiple selections
deleteElement() {
    const slide = this.slides[this.currentSlideIndex];
    const selectedElements = document.querySelectorAll('.slide-element.selected');

    if (!selectedElements.length) return;

    // Save state BEFORE deletion (for undo)
    this.saveState();

    selectedElements.forEach(el => {
        const id = parseInt(el.dataset.elementId || el.dataset.id);
        const index = slide.elements.findIndex(e => e.id === id);
        if (index !== -1) {
            slide.elements.splice(index, 1);
        }
        el.remove();  // Remove from DOM
    });

    // Save state AFTER deletion (for redo to work properly)
    this.saveState();

    this.updateUI();
    scheduleSlidesListUpdate();
}




// Updated duplicateElement to ensure deletable duplicates
// duplicateElement() {
//     const selectedElements = document.querySelectorAll('.slide-element.selected');
//     if (selectedElements.length === 0) return;

//     const offsetX = 20;
//     const offsetY = 20;

//     selectedElements.forEach(element => {
//         const elementId = parseInt(element.dataset.id || element.dataset.elementId);
//         const originalElement = this.slides[this.currentSlideIndex].elements.find(el => el.id === elementId);

//         if (originalElement) {
//             const newId = Date.now() + Math.floor(Math.random() * 1000); // Unique ID

//             const duplicatedElement = {
//                 ...originalElement,
//                 id: newId,
//                 x: originalElement.x + offsetX,
//                 y: originalElement.y + offsetY
//             };

//             // Add to data model
//             this.slides[this.currentSlideIndex].elements.push(duplicatedElement);

//             // Create DOM element and attach dataset.id
//             const duplicatedElementDiv = this.renderElement(duplicatedElement);
//             duplicatedElementDiv.dataset.id = newId;
//             duplicatedElementDiv.classList.add('slide-element');

//             // Append to slide container
//             document.querySelector('#currentSlide').appendChild(duplicatedElementDiv);
//         }
//     });

//    scheduleUIUpdate();
// }


// Update moveElementToFront method to handle multiple selections
moveElementToFront() {
    const selectedElements = document.querySelectorAll('.slide-element.selected');
    if (selectedElements.length === 0) return;

    const maxZ = Math.max(...Array.from(document.querySelectorAll('.slide-element')).map(el => parseInt(getComputedStyle(el).zIndex) || 0));
    
    selectedElements.forEach((element, index) => {
        element.style.zIndex = maxZ + index + 1;
        
        const elementId = element.dataset.id || element.dataset.elementId;
        const modelElement = this.slides[this.currentSlideIndex].elements.find(el => el.id.toString() === elementId);
        if (modelElement) {
            modelElement.zIndex = maxZ + index + 1;
        }
    });
}





moveElementToBack() {
    const selectedElements = document.querySelectorAll('.slide-element.selected');
    if (selectedElements.length === 0) return;

    const minZ = Math.min(...Array.from(document.querySelectorAll('.slide-element')).map(el => parseInt(getComputedStyle(el).zIndex) || 0));
    
    selectedElements.forEach((element, index) => {
        element.style.zIndex = minZ - index - 1;
        
        const elementId = element.dataset.id || element.dataset.elementId;
        const modelElement = this.slides[this.currentSlideIndex].elements.find(el => el.id.toString() === elementId);
        if (modelElement) {
            modelElement.zIndex = minZ - index - 1;
        }
    });
}



// Add keyboard shortcuts for operations
initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't handle shortcuts if user is editing text or in an input/textarea
        if (
            e.target.contentEditable === 'true' ||
            e.target.tagName === 'INPUT' ||
            e.target.tagName === 'TEXTAREA'
        ) return;

        if (e.ctrlKey || e.metaKey) {
            switch(e.key.toLowerCase()) {
                case 'c': // Copy
                    e.preventDefault();
                    this.copyElement();
                    break;
                case 'v': // Paste
                    e.preventDefault();
                    this.pasteElement();
                    break;
                case 'x': // Cut
                    e.preventDefault();
                    this.copyElement();
                    this.deleteElement();
                    break;
                case 'd': // Duplicate
                    e.preventDefault();
                    this.duplicateElement();
                    break;
               case 'z':
  e.preventDefault();
  console.log("🧠 Ctrl+Z pressed");
  this.undo();
  break;

case 'y':
  e.preventDefault();
  console.log("🧠 Ctrl+Y pressed");
 this.redo();
  break;

                case 's': //save
                    e.preventDefault();
                    this.savePresentation();
                    break;
                case 'a': // Select All
                    e.preventDefault();
                    this.selectAllElements(); // implement this function if needed
                    break;
            }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            // Only handle delete if not editing text or in an input/textarea
            if (
                e.target.contentEditable !== 'true' &&
                e.target.tagName !== 'INPUT' &&
                e.target.tagName !== 'TEXTAREA'
            ) {
                e.preventDefault();
                this.deleteElement();
            }
        }
    });
    
    // Enable Ctrl+Click multiple selection on elements
    document.addEventListener('click', (e) => {
        const element = e.target.closest('.slide-element'); // adjust selector as needed
        if (!element) return;

        if (e.ctrlKey || e.metaKey) {
            // Multi-select
            if (this.selectedElements.includes(element)) {
                element.classList.remove('selected');
                this.selectedElements = this.selectedElements.filter(el => el !== element);
            } else {
                element.classList.add('selected');
                this.selectedElements.push(element);
            }
        } else {
            // Single select
            this.selectedElements.forEach(el => el.classList.remove('selected'));
            this.selectedElements = [element];
            element.classList.add('selected');
        }
    });

    // Clear selection when clicking outside any element
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.slide-element')) {
            this.selectedElements.forEach(el => el.classList.remove('selected'));
            this.selectedElements = [];
        }
    });

}
// Select all elements on the current slide
selectAllElements() {
    const currentSlide = document.getElementById('currentSlide');
    if (!currentSlide) return;
    
    // Get all slide elements on the current slide
    const allElements = currentSlide.querySelectorAll('.slide-element');
    
    if (allElements.length === 0) {
        console.log('No elements to select');
        return;
    }
    
    // Select all elements
    allElements.forEach(element => {
        element.classList.add('selected');
    });
    
    console.log(`Selected ${allElements.length} elements`);
    
    // Update the UI to reflect the selection
   scheduleUIUpdate();
}


    async savePresentation() {
        try {
            const presentationData = {
                slides: this.slides,
                currentTheme: this.currentTheme,
                viewSettings: this.viewSettings
            };
            
            const jsonContent = JSON.stringify(presentationData, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'presentation.json';
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (err) {
            console.error('Error saving presentation:', err);
            alert('Error saving presentation: ' + err.message);
        }
    }

    async handleImportHTML() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.html,.json';
            
            input.onchange = async (e) => {
                const file = e.target.files[0];
                const reader = new FileReader();
                
                reader.onload = async (event) => {
                    const content = event.target.result;
                    
                    if (file.name.endsWith('.json')) {
                        // Handle JSON import
                        try {
                            const data = JSON.parse(content);
                            this.slides = data.slides || [];
                            this.currentTheme = data.currentTheme;
                            this.viewSettings = data.viewSettings || this.viewSettings;
                            this.currentSlideIndex = 0;
                           scheduleUIUpdate();
                        } catch (err) {
                            console.error('Error parsing JSON:', err);
                            alert('Error importing presentation: Invalid JSON format');
                        }
                    } else {
                        // Handle HTML import
                        try {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(content, 'text/html');
                            
                            // Try to extract presentation data from embedded script
                            const dataScript = doc.querySelector('script:not([src])');
                            if (dataScript && dataScript.textContent.includes('presentationData')) {
                                const dataMatch = dataScript.textContent.match(/const presentationData = ({[\s\S]*?});/);
                                if (dataMatch) {
                                    const data = JSON.parse(dataMatch[1]);
                                    this.slides = data.slides || [];
                                    this.currentTheme = data.currentTheme;
                                    this.viewSettings = data.viewSettings || this.viewSettings;
                                    this.currentSlideIndex = 0;
                                   scheduleUIUpdate();
                                    return;
                                }
                            }
                            
                            // Fallback to parsing HTML structure
                            const slides = Array.from(doc.querySelectorAll('.slide'));
                            if (slides.length === 0) {
                                throw new Error('No valid slides found in the imported HTML.');
                            }

                            // Store current state for undo
                            const previousState = JSON.stringify(this.slides);

                            // Clear existing slides
                            this.slides = [];
                            
                            slides.forEach((slideElement, index) => {
                                const slide = {
                                    id: Date.now() + index,
                                    elements: [],
                                    theme: null,
                                    customStyle: null,
                                    transition: slideElement.dataset.transition || 'none',
                                    duration: parseInt(slideElement.dataset.duration) || 0
                                };

                                // Parse slide background and theme
                                const bgColor = slideElement.style.backgroundColor;
                                const bgImage = slideElement.style.backgroundImage;
                                if (bgColor) {
                                    slide.customStyle = { 
                                        backgroundColor: bgColor,
                                        backgroundSize: slideElement.style.backgroundSize || 'cover',
                                        backgroundPosition: slideElement.style.backgroundPosition || 'center'
                                    };
                                } else if (bgImage) {
                                    slide.theme = {
                                        backgroundImage: bgImage.replace(/url\(['"]?(.*?)['"]?\)/i, '$1'),
                                        textColor: slideElement.style.color || '#000000',
                                        backgroundSize: slideElement.style.backgroundSize || 'cover',
                                        backgroundPosition: slideElement.style.backgroundPosition || 'center'
                                    };
                                }

                                // Parse elements inside the slide
                                const elements = slideElement.querySelectorAll('.slide-element');
                                elements.forEach(element => {
                                    const elementData = {
                                        id: Date.now() + Math.random(),
                                        x: parseInt(element.style.left) || 0,
                                        y: parseInt(element.style.top) || 0,
                                        width: parseInt(element.style.width) || 200,
                                        height: parseInt(element.style.height) || 100,
                                        type: 'text', // Default type
                                        content: element.textContent || '',
                                        style: {}
                                    };

                                    // Determine element type and extract properties
                                    if (element.querySelector('img')) {
                                        elementData.type = 'image';
                                        elementData.content = element.querySelector('img').src;
                                    } else if (element.querySelector('video')) {
                                        elementData.type = 'video';
                                        elementData.content = element.querySelector('video').src;
                                    } else if (element.querySelector('canvas')) {
                                        elementData.type = 'chart';
                                        // Chart data would need to be extracted from the embedded script
                                    } else if (element.classList.contains('shape-rectangle') ||
                                             element.classList.contains('shape-circle') ||
                                             element.classList.contains('shape-triangle')) {
                                        elementData.type = 'shape';
                                        elementData.shapeType = element.className.replace('slide-element shape-', '');
                                        elementData.fillColor = element.style.background;
                                        elementData.borderColor = element.style.borderColor;
                                        elementData.borderWidth = parseInt(element.style.borderWidth) || 2;
                                    }

                                    // Extract text styling
                                    if (elementData.type === 'text') {
                                        elementData.style = {
                                            fontSize: element.style.fontSize,
                                            fontFamily: element.style.fontFamily,
                                            color: element.style.color,
                                            fontWeight: element.style.fontWeight,
                                            fontStyle: element.style.fontStyle
                                        };
                                    }

                                    // Extract link data
                                    if (element.classList.contains('link-element')) {
                                        elementData.link = {
                                            type: element.dataset.linkType,
                                            url: element.dataset.linkTarget,
                                            targetSlide: parseInt(element.dataset.linkTarget)
                                        };
                                    }

                                    slide.elements.push(elementData);
                                });

                                this.slides.push(slide);
                            });

                            this.currentSlideIndex = 0;
                           scheduleUIUpdate();
                        } catch (err) {
                            console.error('Error importing HTML:', err);
                            alert('Error importing presentation: ' + err.message);
                        }
                    }
                };
                
                reader.readAsText(file);
            };
            
            input.click();
        } catch (err) {
            console.error('Error importing file:', err);
            alert('Error importing file: ' + err.message);
        }
    }

    findElementModelFromDOM(elementDiv) {
        // Try both possible dataset keys
        const elementId = elementDiv.dataset.elementId || elementDiv.dataset.id;
        if (!elementId) return null;
        return this.slides[this.currentSlideIndex].elements.find(el => el.id.toString() === elementId);
    }
}
const presentation = new Presentation(); 

}