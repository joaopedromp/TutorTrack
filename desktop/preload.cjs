const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("tutortrack", {
  saveBackup: (json, filename) =>
    ipcRenderer.invoke("save-backup", json, filename),
});
