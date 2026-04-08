const { contextBridge, ipcRenderer } = require('electron');

// 预加载脚本 — 安全隔离，通过 contextBridge 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
    // ---- 数据存储路径管理 ----
    getDataPath: () => ipcRenderer.invoke('get-data-path'),
    selectDataPath: () => ipcRenderer.invoke('select-data-path'),
    migrateDataPath: (newPath) => ipcRenderer.invoke('migrate-data-path', newPath),
    // ---- 存档管理 ----
    listSaves: () => ipcRenderer.invoke('list-saves'),
    createSave: (name) => ipcRenderer.invoke('create-save', name),
    loadSave: (name) => ipcRenderer.invoke('load-save', name),
    exportSave: () => ipcRenderer.invoke('export-save'),
    importSave: () => ipcRenderer.invoke('import-save'),
    deleteSave: (name) => ipcRenderer.invoke('delete-save', name),
    renameSave: (oldName, newName) => ipcRenderer.invoke('rename-save', oldName, newName),
    updateSave: (fileName) => ipcRenderer.invoke('update-save', fileName),
    relaunchApp: () => ipcRenderer.invoke('relaunch-app'),
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
