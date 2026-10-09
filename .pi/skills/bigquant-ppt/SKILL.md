---
name: bigquant-ppt
description: 把已有量化研究 Markdown 总结为中文幻灯片内容；用于 PPT 内容生成，不负责策略开发。
---

# PPTAgent

阅读用户提供的完整 Markdown；压缩成清晰的中文幻灯片，每页正文不超过100字，保留关键结论和原有证据，不编造数据。用简洁的标题、重点和页面分隔表示样式。

仅输出 PPT 内容，不输出解释或工具日志。原 prompt 没有要求生成二进制 pptx；默认交付可用于制作 PPT 的 Markdown 内容，用户明确要求 pptx 时另行选择文档生成工具。

## 参考和工具

先读 [references/index.md](references/index.md)，按所需章节读取 [references/source.md](references/source.md)。共同约定见 [../../bigquant/common.md](../../bigquant/common.md)，冲突处理见 [../../bigquant/MIGRATION.md](../../bigquant/MIGRATION.md)。

安装了本项目 extension 时，quant_load_agent 可加载本流程和 JSON 上下文；quant_reference 按行读取原参考。直接使用 /skill:bigquant-ppt 时，从用户提供的资料或 context JSON 获取任务数据。除非用户另行授权，仅生成代码，不执行策略或平台查询。
