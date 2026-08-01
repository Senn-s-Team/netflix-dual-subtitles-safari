/**
 * [INPUT]: 依赖 browser/chrome storage/tabs API 与 popup.html 的字幕、固定预览和当前角色样式控件
 * [OUTPUT]: 对外提供按剧集记忆的双字幕选择、统一角色编辑、自动布局、状态反馈与重新读取交互
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
  subtitleLayoutPreset: "balanced",
  primaryFontFamily: "system",
  secondaryFontFamily: "system",
  primaryFontWeight: 700,
  secondaryFontWeight: 700,
  primaryTextColor: "#FFFFFF",
  secondaryTextColor: "#FFFFFF",
  primaryTextOpacity: 100,
  secondaryTextOpacity: 100,
  primaryStrokeWidth: 1,
  secondaryStrokeWidth: 1,
  primaryStrokeColor: "#000000",
  secondaryStrokeColor: "#000000",
  primaryBackgroundColor: "#000000",
  secondaryBackgroundColor: "#000000",
  primaryBackgroundOpacity: 64,
  secondaryBackgroundOpacity: 64,
  primaryLineHeight: 1.28,
  secondaryLineHeight: 1.28,
  primaryMaxWidth: 86,
  secondaryMaxWidth: 86,
  timingOffsetMs: 0
};

const STYLE_ROLE_SUFFIXES = [
  "FontSize",
  "VerticalOffset",
  "FontFamily",
  "FontWeight",
  "TextColor",
  "TextOpacity",
  "StrokeWidth",
  "StrokeColor",
  "BackgroundColor",
  "BackgroundOpacity",
  "LineHeight",
  "MaxWidth"
];

const EPISODE_SETTINGS_STORAGE_KEY = "episodeSettingsById";
const EPISODE_SETTING_KEYS = new Set([
  "primaryTrackKey",
  "primaryLanguage",
  "secondaryTrackKey",
  "secondaryLanguage",
  "subtitleLayoutPreset",
  "timingOffsetMs",
  ...["primary", "secondary"].flatMap((role) => (
    STYLE_ROLE_SUFFIXES.map((suffix) => `${role}${suffix}`)
  ))
]);

const STYLE_DEFAULTS = {
  subtitleLayoutPreset: DEFAULT_SETTINGS.subtitleLayoutPreset
};

for (const role of ["primary", "secondary"]) {
  for (const suffix of STYLE_ROLE_SUFFIXES) {
    STYLE_DEFAULTS[`${role}${suffix}`] = DEFAULT_SETTINGS[`${role}${suffix}`];
  }
}

const LAYOUT_PREVIEW = {
  compact: { gap: 4 },
  balanced: { gap: 8 },
  spacious: { gap: 16 }
};

const PREVIEW_FONT_FAMILIES = {
  system: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
  sans: '"Avenir Next", Avenir, "Helvetica Neue", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  rounded: '"Arial Rounded MT Bold", "SF Pro Rounded", -apple-system, sans-serif'
};

const controls = {
  enabled: document.querySelector("#enabled"),
  hideNativeSubtitles: document.querySelector("#hideNativeSubtitles"),
  primaryTrackKey: document.querySelector("#primaryTrackKey"),
  secondaryTrackKey: document.querySelector("#secondaryTrackKey"),
  timingOffsetMs: document.querySelector("#timingOffsetMs")
};

const advancedControls = {
  FontSize: { element: document.querySelector("#styleFontSize"), numeric: true },
  VerticalOffset: { element: document.querySelector("#styleVerticalOffset"), numeric: true },
  FontFamily: { element: document.querySelector("#styleFontFamily"), numeric: false },
  FontWeight: { element: document.querySelector("#styleFontWeight"), numeric: true },
  TextColor: { element: document.querySelector("#styleTextColor"), numeric: false },
  TextOpacity: { element: document.querySelector("#styleTextOpacity"), numeric: true },
  StrokeWidth: { element: document.querySelector("#styleStrokeWidth"), numeric: true },
  StrokeColor: { element: document.querySelector("#styleStrokeColor"), numeric: false },
  BackgroundColor: { element: document.querySelector("#styleBackgroundColor"), numeric: false },
  BackgroundOpacity: { element: document.querySelector("#styleBackgroundOpacity"), numeric: true },
  LineHeight: { element: document.querySelector("#styleLineHeight"), numeric: true },
  MaxWidth: { element: document.querySelector("#styleMaxWidth"), numeric: true }
};

const elements = {
  pageStatus: document.querySelector("#pageStatus"),
  statusDot: document.querySelector("#statusDot"),
  primaryStatus: document.querySelector("#primaryStatus"),
  secondaryStatus: document.querySelector("#secondaryStatus"),
  trackGrid: document.querySelector("#trackGrid"),
  swapTracks: document.querySelector("#swapTracks"),
  reloadTracks: document.querySelector("#reloadTracks"),
  resetStyles: document.querySelector("#resetStyles"),
  styleFontSizeValue: document.querySelector("#styleFontSizeValue"),
  styleVerticalOffsetValue: document.querySelector("#styleVerticalOffsetValue"),
  styleTextColorValue: document.querySelector("#styleTextColorValue"),
  styleTextOpacityValue: document.querySelector("#styleTextOpacityValue"),
  styleStrokeWidthValue: document.querySelector("#styleStrokeWidthValue"),
  styleStrokeColorValue: document.querySelector("#styleStrokeColorValue"),
  styleBackgroundColorValue: document.querySelector("#styleBackgroundColorValue"),
  styleBackgroundOpacityValue: document.querySelector("#styleBackgroundOpacityValue"),
  styleLineHeightValue: document.querySelector("#styleLineHeightValue"),
  styleMaxWidthValue: document.querySelector("#styleMaxWidthValue"),
  stylePreview: document.querySelector("#stylePreview"),
  primaryPreview: document.querySelector("#primaryPreview"),
  secondaryPreview: document.querySelector("#secondaryPreview")
};

let currentSettings = { ...DEFAULT_SETTINGS };
let currentPageState = null;
let currentTracks = [];
let currentTrackSignature = "";
let activeStyleRole = "primary";
let pollTimer = 0;
let currentWatchId = "";
let episodeWriteChain = Promise.resolve();

void init();

async function init() {
  const [stored, pageState] = await Promise.all([readStoredSettings(), readPageState()]);
  currentWatchId = readWatchId(pageState);
  currentSettings = pageState?.settings
    ? normalizeSettings(pageState.settings)
    : settingsForWatch(stored, currentWatchId);
  applyPageState(pageState, true);
  writeControls();
  bindControls();
  scheduleStatePoll();
}

function bindControls() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => selectTab(button.dataset.tab));
  });

  document.querySelectorAll("[data-layout-preset]").forEach((button) => {
    button.addEventListener("click", () => void selectLayoutPreset(button.dataset.layoutPreset));
  });

  document.querySelectorAll("[data-style-role]").forEach((button) => {
    button.addEventListener("click", () => selectStyleRole(button.dataset.styleRole));
  });

  for (const [key, control] of Object.entries(controls)) {
    control.addEventListener("input", () => {
      const update = readUpdate(key, control);
      Object.assign(currentSettings, update);
      void writeSettings(update);

      if (key === "primaryTrackKey" || key === "secondaryTrackKey") {
        markTrackLoading(key.startsWith("primary") ? "primary" : "secondary");
        scheduleStatePoll(0);
      }
    });
  }

  for (const [suffix, config] of Object.entries(advancedControls)) {
    config.element.addEventListener("input", () => {
      const key = `${activeStyleRole}${suffix}`;
      const value = config.numeric ? Number(config.element.value) : config.element.value;
      currentSettings[key] = value;
      void writeSettings({ [key]: value });
      writeAdvancedValues();
      writePreview();
    });
  }

  elements.swapTracks.addEventListener("click", () => void swapTracks());
  elements.reloadTracks.addEventListener("click", () => void reloadTracks());
  elements.resetStyles.addEventListener("click", () => void resetStyles());
}

function selectTab(tabName) {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    const active = button.dataset.tab === tabName;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabName;
  });
}

async function selectLayoutPreset(preset) {
  if (!Object.hasOwn(LAYOUT_PREVIEW, preset) && preset !== "free") return;

  currentSettings.subtitleLayoutPreset = preset;
  writeLayoutPreset();
  writePreview();
  await writeSettings({ subtitleLayoutPreset: preset });
}

function selectStyleRole(role) {
  if (role !== "primary" && role !== "secondary") return;
  activeStyleRole = role;

  document.querySelectorAll("[data-style-role]").forEach((button) => {
    const active = button.dataset.styleRole === role;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  writeAdvancedControls();
}

async function swapTracks() {
  const update = {
    primaryTrackKey: currentSettings.secondaryTrackKey,
    primaryLanguage: currentSettings.secondaryLanguage,
    secondaryTrackKey: currentSettings.primaryTrackKey,
    secondaryLanguage: currentSettings.primaryLanguage
  };

  for (const suffix of STYLE_ROLE_SUFFIXES) {
    update[`primary${suffix}`] = currentSettings[`secondary${suffix}`];
    update[`secondary${suffix}`] = currentSettings[`primary${suffix}`];
  }

  Object.assign(currentSettings, update);
  writeControls();
  markTrackLoading("primary");
  markTrackLoading("secondary");
  await writeSettings(update);
  scheduleStatePoll(0);
}

async function reloadTracks() {
  if (!isWatchPage(currentPageState)) return;

  clearTimeout(pollTimer);
  elements.reloadTracks.disabled = true;
  elements.reloadTracks.classList.add("is-busy");
  writePageStatus("正在重新读取字幕", "loading");
  writeRoleStatus("primary", "等待字幕轨道", "loading");
  writeRoleStatus("secondary", "等待字幕轨道", "loading");

  await sendMessageToActiveTab({ type: "NETFLIX_DUAL_SUBTITLES_RELOAD" });
  scheduleStatePoll(0);
}

async function resetStyles() {
  Object.assign(currentSettings, STYLE_DEFAULTS);
  writeControls();
  await writeSettings(STYLE_DEFAULTS);
}

function applyPageState(pageState, forceTrackUpdate = false) {
  const nextWatchId = readWatchId(pageState);
  const watchChanged = nextWatchId !== currentWatchId;

  if (watchChanged) {
    currentWatchId = nextWatchId;
    if (pageState?.settings) currentSettings = normalizeSettings(pageState.settings);
    forceTrackUpdate = true;
  }

  currentPageState = pageState;
  currentTracks = pageState?.tracks ?? [];

  const signature = currentTracks.map((track) => track.key).join("\n");
  if (forceTrackUpdate || signature !== currentTrackSignature) {
    currentTrackSignature = signature;
    populateTrackSelects();
  }

  if (watchChanged) writeControls();
  writeStatus();
  writeAvailability();
}

function populateTrackSelects() {
  populateTrackSelect(controls.primaryTrackKey, "不显示", currentSettings.primaryTrackKey, currentSettings.primaryLanguage);
  populateTrackSelect(controls.secondaryTrackKey, "不显示", currentSettings.secondaryTrackKey, currentSettings.secondaryLanguage);
}

function populateTrackSelect(select, emptyLabel, selectedKey, language) {
  const selectedValue = findSelectedTrack(selectedKey, language)?.key ?? "";
  select.replaceChildren(createOption("", emptyLabel), ...currentTracks.map(trackToOption));
  select.value = selectedValue;
}

function writeControls() {
  controls.enabled.checked = currentSettings.enabled;
  controls.hideNativeSubtitles.checked = currentSettings.hideNativeSubtitles;
  controls.primaryTrackKey.value = findSelectedTrack(currentSettings.primaryTrackKey, currentSettings.primaryLanguage)?.key ?? "";
  controls.secondaryTrackKey.value = findSelectedTrack(currentSettings.secondaryTrackKey, currentSettings.secondaryLanguage)?.key ?? "";
  controls.timingOffsetMs.value = currentSettings.timingOffsetMs;
  writeLayoutPreset();
  writeAdvancedControls();
}

function writeLayoutPreset() {
  const preset = currentSettings.subtitleLayoutPreset;
  document.querySelectorAll("[data-layout-preset]").forEach((button) => {
    const active = button.dataset.layoutPreset === preset;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const usesFreePosition = preset === "free";
  advancedControls.VerticalOffset.element.disabled = !usesFreePosition;
}

function writeAdvancedControls() {
  for (const [suffix, config] of Object.entries(advancedControls)) {
    config.element.value = currentSettings[`${activeStyleRole}${suffix}`];
  }

  elements.primaryPreview.classList.toggle("is-editing", activeStyleRole === "primary");
  elements.secondaryPreview.classList.toggle("is-editing", activeStyleRole === "secondary");
  writeAdvancedValues();
  writePreview();
}

function writeAdvancedValues() {
  writeRangeValue(advancedControls.FontSize.element, elements.styleFontSizeValue, (value) => `${value} px`);
  writeRangeValue(advancedControls.VerticalOffset.element, elements.styleVerticalOffsetValue, (value) => `${value}%`);
  elements.styleTextColorValue.value = advancedControls.TextColor.element.value.toUpperCase();
  elements.styleStrokeColorValue.value = advancedControls.StrokeColor.element.value.toUpperCase();
  elements.styleBackgroundColorValue.value = advancedControls.BackgroundColor.element.value.toUpperCase();
  writeRangeValue(advancedControls.TextOpacity.element, elements.styleTextOpacityValue, (value) => `${value}%`);
  writeRangeValue(advancedControls.StrokeWidth.element, elements.styleStrokeWidthValue, (value) => `${formatDecimal(value)} px`);
  writeRangeValue(advancedControls.BackgroundOpacity.element, elements.styleBackgroundOpacityValue, (value) => `${value}%`);
  writeRangeValue(advancedControls.LineHeight.element, elements.styleLineHeightValue, formatDecimal);
  writeRangeValue(advancedControls.MaxWidth.element, elements.styleMaxWidthValue, (value) => `${value}%`);
}

function writeRangeValue(control, output, formatter) {
  output.value = formatter(control.value);
  const progress = ((Number(control.value) - Number(control.min)) / (Number(control.max) - Number(control.min))) * 100;
  control.style.setProperty("--range-progress", `${progress}%`);
}

function writePreview() {
  const preset = currentSettings.subtitleLayoutPreset;
  elements.stylePreview.dataset.layout = preset;

  if (preset === "free") {
    elements.stylePreview.style.setProperty(
      "--preview-primary-bottom",
      `${previewBottom(currentSettings.primaryVerticalOffset)}px`
    );
    elements.stylePreview.style.setProperty(
      "--preview-secondary-bottom",
      `${previewBottom(currentSettings.secondaryVerticalOffset)}px`
    );
  } else {
    elements.stylePreview.style.setProperty("--preview-gap", `${LAYOUT_PREVIEW[preset]?.gap ?? 8}px`);
  }

  applyPreviewStyle(elements.primaryPreview, "primary");
  applyPreviewStyle(elements.secondaryPreview, "secondary");
}

function applyPreviewStyle(element, role) {
  const value = (suffix) => currentSettings[`${role}${suffix}`];
  const previewFontSize = 10 + (Number(value("FontSize")) - 18) * 0.18;
  const maxWidth = Math.round(330 * Number(value("MaxWidth")) / 100);

  element.style.fontFamily = PREVIEW_FONT_FAMILIES[value("FontFamily")] ?? PREVIEW_FONT_FAMILIES.system;
  element.style.fontSize = `${previewFontSize}px`;
  element.style.fontWeight = value("FontWeight");
  element.style.lineHeight = value("LineHeight");
  element.style.maxWidth = `${maxWidth}px`;
  element.style.color = colorWithOpacity(value("TextColor"), value("TextOpacity"));
  element.style.background = colorWithOpacity(value("BackgroundColor"), value("BackgroundOpacity"));
  element.style.webkitTextStroke = `${value("StrokeWidth")}px ${value("StrokeColor")}`;
}

function previewBottom(offset) {
  return 12 + ((Number(offset) - 8) / 34) * 76;
}

function formatDecimal(value) {
  return String(Number(Number(value).toFixed(2)));
}

function colorWithOpacity(color, opacity) {
  const normalized = String(color ?? "#000000").replace(/^#/, "");
  const hex = normalized.length === 3
    ? normalized.split("").map((value) => value + value).join("")
    : normalized.padEnd(6, "0").slice(0, 6);
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const alpha = Math.max(0, Math.min(100, Number(opacity ?? 100))) / 100;

  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

function writeStatus() {
  if (!currentPageState) {
    writePageStatus("未连接 Netflix 页面", "error");
    writeRoleStatus("primary", "等待 Netflix 页面", "idle");
    writeRoleStatus("secondary", "等待 Netflix 页面", "idle");
    return;
  }

  if (!isWatchPage(currentPageState)) {
    writePageStatus("打开影片后可选择字幕", "idle");
    writeRoleStatus("primary", "等待播放", "idle");
    writeRoleStatus("secondary", "等待播放", "idle");
    return;
  }

  const primary = currentPageState.loadStatus?.primary;
  const secondary = currentPageState.loadStatus?.secondary;
  const hasError = Boolean(primary?.error || secondary?.error);

  if (currentTracks.length === 0) writePageStatus("正在读取字幕", "loading");
  else if (hasError) writePageStatus(`已识别 ${currentTracks.length} 条，部分加载失败`, "error");
  else writePageStatus(`已识别 ${currentTracks.length} 条字幕`, "ready");

  writeLoadStatus("primary", primary, currentSettings.primaryTrackKey || currentSettings.primaryLanguage);
  writeLoadStatus("secondary", secondary, currentSettings.secondaryTrackKey || currentSettings.secondaryLanguage);
}

function writePageStatus(message, state) {
  elements.pageStatus.textContent = message;
  elements.statusDot.dataset.state = state;
}

function writeLoadStatus(role, loadStatus, hasSelection) {
  if (!hasSelection) {
    writeRoleStatus(role, "未选择", "idle");
    return;
  }

  if (loadStatus?.error) {
    writeRoleStatus(role, friendlyError(loadStatus.error), "error");
    return;
  }

  if (loadStatus?.cueCount > 0) {
    writeRoleStatus(role, `已加载 ${loadStatus.cueCount} 条`, "ready");
    return;
  }

  writeRoleStatus(role, currentTracks.length > 0 ? "正在加载" : "等待字幕轨道", "loading");
}

function writeRoleStatus(role, message, state) {
  const element = role === "primary" ? elements.primaryStatus : elements.secondaryStatus;
  element.textContent = message;
  element.dataset.state = state;
}

function markTrackLoading(role) {
  writeRoleStatus(role, "正在加载", "loading");
}

function writeAvailability() {
  const onWatchPage = isWatchPage(currentPageState);
  const tracksReady = onWatchPage && currentTracks.length > 0;
  controls.primaryTrackKey.disabled = !tracksReady;
  controls.secondaryTrackKey.disabled = !tracksReady;
  elements.swapTracks.disabled = !tracksReady;
  elements.reloadTracks.disabled = !onWatchPage;
  elements.reloadTracks.classList.remove("is-busy");
  elements.trackGrid.setAttribute("aria-disabled", String(!tracksReady));
}

function scheduleStatePoll(attempt = 0) {
  clearTimeout(pollTimer);
  if (attempt >= 10 || (currentPageState && !isWatchPage(currentPageState))) return;

  pollTimer = setTimeout(async () => {
    const pageState = await readPageState();
    applyPageState(pageState);

    if (shouldKeepPolling(pageState)) scheduleStatePoll(attempt + 1);
  }, attempt === 0 ? 350 : 900);
}

function shouldKeepPolling(pageState) {
  if (!isWatchPage(pageState)) return false;
  if ((pageState?.tracks?.length ?? 0) === 0) return true;

  return ["primary", "secondary"].some((role) => {
    const selected = currentSettings[`${role}TrackKey`] || currentSettings[`${role}Language`];
    const status = pageState?.loadStatus?.[role];
    return selected && !status?.error && !status?.cueCount;
  });
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
  const language = track.language ? ` · ${track.language}` : "";
  return createOption(track.key, `${track.label}${language}`);
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

function friendlyError(error) {
  const message = String(error ?? "").toLowerCase();
  if (message.includes("0 cues")) return "轨道没有文本字幕";
  if (message.includes("load failed") || message.includes("fetch")) return "字幕下载失败";
  if (message.includes("timeout")) return "字幕读取超时";
  return "字幕加载失败";
}

function isWatchPage(pageState) {
  return Boolean(readWatchId(pageState));
}

function readWatchId(pageState) {
  if (pageState?.watchId) return String(pageState.watchId);

  try {
    return new URL(pageState?.url ?? "").pathname.match(/^\/watch\/([^/?#]+)/)?.[1] ?? "";
  } catch {
    return "";
  }
}

function readStoredSettings() {
  return new Promise((resolve) => {
    runtime.storage.local.get({
      ...DEFAULT_SETTINGS,
      [EPISODE_SETTINGS_STORAGE_KEY]: {}
    }, resolve);
  });
}

function writeSettings(update) {
  const globalUpdate = {};
  const episodeUpdate = {};

  for (const [key, value] of Object.entries(update)) {
    const destination = currentWatchId && EPISODE_SETTING_KEYS.has(key)
      ? episodeUpdate
      : globalUpdate;
    destination[key] = value;
  }

  const writes = [];
  if (Object.keys(globalUpdate).length > 0) writes.push(writeStorage(globalUpdate));

  if (Object.keys(episodeUpdate).length > 0) {
    const watchId = currentWatchId;
    const queuedUpdate = { ...episodeUpdate };
    episodeWriteChain = episodeWriteChain.then(() => writeEpisodeSettings(watchId, queuedUpdate));
    writes.push(episodeWriteChain);
  }

  return Promise.all(writes);
}

function writeEpisodeSettings(watchId, update) {
  return new Promise((resolve) => {
    runtime.storage.local.get({ [EPISODE_SETTINGS_STORAGE_KEY]: {} }, (stored) => {
      const settingsById = stored[EPISODE_SETTINGS_STORAGE_KEY] ?? {};
      const nextSettingsById = {
        ...settingsById,
        [watchId]: {
          ...(settingsById[watchId] ?? {}),
          ...update
        }
      };

      runtime.storage.local.set({ [EPISODE_SETTINGS_STORAGE_KEY]: nextSettingsById }, resolve);
    });
  });
}

function writeStorage(update) {
  return new Promise((resolve) => runtime.storage.local.set(update, resolve));
}

function settingsForWatch(stored, watchId) {
  const settingsById = stored[EPISODE_SETTINGS_STORAGE_KEY] ?? {};
  const storedSettings = { ...stored };
  delete storedSettings[EPISODE_SETTINGS_STORAGE_KEY];
  const settings = normalizeSettings(storedSettings);
  const episodeSettings = settingsById[watchId];

  if (watchId && episodeSettings) {
    for (const key of EPISODE_SETTING_KEYS) {
      if (Object.hasOwn(episodeSettings, key)) settings[key] = episodeSettings[key];
    }
  }

  return settings;
}

function normalizeSettings(stored) {
  const settings = { ...DEFAULT_SETTINGS, ...stored };

  if (stored.fontSize !== undefined && stored.secondaryFontSize === undefined) {
    settings.secondaryFontSize = stored.fontSize;
  }

  if (stored.verticalOffset !== undefined && stored.secondaryVerticalOffset === undefined) {
    settings.secondaryVerticalOffset = stored.verticalOffset;
  }

  if (!Object.hasOwn(LAYOUT_PREVIEW, settings.subtitleLayoutPreset) && settings.subtitleLayoutPreset !== "free") {
    settings.subtitleLayoutPreset = DEFAULT_SETTINGS.subtitleLayoutPreset;
  }

  return settings;
}

function readPageState() {
  return sendMessageToActiveTab({ type: "NETFLIX_DUAL_SUBTITLES_GET_STATE" });
}

function sendMessageToActiveTab(message) {
  return new Promise((resolve) => {
    runtime.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs?.[0];
      if (!tab?.id) {
        resolve(null);
        return;
      }

      runtime.tabs.sendMessage(tab.id, message, (response) => {
        if (runtime.runtime.lastError) {
          resolve(null);
          return;
        }

        resolve(response ?? null);
      });
    });
  });
}
