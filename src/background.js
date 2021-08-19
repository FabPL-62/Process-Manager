'use strict'

import { app, protocol, BrowserWindow } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
import { ProcessLoader } from './loader'
import path from 'path';
const isDevelopment = process.env.NODE_ENV !== 'production'
const {nativeImage, shell, ipcMain, Tray, Menu} = require('electron')
process.env.TZ = 'America/Santiago';
const assetsPath = app.isPackaged ? process.resourcesPath : "src/assets";
const iconPath = path.join(assetsPath,'icon.png');

/**
 * Se inicializa loader y se cargan definiciones de scripts
 */
let loader = new ProcessLoader(assetsPath);

// prevent gc to keep windows
let top = {};

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

/**
 * Funcion que crea la ventana
 */
async function createWindow() {

  // Create the browser window.
  top.win = new BrowserWindow({
    icon: iconPath,
    center: true,
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
  top.win.webContents.on('did-finish-load', () => {

    // Se carga el loader con los procesos pendientes
    loader.read();

    // Se envia el listado de procesos hacia la ventana
    top.win.webContents.send('init',{
      logPath: loader.outDir,
      processes: loader.processes
    });

    setTimeout(() => {
      loader.startAll();
    },1000);

  });

  // Previene que la aplicacion se cierre
  top.win.on("close", ev => {
    ev.sender.hide();
    ev.preventDefault();
  });

  // Se crea el traymenu
  top.tray = new Tray(iconPath);
  const menu = Menu.buildFromTemplate([
    {label: "Open window", click: (item, window, event) => {
      top.win.show();
    }},
    {type: "separator"},
    {role: "quit"}, // "role": system prepared action menu
  ]);
  top.tray.setToolTip("Process Manager");
  top.tray.setContextMenu(menu);

  // Se define el metodo para enviar status hacia la vista
  loader.onStatusChange((label,status) => {
    top.win.webContents.send('status',{
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
    await top.win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    // if (!process.env.IS_TEST) top.win.webContents.openDevTools({
    //   mode: "undocked"
    // })
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    top.win.loadURL('app://./index.html')
  }
}

app.on("before-quit", ev => {
  // BrowserWindow "close" event spawn after quit operation,
  // it requires to clean up listeners for "close" event
  if (top.win) top.win.removeAllListeners("close");
  // release windows
  top = null;
});

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