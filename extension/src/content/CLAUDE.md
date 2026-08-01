# content/
> L2 | 父级: ../CLAUDE.md

成员清单
content.js: 内容脚本入口，连接 page bridge、按剧集恢复设置、双轨加载、播放器同步与 popup 查询/重载
netflixAdapter.js: Netflix 字幕轨道归一化器，把私有响应折叠成稳定 Track
overlay.js: Shadow DOM 字幕层，负责自动上下布局、独立样式变量与视觉渲染
subtitleParser.js: TTML/DFXP/WebVTT/JSON 字幕解析器，输出统一 cue 时间轴
subtitleStore.js: 字幕轨道与 cue 缓存，负责按选择的轨道拉取字幕文本

设计边界:
Netflix 私有变化只进入 adapter；字幕格式变化只进入 parser；DOM 视觉变化只进入 overlay。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
