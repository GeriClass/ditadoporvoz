// Ponte segura entre o main e as janelas (overlay/configurações).

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ditado', {
  // Configurações (arquivo JSON no userData, compartilhado por todas as janelas)
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  onSettingsUpdated: (cb) => ipcRenderer.on('settings:updated', (_e, s) => cb(s)),

  // Overlay
  onToggle: (cb) => ipcRenderer.on('dictation:toggle', () => cb()),
  hide: () => ipcRenderer.send('overlay:hide'),
  resize: (height) => ipcRenderer.send('overlay:resize', height),
  paste: (text) => ipcRenderer.invoke('overlay:paste', text),
  openSettings: () => ipcRenderer.send('overlay:open-settings'),
  openExternal: (url) => ipcRenderer.send('open-external', url),

  platform: process.platform,
});
