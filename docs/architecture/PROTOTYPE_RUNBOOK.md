# 四模块测试原型操作说明

2026-11-05，分支为integration/test-fixes。B案件与补问、C分析、D建议及E审核输出共用同一个运行案件，主入口为根页面。

## 启动

Windows在项目根目录执行npm.cmd run dev，打开http://127.0.0.1:5173/。macOS使用npm run dev。本机已有依赖，新电脑按[基础运行说明](RUNBOOK.md)安装Node 24、npm依赖及Playwright Chromium。另一启动方式为npm.cmd run build后npm.cmd start，服务端页面位于http://127.0.0.1:4310/。

默认使用Mock，输入保持固定T09合成叙述。其他自由叙述的模型效果由人类在API设置中配置并主动调用后另行验证。设置保存本身不会发出模型请求。四个独立入口仍为/?module=intake、model、guidance、outputs，旧基座在/?view=foundation。

## 五阶段 T09 主线

1. 根页面打开Local cases and backup，新建合成案件或打开历史案件。确认机构、岗位，统一填写合成标识SYN-DEMO并Confirm working context。旧案件保留，不通过重置覆盖历史测试案。输入支持中英文，Mock仍使用T09固定叙述，点击Analyze current description。
2. Continue to Check information，在Transaction 1 · Amount更正200并Apply，点击Complete first fact check。首次核对仍保留训练simulated标记。来源、内部引用和更正历史可展开。
3. Continue to Add information，Save and display proposed questions，Q1填reported pending并更新目标，Q2选择Unknown / unable to answer，End follow-up结束。当前交易状态及分析缺口应一致，保持1轮3问及跳过记录。
4. Continue to Prepare materials集中更新建议及文稿。核对建议，Accept/Modify/Reject suggestion逐条记录决定。继续到下一阶段时会协调刷新当前材料。接受仅记录本地准备选择。Employee-edited稿不会静默覆盖，需要时点击Update documents / compare employee edits，比较并保留或填写理由明确替换。
5. Continue to Review and export，核对可读事实、类型、缺口、所选文稿全文及引用建议。勾选本次文件与一次明确确认，Review selected documents and recommendations会按对象记录审核。顶部Save case成功后，选择Document to inspect or export，复制及下载Markdown/PDF。保存状态与审核状态分别展示。

## 无有效指引及诊断入口

独立Test workspace入口为/?test=1。测试控件位于Test controls and local case management，保留固定变体、保存／输出失败、备份和独立模块入口。阶段4可Suspend guidance，进入阶段5只审核事实摘要，保留Insufficient approved guidance; human review required。历史接收方稿仍可查看，失去导出资格。故障和固定变体结果必须单独标注，不能当作正常输入分析结果。

## 修改、保护与恢复

- 统一员工标识随案件保存，刷新恢复后在阶段1确认工作上下文，再返回相应阶段。刷新只恢复已保存状态。
- 阶段2更正250后Confirm changes to checked facts，再进入材料阶段协调更新，相关文稿需重新审核。旧审核历史保留。
- 拒绝建议必须填写理由，重算继续保留拒绝，更新正文后该项不作为待执行内容。无关稿件的审核按既有依赖保留。
- 阶段4Edit body输入后先填理由并Record edit或Discard working edit。未记录正文阻止保存、切案及导航，刷新关闭提示继续保留。
- 旧案件恢复时若存在已解决却残留的结构化缺口，协调当前分析并标未保存，受影响输出更新后重审。原叙述与历史不改写。
- 模拟输出失败保留正文、审核及有效预览，取消故障后可重试同版本。真实模型仍须员工主动操作，本轮验证默认Mock。

## 历史验证（本轮结果另记）

Windows、Node v24.15.0、Chromium 156.0.8078.4。89项自动检查全部通过，包含B/C/D/E实际浏览器；完整主页面5组流程、原宿主7组及outputs公共11组通过。命令、失败批次和PDF检查见[集成记录](../project/INTEGRATION_TEST_FIXES.md)的2026-11-05批次。

当前可开始合成T09与无指引两条完整流程的人工测试。训练首次核对、自动化测试的最终审核事件与人类产品验收分别记录；真实模型效果、F独立验收、完整15例、macOS和第二电脑仍待验证。
