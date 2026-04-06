const { contextBridge, ipcRenderer } = require('electron');

// 预加载脚本 — 安全隔离，通过 contextBridge 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
    // ---- 数据存储路径管理 ----
    getDataPath: () => ipcRenderer.invoke('get-data-path'),
    selectDataPath: () => ipcRenderer.invoke('select-data-path'),
    migrateDataPath: (newPath) => ipcRenderer.invoke('migrate-data-path', newPath),
    // ---- 自动更新 (electron-updater) ----
    checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    downloadAndInstallUpdate: () => ipcRenderer.invoke('download-and-install-update'),
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
    // 监听更新事件
    onUpdateAvailable: (callback) => {
        ipcRenderer.on('update-available', (event, data) => callback(data));
    },
    onUpdateProgress: (callback) => {
        ipcRenderer.on('update-download-progress', (event, data) => callback(data));
    },
    onUpdateDownloaded: (callback) => {
        ipcRenderer.on('update-downloaded', (event, data) => callback(data));
    },
    onUpdateError: (callback) => {
        ipcRenderer.on('update-error', (event, data) => callback(data));
    },
});
