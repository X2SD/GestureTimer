const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readImageDataUrl: (p) => ipcRenderer.invoke('read-image-data-url', p),
  onFolderShortcut: (cb) => {
    ipcRenderer.on('open-folder-shortcut', () => cb());
  },
  onImageZoom: (cb) => {
    ipcRenderer.on('image-zoom', (_e, dir) => cb(dir));
  },
  onImageViewReset: (cb) => {
    ipcRenderer.on('image-view-reset', () => cb());
  },
});
