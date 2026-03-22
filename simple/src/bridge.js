import { invoke } from '@tauri-apps/api/core';

const _ev = { folder: [], zoom: [], reset: [] };

window.api = {
  async readImageDataUrl(path) {
    try {
      const dataUrl = await invoke('read_image_data_url', { path });
      return { ok: true, dataUrl };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },
  async selectFolder() {
    const folder = await invoke('pick_folder');
    if (folder == null || folder === '') return { paths: [] };
    const paths = await invoke('list_images_in_folder', { folder });
    return { folder, paths };
  },
  onFolderShortcut(cb) {
    _ev.folder.push(cb);
  },
  onImageZoom(cb) {
    _ev.zoom.push(cb);
  },
  onImageViewReset(cb) {
    _ev.reset.push(cb);
  },
};
