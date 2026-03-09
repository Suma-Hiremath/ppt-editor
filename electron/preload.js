const { contextBridge } = require('electron');
const fs = require('fs');
const { dialog } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (path) => fs.readFileSync(path, 'utf-8'),
  writeFile: (path, data) => fs.writeFileSync(path, data),
  showSaveDialog: (opts) => dialog.showSaveDialogSync(opts),
  showOpenDialog: (opts) => dialog.showOpenDialogSync(opts)
});