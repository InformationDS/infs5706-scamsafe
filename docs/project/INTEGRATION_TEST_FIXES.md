# 测试集成记录 · 2026-10-30（Sydney）

本地分支 `integration/test-fixes`；工作目录 `D:\BaiduSyncdisk\UNSW\INFS5706\GroupAssignment-integration`。本次是可用部分集成，不是A02完整验收、F独立验收或发布。

## 来源与接收结论

开工原目录为main、工作区干净，无未提交工作可带入。已fetch origin最新引用；main仍为A01 `435962f51daae5ae22065fdd8c3c3feb75099314`。三个新分支与main的merge-base均为此提交，各有一个独立新增提交，互不包含，未进入main。已存在公共基础不重复导入。保留原目录、main和所有原成员提交。

| 模块 | 远端分支／提交 | 实际实现 | 本次验证 | 缺项／接收 |
|---|---|---|---|---|
| B | NewB01 / dff4e4fd67f139f4257041e0e53376b798e9c833 | 设计说明、drawio流程；文件明确自述尚未实现 | 检查提交及全部两文件；intake入口公共MOCK可运行 | 无intake组件、业务函数、绑定或模块测试。不合并设计提案作为运行成果；更正合并、首次核对、补问计数仍缺 |
| C | codex/c01-model-analysis / 9bf119fc5e2d3a116a050c6df182e32568480944 | analyzeRuntime、实际模型UI、API设置联动、提示、来源／身份／响应校验、安全错误、迟到响应保护 | 本次65项全套检查含C实际浏览器通过；本地假提供商，无真实外部调用 | 已整合。Mock限固定T09来源；自由输入真实模型效果未验证；提议不合并案件（B职责） |
| D | feat/d01-guidance / ec56a5453cdff3fdbdb40ea16146144b9b5cce8e | 有限批准包匹配、受限岗位、建议接受／修改／拒绝与历史、失效及E交接、UI绑定 | 原交付应用检查因缺依赖未启动；本次15项D业务测试、实际整合页交互及公共检查通过 | 已整合。只支持当前三条教学指引及严格来源快照；只有一个批准岗位；跨指引版本归档未实现，E正文更新未接通 |
| E | 无可发现的origin分支、提交或PR | A01仅有MOCK输出替身；shared/outputs.ts、outputs模块、output-service.ts均不存在 | outputs公共MOCK 11组通过；context.outputRegistered=false | 无可整合运行交付。摘要／稿件生成、员工最终审核、复制及正式双格式输出未实现／未验证 |

GitHub PR搜索共两条：[#1](https://github.com/InformationDS/infs5706-scamsafe/pull/1)为历史协作文档，其提交d077ebf已在main祖先中；[#2](https://github.com/InformationDS/infs5706-scamsafe/pull/2)为C，open且draft，head=9bf119f。B/D/E无发现PR。远端另有docs/team-execution-rules=d077ebf，属于旧基础，不重合并。结论仅覆盖本次获取的origin及仓库PR，不推断他人未上传的本地成果。

C、D分别以非快进merge纳入（8a2919b、a5d4646），无代码冲突，保留来源与作者历史；未改main、未推送、未创建PR或部署。B设计仍可在原远端分支查阅。

## 装配与必要修复

- 根页面改为同一RuntimeCaseRecord的C/D工作台，复用成员组件和A01持久化，使用独立integration恢复会话；B/E缺项直接显示。
- 真实guidance端口接D的evaluateGuidance；公共诊断控件仍强制MOCK，并在整合页折叠标注。C只返回提议，不假装已由B合并；E缺失时不伪造员工审核或重新实现整个模块。
- 原基座保留在 `/?view=foundation`，四个独立模块URL保留；旧浏览器脚本对应调整到该基座URL。
- 增加一个有限的 `tests/integration-browser.ts` 检查实际C/D同页状态、拒绝保留、失效和存储；没有建设十五例回归工程。未改PRD、公共schema、批准包、依赖或锁文件。

## 实际命令与结果

Windows Node v24.15.0，Chromium 156.0.8078.4。依赖从原目录的既有node_modules复制到独立worktree，仅为忽略的本地依赖；没有复制.env、local配置或案件历史。没有新安装或锁文件变更。

| 命令（worktree根目录） | 结果与范围 |
|---|---|
| npm.cmd run build | TypeScript与Vite构建通过 |
| npm.cmd run check（设置C01_BROWSER=1及C01_EVIDENCE_DIR） | 65/65通过，0跳过；含D的15项及C实际浏览器，假提供商测试无外部模型 |
| npm.cmd run check:business | 批准包结构、哈希与引用通过，不等于产品验收 |
| npm.cmd run check:module -- 模块名 evidence/integration/2026-10-30/run-02/模块名-foundation | intake/model/guidance/outputs各11组，共44组通过；全部是公共MOCK底座检查，providerRequests=0 |
| npm.cmd run check:browser -- evidence/integration/2026-10-30/run-02/legacy-foundation | 旧基座16组通过 |
| node_modules/.bin/tsx.cmd tests/integration-browser.ts evidence/integration/2026-10-30/run-05/workspace | 实际整合页7组通过，页面异常0，providerRequests=0 |
| python scripts/maintenance/check_repository.py | 文档／来源维护检查通过，不代替应用测试 |
| python scripts/maintenance/check_tasks.py；git diff --check | 9张任务定义检查及差异格式检查通过 |
| npm.cmd run dev；GET 5173/ 及 /api/runtime/context | UI和4310服务实际启动，页面200；modelRegistered=true，outputRegistered=false，previewMode=mock |

证据在 `evidence/integration/2026-10-30/`：run-01保留受限环境HTTP失败及中断日志；允许回环后run-02全套65项通过。整合页run-02／03／04分别保留岗位选择器定位、错误文案预期、输出选择器定位失败；修正检查脚本后run-05通过，未修改业务标准或关闭校验。最终结果、构建／测试日志及整合截图进入本地提交；自动生成的合成JSON备份和大部分公共检查下载文件只留本地，不提交配置或真实个人数据。

## 已验证边界与剩余问题

实际C显示当前人工200和原文提议2000且不改变事实；迟到250保护、设置中途变化由C浏览器测试验证。D匹配三条指引，拒绝REC-03后重算／保存刷新仍保留，岗位或指引暂停不清事实、首次核对历史及问数。D改变依赖后，已保存的旧电信稿模拟导出返回409，未伪造新审核。

补问部分回答／未知／3轮9问仅验证底座纯函数和固定变体，不能证明B交互已完成。无指引实际D返回零建议及固定提示；事实摘要审核与复制／正式输出因E缺失不能走通。A01模拟Markdown/PDF及故障重试可运行，不能当作E交付；本次未重新逐页验收中文长文／表格PDF。

C原交付的dependency-note记录body-parser告警，本次未更新依赖，也未重新联网核实该告警。真实模型、人类产品验收、macOS／第二电脑、跨指引版本迁移及完整十五例未验证。F01/F02/A03未执行。

**可开始C/D与公共存储的局部测试；不能开始从自由输入到真实员工审核输出的完整流程测试。** 当前主要阻塞是缺B和E运行模块，不是C/D构建失败。后续拿到B/E后沿用当前分支接入，不用重建全部业务。

## 启动与复测

在上述worktree目录执行 `npm.cmd run dev`，打开 http://127.0.0.1:5173/；或 `npm.cmd run build` 后 `npm.cmd start`，打开 http://127.0.0.1:4310/。本机依赖已就绪；新电脑按RUNBOOK执行npm ci及npm run browser:install。默认Mock，不需密钥。真实模型仅由人类在产品内保存设置后主动点击分析。

选corrected并Reset fixed input，按未保存提示确认后，在C点Analyze current case；D点Recalculate guidance，填写合成员工标识并接受／修改／拒绝。Save runtime case后刷新验证恢复。选no-guidance并重置可检查无指引边界；诊断MOCK输出只用于底座检查。重跑浏览器命令时使用新的证据目录，保留原失败批次。
