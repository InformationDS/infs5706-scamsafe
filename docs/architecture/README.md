# 统一技术方案入口

维护人：A。当前采用用户已批准的 Windows/macOS 本地技术基础；当前单例业务岗位、EX-G01–03 v1 和参考预期已批准并有独立加载包；工作流仍为明确标记的 mock 开发环境。

- [统一方案](FOUNDATION_PROPOSAL.md)：已确认技术、模块边界、外部条件与官方依据。
- [运行说明](RUNBOOK.md)：安装、配置、启动、固定 origin、检查和失败处理。
- [共享契约](CONTRACTS.md)：实际结构、函数、HTTP 接口及未实现业务。
- [就绪盘点](../project/FOUNDATION_READINESS.md)：各方向实际具备条件与阻塞。
- [业务逐项确认](../product/examples/BASELINE_CONFIRMATION.md)：当前已批准范围与边界；实际正文及配置见[批准基准](../product/examples/APPROVED_BASELINE.md)。

```text
app 展示／操作 → shared 公共状态与审核边界
app /api → server 模型适配与结构校验
IndexedDB ← 完整模拟案件 → JSON 备份／恢复
有效模拟审核 → 同一快照 → 预览／复制／Markdown／Chromium PDF
```

A准备公共运行结构、持久化及模拟端口；B开发案件与首次核对／补问，C开发模型接入，D开发岗位与建议，E开发最终审核和输出，各自完成界面及绑定。A集中集成后F统一检查与复测。成员不自行扩充权限、改计数或绕过审核。实际开发范围及开工依赖见[任务入口](../project/TASKS.md)，成员按获指派的一张卡执行。
