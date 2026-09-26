const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('tutortrack',{
  saveBackup:(json,filename)=>ipcRenderer.invoke('save-backup',json,filename),
  google:{
    status:()=>ipcRenderer.invoke('google-status'),
    importClient:()=>ipcRenderer.invoke('google-importClient'),
    connect:()=>ipcRenderer.invoke('google-connect'),
    calendars:()=>ipcRenderer.invoke('google-calendars'),
    select:id=>ipcRenderer.invoke('google-select',id),
    disconnect:()=>ipcRenderer.invoke('google-disconnect'),
    events:ids=>ipcRenderer.invoke('google-events',ids),
  },
});
