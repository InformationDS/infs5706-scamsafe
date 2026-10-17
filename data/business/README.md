# 已批准的单例业务基准

当前批准来源为 [approval.json](approval.json)：A 在本对话明确授权“你直接完成所有的业务内容，我都批准”，日期为 2026-10-17。范围为本轮已列明的 T09／EXAMPLE-01 内容，不是运行测试或员工个案审核。

- [role.json](role.json)：已批准的一线岗位、本地权限、排除动作及银行／电信接收方职责。
- [guidelines.json](guidelines.json)：EX-G01–03 v1，合成原型配置为 enabled、approved、current；必需条件、允许未知、不匹配结果、人工升级及局限齐全。
- [T09.json](T09.json)：固定叙述、更正、三问两次回答、25 项参考事实、三项建议的预期选择、四段条件性正文及 10 条独立验收参考。`expectationOnly:true`、`execution:not-executed`；正文中的 Reviewed 不能作为实际审核记录。

根目录执行 `npm run check:business` 校验批准记录、文件哈希、结构、引用以及与固定来源的一致性。`GET /api/business` 返回校验后的批准包；schemas/ 提供五份同源 JSON Schema。哈希以 UTF-8／LF 规范化，兼容 Windows／macOS 换行差异。手改批准内容会使哈希校验失败，不应绕过检查或让成员自行刷新批准记录。

`*.pending.json`和data/fixtures/保留为负向／模拟测试材料，原来源字节保存在evidence/preparation/source-snapshot/；它们不由本次内容批准自动升级为有效员工审核或完整业务流程。当前批准包可供后续内容和接口开发消费；指引匹配、生成及完整产品流程仍须按 PRD 实现并实际验收。
