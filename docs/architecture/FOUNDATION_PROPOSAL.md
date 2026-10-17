# 公共基础统一方案

用户已批准下列技术基础，要求同时支持 Windows 与 macOS 本地运行。产品行为仍以 [PRD](../product/PRD.md) 为准；技术批准不代表业务内容批准。安装、配置和启动见 [RUNBOOK](RUNBOOK.md)，实际验证与缺项见[就绪盘点](../project/FOUNDATION_READINESS.md)。

## 已确认选择

| 范围 | 当前方案 | 取舍与边界 |
|---|---|---|
| 界面 | React + TypeScript + Vite | A定义公共结构并装配主页面；B/C/D/E各自实现完整模块的逻辑、界面和绑定，样式作用域隔离 |
| 本地服务 | Node.js 24 + Express；依赖与锁文件共用 | 构建后服务提供页面及 API；仅监听本机回环地址，仍需要 Node.js 和依赖，并非独立可执行程序 |
| 结构 | Zod；同源生成 JSON Schema | 类型、运行校验、固定状态统一；JSON Schema 不能代替运行时跨字段／依赖校验 |
| 模型 | MiMo 的 OpenAI 兼容接口，用户自行配置 | 产品内设置地址、模型、密钥及认证参数，本地服务保存，.env 仅作默认值；默认 mock。用户自主配置后主动分析，本轮不使用真实凭证调用 |
| 保存 | 同一浏览器 origin 的 IndexedDB；允许 JSON 备份／恢复 | 基座仅保存 EXAMPLE-01；刷新恢复与备份接口已有，完整多案件历史待开发；不同浏览器／电脑不自动共享 |
| 输出 | 同一模拟审核快照 → Markdown 与 HTML／Chromium PDF | 共用正文与版本；PDF 依赖单独安装的 Chromium 和本机字体，需逐页检查 |
| 运行与协作 | Windows/macOS 本地项目；文件交 A；允许 JSON 搬迁 | 团队两台 Windows、四台 macOS；成员映射后续人工确认；不要求截止时间；macOS 与第二台电脑需实际复测。没有线上部署授权 |

本轮单例岗位、接收方、EX-G01–03 v1、T09／EXAMPLE-01 输入及参考预期已获用户批准，独立配置在 data/business/，由共享结构和服务端加载器校验。原固定 mock 状态仍保持岗位停用、内容 pending 及审核 simulated:true，只用于开发门槛与排版。批准范围见[批准基准](../product/examples/APPROVED_BASELINE.md)。

## 实际模块

| 位置 | 职责 |
|---|---|
| shared/schema.ts、shared/core.ts、shared/fixtures.ts | A 维护类型、运行边界、版本／审核操作及固定状态 |
| app/src/components/ | 既有展示起点；B/C/D/E按模块卡分别开发，公共状态接口由A01准备 |
| server/src/、server/prompts/intake.txt | C实现模型调用／校验、设置与提示，A维护公共路由，不让模型决定岗位、审核或权限 |
| data/business/、shared/business.ts、server/src/business.ts | D 的当前批准岗位／指引与单例参考样板，公共校验和加载由 A 维护；data/roles/、data/guidelines/ 的原稿及 pending 样例保留来源／负向身份 |
| app/src/export/OutputPanel.tsx、shared/export.ts | E 的预览与输出排版起点；快照资格由公共核心检查 |
| data/fixtures/、tests/ | 共用 mock 输入、固定状态与程序检查；F 可观察基座行为 |

仅建立任务拆分所需入口；建议生成、指引匹配、岗位切换、完整聊天工作流和全案例验收尚未实现，不能由现有目录推定已完成。

## 官方依据与使用限制

- Node.js 24 是 LTS 发布线，项目 engines 限定 24.x；实际依赖版本以 package-lock.json 为准。[Node.js 发布线](https://nodejs.org/en/about/previous-releases)
- Vite 支持现代浏览器，开发模式对浏览器能力要求更高；成员使用当前稳定 Chrome／Edge，macOS 浏览器效果须复测。[Vite 官方说明](https://vite.dev/guide/)
- VITE_ 环境变量会进入客户端，模型密钥不得使用该前缀。[Vite 环境变量](https://vite.dev/guide/env-and-mode)
- Zod 可生成 JSON Schema，但需另外执行核心函数与跨字段校验。[Zod JSON Schema](https://zod.dev/json-schema)
- IndexedDB 按 origin 隔离，存储可能因配额或回收失败；只有事务成功才显示已保存。[MDN 存储说明](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- Playwright 浏览器二进制需另行安装；PDF 使用打印布局，与页面截图不同。[浏览器安装](https://playwright.dev/docs/browsers)、[PDF API](https://playwright.dev/docs/api/class-page#page-pdf)

技术目标支持两种系统，不等于已经在两种系统验收。提供商的具体地址、认证和可用模型由用户在本地填写并按其服务文档核对，不能将任意第三方 MiMo 服务等同于同一端点。
