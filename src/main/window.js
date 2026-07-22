const { app, BrowserWindow } = require('electron');
const path = require('path');

const config = require('./config');

function createWindow() {
    const settings = config.getSettings();
    let width = 1280;
    let height = 720;
    if (settings && settings.resolution) {
        const parts = settings.resolution.split('x');
        if (parts.length === 2) {
            const w = parseInt(parts[0], 10);
            const h = parseInt(parts[1], 10);
            if (!isNaN(w) && !isNaN(h)) {
                width = w;
                height = h;
            }
        }
    }

    const mainWindow = new BrowserWindow({
        width,
        height,
        minWidth: 800,
        minHeight: 600,
        autoHideMenuBar: true,
        icon: path.join(app.getAppPath(), 'program_logo.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // Since window.js is inside projectRoot/src/main/,
            // preload.js is located at projectRoot/preload.js (two levels up)
            preload: path.join(app.getAppPath(), 'preload.js')
        }
    });

    mainWindow.loadFile(path.join(app.getAppPath(), 'index.html'));

    mainWindow.on('close', (e) => {
        const ipc = require('./ipc');
        if (ipc.isCompressionRunning && ipc.isCompressionRunning()) {
            e.preventDefault();
            mainWindow.webContents.send('show-close-warning');
        }
    });

    return mainWindow;
}

module.exports = {
    createWindow
};
