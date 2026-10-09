# 静态检查记录

检查日期：2026-10-09。分支：kuanbang。

| 检查 | 结果 | 范围 |
|---|---|---|
| check_resources.py --source-dir Home-12 | 通过 | 14个 skill 的元数据、来源哈希、原文逐字节一致性、链接、索引行号 |
| check_python.py scripts及assets目录 | 通过 | 6个辅助脚本和5个 Python 模板，仅编译语法 |
| npm run check 的 Biome 阶段 | 通过 | 1510个仓库现有检查范围内的文件，未格式化其他文件 |
| npm run check | 未通过 | check:runtime-deps 无法加载 typescript/unstable/ast，后续阶段未运行 |
| tsc --project .pi/bigquant/tsconfig.json --noEmit | 未通过 | 新增 .pi 文件未报告错误；导入的仓库源码报现有依赖相关错误 |

当前本地 TypeScript 是5.9.3，根 package.json 声明7.0.2。当前 OpenAI SDK 是6.40.0，packages/ai 声明7.19.0。现有源码类型检查报告 prompt_cache_options、fast service tier、部分 provider 的 unknown[] 和 highlight.js 子路径类型错误。当前 Node 为22.16.0，根项目要求至少22.19.0。

尝试 npm install --ignore-scripts --no-package-lock --offline 恢复本地依赖，因 @anthropic-ai/sandbox-runtime 不在缓存中返回 ENOTCACHED。没有修改 package.json、package-lock.json 或已有源码来绕过这些错误。未进行联网安装。

TypeScript整体检查尚未通过，不能把“新增文件未报错”当作完整编译成功。依赖环境恢复后可重跑 README 中的检查命令。

没有执行策略、SQL、BigQuant/QMT接口、回测、交易、测试或构建。Python通过只表示源码可编译，不能证明平台接口或策略行为正确。
