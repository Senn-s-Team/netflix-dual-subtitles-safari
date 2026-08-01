# extension/
> L2 | 父级: ../CLAUDE.md

成员清单
icons/: 扩展图标资源，供 manifest 与 Safari converter 生成 App 图标
manifest.json: WebExtension 清单，声明 Netflix host 权限、content script、popup、page bridge 可访问资源
src/: 扩展运行时代码，按浏览器上下文拆成 background/content/page/popup

设计边界:
`manifest.json` 只描述能力和加载点；业务逻辑全部放入 `src/`，便于 Safari converter 直接消费。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
