# 四模块测试原型操作说明

2026-11-05，分支为integration/test-fixes。B案件与补问、C分析、D建议及E审核输出共用同一个运行案件，主入口为根页面。

## 启动

Windows在项目根目录执行npm.cmd run dev，打开http://127.0.0.1:5173/。macOS使用npm run dev。本机已有依赖，新电脑按[基础运行说明](RUNBOOK.md)安装Node 24、npm依赖及Playwright Chromium。另一启动方式为npm.cmd run build后npm.cmd start，服务端页面位于http://127.0.0.1:4310/。

默认使用Mock，输入保持固定T09合成叙述。其他自由叙述的模型效果由人类在API设置中配置并主动调用后另行验证。设置保存本身不会发出模型请求。四个独立入口仍为/?module=intake、model、guidance、outputs，旧基座在/?view=foundation。

## T09主线

1. 新浏览器会话自动显示T09种子。已有历史时，选择Fixed runtime variant中的T09并Reset fixed input，按未保存提示保存或放弃后继续。使用B的Analyze current description，等待Analysis proposal received。
2. 在Facts表找到E04 / TX-01，将金额更正为200并Apply，再点Complete first fact check。该训练首次核对保留simulated=true标记。重新分析原叙述可展示2000冲突候选，当前人工200继续保留。
3. 点Save and display proposed questions。Q1输入reported pending并Save answer and update target，Q2选Unknown / unable to answer，剩余Q3可用End follow-up标为跳过。观察仍为1轮3问，保存失败不计数，已显示问题的重试不重复计数。
4. 在D填写合成测试标识SYN-DEMO，Recalculate guidance，核对EX-G01–03、事实与来源。逐条Accept或填写理由后Modify／Reject。接受仅记录选择，外部动作仍由人处理。
5. 在E填写同一合成测试标识，Generate / refresh E outputs。生成SUMMARY、HANDOVER-BANK及HANDOVER-TELCO，初始均待最终审核。
6. 每次点击Final review之前，勾选I checked the current facts复选框。先审核实际引用且接受／修改的建议，再用E draft selection分别选择摘要、银行稿、电信稿审核。拒绝的建议不作为待执行动作进入正文。
7. Save E case成功后，选定对象的有效预览、Copy E Markdown、Download E markdown与Download E pdf可用。复制及双格式使用同一对象快照。刷新应恢复保存的事实、补问计数、建议、正文和审核。

## 无有效指引

在D点击Suspend guidance，再在E生成／更新输出并选择SUMMARY。摘要应保留Insufficient approved guidance; human review required，且无具体机构路径和待执行建议。核对当前事实后，只审核当前摘要并Save E case即可预览、复制及下载。历史接收方稿保留供核对，其导出资格失效。

## 修改、保护及故障

- 编辑正文时先填写Edit reason并Record edit，或Discard working edit。未记录的工作文本会阻止公共保存、新建、重置、打开、导入及页面导航；刷新／关闭页面触发浏览器离开确认。
- 仅改银行稿时，银行稿需重审，其他无依赖变化的稿件保留审核。重新生成遇到员工稿会展示比较，明确选择保留或填写理由后替换，历史保留旧正文。
- B在首次核对后更正共用金额250，需要Confirm changes to checked facts，再D重算、E更新及相关对象重审。旧稿不能凭旧审核导出。
- D拒绝REC-03后重算继续保留拒绝，E更新电信稿时移除该待执行动作。银行稿的无关审核保持。
- Simulate save failure用于检查保存失败后仍保留输入与重试。Simulate output failure用于检查503后正文及有效审核保持，取消故障后可重试同一版本。
- 主页面折叠的Diagnostic MOCK controls只用于公共底座故障与固定变体检查。业务验证使用上方B/C/D/E控件。

## 本次实际验证

Windows、Node v24.15.0、Chromium 156.0.8078.4。89项自动检查全部通过，包含B/C/D/E实际浏览器；完整主页面5组流程、原宿主7组及outputs公共11组通过。命令、失败批次和PDF检查见[集成记录](../project/INTEGRATION_TEST_FIXES.md)的2026-11-05批次。

当前可开始合成T09与无指引两条完整流程的人工测试。训练首次核对、自动化测试的最终审核事件与人类产品验收分别记录；真实模型效果、F独立验收、完整15例、macOS和第二电脑仍待验证。
