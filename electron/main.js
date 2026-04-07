const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const fs = require('fs');
const { getServerWaitConfig, shouldLoadEnvFile } = require('./startup-config');

// 加载 .env.local（轻量实现，无需 dotenv 依赖）
(function loadEnvFile() {
    if (!shouldLoadEnvFile({ isPackaged: app.isPackaged })) {
        return;
    }

    const envPaths = [
        path.join(__dirname, '..', '.env.local'),
        path.join(__dirname, '..', '.env'),
    ];
    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            const lines = fs.readFileSync(envPath, 'utf8').split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx === -1) continue;
                const key = trimmed.slice(0, eqIdx).trim();
                const value = trimmed.slice(eqIdx + 1).trim();
                if (key && !process.env[key]) {
                    process.env[key] = value;
                }
            }
            break; // 只加载第一个找到的文件
        }
    }
})();

// 保证单实例运行
const gotTheLock = app.requestSingleInstanceLock();

// 日志文件 - 写到操作系统的 UserData 目录（避免 C 盘权限问题被静默拦截）
const logFile = path.join(app.getPath('userData'), 'author-debug.log');
const userDataPath = app.getPath('userData');
function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(msg);
    fs.appendFile(logFile, line, () => { });
}

// ==================== 数据存储路径配置 ====================

const configFilePath = path.join(app.getPath('userData'), 'author-config.json');

function loadConfig() {
    try {
        if (fs.existsSync(configFilePath)) {
            return JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
        }
    } catch (e) {
        log(`[Config] Failed to load config: ${e.message}`);
    }
    return {};
}

function saveConfig(config) {
    try {
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (e) {
        log(`[Config] Failed to save config: ${e.message}`);
    }
}

function getDefaultDataDir() {
    const isPackaged = app.isPackaged;
    if (isPackaged) {
        return path.join(process.resourcesPath, 'standalone', 'data');
    }
    return path.join(__dirname, '..', '.next', 'standalone', 'data');
}

function getCurrentDataDir() {
    const config = loadConfig();
    return config.dataDir || getDefaultDataDir();
}

// 启动时设置 DATA_DIR 环境变量，确保 /api/storage 路由使用正确的路径
(function applyDataDir() {
    const dataDir = getCurrentDataDir();
    process.env.DATA_DIR = dataDir;
    log(`[Config] DATA_DIR set to: ${dataDir}`);
})();

// 递归复制目录
async function copyDirRecursive(src, dest) {
    const fsPromises = require('fs').promises;
    await fsPromises.mkdir(dest, { recursive: true });
    const entries = await fsPromises.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDirRecursive(srcPath, destPath);
        } else {
            await fsPromises.copyFile(srcPath, destPath);
        }
    }
}

// 递归删除目录
async function removeDirRecursive(dirPath) {
    const fsPromises = require('fs').promises;
    await fsPromises.rm(dirPath, { recursive: true, force: true });
}

ipcMain.handle('open-data-folder', async () => {
    try {
        const dataDir = getCurrentDataDir();
        const result = await shell.openPath(dataDir);
        if (result) {
            log(`[OpenDataFolder] Failed: ${result}`);
            return { success: false, error: result };
        }
        log(`[OpenDataFolder] Opened: ${dataDir}`);
        return { success: true, path: dataDir };
    } catch (error) {
        const message = error?.message || String(error);
        log(`[OpenDataFolder] Error: ${message}`);
        return { success: false, error: message };
    }
});

ipcMain.handle('get-data-path', async () => {
    return { success: true, path: getCurrentDataDir() };
});

ipcMain.handle('select-data-path', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            title: '选择数据存储位置',
            properties: ['openDirectory', 'createDirectory'],
            defaultPath: getCurrentDataDir(),
        });
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            return { success: false, canceled: true };
        }
        return { success: true, path: result.filePaths[0] };
    } catch (error) {
        const message = error?.message || String(error);
        log(`[SelectDataPath] Error: ${message}`);
        return { success: false, error: message };
    }
});

ipcMain.handle('migrate-data-path', async (event, newPath) => {
    try {
        const oldPath = getCurrentDataDir();
        log(`[MigrateData] From: ${oldPath} -> To: ${newPath}`);

        // 同一路径无需迁移
        if (path.resolve(oldPath) === path.resolve(newPath)) {
            return { success: true, path: newPath, message: 'Same path, no migration needed' };
        }

        // 确保目标目录存在
        if (!fs.existsSync(newPath)) {
            fs.mkdirSync(newPath, { recursive: true });
        }

        // 如果旧目录存在且有内容，复制到新位置
        if (fs.existsSync(oldPath)) {
            const entries = fs.readdirSync(oldPath);
            if (entries.length > 0) {
                log(`[MigrateData] Copying ${entries.length} entries...`);
                await copyDirRecursive(oldPath, newPath);
                log(`[MigrateData] Copy complete`);

                // 删除旧目录中的数据
                await removeDirRecursive(oldPath);
                log(`[MigrateData] Old data cleaned up`);
            }
        }

        // 更新配置
        const config = loadConfig();
        config.dataDir = newPath;
        saveConfig(config);

        // 更新环境变量
        process.env.DATA_DIR = newPath;
        log(`[MigrateData] Config updated, DATA_DIR = ${newPath}`);

        // 重启应用以确保所有组件使用新路径
        setTimeout(() => {
            app.relaunch();
            app.quit();
        }, 1500);

        return { success: true, path: newPath };
    } catch (error) {
        const message = error?.message || String(error);
        log(`[MigrateData] Error: ${message}`);
        return { success: false, error: message };
    }
});

if (!gotTheLock) {
    log('Another instance is running, quitting.');
    app.quit();
    process.exit(0);
}

app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

let mainWindow;
let splashWindow;
let serverProcess;

const isDev = process.argv.includes('--dev');
const BASE_PORT = parseInt(process.env.PORT, 10) || 3000;
let actualPort = BASE_PORT;
let loadRetries = 0;
const MAX_LOAD_RETRIES = 10;
let serverReady = false; // 追踪服务器是否真正就绪
let serverCrashed = false; // 追踪子进程是否已崩溃

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        title: 'Author — AI-Powered Creative Writing',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        autoHideMenuBar: true,
        show: false,
    });

    mainWindow.loadURL(`http://localhost:${actualPort}`);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        // F12 打开开发者工具
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.key === 'F12') {
                mainWindow.webContents.toggleDevTools();
            }
        });
    });

    // 加载失败时有限次重试
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        loadRetries++;
        log(`Load failed (${loadRetries}/${MAX_LOAD_RETRIES}): ${errorDescription}`);
        if (loadRetries < MAX_LOAD_RETRIES) {
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.loadURL(`http://localhost:${actualPort}`);
                }
            }, 2000);
        } else {
            mainWindow.show();
            dialog.showErrorBox(
                'Author 启动失败',
                '无法连接到内置服务器。\n\n' +
                '查看日志: ' + logFile
            );
        }
    });

    // 只有真正加载了 localhost 页面才重置重试计数器
    mainWindow.webContents.on('did-finish-load', () => {
        const url = mainWindow.webContents.getURL();
        if (url.includes('localhost')) {
            log('Page loaded successfully: ' + url);
            loadRetries = 0;
        }
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http') && !url.includes('localhost')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    // 确保下载文件使用正确的文件名（而非 blob UUID）
    mainWindow.webContents.session.on('will-download', (event, item) => {
        const suggestedName = item.getFilename();
        // 如果文件名看起来像 UUID（没有扩展名或是 blob hash），尝试用 Content-Disposition
        if (suggestedName && !suggestedName.match(/^[0-9a-f-]{36}/i)) {
            // 文件名正常，不需要干预
            return;
        }
        // Electron 有时已经能从 a.download 获取到正确名称，这里做兜底
        log(`[Download] Original filename: ${suggestedName}`);
    });

    // 捕获底层渲染线程崩溃（如内存溢出 OOM、GPU 崩溃等导致的突然白屏）
    mainWindow.webContents.on('render-process-gone', (event, details) => {
        log(`[Crash] Renderer process gone. Reason: ${details.reason}, Code: ${details.exitCode}`);
        if (details.reason !== 'clean-exit') {
            const options = {
                type: 'error',
                title: '系统崩溃拦截',
                message: '渲染进程由于致命错误（如内存不足或驱动异常）突然终止。',
                detail: `崩溃原因: ${details.reason}\n错误码: ${details.exitCode}\n\n系统被迫中断。如果您刚才正在编辑，文字会安全保留在本地存储中不会丢失。\n您可以随时安全地重启应用。`,
                buttons: ['立即重启', '结束应用'],
                defaultId: 0
            };
            const btnIdx = dialog.showMessageBoxSync(mainWindow, options);
            if (btnIdx === 0) {
                app.relaunch();
                app.quit();
            } else {
                app.quit();
            }
        }
    });

    // 网页长时间无响应
    mainWindow.webContents.on('unresponsive', () => {
        log('[Crash] Renderer process became unresponsive.');
        const options = {
            type: 'warning',
            title: '进程失去响应',
            message: '由于高负荷运算或资源挤占，程序目前暂时无法响应。',
            detail: '您可以耐心等待系统恢复，或者选择强制重启程序。',
            buttons: ['继续等待', '强制重启'],
            defaultId: 0
        };
        const btnIdx = dialog.showMessageBoxSync(mainWindow, options);
        if (btnIdx === 1) {
            app.relaunch();
            app.quit();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// 检测端口是否可用
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', () => resolve(false));
        server.once('listening', () => {
            server.close(() => resolve(true));
        });
        server.listen(port, '127.0.0.1');
    });
}

// 查找可用端口
async function findAvailablePort(startPort, maxTries = 10) {
    for (let i = 0; i < maxTries; i++) {
        const port = startPort + i;
        if (await isPortAvailable(port)) {
            return port;
        }
        log(`Port ${port} is in use, trying next...`);
    }
    return null;
}

// 尝试杀掉占用端口的进程 (Windows)
function execCommand(command, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, {
            shell: true,
            windowsHide: true,
        });

        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            child.kill();
            reject(new Error(`Command timed out: ${command}`));
        }, timeout);

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        child.on('error', (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
        });
        child.on('close', (code) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (code === 0) resolve(stdout);
            else reject(new Error(stderr || stdout || `Command failed with code ${code}: ${command}`));
        });
    });
}

async function tryKillPortProcess(port) {
    try {
        if (process.platform === 'win32') {
            const result = await execCommand(`netstat -ano | findstr :${port} | findstr LISTENING`);
            const pids = [...new Set(result.trim().split('\n').map(line => line.trim().split(/\s+/).pop()).filter(pid => pid && pid !== '0'))];
            await Promise.all(pids.map(async (pid) => {
                log(`Killing process ${pid} on port ${port}`);
                try {
                    await execCommand(`taskkill /F /PID ${pid}`);
                } catch (e) { }
            }));
        }
    } catch (e) {
        // 没有进程占用或命令失败，忽略
    }
}

function waitForServer(port) {
    const { maxRetries, retryDelayMs, requestTimeoutMs } = getServerWaitConfig({ isPackaged: app.isPackaged });

    return new Promise((resolve) => {
        let retries = 0;
        const check = () => {
            if (serverCrashed) {
                log(`[waitForServer] Server process already crashed, aborting wait`);
                resolve(false);
                return;
            }
            if (retries > 0 && retries % 5 === 0) {
                log(`[waitForServer] Still waiting for server... attempt ${retries}/${maxRetries}`);
                updateSplashText(`正在启动服务... (${retries}/${maxRetries})`);
            }
            const req = http.get(`http://localhost:${port}`, (res) => {
                res.resume();
                resolve(true);
            });
            req.on('error', () => {
                retries++;
                if (retries >= maxRetries) {
                    log(`[waitForServer] Timed out after ${maxRetries} retries`);
                    resolve(false);
                } else {
                    setTimeout(check, retryDelayMs);
                }
            });
            req.setTimeout(requestTimeoutMs, () => {
                req.destroy();
                retries++;
                if (retries >= maxRetries) {
                    log(`[waitForServer] Timed out after ${maxRetries} retries`);
                    resolve(false);
                } else {
                    setTimeout(check, retryDelayMs);
                }
            });
        };
        check();
    });
}

function startNextServer() {
    return new Promise(async (resolve) => {
        if (isDev) {
            log('Dev mode — connecting to existing dev server...');
            resolve(true);
            return;
        }

        const isPackaged = app.isPackaged;
        let standaloneDir;

        if (isPackaged) {
            standaloneDir = path.join(process.resourcesPath, 'standalone');
        } else {
            standaloneDir = path.join(__dirname, '..', '.next', 'standalone');
        }

        const serverPath = path.join(standaloneDir, 'server.js');

        log(`isPackaged: ${isPackaged}`);
        log(`resourcesPath: ${process.resourcesPath}`);
        log(`standaloneDir: ${standaloneDir}`);
        log(`serverPath: ${serverPath}`);
        log(`serverExists: ${fs.existsSync(serverPath)}`);

        // 检查关键目录
        const staticDir = path.join(standaloneDir, '.next', 'static');
        const publicDir = path.join(standaloneDir, 'public');
        log(`staticDir exists: ${fs.existsSync(staticDir)}`);
        log(`publicDir exists: ${fs.existsSync(publicDir)}`);

        if (!fs.existsSync(serverPath)) {
            const msg = '找不到 server.js\n路径: ' + serverPath;
            log('ERROR: ' + msg);
            dialog.showErrorBox('Author 启动失败', msg);
            resolve(false);
            return;
        }

        if (isPackaged) {
            actualPort = BASE_PORT;
            log(`Using packaged base port: ${actualPort}`);
        } else {
            await tryKillPortProcess(BASE_PORT);

            actualPort = await findAvailablePort(BASE_PORT);
            if (!actualPort) {
                const msg = `端口 ${BASE_PORT}-${BASE_PORT + 9} 全部被占用，无法启动服务器。`;
                log('ERROR: ' + msg);
                dialog.showErrorBox('Author 启动失败', msg);
                resolve(false);
                return;
            }

            log(`Using port: ${actualPort}`);
        }

        // ===== 策略1：尝试子进程模式（5 秒超时预检） =====
        const childProcessOk = await tryChildProcessMode(standaloneDir, serverPath);
        if (childProcessOk) {
            log('[Strategy] Child process mode succeeded');
            const ready = await waitForServer(actualPort);
            serverReady = ready;
            log(`Server ready: ${ready}`);
            resolve(ready);
            return;
        }

        // ===== 策略2：主进程内直接加载 server.js =====
        log('[Strategy] Falling back to in-process server mode...');
        updateSplashText('正在以兼容模式启动...');

        const inProcessOk = await tryInProcessMode(standaloneDir, serverPath);
        if (inProcessOk) {
            log('[Strategy] In-process mode succeeded');
            const ready = await waitForServer(actualPort);
            serverReady = ready;
            log(`Server ready: ${ready}`);
            resolve(ready);
            return;
        }

        log('[Strategy] All strategies failed');
        resolve(false);
    });
}

// ===== 策略1：子进程模式 =====
function tryChildProcessMode(standaloneDir, serverPath) {
    return new Promise(async (resolve) => {
        const nodeExecutable = process.execPath;
        log(`[ChildProcess] Node executable: ${nodeExecutable}`);

        updateSplashText('正在检测运行环境...');

        // 预检：验证 ELECTRON_RUN_AS_NODE 是否生效（5 秒超时）
        const preflightOk = await new Promise((preResolve) => {
            const { spawn: spawnProcess } = require('child_process');
            log('[Preflight] Testing ELECTRON_RUN_AS_NODE...');
            let resolved = false;
            const testProc = spawnProcess(nodeExecutable, ['-e', 'console.log("PREFLIGHT_OK:" + process.version)'], {
                env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
            });
            let testOutput = '';
            let testErr = '';
            testProc.stdout.on('data', (d) => { testOutput += d.toString(); });
            testProc.stderr.on('data', (d) => { testErr += d.toString(); });
            testProc.on('close', (code) => {
                if (resolved) return;
                resolved = true;
                log(`[Preflight] exit code: ${code}, stdout: ${testOutput.trim()}, stderr: ${testErr.trim()}`);
                preResolve(testOutput.includes('PREFLIGHT_OK'));
            });
            testProc.on('error', (err) => {
                if (resolved) return;
                resolved = true;
                log(`[Preflight] error: ${err.message}`);
                preResolve(false);
            });
            // 5 秒超时（不再等 10 秒）
            setTimeout(() => {
                if (resolved) return;
                resolved = true;
                log('[Preflight] Timed out after 5s — ELECTRON_RUN_AS_NODE likely blocked');
                try { testProc.kill(); } catch (e) { }
                preResolve(false);
            }, 5000);
        });

        if (!preflightOk) {
            log('[ChildProcess] Preflight failed, skipping child process mode');
            resolve(false);
            return;
        }
        log('[ChildProcess] Preflight passed');

        // 启动服务子进程
        updateSplashText('正在启动内置服务...');
        serverCrashed = false;

        const serverPathEscaped = serverPath.replace(/\\/g, '\\\\');
        const wrapperScript = [
            `process.on('uncaughtException', (e) => { console.error('UNCAUGHT_EXCEPTION:', e.stack || e); process.exit(1); });`,
            `process.on('unhandledRejection', (e) => { console.error('UNHANDLED_REJECTION:', e && e.stack ? e.stack : e); process.exit(1); });`,
            `console.log('WRAPPER: Starting server.js at ' + new Date().toISOString());`,
            `try { require('${serverPathEscaped}'); } catch(e) { console.error('WRAPPER_LOAD_ERROR:', e.stack || e); process.exit(1); }`,
        ].join('\n');

        try {
            const { spawn: spawnProcess } = require('child_process');
            serverProcess = spawnProcess(nodeExecutable, ['-e', wrapperScript], {
                cwd: standaloneDir,
                env: {
                    ...process.env,
                    NODE_ENV: 'production',
                    PORT: String(actualPort),
                    HOSTNAME: '0.0.0.0',
                    BODY_SIZE_LIMIT: '52428800',
                    ELECTRON_RUN_AS_NODE: '1',
                },
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
            });

            log(`[ChildProcess] Spawned PID: ${serverProcess.pid}`);

            if (!serverProcess.pid) {
                log('[ChildProcess] ERROR: No PID');
                resolve(false);
                return;
            }

            serverProcess.stdout.on('data', (data) => {
                log('[Next.js stdout] ' + data.toString().trim());
            });
            serverProcess.stderr.on('data', (data) => {
                log('[Next.js stderr] ' + data.toString().trim());
            });
            serverProcess.on('error', (err) => {
                log('[Server process error] ' + err.message);
                serverCrashed = true;
            });
            serverProcess.on('exit', (code, signal) => {
                log(`[Server process exit] code: ${code}, signal: ${signal}`);
                serverReady = false;
                serverCrashed = true;
            });
            serverProcess.on('close', (code, signal) => {
                log(`[Server process closed] code: ${code}, signal: ${signal}`);
                serverReady = false;
            });

            // 最多等 1.2 秒确认子进程没有立刻退出
            await new Promise(r => setTimeout(r, 1200));
            if (serverCrashed) {
                log('[ChildProcess] Process crashed during startup');
                resolve(false);
                return;
            }

            log('[ChildProcess] Process alive, waiting for HTTP...');
            updateSplashText('等待服务就绪...');
            resolve(true);

        } catch (spawnErr) {
            log(`[ChildProcess] Spawn error: ${spawnErr.message}`);
            resolve(false);
        }
    });
}

// ===== 策略2：主进程内直接加载 =====
function tryInProcessMode(standaloneDir, serverPath) {
    return new Promise(async (resolve) => {
        log('[InProcess] Loading server.js directly in main process...');
        log(`[InProcess] Setting CWD to: ${standaloneDir}`);
        log(`[InProcess] PORT=${actualPort}`);

        // 保存原始 CWD 和环境变量
        const originalCwd = process.cwd();

        try {
            // 设置环境变量（server.js 会读取这些）
            process.env.NODE_ENV = 'production';
            process.env.PORT = String(actualPort);
            process.env.HOSTNAME = '0.0.0.0';
            process.env.BODY_SIZE_LIMIT = '52428800';

            // 切换工作目录到 standalone（server.js 需要相对路径找 .next 文件）
            process.chdir(standaloneDir);
            log('[InProcess] CWD changed to: ' + process.cwd());

            // 加载 server.js
            require(serverPath);
            log('[InProcess] server.js loaded successfully (sync)');

            // 短暂等待让服务完成异步初始化
            await new Promise(r => setTimeout(r, 600));

            updateSplashText('等待服务就绪...');
            resolve(true);

        } catch (err) {
            log(`[InProcess] FAILED: ${err.message}`);
            log(`[InProcess] Stack: ${err.stack}`);
            // 恢复 CWD
            try { process.chdir(originalCwd); } catch (e) { }
            resolve(false);
        }
    });
}

// ==================== 启动闪屏窗口 ====================

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 400,
        height: 200,
        frame: false,
        transparent: false,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: false,
        show: true,
        backgroundColor: '#1a1a2e',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    const splashHtml = `
    <html>
    <head><meta charset="utf-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            color: #e0e0e0;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            height: 100vh; user-select: none; -webkit-app-region: drag;
        }
        .title { font-size: 28px; font-weight: 700; color: #fff; margin-bottom: 16px; letter-spacing: 2px; }
        .status { font-size: 14px; color: #a0a8c0; margin-bottom: 20px; transition: opacity 0.3s; }
        .spinner {
            width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.15);
            border-top-color: #e94560; border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
    </head>
    <body>
        <div class="title">Author</div>
        <div class="status" id="status">正在初始化...</div>
        <div class="spinner"></div>
    </body>
    </html>`;

    splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml));

    splashWindow.on('closed', () => {
        splashWindow = null;
    });
}

function updateSplashText(text) {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.executeJavaScript(
            `document.getElementById('status').textContent = ${JSON.stringify(text)};`
        ).catch(() => { });
    }
}

function closeSplashWindow() {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
    }
}

app.whenReady().then(async () => {
    log('=== Author Desktop Starting ===');
    log(`Electron version: ${process.versions.electron}`);
    log(`Node version: ${process.versions.node}`);
    log(`Platform: ${process.platform} ${process.arch}`);
    log(`App path: ${app.getAppPath()}`);
    log(`Exe path: ${process.execPath}`);

    // 立即显示启动窗口，让用户知道程序在运行
    if (!isDev) {
        createSplashWindow();
    }

    const ready = await startNextServer();

    if (!ready) {
        closeSplashWindow();
        log('Server failed to start. Showing error dialog.');
        dialog.showErrorBox(
            'Author 启动失败',
            '内置服务器无法启动。\n\n' +
            '可能原因：\n' +
            '1. 端口被其他程序占用\n' +
            '2. 缺少运行文件\n' +
            '3. 防火墙或杀毒软件拦截\n\n' +
            '请检查日志: ' + logFile
        );
        app.quit();
        return;
    }

    updateSplashText('加载界面中...');
    createWindow();

    // 主窗口显示后关闭 splash
    mainWindow.once('ready-to-show', () => {
        closeSplashWindow();
    });

    // 兜底：5 秒后无论如何关闭 splash
    setTimeout(closeSplashWindow, 5000);

    setupAutoUpdater();
});

// ==================== 自动更新 (electron-updater) ====================

function setupAutoUpdater() {
    // electron-updater 仅在打包后可用
    if (isDev || !app.isPackaged) {
        log('Dev mode — skipping auto-updater setup');
        return;
    }

    let autoUpdater;
    try {
        autoUpdater = require('electron-updater').autoUpdater;
    } catch (err) {
        log('Failed to load electron-updater: ' + err.message);
        return;
    }

    // 配置
    autoUpdater.autoDownload = false;        // 不自动下载，等用户确认
    autoUpdater.autoInstallOnAppQuit = true;  // 退出时自动安装已下载的更新
    autoUpdater.logger = { info: log, warn: log, error: log, debug: log };

    // ---- 事件转发到渲染进程 ----
    autoUpdater.on('update-available', (info) => {
        log(`Update available: v${info.version}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-available', {
                version: info.version,
                releaseDate: info.releaseDate,
            });
        }
    });

    autoUpdater.on('update-not-available', () => {
        log('No update available');
    });

    autoUpdater.on('download-progress', (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-download-progress', {
                progress: Math.floor(progress.percent),
                bytesPerSecond: progress.bytesPerSecond,
                downloaded: progress.transferred,
                total: progress.total,
            });
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        log(`Update downloaded: v${info.version}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-downloaded', {
                version: info.version,
            });
        }
    });

    autoUpdater.on('error', (err) => {
        log('Auto-updater error: ' + err.message);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-error', {
                error: err.message,
            });
        }
    });

    // ---- IPC 处理 ----
    ipcMain.handle('check-for-update', async () => {
        try {
            const result = await autoUpdater.checkForUpdates();
            return { success: true, version: result?.updateInfo?.version };
        } catch (err) {
            log('Check update error: ' + err.message);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('download-update', async () => {
        try {
            await autoUpdater.downloadUpdate();
            return { success: true };
        } catch (err) {
            log('Download update error: ' + err.message);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('download-and-install-update', async () => {
        try {
            log('download-and-install-update: starting download...');
            // 注册一次性监听器，下载完成后自动安装
            autoUpdater.once('update-downloaded', () => {
                log('download-and-install-update: download complete, quitting and installing...');
                if (serverProcess) {
                    serverProcess.kill();
                    serverProcess = null;
                }
                autoUpdater.quitAndInstall(false, true);
            });
            await autoUpdater.downloadUpdate();
            return { success: true };
        } catch (err) {
            log('download-and-install-update error: ' + err.message);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('quit-and-install', () => {
        log('User requested quit-and-install');
        if (serverProcess) {
            serverProcess.kill();
            serverProcess = null;
        }
        autoUpdater.quitAndInstall(false, true); // isSilent=false, isForceRunAfter=true
    });

    // 不再自动检查更新，用户可在帮助面板手动检查
}

app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

app.on('window-all-closed', () => {
    if (serverProcess) serverProcess.kill();
    app.quit();
});

app.on('before-quit', () => {
    if (serverProcess) serverProcess.kill();
});
