# page/
> L2 | 父级: ../CLAUDE.md

成员清单
netflix-page-bridge.js: 注入 Netflix 主世界，观察 timed text 请求并通过 window message 传回 content

设计边界:
页面桥只传递可序列化事实，不保存扩展配置，也不直接渲染 UI。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

