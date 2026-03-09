// Auto-save and Save As functionality for PowerPoint Editor
class AutoSaveManager {
    constructor(presentation) {
        this.presentation = presentation;
        this.autoSaveInterval = null;
        this.lastSavedState = null;
        this.isAutoSaving = false;
        this.init();
    }

    init() {
        // Initialize auto-save every 10 seconds
        this.startAutoSave();
        
        // Handle page refresh and navigation
        this.setupBeforeUnload();
        
        // Handle Ctrl+R (refresh)
        this.setupKeyboardShortcuts();
        
        // Load auto-saved data on page load
        this.loadAutoSavedData();
        
        // Track initial state
        this.lastSavedState = this.getCurrentState();
        
        // Enable Save As button with status indicator
        setTimeout(() => {
            this.enableSaveAsButton();
        }, 1000);
    }

    startAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            this.autoSave();
        }, 10000); // Auto-save every 10 seconds
    }

    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    getCurrentState() {
        return JSON.stringify({
            slides: this.presentation.slides,
            currentSlideIndex: this.presentation.currentSlideIndex,
            currentTheme: this.presentation.currentTheme,
            viewSettings: this.presentation.viewSettings
        });
    }

    hasUnsavedChanges() {
        const currentState = this.getCurrentState();
        return currentState !== this.lastSavedState;
    }

    autoSave() {
        if (this.hasUnsavedChanges() && !this.isAutoSaving) {
            this.isAutoSaving = true;
            this.saveToLocalStorage();
            this.lastSavedState = this.getCurrentState();
            this.showToast('Auto-saved presentation', 'success');
            this.showAutoSaveWorking(); // Show indicator that auto-save is working
            this.isAutoSaving = false;
        }
    }

    saveToLocalStorage() {
        const presentationData = {
            slides: this.presentation.slides,
            currentSlideIndex: this.presentation.currentSlideIndex,
            currentTheme: this.presentation.currentTheme,
            viewSettings: this.presentation.viewSettings,
            timestamp: Date.now()
        };
        localStorage.setItem('autoSavedPresentation', JSON.stringify(presentationData));
    }

    // loadAutoSavedData() {
    //     const savedData = localStorage.getItem('autoSavedPresentation');
    //     if (savedData) {
    //         try {
    //             const data = JSON.parse(savedData);
    //             this.presentation.slides = data.slides || [];
    //             this.presentation.currentSlideIndex = data.currentSlideIndex || 0;
    //             this.presentation.currentTheme = data.currentTheme;
    //             this.presentation.viewSettings = data.viewSettings || this.presentation.viewSettings;
    //             this.lastSavedState = this.getCurrentState();
    //             this.presentation.updateUI();
    //             this.showToast('Loaded auto-saved presentation', 'info');
    //             return true;
    //         } catch (err) {
    //             console.error('Error loading auto-saved data:', err);
    //             return false;
    //         }
    //     }
    //     return false;
    // }

    setupBeforeUnload() {
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Do you want to save before leaving?';
                return e.returnValue;
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                // Auto-save first, then show save options
                this.autoSaveAndShowOptions();
            }
        });
    }

    autoSaveAndShowOptions() {
        // First, auto-save to local storage
        this.saveToLocalStorage();
        this.lastSavedState = this.getCurrentState();
        this.showToast('Auto-saved before refresh', 'success');
        
        // Then show save options dialog
        setTimeout(() => {
            this.showSavePrompt();
        }, 500);
    }

    showSavePrompt() {
        const dialog = this.createSaveDialog();
        document.body.appendChild(dialog);
    }

    createSaveDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'save-dialog-overlay';
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const content = document.createElement('div');
        content.className = 'save-dialog-content';
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            max-width: 450px;
            text-align: center;
            animation: slideIn 0.3s ease;
        `;

        content.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #333; font-size: 18px;">
                <i class="fas fa-save" style="margin-right: 8px;"></i>
                Save Your Presentation
            </h3>
            <p style="margin: 0 0 25px 0; color: #666; line-height: 1.5;">
                You have unsaved changes. How would you like to save your presentation?
            </p>
            <div style="display: grid; gap: 12px; grid-template-columns: 1fr 1fr;">
                <button id="save-html" class="save-btn save-html-btn">
                    <i class="fas fa-code"></i>
                    <span>Save as HTML</span>
                </button>
                <button id="save-pdf" class="save-btn save-pdf-btn">
                    <i class="fas fa-file-pdf"></i>
                    <span>Save as PDF</span>
                </button>
                <button id="save-json" class="save-btn save-json-btn">
                    <i class="fas fa-file-code"></i>
                    <span>Save as JSON</span>
                </button>
                <button id="save-local" class="save-btn save-local-btn">
                    <i class="fas fa-download"></i>
                    <span>Save to Local</span>
                </button>
            </div>
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                <button id="dont-save" class="save-btn save-cancel-btn">
                    <i class="fas fa-times"></i>
                    <span>Don't Save</span>
                </button>
            </div>
        `;

        dialog.appendChild(content);
        this.attachSaveDialogEvents(dialog);
        return dialog;
    }

    attachSaveDialogEvents(dialog) {
        const content = dialog.querySelector('.save-dialog-content');

        content.querySelector('#save-html').addEventListener('click', async () => {
            try {
                await this.presentation.saveAsHTML();
                this.lastSavedState = this.getCurrentState();
                this.showToast('Saved as HTML successfully!', 'success');
                dialog.remove();
                location.reload();
            } catch (err) {
                this.showToast('Error saving as HTML: ' + err.message, 'error');
            }
        });

        content.querySelector('#save-pdf').addEventListener('click', async () => {
            try {
                await this.presentation.exportToPDF();
                this.lastSavedState = this.getCurrentState();
                this.showToast('Saved as PDF successfully!', 'success');
                dialog.remove();
                location.reload();
            } catch (err) {
                this.showToast('Error saving as PDF: ' + err.message, 'error');
            }
        });

        content.querySelector('#save-json').addEventListener('click', async () => {
            try {
                await this.saveAsJSON();
                this.lastSavedState = this.getCurrentState();
                this.showToast('Saved as JSON successfully!', 'success');
                dialog.remove();
                location.reload();
            } catch (err) {
                this.showToast('Error saving as JSON: ' + err.message, 'error');
            }
        });

        content.querySelector('#save-local').addEventListener('click', () => {
            this.saveToLocalStorage();
            this.lastSavedState = this.getCurrentState();
            this.showToast('Saved to local storage successfully!', 'success');
            dialog.remove();
            location.reload();
        });

        content.querySelector('#dont-save').addEventListener('click', () => {
            dialog.remove();
            location.reload();
        });

        // Close on outside click
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                dialog.remove();
            }
        });
    }

    async saveAsJSON() {
        const presentationData = {
            slides: this.presentation.slides,
            currentSlideIndex: this.presentation.currentSlideIndex,
            currentTheme: this.presentation.currentTheme,
            viewSettings: this.presentation.viewSettings,
            metadata: {
                created: new Date().toISOString(),
                version: '1.0',
                application: 'PowerPoint Editor'
            }
        };
        
        const jsonContent = JSON.stringify(presentationData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `presentation-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.style.background = type === 'success' ? '#28a745' : 
                                type === 'error' ? '#dc3545' : 
                                type === 'warning' ? '#ffc107' : '#17a2b8';
        toast.style.opacity = '1';

        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }

    // Public method to manually trigger save
    manualSave() {
        // First auto-save to local storage
        this.saveToLocalStorage();
        this.lastSavedState = this.getCurrentState();
        this.showToast('Auto-saved presentation', 'success');
        
        // Then show save options
        this.showSavePrompt();
    }

    // Enhanced Save As method with better error handling
    enhancedSaveAs() {
        try {
            if (!this.presentation) {
                this.showToast('Presentation not available', 'error');
                return;
            }
            
            // Auto-save first
            this.saveToLocalStorage();
            this.lastSavedState = this.getCurrentState();
            this.showToast('Auto-saved before Save As', 'success');
            
            // Show save options
            setTimeout(() => {
                this.showSavePrompt();
            }, 300);
            
        } catch (error) {
            console.error('Error in enhanced Save As:', error);
            this.showToast('Error: ' + error.message, 'error');
        }
    }

    // Public method to check if there are unsaved changes
    checkUnsavedChanges() {
        return this.hasUnsavedChanges();
    }

    // Public method to force save to local storage
    forceSave() {
        this.saveToLocalStorage();
        this.lastSavedState = this.getCurrentState();
        this.showToast('Presentation saved successfully!', 'success');
    }

    // Method to track element changes and trigger auto-save
    trackElementChange() {
        // Trigger auto-save immediately when elements are changed
        setTimeout(() => {
            this.autoSave();
        }, 1000); // Small delay to avoid too frequent saves
    }

    // Method to check auto-save status
    getAutoSaveStatus() {
        return {
            isActive: this.autoSaveInterval !== null,
            lastSaved: this.lastSavedState ? new Date(JSON.parse(this.lastSavedState).timestamp || Date.now()) : null,
            hasUnsavedChanges: this.hasUnsavedChanges()
        };
    }

    // Method to enable Save As button and add status indicator
    enableSaveAsButton() {
        const saveAsBtn = document.getElementById('saveAsBtn');
        if (saveAsBtn) {
            saveAsBtn.disabled = false;
            saveAsBtn.style.opacity = '1';
            saveAsBtn.title = 'Save As - Auto-save is active';
            
            // Add a small indicator that auto-save is active
            if (!saveAsBtn.querySelector('.auto-save-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = 'auto-save-indicator';
                indicator.style.cssText = `
                    position: absolute;
                    top: -2px;
                    right: -2px;
                    width: 8px;
                    height: 8px;
                    background: #28a745;
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 0 4px rgba(0,0,0,0.3);
                `;
                saveAsBtn.style.position = 'relative';
                saveAsBtn.appendChild(indicator);
            }
        }
    }

    // Method to show auto-save is working
    showAutoSaveWorking() {
        const saveAsBtn = document.getElementById('saveAsBtn');
        if (saveAsBtn && saveAsBtn.querySelector('.auto-save-indicator')) {
            const indicator = saveAsBtn.querySelector('.auto-save-indicator');
            indicator.style.background = '#ffc107';
            setTimeout(() => {
                indicator.style.background = '#28a745';
            }, 1000);
        }
    }
}

// Add CSS styles for the save dialog
const saveDialogStyles = `
<style>
@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.save-btn {
    padding: 12px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 60px;
    justify-content: center;
}

.save-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.save-html-btn {
    background: #007bff;
    color: white;
}

.save-html-btn:hover {
    background: #0056b3;
}

.save-pdf-btn {
    background: #dc3545;
    color: white;
}

.save-pdf-btn:hover {
    background: #c82333;
}

.save-json-btn {
    background: #28a745;
    color: white;
}

.save-json-btn:hover {
    background: #218838;
}

.save-local-btn {
    background: #17a2b8;
    color: white;
}

.save-local-btn:hover {
    background: #138496;
}

.save-cancel-btn {
    background: #6c757d;
    color: white;
}

.save-cancel-btn:hover {
    background: #5a6268;
}

.save-btn i {
    font-size: 16px;
}

.save-btn span {
    font-size: 12px;
}
</style>
`;

// Inject styles into the document
document.head.insertAdjacentHTML('beforeend', saveDialogStyles);

// Initialize auto-save manager when the page loads
let autoSaveManager;

// Function to initialize auto-save (called after presentation is created)
function initializeAutoSave(presentation) {
    autoSaveManager = new AutoSaveManager(presentation);
    window.autoSaveManager = autoSaveManager; // Make it globally available
    console.log('Auto-save manager initialized');
    
    // Enable Save As button with status indicator
    setTimeout(() => {
        if (window.autoSaveManager) {
            window.autoSaveManager.enableSaveAsButton();
        }
    }, 1000);
}

// Global fallback functions for save buttons
window.manualSave = function() {
    if (window.autoSaveManager) {
        try {
            window.autoSaveManager.enhancedSaveAs();
        } catch (error) {
            console.error('Error in manual save:', error);
            alert('Error saving presentation: ' + error.message);
        }
    } else {
        alert('Auto-save manager not ready. Please wait a moment and try again.');
    }
};

window.quickSave = function() {
    if (window.autoSaveManager) {
        try {
            window.autoSaveManager.forceSave();
        } catch (error) {
            console.error('Error in quick save:', error);
            alert('Error saving presentation: ' + error.message);
        }
    } else {
        alert('Auto-save manager not ready. Please wait a moment and try again.');
    }
};

// Export for use in other scripts
window.AutoSaveManager = AutoSaveManager;
window.initializeAutoSave = initializeAutoSave;
