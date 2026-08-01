/**
 * [INPUT]: 依赖 window.NetflixDualSubtitles.parseSubtitle、background/page bridge 字幕下载与轨道解析能力
 * [OUTPUT]: 对 window.NetflixDualSubtitles 提供 createSubtitleStore 工厂，缓存 Track 对应 cue 时间轴
 * [POS]: content 的字幕数据层，被 content.js 按语言选择调用
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

window.NetflixDualSubtitles ??= {};
window.NetflixDualSubtitles.createSubtitleStore = function createSubtitleStore() {
  const runtime = globalThis.browser ?? globalThis.chrome;
  const cache = new Map();
  const pending = new Map();
  let nextRequestId = 1;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== "netflix-dual-subtitles-bridge") return;
    if (event.data?.type !== "load-subtitle-result" && event.data?.type !== "resolve-track-url-result") return;

    const request = pending.get(event.data.requestId);
    if (!request) return;

    pending.delete(event.data.requestId);

    if (!event.data.ok) {
      request.reject(new Error(event.data.error || `HTTP ${event.data.status}`));
      return;
    }

    request.resolve({
      text: event.data.text ?? "",
      contentType: event.data.contentType ?? "",
      url: event.data.url ?? ""
    });
  });

  return {
    async load(track) {
      if (cache.has(track.key)) return cache.get(track.key);

      const url = normalizeUrl(await resolveTrackUrlIfNeeded(track));
      const { text, contentType } = await loadSubtitle(url);
      const cues = window.NetflixDualSubtitles.parseSubtitle(text, contentType);
      if (cues.length === 0) throw new Error("Subtitle parsed 0 cues");
      cache.set(track.key, cues);
      return cues;
    },

    clear() {
      cache.clear();
      pending.clear();
    }
  };

  async function loadSubtitle(url) {
    const errors = [];

    try {
      return await loadViaBackground(url);
    } catch (error) {
      errors.push(`background: ${error?.message ?? String(error)}`);
    }

    try {
      return await loadViaPageBridge(url);
    } catch (error) {
      errors.push(`page: ${error?.message ?? String(error)}`);
    }

    throw new Error(errors.join(" / "));
  }

  function loadViaBackground(url) {
    return new Promise((resolve, reject) => {
      if (!runtime?.runtime?.sendMessage) {
        reject(new Error("runtime unavailable"));
        return;
      }

      runtime.runtime.sendMessage({
        type: "NETFLIX_DUAL_SUBTITLES_FETCH_SUBTITLE",
        url
      }, (response) => {
        const runtimeError = runtime.runtime.lastError;
        if (runtimeError) {
          reject(new Error(runtimeError.message));
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || `HTTP ${response?.status ?? 0}`));
          return;
        }

        resolve({
          text: response.text ?? "",
          contentType: response.contentType ?? ""
        });
      });
    });
  }

  function loadViaPageBridge(url) {
    const requestId = `subtitle-${nextRequestId++}`;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("Timed out loading subtitle"));
      }, 12000);

      pending.set(requestId, {
        resolve(value) {
          clearTimeout(timeoutId);
          resolve(value);
        },
        reject(error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      window.postMessage({
        source: "netflix-dual-subtitles-bridge",
        type: "load-subtitle",
        requestId,
        url: normalizeUrl(url)
      }, window.location.origin);
    });
  }

  async function resolveTrackUrlIfNeeded(track) {
    if (!track.needsResolution && !String(track.url ?? "").startsWith("netflix-track:")) {
      return track.url;
    }

    const { url } = await requestTrackUrl(track);
    if (!url) throw new Error("Subtitle URL was not resolved");
    track.url = url;
    track.needsResolution = false;
    return url;
  }

  function requestTrackUrl(track) {
    const requestId = `track-url-${nextRequestId++}`;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error("Timed out resolving subtitle URL"));
      }, 10000);

      pending.set(requestId, {
        resolve(value) {
          clearTimeout(timeoutId);
          resolve(value);
        },
        reject(error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      window.postMessage({
        source: "netflix-dual-subtitles-bridge",
        type: "resolve-track-url",
        requestId,
        key: track.key,
        trackId: track.trackId,
        language: track.language
      }, window.location.origin);
    });
  }

  function normalizeUrl(url) {
    return String(url ?? "")
      .trim()
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&");
  }
};
