# Changelog

## 2026-07-14｜v0.2.1

### Changed

- 重新整理三模块边界，减少模块 1 和模块 2 的重复。
- 模块 1 从“视觉支持综合包”调整为“视觉流程支持”：
  - 视觉日程表；
  - First-Then；
  - 社交叙事；
  - 成人展示建议。
- 模块 2 从“简单 AAC 卡片生成器”调整为“表达卡系统”：
  - 固定核心卡；
  - 当前场景卡；
  - 功能表达卡。
- 模块 3 从“语言简化器”扩展为“沟通伙伴支持”：
  - 成人低压力短句；
  - Aided Language Modeling 示范脚本；
  - 等待与确认提醒。

### Added

- `/api/generate` 支持三种模式：
  - `visual`
  - `aac`
  - `partner`
- README、PROGRESS、ROADMAP、PRD 同步更新为 v0.2.1 结构。

### Safety

- 继续保持非医疗定位：
  - 不诊断；
  - 不治疗；
  - 不解释行为原因；
  - 不推断隐藏意图；
  - 不自动替儿童回复。

## 2026-07-14｜v0.2

### Added

- 顶部 API 连接入口。
- DeepSeek / OpenAI 临时 API Key 输入。
- Cloudflare Pages Function：`functions/api/generate.js`。
- 输入驱动的模块 1、2、3 初版。
