# F01 run-01 归档说明

本目录是他人提供的 ScamSafe full-rebuild 测试记录与证据包，于 2026-11-10 解压归档。

## 来源与完整性

- 原始压缩包：[ScamSafe_完整测试记录与证据_20261110.zip](input/ScamSafe_完整测试记录与证据_20261110.zip)
- 原始包 SHA-256：`11AFC5E6BC4C12E93148EC8C8D4CB2DCE32C7F64C4719962252E433050DFC26D`
- 包内校验清单：[SHA256SUMS.txt](input/SHA256SUMS.txt)（归档时逐项复核 82 项，0 个缺失或哈希不符）
- 包内说明：[PACKAGE-README.md](input/PACKAGE-README.md)
- 原始根目录 Word 记录与 `record/ScamSafe_完整测试记录_20261110.docx` 哈希相同（`6C01F51B9DA4CFE9BE217FAE65B944719DA3651EA0D49A6E6543DDBD74579438`），归档只保留后者，避免重复。

## 被测基线

- 分支：`refactor/full-rebuild`
- 提交：`26e7d78aab97f98832b7b7b3040c91e87046c3e9`
- 测试分支：`codex/full-rebuild-validation`
- 环境：macOS 15.7.3 arm64、Node v24.22.1、Chromium 156.0.8078.4
- 入口：`/?view=course`，临时本机回环服务

## 结果索引

- [测试报告](REPORT.md)
- [完整 Markdown 记录](record/ScamSafe_完整测试记录_20261110.md)
- [完整 Word 记录](record/ScamSafe_完整测试记录_20261110.docx)
- [逐项检查清单](record/逐项检查清单.md)
- [新六案例页面套件](new-suite-attempt-01/result.json)
- [HTTP 最小边界复现](boundary-replay-result.json)

统计：

- `npm run check`：182 项，180 通过，2 项旧 C/E 浏览器用例跳过，0 失败。
- 新六案例 × 两角色：172 个检查点，170 通过 / 2 失败。
- 最小 HTTP 复现：10 项，8 通过 / 2 失败（重复前述交接边界，不是两个新缺陷）。
- 真实模型：未执行；本机为 mock 且无配置。假提供商结果不代表真实模型质量。

## 已暴露问题

1. **F01-001（P1，明确缺陷）**：电信角色收到纯骚扰电话（仅 `contactChannel=Phone call`、`affectedService=Mobile phone`、`observedIssue=Repeated nuisance calls`，无账户/付款事实）时，`handoverRecipient` 因通用 `observedIssue` 被判为银行线索，生成可确认、复制和下载的 `SYN Bank A intake team` 交接稿。
2. **F01-002（P2，待产品确认）**：模型返回 `recommendations=[]`，且 `handoverReason`、`handoverRequest`、`handoverGuidelineId` 全为 null 时，程序仍根据事实补出银行交接并使用通用理由；没有指引 Basis。是否允许这种确定性降级需要产品确认；从 PRD 5.3/5.4 看，保守做法应是不生成无依据交接。

## 归档说明

- 本目录保留原测试证据的相对路径和失败结果，没有把失败改绿。
- `docs/project/tasks/F01.md` 已更新为该证据包提供的唯一执行记录。
- 本归档不修改产品程序、PRD、指引或模型配置。
