'use strict'

import { app, protocol, BrowserWindow } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
import { ProcessLoader } from './loader'
import path from 'path';
const isDevelopment = process.env.NODE_ENV !== 'production'
const {shell, ipcMain} = require('electron')
process.env.TZ = 'America/Santiago';

function getAppRoot() {
  if ( process.platform === 'win32' ) {
    return path.join( app.getAppPath(), '/../../' );
  }  else {
    return path.join( app.getAppPath(), '/../../../../' );
  }
}

/**
 * Se inicializa loader y se cargan definiciones de scripts
 */
let loader = new ProcessLoader(
  getAppRoot()
);

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

async function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    autoHideMenuBar: true,
    width: 800,
    height: 600,
    webPreferences: {
      
      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      preload: path.join(__dirname, 'preload.js')
    },
  })

  // Cuando la ventana sea cargada completamente
  win.webContents.on('did-finish-load', () => {

    // Se carga el loader con los procesos pendientes
    loader.read();

    // Se envia el listado de procesos hacia la ventana
    win.webContents.send('init',{
      logPath: loader.outDir,
      processes: loader.processes
    });

    setTimeout(() => {
      loader.startAll();
    },1000);

  });

  // Se define el metodo para enviar status hacia la vista
  loader.onStatusChange((label,status) => {
    win.webContents.send('status',{
      label: label,
      status: status
    });
  });

  /**
   * Inicia un proceso
   */
  ipcMain.on("start",(event,label) => {
    loader.start(label);
  })

  /**
   * Inicia un proceso
   */
  ipcMain.on("end",(event,label) => {
    loader.kill(label);
  })

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools({
      mode: "undocked"
    })
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')
  }
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
  loader.killAll();
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    try {
      await installExtension(VUEJS3_DEVTOOLS)
    } catch (e) {
      console.error('Vue Devtools failed to install:', e.toString())
    }
  }
  createWindow()
})

/**
 * Si se recupera un logpath
 */
ipcMain.on("logPath",(event,filePath) => {
  shell.openPath(filePath)
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}