# 本地运行与检查

从仓库根目录执行下列命令。目标为 Windows 和 macOS 本地项目；当前实际平台验证及失败／未执行项见[就绪情况](../project/FOUNDATION_READINESS.md)和[验证证据](../../evidence/preparation/README.md)。任务范围与开工条件见[任务入口](../project/TASKS.md)。

## 环境与安装

安装 Node.js 24.x（包含 npm），使用当前稳定 Chrome 或 Edge。PDF 和自动浏览器检查另需 Playwright Chromium。网络须能获取 npm 依赖及浏览器；无需模型账号即可运行 mock。不要复制另一系统的 node_modules。

Windows：先在文件资源管理器打开自己解压的项目根目录（应能看到package.json和package-lock.json），在该目录打开PowerShell。目录使用本机实际位置，不复制A电脑的路径。先运行Get-Location核对位置，再执行安装：

```powershell
Get-Location
node --version
npm.cmd --version
npm.cmd ci
npm.cmd run browser:install
```

已有 .env 保留，不覆盖；它只是可选启动默认值。Windows 使用 npm.cmd 可避开本机 PowerShell 对 npm.ps1 的执行策略影响，无需改执行策略。

macOS Terminal（先进入自己保存的项目根目录；以下安装和运行待 macOS 实机验证）：

```sh
node --version
npm --version
npm ci
npm run browser:install
```

预期 node 为 v24.x，npm ci 完成且不改锁文件，浏览器安装完成。失败时保留终端完整错误交 A，不自行升级依赖。浏览器安装下载的是本机运行时，不是线上部署。[Node.js 下载](https://nodejs.org/en/download)、[Playwright 安装说明](https://playwright.dev/docs/browsers)

## 产品内模型设置

团队为两台 Windows、四台 macOS；成员映射后续人工确认，不要求截止日期。操作入口是工作台顶部的 **Configure model API**，不要求用户编辑配置文件。

1. 启动并打开工作台，点击 Configure model API。
2. 默认 Mock 模式使用固定输入且不调用外部服务；需要自己的 API 时选择 Real API。
3. 填写服务商的 API base URL（不附加 /chat/completions）、精确 Model name 和 API key。MiMo 或其他 OpenAI 兼容服务均由用户填写，不预设账号或价格。
4. 按服务商要求展开 Authentication & timeout。通常为 Authorization + Bearer；支持 api-key、x-api-key，以及空前缀原始密钥。超时为 0.1–120 秒。
5. 点击 Save API settings。保存不发送模型请求；Real API 必须配置完整。失败保留旧有效配置与当前页面填写内容，修正后可重试。
6. 保存成功后，下一次点击 Run adapter 使用新配置，无需重启。真实请求发送当前合成案件，可能消耗用户服务额度；是否调用由用户主动操作。configured 或保存成功不等于连接／余额／分析效果已验证。

已保存密钥不回填，只显示 API key saved。密钥输入留空会保留旧值；换密钥直接填新值；清除时明确勾选 Remove saved API key。Real API 不允许缺密钥，需先切回 Mock 才可清除。关闭面板不保存未提交更改，并清空尚未提交的密钥输入。

配置由本地服务保存于被 Git 忽略的 local/model-settings.json，当前是本机明文配置文件，并非系统钥匙串或加密存储；POSIX 新文件使用 0600，Windows 使用本机文件系统权限。不把 local/ 或 .env 交给其他成员。密钥不进入页面读取响应、浏览器案件存储、JSON 案件备份、生成构建或共享文档。Node.js 官方说明 Windows 对权限位的支持有局限，不据 0600 声称 Windows 具备相同权限隔离。[文件写入与权限](https://nodejs.org/docs/latest-v24.x/api/fs.html)

.env 保留为可选启动默认值，无需复制或填写也能运行 Mock。保存过的页面设置优先；明确清除的密钥重启后不会回落为 .env 的旧密钥。PORT 仍是服务启动设置，默认 4310，不在产品 API 设置中修改；开发代理使用该端口。GET /api/health 只显示 mode 与 configured。未执行真实 MiMo 测试时保持未验证，不能以本地假服务通过代替。

## 开发、构建与启动

两平台命令相同；Windows 将 npm 写为 npm.cmd：

```sh
npm run dev
```

打开 [开发工作台](http://127.0.0.1:5173)。此命令同时运行 Vite 与 4310 本地服务；端口被占用时停止并交 A 处理，不自行改端口产生另一套保存位置。终端保持打开；Ctrl+C 停止。

供本机使用的构建与启动：

```sh
npm run build
npm start
```

打开 [本地构建页面](http://127.0.0.1:4310)。先停止 dev 的服务再 start。build 仅构建界面并检查类型，start 仍运行 server/src/ 中源代码，需要完整项目、Node.js 和依赖；不是双击安装包，也没有在线链接。

**固定保存地址：**日常开发使用 127.0.0.1:5173；构建运行使用 127.0.0.1:4310。端口、协议或 localhost／127.0.0.1 改变都会产生不同 origin，IndexedDB 不互通；先导出 JSON 备份，再在目标地址导入并保存。不要用清除浏览器数据的方法修复案件问题。[origin 与存储说明](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

## 固定输入与检查

共享单例为 caseId EXAMPLE-01、evaluationId T09；业务批准范围见[确认表](../product/examples/BASELINE_CONFIRMATION.md)及[批准基准](../product/examples/APPROVED_BASELINE.md)。data/business/ 当前批准包由 GET /api/business 提供，工作台业务基准卡只展示批准状态、岗位及三条指引；不会自动执行完整业务流程。十个固定状态由 shared/fixtures.ts 产生并写入 data/fixtures/；所有状态都是未批准 mock，岗位停用。页面提供状态选择、保存／恢复、JSON 备份／导入、模拟审核及基础输出，细节以实际页面与组件属性为准。

成员仅运行本卡要求的检查，不要整体执行本文所有代码块。下列为可选检查入口；Windows将npm写为npm.cmd，浏览器检查前先按卡片运行npm run build：

```sh
npm run check
npm run check:business
npm run check:browser -- evidence/task-results/RUNBOOK/manual-01
```

check:business 校验批准包、原文来源、哈希、岗位／指引引用和单例参考，不执行真实模型或业务端到端验收。

check 执行类型检查和核心／服务程序测试，包含本地假 OpenAI 兼容服务，不连接真实 MiMo。check:browser 是真实浏览器基座检查，需 Chromium 和已构建 dist；它自行启动 mock 临时回环服务并关闭，无需事先 npm start，不使用日常浏览器保存空间。运行细节以tests/browser-check.ts为准。卡内使用本卡目录；独立手工执行示例使用RUNBOOK/manual-01，重复执行先改为新的批次目录，不覆盖原证据。

### A维护专用：重建公共文件

以下命令会重写schema与固定模拟数据，不是安装或启动所需步骤。仅A在实际修改共享定义后执行并检查差异；B–F不因运行原型而执行：

```sh
npm run schemas
npm run fixtures
```

### 资料检查（按任务需要）

资料检查另行执行，Windows 用 python，macOS 通常用 python3（需自行准备 Python）：

```sh
python scripts/maintenance/check_preparation.py
python scripts/maintenance/check_repository.py
git diff --check
```

Python 检查只验证来源和仓库资料，不代替 npm 检查或业务验收。完整 T01–T15、正式业务工作流、真实模型、macOS／第二台电脑运行均不能据基座检查通过推定完成。

## 可核对的开发检查

先打开工作台并等待本地历史读取完成。下表每次“选择某状态”都指：在 Fixed training state 下拉框选定名称，再点击 Load training state，等提示 Loaded and saved… 出现后继续；只改变下拉选项不会切换案件。每一行从指定状态独立开始，加载会替换当前页面单例；需要保留当前记录时先下载 JSON 备份。

| 输入与步骤 | 预期 |
|---|---|
| 选择 intake，再更正金额为 200 并保存；刷新／恢复 | 当前金额及更正历史保持；只有保存事务完成才显示已保存 |
| 选择 partial | 同轮三问中一问已答、两问待答；不伪造下一轮 |
| 选择 stopped | 保留三问及停止状态；后补回答不重开补问 |
| 选择 reviewed，选 SUMMARY，预览／复制／下载 Markdown／PDF | 使用同一对象及版本，保留 SYNTHETIC／MOCK／未批准标记；模拟审核不等于业务批准 |
| 选择 stale 或 save-error 后尝试输出 | 不得把过期审核或未保存状态当作可导出快照 |
| 选择 reviewed 并加载，勾选 Simulate output failure，依次复制／下载 Markdown／PDF，再取消勾选重试 | 三种失败均显示错误，原预览、审核与正文保留；取消后可输出同一版本 |
| mock 中触发 timeout／invalid／delayed | 错误可见，输入和已有结果保留；旧结果不能覆盖新状态；不调用外部模型 |
| 导出 JSON 后导入，再保存 | 校验备份格式，恢复完整单例；未保存前不输出，错误备份保留当前案件 |

上述状态均需在 Fixed training state 选择后点击 Load training state。更正使用 Correct TX-01 amount to AUD 200；故障按钮为 Simulate timeout、Simulate invalid output、Delayed response；保存故障勾选 Simulate next save failure 后更正，取消勾选再 Retry save；备份使用 Download JSON backup／Restore training JSON。模型返回只供对照，不自动合并，也不生成新补问。输出当前为纯文本 body 模板，复杂 Markdown 表格样式尚未实现。这些预期只适用于公共基座。PDF 成功生成后还需逐页检查字体、换行和页边界。安装 Chromium 失败时记录 PDF 未执行，不能用 Markdown 成功代替 PDF 验证。

## 常见失败

依赖／下载失败先记录网络和错误；MODEL_NOT_CONFIGURED 表示本地配置缺项；MODEL_INVALID_OUTPUT 表示返回结构或来源不合格；MODEL_TIMEOUT 不算成功；PDF_UNAVAILABLE 要检查本机 Chromium。导出 409 时先处理当前事实、保存及模拟审核，不能删校验绕过。IndexedDB 不可用或保存失败时保留当前页面和输入，尝试 JSON 备份并交 A 处理。

任务内浏览器检查使用独立输出目录，例如 `npm run check:browser -- evidence/task-results/F01/run-01/browser`（Windows用npm.cmd）。目录须位于项目evidence内，检查完成会写入该目录，不覆盖evidence/preparation的基座证据；无参数命令只供A维护基座证据，成员不执行；任何复测先选新的批次目录。任务卡已给出各自目录，执行结果只在对应卡记录。

## A01 四模块公共起点

工作包 `A01-20261017-01` 使用同一完整源码副本（包括未提交的新文件），实际包及哈希见[A01执行记录](../project/tasks/A01.md#唯一执行记录)。不要只发当前远端链接。依赖沿用现有锁文件与Node 24，不重新选技术。

根目录运行 `npm run dev`，分别打开 `http://127.0.0.1:5173/?module=intake`、`/?module=model`、`/?module=guidance`、`/?module=outputs`；构建运行仍是 `npm run build` 后 `npm start`，地址改为4310。四个页面各自可启动，当前业务模块未安装，显示可操作MOCK substitute。

Fixed runtime variant选T09／corrected／stale／partial／unknown／limit／stopped／rejected／role-stale／guidance-stale／no-guidance／single-edit／save-error／output-error后点Reset fixed input。重置不删已保存案件；有未保存修改时使用Save and continue、Discard changes and continue或Cancel。点Save runtime case成功后才为Saved，刷新恢复该模块最近成功保存的案；Saved case可列出和打开其他案。备份用Download runtime backup／Import runtime backup，格式v2；未保存时禁止导入，同号先确认。

PDF操作：选no-guidance，Reset fixed input，Save runtime case，再Download MOCK pdf或Open MOCK PDF；均为实际本机Chromium生成文件。无指引仅摘要可用。选output-error默认模拟输出失败，失败后取消Simulate output failure即可同版本重试。mock服务不会连接提供商，即使机器已有真实API设置。浏览器内置PDF查看器不是普通网页；自动化记录弹出窗口及PDF文件，并使用Poppler渲染逐页观察，不能根据网页load事件推断文件损坏。

```sh
npm run check
npm run check:business
npm run build
npm run check:module -- intake evidence/task-results/A01/manual-01/intake
npm run check:module -- model evidence/task-results/A01/manual-01/model
npm run check:module -- guidance evidence/task-results/A01/manual-01/guidance
npm run check:module -- outputs evidence/task-results/A01/manual-01/outputs
```

Windows使用npm.cmd；复测使用新目录，不能覆盖既有result.json。四模块检查自行启动独立临时mock服务，无需另开npm start。检查公共MOCK控件、重置、保存恢复、备份、迟到请求、失败与PDF，不等于B/C/D/E业务通过。真实模块入口、props、服务注册与依赖约定见[MODULE_CONTRACTS](MODULE_CONTRACTS.md)。不需要API密钥；真实模型、macOS及第二电脑未执行。
