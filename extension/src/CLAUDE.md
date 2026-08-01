# src/
> L2 | 父级: ../CLAUDE.md

成员清单
background/: 扩展后台上下文，负责安装默认设置与消息保底
content/: Netflix 页面隔离上下文，负责字幕状态、加载、解析、渲染
page/: Netflix 页面主世界桥接，负责观察私有播放器请求与元数据
popup/: 扩展弹窗，负责用户设置读写与即时下发

设计边界:
page 只采集 Netflix 页面事实；content 只维护扩展事实；popup 只写配置；background 只做生命周期。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

