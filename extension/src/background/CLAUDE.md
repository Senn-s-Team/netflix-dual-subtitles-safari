# background/
> L2 | 父级: ../CLAUDE.md

成员清单
service_worker.js: 初始化全局默认配置与按剧集设置容器，提供字幕下载兜底

设计边界:
后台脚本保持无业务状态，页面级数据由 content script 自己管理。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
