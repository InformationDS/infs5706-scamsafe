# 本地服务公共基座

运行及本地凭证配置见 [RUNBOOK](../docs/architecture/RUNBOOK.md)，结构与 HTTP 输入输出见 [CONTRACTS](../docs/architecture/CONTRACTS.md)。根目录统一安装、构建及启动，不在本目录另装依赖。

- src/index.ts：加载可选 .env 默认值及本地产品设置，仅监听 127.0.0.1。
- src/model-settings.ts：产品内 API 设置的校验、本地持久化及不含密钥的读取接口。
- src/config.ts：验证模式、地址、模型、认证及超时配置，不打印秘密值。
- src/app.ts：health、settings/model、analyze、export 入口，输入／快照校验、本地 origin 限制和错误响应。
- src/model.ts：OpenAI 兼容非流式分析适配器；本地假服务测试与真实提供商调用分开。
- prompts/intake.txt：C 的实际提示入口；INTAKE_DRAFT.md 为来源稿，不作为另一个运行提示加载。

默认 mock 只支持固定单例事实；timeout／invalid／delayed 故障注入仅 mock 可用。模型不能产生岗位、有效指引、审核或自由权限，当前建议恒为空。live 配置接口已有，真实 MiMo、费用和内容效果均未验证。
