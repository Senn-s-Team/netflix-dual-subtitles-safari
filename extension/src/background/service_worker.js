/**
 * [INPUT]: 依赖 browser/chrome storage API 与 host_permissions 的跨域 fetch 能力
 * [OUTPUT]: 对外提供扩展安装默认配置初始化与字幕文本下载兜底
 * [POS]: background 的生命周期入口，被 Safari/Chromium 扩展运行时消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const runtime = globalThis.browser ?? globalThis.chrome;

const DEFAULT_SETTINGS = {
  enabled: true,
  secondaryLanguage: "en",
  fontSize: 28,
  verticalOffset: 18,
  timingOffsetMs: 0
};

runtime.runtime.onInstalled.addListener(() => {
  runtime.storage.local.get(DEFAULT_SETTINGS, (stored) => {
    runtime.storage.local.set({ ...DEFAULT_SETTINGS, ...stored });
  });
});

runtime.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "NETFLIX_DUAL_SUBTITLES_FETCH_SUBTITLE") return false;

  void fetchSubtitle(message.url)
    .then((result) => sendResponse(result))
    .catch((error) => {
      sendResponse({
        ok: false,
        status: 0,
        error: error?.message ?? String(error)
      });
    });

  return true;
});

async function fetchSubtitle(url) {
  const response = await fetch(normalizeUrl(url), {
    credentials: "omit",
    cache: "force-cache",
    redirect: "follow"
  });
  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    contentType: response.headers.get("content-type") ?? "",
    text
  };
}

function normalizeUrl(url) {
  return String(url ?? "")
    .trim()
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
}
