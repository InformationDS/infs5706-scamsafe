# 测试集成记录 · 2026-10-30（Sydney）

后续B接入及修复结果见文末2026-11-04批次；以下2026-10-30记录保留原检查范围。

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

## B接入与保存修复 · 2026-11-04

来源为origin/NewB01@83fc6a234b2579ee15efc35602ebe7f5c282db54。将根目录intake.ts放到shared/intake.ts，将index.tsx、useIntake.ts、style.css放到app/src/modules/intake/，提取tests/intake.test.ts。保留成员实际实现；选择性接入5个文件，来源分支的重复测试、根目录证据及旧公共代码继续留在原分支。

修复中，B保存成功后由宿主应用已提交状态，去除再次onChange(saved)带来的未保存标记。宿主对未提前展示的待保存状态（如新问题轮次）支持事务提交后应用，并比较保存前／提交内容以保护较新编辑。保存失败保留输入并显示失败，首次核对允许重试；回答、结束及来源保存的成功提示仅在当前案件确已保存时显示。问题保存失败计数保持0，重试成功后计3，迟到保存保留当前250及未保存状态。根页面与/?module=intake均挂载成员模块。

实际验证使用Windows Node v24.15.0与Chromium 156.0.8078.4，证据位于evidence/task-results/B01/fix-20261104/。

- npm.cmd run build通过。
- B01_BROWSER=1、C01_BROWSER=1及各自新证据目录环境下的npm.cmd run check通过72/72，0失败、0跳过；含6项B原单测及1项B双入口浏览器回归。
- npm.cmd run check:module -- intake evidence/task-results/B01/fix-20261104/run-02/public-intake通过11组公共Mock检查。
- node_modules/.bin/tsx.cmd tests/integration-browser.ts evidence/task-results/B01/fix-20261104/run-02/integration通过7组。
- npm.cmd run check:business通过。仓库／任务维护及diff检查结果见本批最终记录。

run-01记录核对保存失败后重试按钮被禁用的回归失败，修复后run-02通过。B双入口实际验证保存成功状态、失败重试、问题计数、回答与结束保存、刷新恢复以及保存进行中更正250；页面异常0、外部提供商调用0。首次核对沿用原B实现的simulated=true训练事件。E最终审核输出、真实模型效果、F独立验收及跨系统验证待完成。

## D更新整合与推送 · 2026-11-04

按用户本次授权，先将B修复fcf547c及日志格式提交faff4e1推送至origin/integration/test-fixes，再以merge c228b70接入origin/codex/d01-integration-review@957831c。其中d5b21a3加强当前建议的事实／来源／指引依据比较，交接增加decisionReason及employeeEdited，957831c为成员交付记录；完整保留来源和原检查证据，合并无冲突。

重新fetch及检索仓库PR后，C分支继续指向已有成果，E仍缺可发现交付。B五个模块文件已通过选择性接入及修复纳入，NewB01分支中的根目录文件、旧测试换行和重复内容继续留在来源分支，避免重复带入。当前复核范围为B/C/D及公共存储。

本批实际命令与结果保存在evidence/integration/2026-11-04/run-01/。

- npm.cmd run build通过，日志为build.txt。
- B01_BROWSER=1、C01_BROWSER=1、D01_BROWSER=1的npm.cmd run check为77/77，0失败、0跳过，日志为check.txt。各模块B01_EVIDENCE_DIR／C01_EVIDENCE_DIR／D01_EVIDENCE_DIR分别使用evidence/task-results/对应任务/integration-20261104/run-01/browser，含B保存回归、C本地假提供商回归和D双入口实际页面。
- node_modules/.bin/tsx.cmd tests/integration-browser.ts evidence/integration/2026-11-04/run-01/workspace通过7组，providerRequests=0。
- npm.cmd run check:module -- guidance evidence/integration/2026-11-04/run-01/guidance-public通过11组公共Mock检查，providerRequests=0。
- npm.cmd run check:business通过；仓库、任务定义及差异检查通过。

E仍需根据当前D记录与guidanceHandoff消费员工决定和依赖，并实现正文更新及最终审核。公共ports.guidance目前返回evaluateGuidance匹配提议，E接线时须按D卡消费当前决定，避免将提议覆盖已拒绝或人工修改的记录。跨指引版本迁移、真实模型效果、人类／F验收及跨系统检查待完成。

## E四模块接入 · 2026-11-05

来源为origin/feat/e01-outputs-jingran@13ed32d1ea549657a55293a150d857b294c0d93b，公共起点58038ac。本地以2c14f21为基线，merge ef79301保留E实现、tests/outputs.test.ts及原失败／成功证据，无合并冲突。

主页面同案装配B/C/D/E，E独立预览继续保留嵌入D的便利控件，整合页复用已有D区域。E服务自动注册并沿用outputSnapshot服务端复验，摘要／接收方草稿、决定过滤、重生成保护、编辑历史和显式最终审核均使用成员原实现。

必要适配如下。

- ModuleProps增加可选integrated及onWorkingEditChange属性，保持旧模块调用兼容。E未Record edit的正文阻止公共保存、新建／重置／打开／导入／导航，刷新／关闭时提示；Record edit或Discard working edit后恢复。PDF请求期间开始编辑时，迟到文件会被丢弃，当前工作文本保留。
- B后补同一问题的答案时，保留原Q来源文字，新答案生成SRC-UUID且沿用字段／记录目标，问题ID和计数保持。事实版本继续使E依赖失效，避免源文原地改写影响历史正文。
- E浏览器证据目录检查改用跨平台relative/isAbsolute，保持任务目录边界；Windows剪贴板CRLF只在比较时归一为LF，正文内容比较仍严格。
- 既有tests/integration-browser.ts更新为检查E服务已注册；新增A02允许的tests/prototype-browser.ts，通过实际主页面操作检查T09和无指引流程。

最终结果来自evidence/integration/2026-11-05/及evidence/task-results/各模块/integration-e-20261105或integration-20261105。

| 实际命令／动作 | 结果及证据 |
| --- | --- |
| npm.cmd run build | run-05/build.txt，TypeScript及Vite通过 |
| B01_BROWSER=1、C01_BROWSER=1、D01_BROWSER=1、E01_BROWSER=1的npm.cmd run check | run-05/check.txt，89/89、0失败、0跳过；每个任务的证据目录为对应任务下integration-e-20261105/run-05/browser，E为integration-20261105/run-05/browser |
| node_modules/.bin/tsx.cmd tests/prototype-browser.ts evidence/integration/2026-11-05/run-06/prototype | 5组完整流程通过，页面异常0、providerRequests=0；从初始T09执行B分析／200更正／首次核对／1轮3问部分回答未知结束，经D决定到E审核、复制及双格式输出；后续拒绝REC-03、金额250、员工稿保护／明确替换、无指引摘要、503重试及刷新恢复通过；含导出进行中开始工作编辑的迟到下载阻断 |
| node_modules/.bin/tsx.cmd tests/integration-browser.ts evidence/integration/2026-11-05/run-05/host-regression | 原宿主7组通过，providerRequests=0 |
| npm.cmd run check:module -- outputs evidence/integration/2026-11-05/run-05/public-outputs | 公共Mock 11组通过，providerRequests=0 |
| npm.cmd run check:business | 批准包、哈希及引用通过，日志为run-05/business.txt |
| PDF结构、文本及渲染检查 | E最终压力目录4份PDF共17页（摘要4、中文长表5、同版本重试5、无指引3）；中文与表格换页正常，168个HTML文本块在按阅读顺序提取的PDF文本中全部找到，缺失0。长表5页逐页观察，摘要4页及无指引3页用逐页拼图观察，重试5页像素与长表完全一致。结果为E对应run-05/browser/pdf-check.json，PDF和渲染保留于同目录 |
| npm.cmd run dev及GET 5173/、/api/runtime/context | UI与4310服务实际启动，页面200，modelRegistered=true、outputRegistered=true、previewMode=mock |

run-01保留E Windows路径校验失败；run-02保留剪贴板换行差异；run-03全套88项通过，但新增整合脚本未先切换所选草稿导致定位审核按钮失败；修正脚本操作后run-04完整流程通过。新增B旧来源保护后run-05最终89项及完整流程通过，run-06在相同产品代码上额外验证PDF迟到响应与工作编辑并发。旧批次均保留。PDF表格逐块完整性使用raw阅读顺序提取，layout方式列文本交错的误报已在本地QA核对。

当前可开展合成T09及无指引两条完整流程人工测试，操作见[原型说明](../architecture/PROTOTYPE_RUNBOOK.md)。首次核对保留B的训练模拟标记，自动最终审核以测试标识记录；人类／F独立验收、真实模型效果、完整15例、跨系统和跨指引版本迁移待完成。原批准包、依赖和JSON schema无差异。

本轮跨日于2026-11-06收尾。最终共享存储操作期间将模块设为inert，避免导入／切案正在进行时再开始工作编辑；run-07/build.txt、run-07/check.txt为最终构建及89/89结果，run-07/prototype/result.json为含迟到PDF保护的完整5组流程，run-07/public-outputs/result.json为最终11组公共检查，额外tsc --noEmit通过。原宿主7组及17页PDF版式／文本结果保留在run-05，导出实现与最终版本一致。失败文本日志的提交归档仅清理行末空白，原始副本留在忽略的local/e-integration-20261105/original-logs/。
