# F01 独立 computer-use 执行报告 · run-01

## 批次与结论

测试日期为悉尼时间 2026-11-06。原始 UI 日志保留 UTC 时间 2026-11-05T13:13:23.455Z 至 13:29:09.167Z。本批次按用户“对现在工作直接进行收尾”结束新增测试，交付已执行部分及未验证清单。报告由 computer-use agent 执行和整理，未取得人类产品验收。

T09 从初始叙述实际分析、更正、首次核对、补问、建议决定、逐对象最终审核、保存和导出已走通。无有效指引路径的摘要生成、单独审核、保存和导出已走通。两者均不构成完整通过，存在 F01-001，且输出内容校验和关键边界覆盖尚未完成。当前不适合宣布 F01 全部通过或无条件演示就绪。未验证的更正保护、保存失败、未记录正文保护、权限与恢复等仍是交付验收缺口。

## 环境与边界

- 仓库位于 `D:\BaiduSyncdisk\UNSW\INFS5706\GroupAssignment-integration`，分支 `integration/test-fixes`，实际 SHA `5393f7b6d61779bae3d58daa2d2b5b172c3eaf6d`，与预期基线一致。历史最新提交为 `integrate: connect E01 reviewed outputs to the shared prototype`。
- 本机报告 Windows NT 10.0.26200.0，Node v24.15.0。使用系统默认豆包浏览器，浏览器版本未核实。入口 `http://127.0.0.1:5173/` 已可用，沿用已有服务。
- 初始 Edge 尝试未形成产品操作。用户指定默认浏览器后，本批次产品操作均在豆包浏览器进行。
- UI 显示 Mock、No API key saved，分析显示 provider called false。未更改模型设置。合成案件为界面初始 T09 案件 EXAMPLE-01，审核及决定标识为 SYN-F01-AGENT。
- 已读 AGENTS、STATUS、F01、PROTOTYPE_RUNBOOK、RUNBOOK、最新整合记录、T09 与 prototype 评估数据，需要规则时读取 PRD 对应部分。预期来自测试前已读要求，逐项记录在本收尾报告中整理。
- Windows 操作使用当前 computer-use 技能支持的 `@oai/sky`，点击、输入、选择和观察均经实际界面。终端仅用于仓库核对、证据整理及已下载文件检查。未运行本轮自动应用检查。
- 修改范围限本报告所在新证据目录及 F01 唯一执行记录。保留已有工作和案件数据。没有自动提交、推送或部署。

## 逐项实际记录

以下证据文件均位于本目录，完整输入、点击后状态和时间见 `ui-log.json`。截图名中的序号是观察顺序，不能当作测试项数量。

| 编号及前置 | 实际输入与点击 | 测试前预期 | 实际观察与判断 | 证据 |
|---|---|---|---|---|
| T01 初始 T09、Mock | 点击 B Analyze current description | 实际形成分析提案，问题展示前不计数 | 提案返回，provider called false。通过本断言 | 001、002 截图 |
| T02 已有提案 | E04/TX-01 输入 200，Apply，Complete first fact check | 当前值200、首次核对记入 | 200 corrected，保留原2000及来源历史，首次核对记录成功。使用界面默认理由 Caller clarification。通过 | 004、007 |
| T03 首次核对后 | Save and display proposed questions | 1轮3问 | 显示1/3轮、3/9问。通过 | 009 |
| T04 当前第1轮 | Q1输入 reported pending，Save answer and update target | 更新E09及Q1来源，未答仍在本轮 | E09 checked、来源Q1，Q2/Q3仍待答。通过更新断言，派生缺口另见F01-001 | 012、031及日志 |
| T05 同一轮 | Q2 Unknown / unable to answer，再 End follow-up | Q2保留缺口，剩余跳过，计数保持 | Q2 unknown，Q3 skipped，补问停止，仍1/3轮、3/9问。通过 | 014、015 |
| T06 案件版本8 | D输入SYN-F01-AGENT，Recalculate guidance，展开权限，依次Accept REC-01/02/03 | 可追踪来源、版本、权限及决定 | EX-G01至03 v1、局部草稿权限和禁止外部执行边界可见，三条接受决定v2及标识保留。通过已观察断言 | 019、020、021、023、025及日志 |
| T07 已有接受决定 | E输入同标识，Generate/refresh，展开检查清单 | 生成摘要与银行、电信稿 | SUMMARY、HANDOVER-BANK、HANDOVER-TELCO均v1。事实200、Q1来源和未知项可见。失败于F01-001 | 029、031及下载MD |
| T08 三对象v1 | 每次明确勾选确认，先分别审核REC-01/02/03，再分别审核摘要、银行稿、电信稿 | 每次审核绑定当前对象版本，独立确认 | 六次合成审核实际完成，复选框每次重置，最终预览可用。通过界面流程 | 034至057及日志 |
| T09 审核完成 | Save E case，查看预览，Copy E Markdown，下载MD/PDF | 保存后导出当前对象版本 | case19保存，电信稿v1复制提示成功并下载双格式。摘要v1、银行v1随后也下载双格式。复制内容未独立粘贴核对。部分通过 | 061至069、074至080，六个v1文件 |
| T10 case19已保存 | Ctrl+R刷新 | 恢复事实、计数、决定、正文和审核 | 200、Q1回答、Q2未知、Q3跳过、计数、决定和原审核时间恢复。输入标识框为空，记录中的标识保留。通过所列恢复断言 | 071、072及日志 |
| T11 case19 | 产品入口Download runtime backup | 得到本案JSON备份 | EXAMPLE-01_runtime.json实际下载并归档。仅导出通过，未验证导入 | 073、备份文件 |
| T12 已恢复案件 | REC-03理由填入“SYN-F01: Duplicate SMS summary; both handover drafts already retain the clues.”，Reject，D重算，E更新，Save E case | 拒绝保留，电信稿移除动作，关联审核失效，无关银行审核保持 | REC-03 v3 rejected及历史保留。case21银行v1原审核有效，电信v2需重新审核，正文Proposed local preparation只保留REC-02。通过所列断言；拒绝后的刷新恢复未执行 | 083、084、085、088、090、092及日志 |
| T13 case21 | Suspend guidance，E生成，选SUMMARY，明确勾选后只审核SUMMARY，Save E case，复制及下载双格式 | 固定不足提示、仅事实摘要，无须接受不存在建议 | case24 SUMMARYv3可导出，正文含 Insufficient approved guidance; human review required，无新接收方稿及具体建议路径。旧稿显示需更新/失效，但未实际选旧稿尝试导出。部分通过 | 094至106、summary_v3.md/pdf |
| T14 case24有效摘要 | 勾选Simulate output failure，点击Download E PDF | 失败保留正文与有效审核，可关闭故障后同版本重试 | 显示EXPORT_FAILED与Body and reviews retained，预览仍case24/SUMMARYv3及原审核。保留断言通过；关闭后重试未完成 | 108、110、111、112 |

## 关键边界覆盖清单

| 用户要求 | 本轮结论 |
|---|---|
| 1 人工更正保护及Delayed MOCK | 未验证。200首次更正已执行，重新分析冲突保护、等待时改250的诊断均未执行 |
| 2 保存失败与重试 | 未验证。未勾选Simulate save failure，不能推断首次核对或补问失败计数行为 |
| 3 补问状态 | 部分通过。部分回答留轮、Unknown、结束跳过和计数已观察。结束后后补答案同ID、旧来源和历史未验证 |
| 4 拒绝传播 | 部分通过。拒绝、重算、保存、E电信移除及银行审核保持已观察。拒绝后的刷新未验证 |
| 5 单稿编辑与重生成 | 未验证。未进行Record edit、比较、保留或明确替换 |
| 6 共用事实改250 | 未验证。未进行最终审核后的250变更、旧稿阻断及重新审核流程 |
| 7 未记录正文保护 | 未验证。未输入未记录工作正文，未逐一尝试保存、新建、重置、打开、导入、导航或刷新关闭提示 |
| 8 无有效指引 | 部分通过。摘要生成、独立审核、保存和下载走通。历史稿实际导出阻断、该PDF内容未验证 |
| 9 输出失败 | 部分通过。PDF失败提示、正文及审核保留已观察。取消故障重试、剪贴板/MD/PDF逐字一致未验证 |
| 10 恢复与隔离 | 部分通过。case19保存刷新恢复及JSON导出完成。切案三分支、失败留原案、坏JSON和同号取消未验证 |
| 11 权限、错误和上限 | 未验证。只查看默认权限说明，未限制岗位。timeout、invalid、limit固定变体均未执行，未交互累计3轮9问 |

尚未执行项因用户要求收尾而结束。本批次没有新增环境权限阻塞测试项。收尾清理有窗口不可用情况，见下文。

## 缺陷清单

### F01-001 · 中影响 · 当前事实与候选分析缺口不一致

- 可能所属模块为 B/C 更新分析派生状态的衔接，以及 E 对该状态的输出。归属待 A 定位，未修改实现。
- 最短复现从T09初始叙述开始，Analyze，金额改200并完成首次核对，保存显示补问，Q1输入reported pending并更新目标事实，D重算及接受建议，E生成摘要/交接稿。
- 预期为E09已由Q1回答后，当前未解决缺口清单与当前事实保持一致。若保留旧分析快照，应明确其历史性质。
- 实际为当前事实表显示 `E09:TX-01 | reported pending | extracted / checked | Q1`，同一当前输出的Candidate analysis仍列 `Gap: Unresolved E09:TX-01`。正文的Unresolved information段已不含E09，因此同一输出的两处缺口口径也不一致。
- 影响为审核者和接收方可能继续把已回答信息当作当前缺口。金额200正确，源叙述中的2000作为历史原文仍保留，该历史保留本身未判为缺陷。
- 首次失败保留在031观察及ui-log.json，导出 `EXAMPLE-01_SUMMARY_v1.md`、`EXAMPLE-01_HANDOVER-TELCO_v1.md`，PDF电信稿第2页及 `telco-page-2.png`。case19刷新后仍出现，后来无指引summary_v3.md也出现。
- 没有用重试覆盖首次失败。后续自然流程中的复现作为持续观察，未进行独立重试或修复验证。

## 下载与PDF核验

- `EXAMPLE-01_SUMMARY_v1.md/.pdf`、`EXAMPLE-01_HANDOVER-BANK_v1.md/.pdf`、`EXAMPLE-01_HANDOVER-TELCO_v1.md/.pdf`为产品UI下载文件的本目录副本。
- `EXAMPLE-01_summary_v3.md/.pdf`为无指引摘要。`EXAMPLE-01_runtime.json`为case19时经产品入口导出的备份。
- 电信v1 PDF经浏览器下载列表实际打开，看到4页，截图068、069。再用本地工具渲染全部4页并逐页视觉查看，见telco-page-1.png至4.png及telco-pdf-text.txt。观察到表格、分页与末页正文，未发现明显裁切。其包含的F01-001如实保留。
- 该样本没有中文正文，中文字体与中文表格未验证。摘要v1、银行v1及无指引v3 PDF未实际打开检查，不能仅凭下载成功认定内容正确。全文件逐字一致性及剪贴板内容未验证。
- MD已核对当前金额200、对象/版本、S3与Q1来源、未知项、历史更正及SYN-F01-AGENT合成审核标识。原文和历史中的2000应与当前值区分阅读。

## 收尾状态与证据索引

UI最后保存状态为EXAMPLE-01 case24、金额200、Suspend guidance、已审核SUMMARYv3。其后仅启用运行时输出失败模拟并触发失败。收尾尝试取消模拟时，原测试窗口不可用，工具报foreground window did not report a process id。重新列窗口后原测试窗口已不在列表，故未操作用户当前其他浏览器页面。无法确认模拟开关是否已清除，后续继续测试时应先通过界面检查该开关。该工具/窗口问题没有记作产品缺陷。

截图均来自实际测试UI。`telco-page-*.png`是UI下载PDF的本地渲染，明确区别于浏览器截图。ui-log.json包含完整界面观察，附带浏览器自身界面文本。所有原始首次失败和中间截图均保留。

本批次实际修改为F01任务卡唯一执行记录与本run-01新目录。先前89项自动检查属于仓库历史证据。本轮没有以其充当computer-use结果，没有执行诊断Mock固定变体，没有真实模型测试，没有人类验收，也未覆盖完整T01–T15或其他系统。

收尾运行 python scripts/maintenance/check_repository.py，结果passed，errors为空。该检查仅覆盖仓库文档和来源保全，未计为产品测试。Git复核仅F01.md及新证据目录有变化。
