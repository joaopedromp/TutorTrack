const {app,BrowserWindow,protocol,session,Menu,dialog,shell,ipcMain,safeStorage}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const ORIGIN='tutortrack://app';
app.setName('TutorTrack');
app.setPath('userData',path.join(app.getPath('appData'),'TutorTrackPublic'));
app.setAppUserModelId('local.tutortrack.public');
protocol.registerSchemesAsPrivileged([{scheme:'tutortrack',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const dataPath=app.getPath('userData');
require('node:fs').mkdirSync(dataPath,{recursive:true});
const root=path.resolve(__dirname,'../dist-desktop');
const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml'};
let win;
function local(url){try{const u=new URL(url);return u.protocol==='tutortrack:'&&u.hostname==='app'&&!u.port;}catch{return false;}}
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
app.whenReady().then(async()=>{
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*','ftp://*/*','file://*/*']},(_details,callback)=>callback({cancel:true}));
  protocol.handle('tutortrack',async request=>{
    if(!local(request.url)||request.method!=='GET')return new Response('Forbidden',{status:403});
    try{
      const url=new URL(request.url);
      const filename=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
      if(filename.includes('\\')||filename.includes('\0')||filename.includes(':'))return new Response('Forbidden',{status:403});
      const target=path.resolve(root,'.'+filename);
      if(!target.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
      const body=await fs.readFile(target);
      return new Response(body,{headers:{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff'}});
    }catch{return new Response('Not found',{status:404});}
  });
  ipcMain.handle('save-backup',async(event,json,filename)=>{
    if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!local(event.senderFrame.url))throw Error('Forbidden');
    if(typeof json!=='string'||Buffer.byteLength(json)>50*1024*1024||!/^TutorTrack-\d{4}-\d{2}-\d{2}\.json$/.test(filename))throw Error('Invalid backup');
    JSON.parse(json);
    const backupFolder=path.join(dataPath,'Backups');
    await fs.mkdir(backupFolder,{recursive:true});
    const result=await dialog.showSaveDialog(win,{title:'Save your TutorTrack backup',defaultPath:path.join(backupFolder,filename),filters:[{name:'TutorTrack JSON backup',extensions:['json']}]});
    if(result.canceled||!result.filePath)return false;
    await fs.writeFile(result.filePath,json,'utf8');
    return true;
  });
  const google=require('./google-calendar.cjs').createGoogleCalendar({safeStorage,shell,dialog,getWindow:()=>win,dataPath});
  for(const method of ['status','importClient','connect','calendars','select','disconnect','events'])ipcMain.handle('google-'+method,async(event,...args)=>{
    if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!local(event.senderFrame.url))throw Error('Forbidden');
    return google[method](...args);
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'File',submenu:[{label:'Open data folder',click:()=>shell.openPath(dataPath)},{type:'separator'},{role:'quit'}]},
    {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},
    {label:'Help',submenu:[{label:'About and backups',click:()=>dialog.showMessageBox(win,{type:'info',title:'TutorTrack Desktop',message:'TutorTrack — entirely local',detail:'Your records are stored in:\n'+dataPath+'\n\nUse Settings → Export JSON regularly. Choose a private local folder or removable drive. To restore, use Import JSON.\n\nNo hosting or app password. Google Calendar import is optional and read-only. Your Windows account protects access. Records from the previous browser version must be exported there and imported here.'})}]}
  ]));
  win=new BrowserWindow({autoHideMenuBar:true,width:1366,height:900,minWidth:850,minHeight:600,title:'TutorTrack',backgroundColor:'#101113',icon:path.join(root,'icon-512.png'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,devTools:false,spellcheck:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(!local(url))event.preventDefault();});
  win.webContents.on('will-redirect',(event,url)=>{if(!local(url))event.preventDefault();});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
  win.once('ready-to-show',()=>win.show());
  await win.loadURL(ORIGIN+'/');
}).catch(error=>{dialog.showErrorBox('TutorTrack could not open',String(error));app.quit();});
app.on('window-all-closed',()=>app.quit());
}
