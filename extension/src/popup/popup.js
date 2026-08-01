/**
 * [INPUT]: 依赖 browser/chrome storage/tabs API 与 popup.html 表单控件
 * [OUTPUT]: 对外提供双字幕轨道选择、显示设置读写与当前页面轨道列表展示
 * [POS]: popup 的交互层，被 Safari 弹窗文档加载
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const runtime = globalThis.browser ?? globalThis.chrome;

const DEFAULT_SETTINGS = {
  enabled: true,
  hideNativeSubtitles: true,
  primaryTrackKey: "",
  primaryLanguage: "",
  secondaryTrackKey: "",
  secondaryLanguage: "en",
  primaryFontSize: 26,
  secondaryFontSize: 28,
  primaryVerticalOffset: 26,
  secondaryVerticalOffset: 18,
  timingOffsetMs: 0
};

const controls = {
  enabled: document.querySelector("#enabled"),
  hideNativeSubtitles: document.querySelector("#hideNativeSubtitles"),
  primaryTrackKey: document.querySelector("#primaryTrackKey"),
  secondaryTrackKey: document.querySelector("#secondaryTrackKey"),
  primaryFontSize: document.querySelector("#primaryFontSize"),
  secondaryFontSize: document.querySelector("#secondaryFontSize"),
  primaryVerticalOffset: document.querySelector("#primaryVerticalOffset"),
  secondaryVerticalOffset: document.querySelector("#secondaryVerticalOffset"),
  timingOffsetMs: document.querySelector("#timingOffsetMs")
};

const trackStatus = document.querySelector("#trackStatus");
let currentTracks = [];

init();

async function init() {
  const [settings, pageState] = await Promise.all([readSettings(), readPageState()]);
  currentTracks = pageState?.tracks ?? [];

  populateTrackSelects(settings);
  writeControls(settings);
  writeTrackStatus(pageState);
  bindControls();
  pollTracksWhenEmpty();
}

function bindControls() {
  for (const [key, control] of Object.entries(controls)) {
    control.addEventListener("input", () => {
      runtime.storage.local.set(readUpdate(key, control));
    });
  }
}

function populateTrackSelects(settings) {
  populateTrackSelect(controls.primaryTrackKey, "不显示", settings.primaryTrackKey, settings.primaryLanguage);
  populateTrackSelect(controls.secondaryTrackKey, "不显示", settings.secondaryTrackKey, settings.secondaryLanguage);
}

function populateTrackSelect(select, emptyLabel, selectedKey, language) {
  const selectedValue = findSelectedTrack(selectedKey, language)?.key ?? "";
  select.replaceChildren(createOption("", emptyLabel), ...currentTracks.map(trackToOption));
  select.value = selectedValue;
}

function writeControls(settings) {
  controls.enabled.checked = settings.enabled;
  controls.hideNativeSubtitles.checked = settings.hideNativeSubtitles;
  controls.primaryTrackKey.value = findSelectedTrack(settings.primaryTrackKey, settings.primaryLanguage)?.key ?? "";
  controls.secondaryTrackKey.value = findSelectedTrack(settings.secondaryTrackKey, settings.secondaryLanguage)?.key ?? "";
  controls.primaryFontSize.value = settings.primaryFontSize;
  controls.secondaryFontSize.value = settings.secondaryFontSize;
  controls.primaryVerticalOffset.value = settings.primaryVerticalOffset;
  controls.secondaryVerticalOffset.value = settings.secondaryVerticalOffset;
  controls.timingOffsetMs.value = settings.timingOffsetMs;
}

function writeTrackStatus(pageState) {
  if (!pageState) {
    trackStatus.value = "未连接当前页面";
    return;
  }

  const primary = pageState.loadStatus?.primary;
  const secondary = pageState.loadStatus?.secondary;
  const status = [];

  if (primary?.error) status.push(`第一错误: ${primary.error}`);
  else if (primary) status.push(`第一 ${primary.cueCount} 条`);

  if (secondary?.error) status.push(`第二错误: ${secondary.error}`);
  else if (secondary) status.push(`第二 ${secondary.cueCount} 条`);

  trackStatus.value = status.length > 0
    ? `${currentTracks.length} 条可用 / ${status.join(" / ")}`
    : currentTracks.length > 0 ? `${currentTracks.length} 条可用` : "播放后自动出现";
}

function pollTracksWhenEmpty(attempt = 0) {
  if (currentTracks.length > 0 || attempt >= 5) return;

  setTimeout(async () => {
    const [settings, pageState] = await Promise.all([readSettings(), readPageState()]);
    currentTracks = pageState?.tracks ?? [];
    populateTrackSelects(settings);
    writeControls(settings);
    writeTrackStatus(pageState);
    pollTracksWhenEmpty(attempt + 1);
  }, 1200);
}

function readUpdate(key, control) {
  if (key === "enabled" || key === "hideNativeSubtitles") return { [key]: control.checked };

  if (key === "primaryTrackKey" || key === "secondaryTrackKey") {
    const prefix = key === "primaryTrackKey" ? "primary" : "secondary";
    const track = currentTracks.find((item) => item.key === control.value);
    return {
      [key]: control.value,
      [`${prefix}Language`]: track?.language ?? ""
    };
  }

  return { [key]: Number(control.value) };
}

function trackToOption(track) {
  return createOption(track.key, `${track.label} (${track.language})`);
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function findSelectedTrack(trackKey, language) {
  if (trackKey) {
    const selected = currentTracks.find((track) => track.key === trackKey);
    if (selected) return selected;
  }

  const needle = String(language ?? "").toLowerCase();
  if (!needle) return null;

  return currentTracks.find((track) => track.language.toLowerCase() === needle)
    ?? currentTracks.find((track) => track.language.toLowerCase().startsWith(needle))
    ?? null;
}

function readSettings() {
  return new Promise((resolve) => {
    runtime.storage.local.get(DEFAULT_SETTINGS, (stored) => {
      resolve(normalizeSettings(stored));
    });
  });
}

function normalizeSettings(stored) {
  const settings = { ...DEFAULT_SETTINGS, ...stored };

  if (stored.fontSize !== undefined && stored.secondaryFontSize === undefined) {
    settings.secondaryFontSize = stored.fontSize;
  }

  if (stored.verticalOffset !== undefined && stored.secondaryVerticalOffset === undefined) {
    settings.secondaryVerticalOffset = stored.verticalOffset;
  }

  return settings;
}

function readPageState() {
  return new Promise((resolve) => {
    runtime.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab?.id) {
        resolve(null);
        return;
      }

      runtime.tabs.sendMessage(tab.id, { type: "NETFLIX_DUAL_SUBTITLES_GET_STATE" }, (response) => {
        if (runtime.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(response ?? null);
      });
    });
  });
}
