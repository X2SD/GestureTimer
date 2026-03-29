import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

const STORAGE_TOTAL_HOURS = 'sketchTotalHours';
const STORAGE_ALLOW_REPEAT = 'sketchAllowRepeat'; // 新增：允许重复抽取存储
/** 窗口置顶偏好；缺省视为 true（与此前默认置顶一致） */
const STORAGE_ALWAYS_ON_TOP = 'gestureAlwaysOnTop';

const photo = document.getElementById('photo');
const photoViewport = document.getElementById('photo-viewport');
const photoTransform = document.getElementById('photo-transform');
const appEl = document.getElementById('app');
const emptyEl = document.getElementById('empty');
const timerEl = document.getElementById('timer');
const totalPlaybackEl = document.getElementById('total-playback');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const openFolderBtn = document.getElementById('open-folder');
const openSettingsBtn = document.getElementById('open-settings');
const emptyOpenBtn = document.getElementById('empty-open');
const presetTrigger = document.getElementById('preset-trigger');
const presetTriggerLabel = document.getElementById('preset-trigger-label');
const presetMenu = document.getElementById('preset-menu');
const presetBackdrop = document.getElementById('preset-backdrop');
const barEl = document.getElementById('bar');

const modalOverlay = document.getElementById('modal-overlay');
const panelSettings = document.getElementById('panel-settings');
const panelSessionEnd = document.getElementById('panel-session-end');
const panelImagesExhausted = document.getElementById('panel-images-exhausted');
const totalHoursInput = document.getElementById('total-hours-input');
const allowRepeatToggle = document.getElementById('allow-repeat-toggle'); // 重复开关
const noRemindThisRound = document.getElementById('no-remind-this-round');
const modalCancel = document.getElementById('modal-cancel');
const modalSave = document.getElementById('modal-save');
const sessionEndOk = document.getElementById('session-end-ok');
const exhaustedCancel = document.getElementById('exhausted-cancel');
const exhaustedContinue = document.getElementById('exhausted-continue');
const openAboutBtn = document.getElementById('open-about');
const panelAbout = document.getElementById('panel-about');
const alwaysOnTopIndicator = document.getElementById('always-on-top-indicator');

let imagePaths = [];
let currentIndex = 0; // 当前显示的图片索引
let historyIndexes = []; // 历史记录：存储跳过的图片索引（核心修复）
let timerId = null;
let timerState = 'idle'; // idle | running | paused
let selectedPresetSec = 30;
let remainingSec = 0;
let idleShowsZero = false;
let totalPlaybackSec = 0;
let sessionEnded = false;

// 重复抽取相关状态
let allowRepeatMode = true; // 勾选=允许重复（默认勾选）
let usedImageIndexes = []; // 未勾选时：已抽取的图片索引
let noRemindExhausted = false; // 本轮不再提醒

let imageZoom = 1;
let panX = 0;
let panY = 0;
let panning = false;
let lastPanClientX = 0;
let lastPanClientY = 0;

const ZOOM_MIN = 0.05;
const ZOOM_MAX = 16;
const MENU_ZOOM_STEP = 1.15;
const WHEEL_ZOOM_FACTOR = 1.09;

function syncAlwaysOnTopIndicator(on) {
  if (!alwaysOnTopIndicator) return;
  alwaysOnTopIndicator.classList.toggle('hidden', !on);
  alwaysOnTopIndicator.setAttribute('aria-hidden', on ? 'false' : 'true');
}

async function applyAlwaysOnTopFromStorage() {
  const want = localStorage.getItem(STORAGE_ALWAYS_ON_TOP) !== 'false';
  try {
    const win = getCurrentWindow();
    await win.setAlwaysOnTop(want);
    syncAlwaysOnTopIndicator(await win.isAlwaysOnTop());
  } catch {
    syncAlwaysOnTopIndicator(false);
  }
}

// ========== 工具方法 ==========
function applyImageTransform() {
  if (!photoTransform) return;
  photoTransform.style.transform = `translate(${panX}px, ${panY}px) scale(${imageZoom})`;
}

function resetImageView() {
  imageZoom = 1;
  panX = 0;
  panY = 0;
  applyImageTransform();
}

function zoomFromMenu(direction) {
  if (direction > 0) {
    imageZoom = Math.min(ZOOM_MAX, imageZoom * MENU_ZOOM_STEP);
  } else {
    imageZoom = Math.max(ZOOM_MIN, imageZoom / MENU_ZOOM_STEP);
  }
  applyImageTransform();
}

function getTotalHours() {
  const raw = localStorage.getItem(STORAGE_TOTAL_HOURS);
  const n = parseFloat(raw);
  if (Number.isFinite(n) && n > 0) return Math.min(24, Math.max(0.25, n));
  return 1;
}

// 新增：获取允许重复抽取状态（默认勾选）
function getAllowRepeatMode() {
  const raw = localStorage.getItem(STORAGE_ALLOW_REPEAT);
  return raw === null ? true : raw === 'true';
}

function getTotalLimitSec() {
  return Math.floor(getTotalHours() * 3600);
}

function isPlaybackLimitReached() {
  return totalPlaybackSec >= getTotalLimitSec();
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function formatTotalPlayback(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
  }
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function mainDisplaySeconds() {
  if (timerState === 'running' || timerState === 'paused') {
    return remainingSec;
  }
  if (idleShowsZero) return 0;
  return selectedPresetSec;
}

function updateTimerDisplay() {
  timerEl.textContent = formatTime(mainDisplaySeconds());
}

function updateTotalPlaybackDisplay() {
  if (totalPlaybackEl) {
    totalPlaybackEl.textContent = formatTotalPlayback(totalPlaybackSec);
  }
}

function labelForPresetSec(sec) {
  const map = { 30: '1/2', 60: '1', 120: '2', 300: '5' };
  return map[sec] ?? formatTime(sec);
}

function syncPresetHighlight() {
  if (presetTriggerLabel) {
    presetTriggerLabel.textContent = labelForPresetSec(selectedPresetSec);
  }
  document.querySelectorAll('.preset-option').forEach((btn) => {
    const s = parseInt(btn.getAttribute('data-seconds'), 10);
    btn.classList.toggle('is-selected', s === selectedPresetSec);
  });
}

function closePresetMenu() {
  if (!presetMenu || !presetBackdrop || !presetTrigger) return;
  presetMenu.classList.add('hidden');
  presetBackdrop.classList.add('hidden');
  presetTrigger.setAttribute('aria-expanded', 'false');
}

function openPresetMenu() {
  if (!presetMenu || !presetBackdrop || !presetTrigger) return;
  presetMenu.classList.remove('hidden');
  presetBackdrop.classList.remove('hidden');
  presetTrigger.setAttribute('aria-expanded', 'true');
}

function togglePresetMenu() {
  if (!presetMenu) return;
  if (presetMenu.classList.contains('hidden')) openPresetMenu();
  else closePresetMenu();
}

function updateTransportButtons() {
  const running = timerState === 'running';
  const paused = timerState === 'paused';

  btnPlay.disabled = running || sessionEnded;
  btnPlay.classList.toggle('is-dim', btnPlay.disabled);

  btnPause.disabled = !running || sessionEnded;
  btnPause.classList.toggle('is-dim', btnPause.disabled);

  btnStop.disabled = (!running && !paused) || sessionEnded;
  btnStop.classList.toggle('is-dim', btnStop.disabled);

  syncBarPlayingLayout();
}

/** 播放中折叠底栏工具区，仅保留倒计时与翻页 */
function syncBarPlayingLayout() {
  if (!barEl) return;
  const playing = timerState === 'running';
  barEl.classList.toggle('is-playing', playing);
  document.documentElement.style.setProperty(
    '--bar-height',
    playing ? 'var(--bar-height-playing)' : 'var(--bar-height-idle)',
  );
  if (playing) closePresetMenu();
}

function stopInterval() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function onPlaybackLimitReached() {
  sessionEnded = true;
  stopInterval();
  timerState = 'idle';
  remainingSec = 0;
  idleShowsZero = true;
  updateTimerDisplay();
  updateTransportButtons();
  openSessionEndModal();
}

function tick() {
  if (sessionEnded) return;
  totalPlaybackSec += 1;
  updateTotalPlaybackDisplay();
  if (totalPlaybackSec >= getTotalLimitSec()) {
    onPlaybackLimitReached();
    return;
  }
  remainingSec -= 1;
  updateTimerDisplay();
  if (remainingSec <= 0) {
    stopInterval();
    remainingSec = 0;
    updateTimerDisplay();
    void goNextRandomAndContinue(); // 时间到跳下一张
  }
}

function startOrResumeFromPlay() {
  if (sessionEnded) {
    openSessionEndModal();
    return;
  }
  if (timerState === 'running') return;

  if (timerState === 'paused') {
    timerState = 'running';
    updateTransportButtons();
    timerId = setInterval(tick, 1000);
    updateTimerDisplay();
    return;
  }

  remainingSec = selectedPresetSec;
  timerState = 'running';
  idleShowsZero = false;
  updateTimerDisplay();
  updateTransportButtons();
  timerId = setInterval(tick, 1000);
}

function pauseFromButton() {
  if (timerState !== 'running') return;
  stopInterval();
  timerState = 'paused';
  updateTransportButtons();
  updateTimerDisplay();
}

function stopFromButton() {
  stopInterval();
  timerState = 'idle';
  remainingSec = 0;
  totalPlaybackSec = 0;
  idleShowsZero = true;
  updateTimerDisplay();
  updateTotalPlaybackDisplay();
  updateTransportButtons();
  // 重置所有状态
  historyIndexes = []; // 清空历史记录
  usedImageIndexes = [];
  noRemindExhausted = false;
}

// ========== 核心修复：上一张/下一张逻辑 ==========
/** 不允许重复时：获取未抽取的随机下标 */
function pickUnusedRandomIndex() {
  const unusedIndexes = imagePaths
    .map((_, i) => i)
    .filter(i => !usedImageIndexes.includes(i));

  if (unusedIndexes.length === 0) return -1; // 无可用图片
  const randomIdx = Math.floor(Math.random() * unusedIndexes.length);
  return unusedIndexes[randomIdx];
}

/** 允许重复时：获取与当前不同的随机下标 */
function pickRandomNextIndex() {
  if (imagePaths.length <= 1) return 0;
  let next;
  do {
    next = Math.floor(Math.random() * imagePaths.length);
  } while (next === currentIndex);
  return next;
}

/** 处理图片抽取完毕逻辑 */
async function handleImagesExhausted() {
  if (noRemindExhausted) {
    usedImageIndexes = [];
    await goNextRandomAndContinue();
    return;
  }
  openImagesExhaustedModal();
}

/** 换图后重新开始计时 */
function startTimerAfterLoad() {
  if (sessionEnded) return;
  if (totalPlaybackSec >= getTotalLimitSec()) {
    onPlaybackLimitReached();
    return;
  }
  remainingSec = selectedPresetSec;
  timerState = 'running';
  idleShowsZero = false;
  updateTimerDisplay();
  updateTransportButtons();
  timerId = setInterval(tick, 1000);
}

/** 时间到跳下一张（记录历史） */
async function goNextRandomAndContinue() {
  if (imagePaths.length === 0 || sessionEnded) return;

  // 核心：跳下一张前，把当前图片加入历史记录
  historyIndexes.push(currentIndex);
  if (historyIndexes.length > 50) historyIndexes.shift(); // 最多存50条

  let nextIndex;
  if (allowRepeatMode) {
    // 勾选重复：随机抽取（可能重复）
    nextIndex = pickRandomNextIndex();
  } else {
    // 未勾选重复：先抽完所有不重复的
    nextIndex = pickUnusedRandomIndex();
    if (nextIndex === -1) {
      await handleImagesExhausted();
      return;
    }
    usedImageIndexes.push(nextIndex);
  }

  currentIndex = nextIndex;
  const ok = await loadCurrentImage();
  if (!ok || sessionEnded) return;
  startTimerAfterLoad();
}

/** 修复：上一张逻辑（精准返回刚刚跳过的图） */
async function goPrev() {
  if (imagePaths.length === 0) return;
  const wasActive = timerState === 'running' || timerState === 'paused';
  stopInterval();
  timerState = 'idle';
  remainingSec = 0;
  idleShowsZero = false;

  // 核心：从历史记录取最后一张（刚刚跳过的图）
  if (historyIndexes.length > 0) {
    currentIndex = historyIndexes.pop(); // 取出最后一条历史
  } else {
    // 无历史时：回退索引（兼容逻辑）
    currentIndex = (currentIndex - 1 + imagePaths.length) % imagePaths.length;
  }

  const ok = await loadCurrentImage();
  if (!ok) {
    updateTimerDisplay();
    updateTransportButtons();
    return;
  }
  if (sessionEnded) return;
  if (wasActive) {
    startTimerAfterLoad();
  } else {
    updateTimerDisplay();
    updateTransportButtons();
  }
}

/** 手动点下一张（记录历史） */
async function goNext() {
  if (imagePaths.length === 0) return;
  const wasActive = timerState === 'running' || timerState === 'paused';
  stopInterval();
  timerState = 'idle';
  remainingSec = 0;
  idleShowsZero = false;

  // 手动跳下一张：记录当前图片到历史
  historyIndexes.push(currentIndex);
  if (historyIndexes.length > 50) historyIndexes.shift();

  let nextIndex;
  if (allowRepeatMode) {
    nextIndex = pickRandomNextIndex();
  } else {
    nextIndex = pickUnusedRandomIndex();
    if (nextIndex === -1) {
      await handleImagesExhausted();
      return;
    }
    usedImageIndexes.push(nextIndex);
  }

  currentIndex = nextIndex;
  const ok = await loadCurrentImage();
  if (!ok) {
    updateTimerDisplay();
    updateTransportButtons();
    return;
  }
  if (sessionEnded) return;
  if (wasActive) {
    startTimerAfterLoad();
  } else {
    updateTimerDisplay();
    updateTransportButtons();
  }
}

function setNavDisabled() {
  const single = imagePaths.length <= 1;
  prevBtn.disabled = single;
  nextBtn.disabled = single;
}

async function loadCurrentImage() {
  if (imagePaths.length === 0) return false;
  const p = imagePaths[currentIndex];
  resetImageView();

  const res = await window.api.readImageDataUrl(p);
  if (!res.ok) {
    timerEl.textContent = '读图失败';
    return false;
  }

  try {
    await new Promise((resolve, reject) => {
      photo.onload = () => resolve();
      photo.onerror = () => reject(new Error('img'));
      photo.src = res.dataUrl;
      setNavDisabled();
      if (photo.complete && photo.naturalWidth > 0) resolve();
    });
  } catch {
    timerEl.textContent = '无法显示';
    return false;
  }

  updateTimerDisplay();
  return true;
}

function showMain() {
  emptyEl.classList.add('hidden');
  appEl.classList.remove('hidden');
}

function showEmpty() {
  appEl.classList.add('hidden');
  emptyEl.classList.remove('hidden');
  stopInterval();
  timerState = 'idle';
  remainingSec = 0;
  idleShowsZero = false;
  totalPlaybackSec = 0;
  sessionEnded = false;
  // 重置所有状态
  historyIndexes = [];
  usedImageIndexes = [];
  noRemindExhausted = false;
  allowRepeatMode = getAllowRepeatMode();
  updateTimerDisplay();
  updateTotalPlaybackDisplay();
  updateTransportButtons();
}

// ========== 弹窗相关 ==========
function openSettingsModal() {
  closePresetMenu();
  // 加载总时长和重复开关状态
  totalHoursInput.value = String(getTotalHours());
  allowRepeatToggle.checked = getAllowRepeatMode();
  // 显示设置弹窗
  panelSessionEnd.classList.add('hidden');
  panelImagesExhausted.classList.add('hidden');
  if (panelAbout) panelAbout.classList.add('hidden');
  panelSettings.classList.remove('hidden');
  modalOverlay.classList.remove('hidden');
}

function openSessionEndModal() {
  panelSettings.classList.add('hidden');
  panelImagesExhausted.classList.add('hidden');
  if (panelAbout) panelAbout.classList.add('hidden');
  panelSessionEnd.classList.remove('hidden');
  modalOverlay.classList.remove('hidden');
}

function openImagesExhaustedModal() {
  panelSettings.classList.add('hidden');
  panelSessionEnd.classList.add('hidden');
  if (panelAbout) panelAbout.classList.add('hidden');
  panelImagesExhausted.classList.remove('hidden');
  modalOverlay.classList.remove('hidden');
  noRemindThisRound.checked = false;
}

function closeModalOverlay() {
  modalOverlay.classList.add('hidden');
  panelSettings.classList.add('hidden');
  panelSessionEnd.classList.add('hidden');
  panelImagesExhausted.classList.add('hidden');
  if (panelAbout) panelAbout.classList.add('hidden');
}

async function applyImageFolder(paths) {
  if (!paths || paths.length === 0) return false;
  imagePaths = paths;
  currentIndex = 0;
  sessionEnded = false;
  totalPlaybackSec = 0;
  historyIndexes = [];
  usedImageIndexes = [];
  noRemindExhausted = false;
  allowRepeatMode = getAllowRepeatMode();
  stopInterval();
  timerState = 'idle';
  remainingSec = 0;
  idleShowsZero = false;
  syncPresetHighlight();
  updateTimerDisplay();
  updateTotalPlaybackDisplay();
  updateTransportButtons();
  showMain();
  await loadCurrentImage();
  return true;
}

async function pickFolder() {
  closePresetMenu();
  const { paths } = await window.api.selectFolder();
  await applyImageFolder(paths);
}

/** 拖入文件夹或图片文件时：优先按文件夹加载；若为单文件则尝试其所在目录 */
async function tryLoadFromDropPaths(paths) {
  if (!paths || paths.length === 0) return;
  for (const p of paths) {
    try {
      const listed = await invoke('list_images_in_folder', { folder: p });
      if (listed && listed.length > 0) {
        await applyImageFolder(listed);
        return;
      }
    } catch {
      /* 不是文件夹或读取失败 */
    }
  }
  for (const p of paths) {
    const sep = p.includes('\\') ? '\\' : '/';
    const last = p.lastIndexOf(sep);
    if (last <= 0) continue;
    const dir = p.slice(0, last);
    try {
      const listed = await invoke('list_images_in_folder', { folder: dir });
      if (listed && listed.length > 0) {
        await applyImageFolder(listed);
        return;
      }
    } catch {
      /* ignore */
    }
  }
}

// ========== 事件监听 ==========
if (presetTrigger) {
  presetTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePresetMenu();
  });
}

if (presetBackdrop) {
  presetBackdrop.addEventListener('click', () => closePresetMenu());
}

document.querySelectorAll('.preset-option').forEach((btn) => {
  btn.addEventListener('click', () => {
    const sec = parseInt(btn.getAttribute('data-seconds'), 10);
    if (!Number.isFinite(sec) || sec <= 0) return;
    selectedPresetSec = sec;
    syncPresetHighlight();
    closePresetMenu();
    if (timerState === 'idle') {
      idleShowsZero = false;
      updateTimerDisplay();
    }
  });
});

if (barEl) {
  barEl.addEventListener(
    'click',
    (e) => {
      if (!presetMenu || presetMenu.classList.contains('hidden')) return;
      if (presetTrigger && presetTrigger.contains(e.target)) return;
      if (presetMenu.contains(e.target)) return;
      closePresetMenu();
    },
    true,
  );
}

btnPlay.addEventListener('click', startOrResumeFromPlay);
btnPause.addEventListener('click', pauseFromButton);
btnStop.addEventListener('click', stopFromButton);

prevBtn.addEventListener('click', () => void goPrev()); // 绑定修复后的上一张
nextBtn.addEventListener('click', () => void goNext()); // 绑定手动下一张
openFolderBtn.addEventListener('click', pickFolder);
openSettingsBtn.addEventListener('click', openSettingsModal);
emptyOpenBtn.addEventListener('click', pickFolder);

if (openAboutBtn && panelAbout) {
  openAboutBtn.addEventListener('click', () => {
    closePresetMenu();
    panelSettings.classList.add('hidden');
    panelSessionEnd.classList.add('hidden');
    panelImagesExhausted.classList.add('hidden');
    panelAbout.classList.remove('hidden');
    modalOverlay.classList.remove('hidden');
  });
}

// 设置弹窗 - 取消
modalCancel.addEventListener('click', closeModalOverlay);
// 设置弹窗 - 保存
modalSave.addEventListener('click', () => {
  // 保存总时长
  const v = parseFloat(totalHoursInput.value);
  if (Number.isFinite(v) && v > 0) {
    const clamped = Math.min(24, Math.max(0.25, v));
    localStorage.setItem(STORAGE_TOTAL_HOURS, String(clamped));
  }
  // 保存重复抽取开关
  allowRepeatMode = allowRepeatToggle.checked;
  localStorage.setItem(STORAGE_ALLOW_REPEAT, String(allowRepeatMode));
  
  closeModalOverlay();
  if (!sessionEnded && isPlaybackLimitReached()) {
    onPlaybackLimitReached();
  }
});

// 计时结束弹窗 - 确定
sessionEndOk.addEventListener('click', () => {
  sessionEnded = false;
  totalPlaybackSec = 0;
  updateTotalPlaybackDisplay();
  closeModalOverlay();
  updateTransportButtons();
});

// 图片抽完弹窗 - 取消
exhaustedCancel.addEventListener('click', () => {
  closeModalOverlay();
  timerState = 'idle';
  updateTransportButtons();
});

// 图片抽完弹窗 - 继续
exhaustedContinue.addEventListener('click', async () => {
  noRemindExhausted = noRemindThisRound.checked;
  usedImageIndexes = [];
  closeModalOverlay();
  await goNextRandomAndContinue();
});


modalOverlay.addEventListener('click', (e) => {
  if (e.target !== modalOverlay) return;
  if (!panelSessionEnd.classList.contains('hidden')) return;
  closeModalOverlay();
});

window.api.onFolderShortcut(() => {
  pickFolder();
});

window.api.onImageZoom((dir) => {
  zoomFromMenu(dir);
});

window.api.onImageViewReset(() => {
  resetImageView();
});

if (photoViewport) {
  photoViewport.addEventListener('wheel', (e) => {
    if (!modalOverlay.classList.contains('hidden')) return;
    if (appEl.classList.contains('hidden')) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1 / WHEEL_ZOOM_FACTOR : WHEEL_ZOOM_FACTOR;
    imageZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, imageZoom * factor));
    applyImageTransform();
  }, { passive: false });

  photoViewport.addEventListener('mousedown', (e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    panning = true;
    lastPanClientX = e.clientX;
    lastPanClientY = e.clientY;
    photoViewport.classList.add('is-panning');
  });

  photoViewport.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    resetImageView();
  });
}

window.addEventListener('mousemove', (e) => {
  if (!panning) return;
  panX += e.clientX - lastPanClientX;
  panY += e.clientY - lastPanClientY;
  lastPanClientX = e.clientX;
  lastPanClientY = e.clientY;
  applyImageTransform();
});

window.addEventListener('mouseup', (e) => {
  if (e.button !== 1) return;
  if (!panning) return;
  panning = false;
  if (photoViewport) photoViewport.classList.remove('is-panning');
});

window.addEventListener('blur', () => {
  if (!panning) return;
  panning = false;
  if (photoViewport) photoViewport.classList.remove('is-panning');
});

window.addEventListener('keydown', (e) => {
  if (presetMenu && !presetMenu.classList.contains('hidden') && e.key === 'Escape') {
    e.preventDefault();
    closePresetMenu();
    return;
  }
  if (!modalOverlay.classList.contains('hidden')) {
    if (e.key === 'Escape') {
      if (!panelSessionEnd.classList.contains('hidden')) return;
      closeModalOverlay();
    }
    return;
  }
  if (e.code === 'Space' || e.key === ' ') {
    if (appEl.classList.contains('hidden')) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    if (timerState === 'running') pauseFromButton();
    else startOrResumeFromPlay();
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') {
      e.preventDefault();
      zoomFromMenu(1);
      return;
    }
    if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      zoomFromMenu(-1);
      return;
    }
    if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
      e.preventDefault();
      resetImageView();
      return;
    }
  }
  if (e.key === 'ArrowLeft') void goPrev();
  if (e.key === 'ArrowRight') void goNext();
});

// 初始化
syncPresetHighlight();
allowRepeatMode = getAllowRepeatMode();
updateTotalPlaybackDisplay();
updateTransportButtons();
resetImageView();
showEmpty();

void (async () => {
  await applyAlwaysOnTopFromStorage();
  try {
    await listen('always-on-top-changed', (e) => {
      const next = Boolean(e.payload);
      localStorage.setItem(STORAGE_ALWAYS_ON_TOP, String(next));
      syncAlwaysOnTopIndicator(next);
    });
  } catch {
    /* 非 Tauri 环境 */
  }
  try {
    const win = getCurrentWindow();
    await win.onDragDropEvent((e) => {
      if (e.payload.type !== 'drop') return;
      void tryLoadFromDropPaths(e.payload.paths);
    });
  } catch {
    /* 非 Tauri 环境 */
  }
})();
