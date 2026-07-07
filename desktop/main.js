// Processo principal do Electron — modo "Wispr Flow":
// um atalho global faz aparecer um pill flutuante sobre qualquer aplicativo;
// você fala, o texto é transcrito/formatado e colado automaticamente
// no campo que estava focado.

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  ipcMain,
  clipboard,
  session,
  nativeImage,
  Notification,
  screen,
  shell,
} = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

let overlayWindow = null;
let settingsWindow = null;
let mainWindow = null;
let tray = null;

// ---------- Configurações (JSON em userData, compartilhado entre janelas) ----------

const DEFAULT_SETTINGS = {
  provider: 'anthropic', // provedor da formatação por IA
  apiKey: '',
  whisperKey: '', // chave OpenAI para transcrição (obrigatória no desktop)
  lang: 'pt-BR',
  tone: 'natural',
  aiEnabled: true,
  voiceCommands: true,
  autoPaste: true, // colar automaticamente no app ativo
  hotkey: 'CommandOrControl+Shift+Space',
  openAtLogin: false,
};

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(patch) {
  const merged = { ...loadSettings(), ...patch };
  fs.writeFileSync(settingsPath(), JSON.stringify(merged, null, 2));
  return merged;
}

// ---------- Overlay (o pill flutuante) ----------

const OVERLAY_WIDTH = 420;
const OVERLAY_HEIGHT = 120;

function createOverlay() {
  overlayWindow = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    focusable: false, // não rouba o foco do app onde você vai colar
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadFile(path.join(__dirname, 'overlay.html'));
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function positionOverlay() {
  // Centralizado na parte de baixo da tela onde está o cursor.
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const { x, y, width, height } = display.workArea;
  overlayWindow.setPosition(
    Math.round(x + (width - OVERLAY_WIDTH) / 2),
    Math.round(y + height - OVERLAY_HEIGHT - 24)
  );
}

function toggleDictation() {
  if (!overlayWindow) createOverlay();
  if (!overlayWindow.isVisible()) {
    positionOverlay();
    overlayWindow.showInactive(); // mantém o foco no app de destino
  }
  overlayWindow.webContents.send('dictation:toggle');
}

function hideOverlay() {
  if (overlayWindow?.isVisible()) overlayWindow.hide();
}

// ---------- Colar automático no app ativo ----------

function pasteCommand() {
  if (process.platform === 'win32') {
    return {
      cmd: 'powershell.exe',
      args: ['-NoProfile', '-Command', "(New-Object -ComObject wscript.shell).SendKeys('^v')"],
    };
  }
  if (process.platform === 'darwin') {
    return {
      cmd: 'osascript',
      args: ['-e', 'tell application "System Events" to keystroke "v" using command down'],
    };
  }
  return { cmd: 'xdotool', args: ['key', '--clearmodifiers', 'ctrl+v'] };
}

function autoPaste(text) {
  return new Promise((resolve) => {
    clipboard.writeText(text);
    const settings = loadSettings();
    if (!settings.autoPaste) {
      notify('Texto pronto', 'Copiado para a área de transferência — cole com Ctrl+V.');
      resolve({ pasted: false, copied: true });
      return;
    }
    // Pequena pausa para o overlay sumir e o app de destino "assentar" o foco.
    setTimeout(() => {
      const { cmd, args } = pasteCommand();
      execFile(cmd, args, (error) => {
        if (error) {
          notify(
            'Texto copiado',
            process.platform === 'linux'
              ? 'Instale o xdotool para colar automático — por ora, cole com Ctrl+V.'
              : 'Não consegui colar automaticamente — cole com Ctrl+V.'
          );
          resolve({ pasted: false, copied: true });
        } else {
          resolve({ pasted: true, copied: true });
        }
      });
    }, 220);
  });
}

function notify(title, body) {
  if (Notification.isSupported()) new Notification({ title, body }).show();
}

// ---------- Janela de configurações ----------

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 460,
    height: 640,
    autoHideMenuBar: true,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// ---------- Janela do app completo (histórico, estatísticas etc.) ----------

function openFullApp() {
  if (mainWindow) {
    mainWindow.focus();
    return;
  }
  mainWindow = new BrowserWindow({
    width: 900,
    height: 740,
    autoHideMenuBar: true,
    backgroundColor: '#0f1117',
    webPreferences: { contextIsolation: true },
  });
  mainWindow.loadFile(path.join(__dirname, 'web', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------- Tray ----------

function createTray() {
  const icon = nativeImage
    .createFromPath(path.join(__dirname, 'build', 'icon.png'))
    .resize({ width: 18, height: 18 });
  tray = new Tray(icon);
  tray.setToolTip('Ditado por Voz');
  refreshTrayMenu();
  tray.on('click', toggleDictation);
}

function refreshTrayMenu() {
  const settings = loadSettings();
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Ditar (${prettyHotkey(settings.hotkey)})`, click: toggleDictation },
      { type: 'separator' },
      { label: 'Configurações…', click: openSettings },
      { label: 'Abrir app completo', click: openFullApp },
      { type: 'separator' },
      { label: 'Sair', click: () => app.quit() },
    ])
  );
}

function prettyHotkey(accelerator) {
  return accelerator
    .replace('CommandOrControl', process.platform === 'darwin' ? 'Cmd' : 'Ctrl')
    .replace('Space', 'Espaço');
}

// ---------- Atalho global ----------

function registerHotkey() {
  globalShortcut.unregisterAll();
  const settings = loadSettings();
  const ok = globalShortcut.register(settings.hotkey, toggleDictation);
  if (!ok) {
    notify('Atalho indisponível', `Não consegui registrar ${prettyHotkey(settings.hotkey)}.`);
  }
}

// ---------- IPC ----------

ipcMain.handle('settings:get', () => loadSettings());

ipcMain.handle('settings:save', (_event, patch) => {
  const merged = saveSettings(patch);
  registerHotkey();
  refreshTrayMenu();
  app.setLoginItemSettings({ openAtLogin: merged.openAtLogin });
  overlayWindow?.webContents.send('settings:updated', merged);
  return merged;
});

ipcMain.handle('overlay:paste', async (_event, text) => {
  hideOverlay();
  return autoPaste(text);
});

ipcMain.on('overlay:hide', hideOverlay);
ipcMain.on('overlay:open-settings', openSettings);
ipcMain.on('overlay:resize', (_event, height) => {
  overlayWindow?.setSize(OVERLAY_WIDTH, Math.max(OVERLAY_HEIGHT, Math.round(height)));
});
ipcMain.on('open-external', (_event, url) => {
  if (/^https:\/\//.test(url)) shell.openExternal(url);
});

// ---------- Ciclo de vida ----------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', toggleDictation);

  app.whenReady().then(() => {
    // Concede acesso ao microfone (gravação de áudio para o Whisper).
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      callback(permission === 'media');
    });

    createTray();
    createOverlay();
    registerHotkey();

    const settings = loadSettings();
    app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });

    // Primeira execução sem chave: abre as configurações.
    if (!settings.whisperKey && !settings.apiKey) openSettings();
  });
}

// App de bandeja: continua rodando sem janelas abertas.
app.on('window-all-closed', (event) => {
  // não sair — o tray mantém o app vivo
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
