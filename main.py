import webview
import os
import base64
import threading
from pathlib import Path

# 配置
IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.jfif'}
MIME_BY_EXT = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.jfif': 'image/jpeg',
}

# 自动找到 index.html
html_path = os.path.join(os.path.dirname(__file__), 'index.html')

class Api:
    def __init__(self):
        self.window = None

    def set_window(self, window):
        self.window = window

    # ========== 对应 Electron 的 ipcMain.handle('read-image-data-url') ==========
    def readImageDataUrl(self, file_path):
        try:
            with open(file_path, 'rb') as f:
                ext = Path(file_path).suffix.lower()
                mime = MIME_BY_EXT.get(ext, 'image/jpeg')
                data_url = f'data:{mime};base64,{base64.b64encode(f.read()).decode()}'
                return {'ok': True, 'dataUrl': data_url}
        except Exception as e:
            return {'ok': False, 'error': str(e)}

    # ========== 对应 Electron 的 ipcMain.handle('select-folder') ==========
    def selectFolder(self):
        # 用 threading 避免阻塞 UI，完全不卡
        result = {'paths': []}
        event = threading.Event()

        def _select():
            try:
                # 用 pywebview 原生的文件选择，零冲突
                folder_path = self.window.create_file_dialog(
                    webview.FOLDER_DIALOG,
                    directory='',
                    allow_multiple=False
                )
                if folder_path and len(folder_path) > 0:
                    folder = folder_path[0]
                    # 列出所有图片文件，和 Electron 逻辑完全一致
                    paths = []
                    for entry in os.scandir(folder):
                        if entry.is_file():
                            ext = Path(entry.name).suffix.lower()
                            if ext in IMAGE_EXT:
                                paths.append(entry.path)
                    # 自然排序，和 Electron 一致
                    paths.sort(key=lambda x: Path(x).stem.lower())
                    result['paths'] = paths
                    result['folder'] = folder
            finally:
                event.set()

        threading.Thread(target=_select, daemon=True).start()
        event.wait()
        return result

    # ========== 对应 Electron 的菜单/快捷键事件 ==========
    def trigger_open_folder(self):
        if self.window:
            self.window.evaluate_js("""
                if (window.api && window.api._onFolderShortcut) {
                    window.api._onFolderShortcut();
                } else {
                    // 直接调用渲染进程的 pickFolder 函数
                    if (typeof pickFolder === 'function') {
                        pickFolder();
                    }
                }
            """)

    def trigger_image_zoom(self, direction):
        if self.window:
            self.window.evaluate_js(f"""
                if (window.api && window.api._onImageZoom) {{
                    window.api._onImageZoom({direction});
                }} else {{
                    // 直接调用渲染进程的 zoomFromMenu 函数
                    if (typeof zoomFromMenu === 'function') {{
                        zoomFromMenu({direction});
                    }}
                }}
            """)

    def trigger_image_reset(self):
        if self.window:
            self.window.evaluate_js("""
                if (window.api && window.api._onImageViewReset) {
                    window.api._onImageViewReset();
                } else {
                    // 直接调用渲染进程的 resetImageView 函数
                    if (typeof resetImageView === 'function') {
                        resetImageView();
                    }
                }
            """)

    def trigger_about_panel(self):
        if self.window:
            self.window.evaluate_js("""
                const overlay = document.getElementById('modal-overlay');
                const panel = document.getElementById('panel-about');
                if (overlay) overlay.classList.remove('hidden');
                if (panel) panel.classList.remove('hidden');
            """)

if __name__ == '__main__':
    api = Api()

    # ========== 构建菜单，和 Electron 完全一致 ==========
    menu = [
        webview.menu.Menu('文件', [
            webview.menu.MenuAction('退出', lambda: os._exit(0)),
        ]),
        webview.menu.Menu('视图', [
            webview.menu.MenuAction('放大图片', lambda: api.trigger_image_zoom(1)),
            webview.menu.MenuAction('缩小图片', lambda: api.trigger_image_zoom(-1)),
            webview.menu.MenuSeparator(),
            webview.menu.MenuAction('重置图片视图', lambda: api.trigger_image_reset()),
        ]),
        webview.menu.Menu('关于', [
            webview.menu.MenuAction('关于', lambda: api.trigger_about_panel()),
        ]),
    ]

    # 创建窗口，和 Electron 配置完全一致
    window = webview.create_window(
        '图片查看器',
        html_path,
        width=1000,
        height=700,
        min_size=(520, 460),
        background_color='#000000',
        js_api=api,
        menu=menu,
        text_select=False
    )
    api.set_window(window)

    webview.start()