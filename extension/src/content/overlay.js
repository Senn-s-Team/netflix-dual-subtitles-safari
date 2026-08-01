/**
 * [INPUT]: 依赖 DOM/Shadow DOM 渲染能力与 subtitleParser 输出的 cue 数组
 * [OUTPUT]: 对 window.NetflixDualSubtitles 提供 createSubtitleOverlay 工厂，负责双字幕视觉层
 * [POS]: content 的显示层，被 content.js 按播放时间驱动
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

window.NetflixDualSubtitles ??= {};
window.NetflixDualSubtitles.createSubtitleOverlay = function createSubtitleOverlay() {
  const host = document.createElement("div");
  host.id = "netflix-dual-subtitles-host";
  Object.assign(host.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    pointerEvents: "none",
    contain: "layout style paint"
  });
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      :host {
        all: initial;
      }

      .subtitle {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        display: grid;
        gap: 4px;
        max-width: min(86vw, 1280px);
        pointer-events: none;
        text-align: center;
      }

      .subtitle[data-role="primary"] {
        bottom: var(--primary-subtitle-offset, 26vh);
      }

      .subtitle[data-role="secondary"] {
        bottom: var(--secondary-subtitle-offset, 18vh);
      }

      .line {
        width: fit-content;
        max-width: 100%;
        margin-inline: auto;
        padding: 3px 10px 5px;
        border-radius: 4px;
        background: rgba(0, 0, 0, 0.64);
        color: #fff;
        font: 700 var(--subtitle-size, 28px)/1.28 -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
        text-shadow: 0 2px 2px rgba(0, 0, 0, 0.8);
        white-space: pre-wrap;
      }

      .subtitle[data-role="primary"] .line {
        font-size: var(--primary-subtitle-size, 26px);
      }

      .subtitle[data-role="secondary"] .line {
        font-size: var(--secondary-subtitle-size, 28px);
      }
    </style>
    <div class="subtitle" data-role="primary" aria-live="off"></div>
    <div class="subtitle" data-role="secondary" aria-live="off"></div>
  `;

  const primaryContainer = root.querySelector('[data-role="primary"]');
  const secondaryContainer = root.querySelector('[data-role="secondary"]');

  return {
    applySettings(settings) {
      host.style.setProperty("--primary-subtitle-size", `${settings.primaryFontSize}px`);
      host.style.setProperty("--secondary-subtitle-size", `${settings.secondaryFontSize}px`);
      host.style.setProperty("--primary-subtitle-offset", `${settings.primaryVerticalOffset}vh`);
      host.style.setProperty("--secondary-subtitle-offset", `${settings.secondaryVerticalOffset}vh`);
    },

    render({ primaryCues = [], secondaryCues = [] } = {}) {
      ensureMounted(host);
      primaryContainer.replaceChildren(...primaryCues.map((cue) => createLine(cue.text)));
      secondaryContainer.replaceChildren(...secondaryCues.map((cue) => createLine(cue.text)));
    }
  };
};

function ensureMounted(host) {
  if (host.isConnected) return;
  document.documentElement.append(host);
}

function createLine(text) {
  const line = document.createElement("div");
  line.className = "line";
  line.textContent = text;
  return line;
}
