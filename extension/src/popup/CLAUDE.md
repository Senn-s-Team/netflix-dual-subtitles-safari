# popup/
> L2 | 父级: ../CLAUDE.md

成员清单
popup.html: 扩展弹窗结构，提供字幕选择，以及固定实时预览、当前角色与任务化样式分组
popup.css: 固定 420x600 的 Neumorphism 弹窗样式，样式页预览常驻、设置区独立滚动
popup.js: 弹窗交互逻辑，按 watch ID 读写设置并统一当前角色的尺寸、位置、文字与效果控制

设计边界:
popup 只管理配置，剧集配置存入 episodeSettingsById；所有 Netflix 页面事实留在 content/page。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
