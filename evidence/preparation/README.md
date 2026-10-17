# 前置准备实际验证

日期：2026-10-17，Australia/Sydney。本记录区分来源完整性、业务内容批准、公共程序、mock／假服务、浏览器和 PDF 检查。本轮单例业务内容已获用户批准，登记见 [approval.json](../../data/business/approval.json)；原模拟案件和员工审核仍保持模拟身份。

| 输入／操作 | 预期 | 实际及证据 |
|---|---|---|
| 开始时 `git status --short`、分支与 HEAD | 明确已有改动与基线 | main；无未提交改动；HEAD 9d141e8755ff7221f7472d7242ffe83596e66044 |
| `node --version`、`npm --version`、`python --version` | 查明本机工具，不推定成员环境 | 24.15.0／11.12.1／3.14.6；[环境记录](environment.json) |
| `python scripts/maintenance/check_preparation.py --report evidence/preparation/source-check.json` | 6 段来源匹配，7 文件哈希一致，批准全部 pending，退出 0 | 通过；[来源检查](source-check.json) |
| 在临时副本分别改原文、复制片段、pending 标志后运行同一检查函数 | 每种错误均被拒绝；不修改仓库来源 | [负向检查](negative-checks.json)记录每项结果 |
| `python scripts/maintenance/check_repository.py --report evidence/preparation/repository-check.json` | 链接、117 字段及资料完整性通过，退出 0 | 通过；[仓库检查](repository-check.json) |
| `git diff --check`，并直接检查新增文本 | 无尾空格或冲突标记 | [文本检查](text-check.json)；直接检查包含未跟踪的新文件 |

## 运行基础验证

| 输入／命令与预期 | 实际结果 |
|---|---|
| npm 依赖安装、按锁文件 `npm ci --ignore-scripts`，预期安装完成 | 本机成功重装 127 包；[环境与安装](environment.json)。此轮禁用依赖安装脚本，后续构建和浏览器检查成功 |
| `npm run build`，预期类型与 Vite 构建成功 | 通过；[构建输出](build-check.txt) |
| `npm run schemas`、`npm run fixtures`，预期生成共用数据 | 9 个原模拟 JSON Schema、5 个批准包 JSON Schema、10 个原模拟固定状态；模拟状态仍 pending；运行时 refinement 另行检查，不完全由 JSON Schema 表达 |
| `npm run check`，预期公共逻辑与本地假模型接口检查通过 | 31／31（核心 14、服务 7、业务批准包 4、模型设置 6）；[完整输出](runtime-check.txt)。包括来源与字段类型、更正保护、补问上限、对象依赖、旧请求及导出门槛 |
| `npm start`，预期 4310 页面及 health 可访问 | 实际启动日志成功；HTTP 200、health mock/configured:false；[启动检查](startup-check.json) |
| `npm run dev`，预期 5173 开发页面及代理可访问 | 实际 Vite 启动、页面 200、API 代理返回 mock；[启动检查](startup-check.json) |
| `npm run check:browser`，预期浏览器基座操作成功 | 16 组通过；[浏览器结果](browser-check.json)及[页面截图](workbench.png)。备份检查包含拒绝不支持案件，保留当前内容 |
| reviewed 模拟状态导出，预期复制／Markdown 正文一致且 PDF 可读 | 浏览器中实际下载并比对；[Markdown](EXAMPLE-01_SUMMARY_v1.md)、[摘要 PDF](EXAMPLE-01_SUMMARY_v1.pdf)。所有格式含未批准／模拟标记 |
| PDF 渲染探针，预期中文、长 URL、表格文本及分页完整 | 摘要 1 页＋[探针](rendering-probe.pdf)4 页共 5 页，使用 Poppler 渲染后主 agent 逐页目视检查；[视觉检查](pdf-check.json)。中文及第 40 段还经 pypdf 文本提取确认 |

浏览器十六组覆盖：API 设置保存与刷新、密钥不回显／空白保留／显式清除、关闭丢弃未保存内容、设置变更使进行中分析失效；批准业务基准的独立加载；部分回答刷新恢复；JSON 备份还原及错误备份拒绝；超时／解析错误；延迟旧请求；保存失败、阻输出及重试；旧审核阻断与新模拟审核；复制／Markdown／PDF 故障与同版重试；复制与 Markdown 同文及 PDF 生成；中文长文探针；两接收方模拟预览；无未捕获页面错误。各组输入和顺序见 tests/browser-check.ts，命令自行建立临时本地服务并关闭，不使用真实模型。

PDF 模板目前按纯文本正文排版；探针的表格是文本列，不是复杂 Markdown 表格支持。共用正文中的 Markdown 标记仍可能以文本呈现。此检查不能代替 E 的最终排版验收或 macOS 字体检查。

## 实际失败、重测与未执行

- 首次依赖下载在受限环境 DNS 解析失败；允许网络安装后成功。首次临时目录负向检查遇权限失败，改用项目 local/ 的隔离副本后通过。
- 首次浏览器检查在 Windows 剪贴板 CRLF 与 Markdown LF 的直接比较处失败；按平台换行规范比较正文后重测通过，未删除或改写业务正文。
- API Host 检查首次使用 fetch（不保留自定义 Host）未达到预期；改用原始 HTTP 请求后验证拒绝异常 Host。真实模型无关。
- 收紧案件主入口时发现模拟接收方 ID 与岗位配置不一致；统一引用并加入缺失／越界接收方负向检查后，21 项集成检查通过。
- 上轮最后复测因自动审批用量限制未执行；本轮重新获准后完成，没有将未执行当通过。
- 渲染已成功；附加文本工具 pdftotext 不在运行时中，改用 bundled Python 的 pypdf 完成文本检查。
- 未执行真实 MiMo、macOS、第二台电脑、F 独立验收、完整 15 例或正式产品全流程；本轮岗位／指引／案例参考内容已批准，员工个案审核未执行。模型接口测试仅使用本地假服务，providerCalled 元数据不代表已调用 MiMo。

文档检查与程序／视觉检查分别记录；本轮没有提交、推送、部署或付费模型操作。详情见[就绪盘点](../../docs/project/FOUNDATION_READINESS.md)。

## 业务内容批准与核对

用户明确批准本轮现有业务内容；[业务校验记录](business-check.txt)验证批准身份、范围、版本、规范化哈希、岗位与指引引用、固定输入／问答、25 项参考事实及四段条件性正文。[业务包](../../data/business/README.md)提供有效合成配置与10条参考检查，不表示已执行这10条业务流程。GET /api/business 和工作台已批准基准卡读取同一包。原来源包与负向样例的 pending 保留，不作为当前批准登记。真实模型、第二岗位、完整15例、macOS及F独立验收仍未执行。

产品设置专项：页面入口见 [ModelSettings](../../app/src/components/ModelSettings.tsx)，服务端见 [ModelSettingsStore](../../server/src/model-settings.ts)，操作与本地保存位置见 [RUNBOOK](../../docs/architecture/RUNBOOK.md)。[设置截图](model-settings.png)使用测试凭证且密码栏为空；测试使用隔离内存设置与本地假提供商，未写用户配置、未联系真实模型。六项程序测试另覆盖保存失败保持旧配置、进程重启读取配置、凭证清除、地址和认证校验、Host／Origin 限制及下一次请求采用新设置。

当前开发任务定义与检查见[任务入口](../../docs/project/TASKS.md)和[任务定义验证](../task-restructure/README.md)。此处公共基座证据不作为新任务已执行或已验收的记录。
