const { app, BrowserWindow, ipcMain, dialog, globalShortcut, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.jfif']);

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.jfif': 'image/jpeg',
};

function listImagesInFolder(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => IMAGE_EXT.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map((name) => path.join(dirPath, name));
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 520,
    minHeight: 460,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // 允许加载文件夹内任意路径的 file:// 图片（默认 webSecurity 会拦截）
      webSecurity: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(1);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildAppMenu() {
  const viewZoomSend = (dir) => (_, win) => {
    if (win && !win.isDestroyed()) win.webContents.send('image-zoom', dir);
  };
  const viewResetSend = () => (_, win) => {
    if (win && !win.isDestroyed()) win.webContents.send('image-view-reset');
  };

  // 新增：点击「关于」菜单触发弹窗的函数
  const openAboutWindow = () => (_, win) => {
    if (win && !win.isDestroyed()) {
      // 执行渲染进程代码，触发关于弹窗
      win.webContents.executeJavaScript(`
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('panel-about').classList.remove('hidden');
      `);
    }
  };

  const template = [
    {
      label: '文件',
      submenu: [{ role: 'quit', label: '退出' }],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '放大图片',
          accelerator: 'CmdOrControl+Plus',
          click: viewZoomSend(1),
        },
        {
          label: '缩小图片',
          accelerator: 'CmdOrControl+-',
          click: viewZoomSend(-1),
        },
        { type: 'separator' },
        {
          label: '重置图片视图',
          accelerator: 'CmdOrControl+0',
          click: viewResetSend(),
        },
      ],
    },
    // 新增：关于菜单（放在View右侧）
    {
      label: '关于',
      click: openAboutWindow(),
    },
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildAppMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  try {
    globalShortcut.register('CommandOrControl+O', () => {
      if (mainWindow) mainWindow.webContents.send('open-folder-shortcut');
    });
  } catch {
    /* ignore */
  }
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  app.quit();
});

/** 主进程读盘转 Data URL，避免渲染进程 file:// 被策略拦截导致黑屏 */
ipcMain.handle('read-image-data-url', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath) {
    return { ok: false, error: '无效路径' };
  }
  try {
    const buf = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'image/jpeg';
    return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (err) {
    return { ok: false, error: err && err.message ? String(err.message) : String(err) };
  }
});

ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (canceled || !filePaths[0]) return { paths: [] };
  const paths = listImagesInFolder(filePaths[0]);
  return { folder: filePaths[0], paths };
});