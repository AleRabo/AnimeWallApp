import { app, BrowserWindow, dialog, shell } from 'electron';
import electronUpdater from 'electron-updater';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const port = 3210;
const host = '127.0.0.1';
const isProduction = app.isPackaged || process.argv.includes('--production');
const { autoUpdater } = electronUpdater;
let nextProcess;

function configureAutoUpdates(window) {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.on('update-available', async (info) => {
    const result = await dialog.showMessageBox(window, {
      type: 'info',
      buttons: ['Scarica aggiornamento', 'Più tardi'],
      defaultId: 0,
      cancelId: 1,
      title: 'Aggiornamento AnimeWall disponibile',
      message: `È disponibile AnimeWall ${info.version}.`
    });
    if (result.response === 0) {
      await autoUpdater.downloadUpdate();
    }
  });
  autoUpdater.on('update-downloaded', async () => {
    const result = await dialog.showMessageBox(window, {
      type: 'info',
      buttons: ['Riavvia e installa', 'Più tardi'],
      defaultId: 0,
      cancelId: 1,
      title: 'Aggiornamento pronto',
      message: 'L’aggiornamento è stato scaricato ed è pronto per l’installazione.'
    });
    if (result.response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (error) => {
    console.error('Aggiornamento AnimeWall non riuscito:', error);
  });
  void autoUpdater.checkForUpdates();
}

function startNextServer() {
  const nextCli = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
  const args = isProduction
    ? ['start', '-H', host, '-p', String(port)]
    : ['dev', '-H', host, '-p', String(port)];

  const nodeRuntime = process.execPath;
  nextProcess = spawn(nodeRuntime, [nextCli, ...args], {
    cwd: projectRoot,
    env: {
      ...process.env,
      BROWSER: 'none',
      ELECTRON_RUN_AS_NODE: '1'
    },
    stdio: 'inherit'
  });

  nextProcess.on('error', (error) => {
    console.error('Impossibile avviare il server locale AnimeWall:', error);
  });
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      const socket = createConnection({ host, port });
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - startedAt > 30000) {
          reject(new Error('Il server locale AnimeWall non ha risposto entro 30 secondi.'));
          return;
        }
        setTimeout(check, 250);
      });
    };
    check();
  });
}

async function createMainWindow() {
  startNextServer();
  await waitForServer();

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#08090c',
    icon: path.join(projectRoot, 'electron', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://${host}:${port}`)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  await window.loadURL(`http://${host}:${port}`);
  configureAutoUpdates(window);
}

app.whenReady().then(() => {
  createMainWindow().catch((error) => {
    console.error(error);
    app.quit();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill();
  }
});
