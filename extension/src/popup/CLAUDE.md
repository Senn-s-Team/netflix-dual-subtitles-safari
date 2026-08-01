# popup/
> L2 | 父级: ../CLAUDE.md

成员清单
popup.html: 扩展弹窗结构，提供启用、第一/第二字幕轨道、字号、位置、延时控制
popup.css: 弹窗视觉样式，保持 Safari 原生感与双列紧凑设置密度
popup.js: 弹窗交互逻辑，读取当前页面轨道列表、读写 storage.local 并即时同步 content

设计边界:
popup 只管理配置，所有 Netflix 页面状态留在 content/page。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
