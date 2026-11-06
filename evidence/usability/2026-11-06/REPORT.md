# ScamSafe 易用性修复与整合

## 基线与保全

悉尼日期2026-11-06，工作目录为D:/BaiduSyncdisk/UNSW/INFS5706/GroupAssignment-integration。实际分支integration/test-fixes，开工SHA为5393f7b6d61779bae3d58daa2d2b5b172c3eaf6d。开工未提交内容为docs/project/tasks/F01.md及evidence/task-results/F01/，本轮未编辑该任务卡及旧证据。所有实现留在工作区，没有提交、推送、合并或部署。

本轮由主agent负责宿主、共享契约、文档和整合。三个实现子agent分别负责事实／补问、建议决定、材料／最终审核／导出。建议子agent随后执行跨模块独立自动复测，另一个未参与实现的子agent执行独立computer-use。模块自检与整体结果分开记录。

## 修复约定与实现

- 五阶段为Record case、Check information、Add information、Prepare materials、Review and export。导航显示当前任务与完成状态，组件持续挂载保留输入。
- 开始与打开案件时确认配置中的机构、岗位和合成员工标识，统一标识随案件保存，建议决定与最终审核复用。主页面单一Save case入口显示实际事务结果。
- 普通主界面只展示业务流程，本地案件及备份可展开。/?test=1保留固定变体、故障、独立模块、模型设置及JSON诊断，默认Mock。原有工作数据及案件历史保留。
- shared/presentation.ts统一字段、记录、建议、指引及文件业务名称。正文、剪贴板、Markdown及PDF使用同一可读输出快照，来源原文与历史保持。
- 进入材料／审核阶段集中协调确定性建议重算与文稿生成，不自动发起模型请求。已拒绝决定保留并从待执行正文排除，员工稿保护、比较／保留／明确替换继续使用既有逻辑。
- 最终审核展示可读事实、类型、缺口、勾选文件全文及引用建议。一次明确确认在临时副本逐建议、逐文件记录，全部成功才应用，无部分审核发布。保存、待审核、审核有效及变化需重审分别呈现。

## F01-001 根因与修复

answerRuntimeQuestion原先只改fact，analysis.gaps仍来自旧分析。currentAnalysisGaps及reconcileAnalysisGaps按当前字段／记录的缺失和冲突状态协调结构化缺口，实质变化递增analysis版本，旧输出与审核按依赖失效。回答、更正及合并分析接入协调，load/open/import兼容旧案。原始叙述、旧回答来源、问题ID、计数、更正与审核历史均保留。

独立复测另发现固定已核对输入直接生成、审核再刷新时才协调旧缺口，导致刚审核对象失效。regenerateOutputs入口现先协调再绑定生成依赖，避免刷新额外变化。可读名称正则也加边界，防止EX-G01中的G01被当事实字段替换。两处均增加针对性回归。

## 技术检查

| 检查 | 本轮实际结果 | 证据 |
| --- | --- | --- |
| npm.cmd run check | run-02为89通过、0失败、2个opt-in浏览器跳过，后续最终全套另记 | main/check-run-02.txt |
| C01_BROWSER实际模块回归 | 12/12通过，Mock及本地假提供商，非真实模型 | main/model-run-01.txt |
| E01_BROWSER实际模块回归 | run-01发现固定输入刷新失效，修复后run-02为13/13通过 | main/outputs-browser-run-01.txt、outputs-browser-run-02.txt |
| B01_BROWSER双入口回归 | 10/10通过，无provider请求和页面异常 | ../task-results/B01/usability-20261106/run-08/browser/ |
| 独立五阶段自动复测 | 最终结果待下方收录，正常流程与诊断固定状态分别标识 | independent-auto/ |
| 文档／来源维护 | passed，errors为空，仅文档与来源检查 | main/repository-run-01.txt |
| 批准业务数据检查 | 结构、hash及引用通过，不表示测试验收 | main/business-run-01.txt |

main/check-run-01为受限环境回环端口失败并中断的记录，未计为产品失败或通过，允许本机回环后使用新run-02。各模块及独立自动复测的早批失败与时序修正保留原记录。

## PDF 文件检查

输出模块自动浏览器run-02实际下载summary、中文长表、同版本重试、无指引PDF，分别4、5、5、3页。main/pdf-render-run-01保留全部页图、拼图及文本。主agent视觉检查摘要4页、中文长表5页、无指引3页，未见明显裁切或缺字，中文及末尾E01-END存在。该批发现guideline token名称替换边界问题，最终修复后重新导出渲染结果另记。这里的样本为自动浏览器文件，与computer-use实际下载分开。

## 独立 computer-use

执行中，实际逐步记录、截图及导出副本位于computer-use/run-01。最终结果以下方及该目录REPORT为准，不能用上述自动检查替代。

## 范围边界

默认Mock，只使用合成案例与员工标识。没有读取、填写、清除真实密钥，没有真实模型验证或人类产品验收。完整十五例、其他操作系统及多电脑验证继续保持未验证。本轮不扩展生产认证、权限平台、部署或外部发送。
