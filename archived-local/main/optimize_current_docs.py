from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
def read(n): return (ROOT/n).read_text(encoding='utf-8-sig')
def write(n,s):
    p=ROOT/n; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(s.rstrip()+'\n',encoding='utf-8')
def replace(n,a,b):
    s=read(n); assert a in s,(n,a[:70]); write(n,s.replace(a,b))

write('docs/README.md','''# 文档导航

成员先读[AGENTS](../AGENTS.md)、[当前状态](project/STATUS.md)和A已指派的一张[任务卡](project/TASKS.md)，只读卡中指定条款。没有任务或工作包未填完整时，交A确认，不从目录中自行找工作。

| 需要查什么 | 唯一入口 | 默认读者 |
|---|---|---|
| 产品行为 | [PRD](product/PRD.md) | A；成员只读卡内条款 |
| 字段含义 | [字段字典](product/FIELD_DICTIONARY.md) | 按字段查阅 |
| 当前批准内容与单例 | [批准基准](product/examples/APPROVED_BASELINE.md)、[实际业务包](../data/business/README.md) | 内容任务及A |
| 当前实现和缺项 | [STATUS](project/STATUS.md) | 全员 |
| 责任与协作 | [团队规则](project/TEAM_EXECUTION.md) | 首次参与／按需 |
| 当前任务及依赖 | [TASKS](project/TASKS.md) | A指派；成员只读自己的卡 |
| 工作包准备 | [WORK_PACKAGE](project/WORK_PACKAGE.md) | A |
| 文件交付 | [CONTRIBUTING](../CONTRIBUTING.md) | 成员 |
| 启动与失败处理 | [RUNBOOK](architecture/RUNBOOK.md) | 实际运行时 |
| 实际接口 | [CONTRACTS](architecture/CONTRACTS.md) | A；成员仅按卡查 |
| 检查覆盖 | [tests/README](../tests/README.md) | A编制操作表；F按已填步骤执行 |
| 实际证据 | [evidence](../evidence/README.md) | 按任务与批次查 |

方案取舍、就绪盘点、来源快照和复核报告按需查阅，不作为成员默认必读，不维护第二套任务或产品规则。PRD定义目标，STATUS记录实际实现，两者不能互相代替。
''')
write('docs/product/WORKSPACE_LAYOUT.md','''# 工作台布局说明

当前产品交互规则见[PRD第5节](PRD.md#5-同屏双栏交互)。当前实现见[STATUS](../project/STATUS.md)，实际启动和固定状态操作见[RUNBOOK](../architecture/RUNBOOK.md)。

A06负责接通最小完整界面及事件绑定。B01调整固定状态的指定展示，B02在A06交付后调整运行事实区；只执行A已指派的[任务卡](../project/TASKS.md)。本文件不分配额外编辑或走查任务。
''')
write('docs/product/EXPORT_LAYOUT.md','''# 输出与排版说明

对象审核与输出规则见[PRD 4.4](PRD.md#44-审核与导出)，批准正文和条件见[批准基准](examples/APPROVED_BASELINE.md)，实际模板接口见[CONTRACTS](../architecture/CONTRACTS.md)。

E01只修改固定模拟输出排版；E02等待A06交付实际可操作页面后核对运行输出。成员仅按A已指派的[任务卡](../project/TASKS.md)修改。本文件不维护第二份正文或独立任务。

复制、Markdown、PDF采用同一选定对象快照。统一摘要可独立输出；当前接收方参考正文的装配范围以批准包与实际模板为准，不能自行拼接另一份摘要或新增正文。复杂Markdown表格当前未实现，不能把纯文本表格探针当作复杂排版通过。
''')
write('server/prompts/INTAKE_DRAFT.md','''# 分析提示入口

运行时唯一提示文件为[intake.txt](intake.txt)，适配器从该文件加载。职责和输出结构见[CONTRACTS](../../docs/architecture/CONTRACTS.md)，产品规则见[PRD](../../docs/product/PRD.md)。

C01只按当前结构核对提示；新增补问返回与程序控制由A02实现。成员只执行已指派的[任务卡](../../docs/project/TASKS.md)，不从本文件另领任务。固定输入与参考预期见[批准包](../../data/business/README.md)。
''')
write('data/README.md','''# 数据与配置入口

| 位置 | 当前用途 |
|---|---|
| [business/](business/README.md) | 当前已批准的有限合成岗位、指引和T09参考；唯一批准登记在此 |
| [fixtures/](fixtures/README.md) | 固定模拟状态；不作为真实员工审核 |
| [evaluation/](evaluation/README.md) | 固定验收输入与独立预期，执行证据不放这里 |
| [schemas/](schemas/README.md) | 从共享定义生成的结构；程序仍检查跨字段规则 |
| [roles/](roles/README.md)、[guidelines/](guidelines/README.md) | pending负向样例及当前业务包入口，不是有效配置加载位置 |

实际实现见[STATUS](../docs/project/STATUS.md)，当前任务见[TASKS](../docs/project/TASKS.md)。A维护结构与批准登记；成员只读取卡中列出的数据，不自行扩权限、刷新批准哈希或复制模型输出作为预期。
''')
write('data/roles/EXAMPLE_ROLE_DRAFT.md','''# 岗位内容入口

当前已批准的有限岗位与接收方见[business/role.json](../business/role.json)，范围见[批准基准](../../docs/product/examples/APPROVED_BASELINE.md)。example-role.pending.json仅供负向检查，不是当前配置。

当前内容核对仅按D01或D02已指派任务进行。来源原文及原哈希固定于[来源快照](../../evidence/preparation/source-snapshot/README.md)，本文件不再分配编辑任务。
''')
write('data/guidelines/EXAMPLE_GUIDELINES_DRAFT.md','''# 指引内容入口

当前有限条目EX-G01–03 v1见[business/guidelines.json](../business/guidelines.json)，批准登记见同目录approval.json；范围见[批准基准](../../docs/product/examples/APPROVED_BASELINE.md)。example-guidelines.pending.json仅供负向检查。

当前内容核对仅按D01或D02已指派任务进行。来源原文及原哈希固定于[来源快照](../../evidence/preparation/source-snapshot/README.md)，本文件不再分配编辑任务。
''')
write('data/evaluation/README.md','''# 固定合成评估集

15例范围与编号映射见[验收计划](../../tests/README.md)。当前只有T09有限批准参考，完整T01–T15由A07准备、D02核对，程序和模型结果另由C02／F02实际记录，不能据文件存在判为通过。

- 当前T09输入、回答、事实与正文预期：[批准业务包](../business/README.md)。
- [cases/](cases/README.md)、[expected/](expected/README.md)：可读输入／预期入口，完整套件建立后由A07更新索引。
- [baseline/](baseline/README.md)：固定来源及原哈希，保留pending来源身份，不是执行输入或批准登记。

A07交付suite.json、schema、受控配置及逐项审阅记录；D02按A填好的逐行表核对；F按A06实际入口执行。成员不自行设计案例、变体或标准答案。执行证据统一放evidence/task-results/任务号/批次/。
''')
write('data/evaluation/cases/T09.md','''# T09固定输入

评估编号T09，案件编号EXAMPLE-01，网络钓鱼缺失／冲突合成变体。当前固定原文、更正、Q1–Q3与两次回答位于[data/business/T09.json](../../business/T09.json)的input、correction、questions、answers。

可读流程见[当前示例](../../../docs/product/examples/WORKED_CASE.md)。固定主线为2000更正为200，先只答Q1，再将Q2/Q3回答未知／无法回答并主动结束，仍1轮3问。250属于另一旧响应或审核后更正变体，不与主线串接。

参考预期见[expected/T09](../expected/T09.md)。实际运行步骤由A06交付后按对应任务卡执行；本文件不是测试通过记录。
''')
write('data/evaluation/expected/T09.md','''# T09独立参考预期

当前获批参考在[data/business/T09.json](../../business/T09.json)的expectedFacts、recommendations、bodies、bodyConditions和expectedChecks；批准范围见[批准基准](../../../docs/product/examples/APPROVED_BASELINE.md)。

应核对：当前金额200及人工历史；交易状态据报待处理；09:30仅异常发现时间；未知收款对象／持续联系不填否或0；仅一轮三问；REC-03拒绝不删除事实；两份输出不宣称行动或发送已发生。无有效指引变体只形成事实摘要。

逐项执行表由A06/A07预填，D核对、F实际观察。不得从模型输出反推预期。原文快照见[来源说明](../baseline/README.md)，实际结果记录在对应任务证据中。
''')
write('data/evaluation/baseline/README.md','''# 固定来源包

[T09.source.json](T09.source.json)保留原始来源哈希、人工输入及参考正文；其approvals全部pending，仅记录来源身份，不是当前批准登记。

原始字节固定于[evidence/preparation/source-snapshot](../../../evidence/preparation/source-snapshot/README.md)，sourceSnapshots按原路径定位对应.txt。原sourceHashes不刷新，避免当前PRD正常编辑改变历史证据。片段与哈希检查读取固定快照，当前产品规则仍只读[PRD](../../../docs/product/PRD.md)。

运行python scripts/maintenance/check_preparation.py应返回passed，只证明固定来源未变。当前批准见[data/business](../../business/README.md)，不从来源包恢复案件或推定员工审核。
''')
write('evidence/preparation/source-snapshot/README.md','''# 固定来源证据

这里的.txt逐字保留文档优化前已登记的7份来源，文件夹层级仅用于原路径定位。不是当前规则、成员任务或有效配置，默认不阅读。

校验索引在[data/evaluation/baseline/T09.source.json](../../../data/evaluation/baseline/T09.source.json)：sourceHashes保留原SHA256，sourceSnapshots定位此处字节副本。先核验原哈希再复制，未重新生成批准或改变原记录。

当前规则见[PRD](../../../docs/product/PRD.md)，当前业务包见[data/business](../../../data/business/README.md)。固定来源检查与当前批准包检查分别执行，不互相代替。
''')

# Current worked example retains verbatim English inputs and bodies; only explanatory timing changes.
n='docs/product/examples/WORKED_CASE.md'
s=read(n)
s=re.sub(r'\*\*使用门槛：\*\*.*?(?=\n\n)', '**使用范围：**本例T09／EXAMPLE-01的有限业务内容已批准，当前登记和条件见[批准基准](APPROVED_BASELINE.md)及data/business/。本例说明输入、人工操作与参考输出，不是运行配置或员工实际审核记录。无有效适用指引的变体只走第4.1节事实摘要路径；有指引路径仍须员工实际核对。原始来源字节另存于evidence/preparation/source-snapshot/，不从其中领取任务。',s,count=1,flags=re.S)
s=s.replace('## 4. 拟审核的有限合成指引','## 4. 有限合成指引参考')
s=s.replace('本节仅演示“前述配置和指引日后获审核”的目标行为。当前仓库不得显示它们为已批准建议。','本节为当前批准内容的参考行为。业务内容批准不等于员工已接受建议、已完成最终审核或程序已实现；实际建议从data/business/加载并按当前事实匹配。')
s=s.replace('以当前未审核 EX-G 指引尝试生成建议','使用未审核EX-G指引的负向变体尝试生成建议')
s=s.replace('### 4.1 没有有效指引时的当前目标路径','### 4.1 没有有效指引时的事实摘要路径')
write(n,s)
replace('docs/product/examples/APPROVED_BASELINE.md','旧教学原文、起始稿、source 包和 pending JSON 保持来源及负向样例身份','固定来源快照、source包和pending JSON保持来源及负向样例身份；当前可读文档只说明现行规则和入口')
replace('docs/product/examples/BASELINE_CONFIRMATION.md','原始教学稿及 source 包保持原文，其中 pending 只说明来源材料，不代表当前批准状态','原始字节及原哈希固定在evidence/preparation/source-snapshot/和source包；其中pending只说明来源身份，不代表当前批准状态')
replace('data/business/README.md','原始 `*.pending.json` 和 `data/fixtures/` 保留为草稿／模拟测试材料','`*.pending.json`和data/fixtures/保留为负向／模拟测试材料，原来源字节保存在evidence/preparation/source-snapshot/')
replace('server/prompts/intake.txt','Analyze only reported facts, candidate scam types, uncertainty and evidence-linked questions.','Analyze only reported facts, candidate scam types and uncertainty. Follow-up question generation is outside this response schema.')
replace('server/prompts/intake.txt','Team approval of business content is pending.','Approved synthetic business configuration is handled by a separate application component; this analysis component does not match guidance or generate recommendations.')
replace('shared/source-text.ts','// Fixed unapproved teaching text copied from WORKED_CASE. Not runtime approval.','// Fixed reference text. Configuration approval and actual staff case review are separate application records.')

# User-confirmed prototype behavior: lightweight manual editing, three-way navigation, simple prompts.
n='docs/product/PRD.md'
s=read(n)
s=s.replace('具有事实和指引依据的紧急提示可在任何阶段展示，不等待表单完整。','风险关注提示仅使用固定合成案例和指引中明确的条件，不计算风险分数；有依据时可在首次核对前展示，但标为据报告、尚未核对，不等待表单完整。')
s=s.replace('### 4.4 审核与导出','''### 风险关注提示

原型只展示简单、可追溯的提醒，例如据报告远程连接仍在持续，请优先人工核实。正文使用英文，显示对应报告来源和合成指引，不自动判断现实危险等级，不执行账户、交易或设备操作。未首次核对的事实标为Reported — not yet checked；触发事实冲突或指引失效时，不继续显示原提示为有效，改为需人工核实。没有明确触发依据时不生成提示。具体有限条目随验收案例由A确定，不要求模型构建风险评分。

### 4.4 审核与导出''')
needle='摘要／草稿生成或重算不能静默覆盖员工已修改的内容；'
s=s.replace(needle,'''员工可修改建议和摘要／草稿正文。原型保留修改前内容及Employee edited标记，修改后按对象重新审核；不新增自由文本语义判定或逐句指引匹配拦截。人工新增文字不自动标为合成指引原文或已核实事实，也不自动改写共用事实。系统生成的建议仍遵守4.3的指引和岗位边界；编辑或审核不赋予程序实际操作、发送或转介能力。

'''+needle)
s=s.replace('## 5. 同屏双栏交互','''### 4.5 本地历史与JSON备份

支持新建、列出和打开本地合成案件，保存事实与来源、角色、问题与计数、建议决定、输出和审核版本。只在实际保存成功后显示已保存；刷新恢复的是该浏览器地址下已保存的内容，不能承诺恢复未保存修改。

| 操作或情况 | 确定结果 |
|---|---|
| 新建或切换案件时有未保存修改 | 提供Save and continue、Discard changes and continue、Cancel三个选项；取消留原案，放弃仅丢弃原案未保存变化 |
| 选择保存后继续 | 保存成功才新建／切换；失败保留原案和当前输入，不执行切换，允许重试 |
| 新建或切换时无未保存修改 | 进入所选或新建案件，事实、问答与审核不串案 |
| 下载JSON备份 | 包含本案数据及恢复所需版本，不包含模型配置和密钥；备份不等于已审核的对外交付 |
| 导入格式错误、不支持版本或引用不完整 | 清楚报错，保留当前案与已保存案；不部分覆盖 |
| 导入案件号与本地已有案相同 | 显示替换确认；取消不改变当前或已有案；确认后按正常保存结果处理 |
| 恢复／导入成功 | 检查对象依赖与审核是否仍有效，不能把模拟审核或过期审核变为有效员工审核；失败不宣称恢复成功 |

不同浏览器、地址或电脑不自动共享本地历史；使用JSON备份搬移。实际origin、大小限制和格式由运行说明及契约记录，不由成员自行修改。

## 5. 同屏双栏交互''')
write(n,s)
replace('docs/product/FIELD_DICTIONARY.md','派生；具体规则待定','派生；使用有限合成指引给出的提示或顺序，不计算风险分数')
replace('docs/product/FIELD_DICTIONARY.md','审核；具体制度待定','审核；仅记录员工填写的许可状态与说明，原型不验证真实机构制度或自动发送')

for name in ['docs/project/tasks/A03.md','docs/project/tasks/A04.md']:
    s=read(name)
    s=s.replace('## 固定检查与预期','人工修改采用PRD 4.4的轻量规则：保留原内容及Employee edited标记，修改后重新审核；不自行新增语义审查、自动风险评分或人工文字逐句指引拦截。系统生成建议仍遵守既有匹配规则。\n\n## 固定检查与预期')
    write(name,s)
replace('docs/project/tasks/A05.md','1. 扩展实际 IndexedDB cases 存储','1. 先按PRD 4.5实现未保存案件切换的保存后继续／放弃后继续／取消；保存失败留原案。扩展实际 IndexedDB cases 存储')
replace('docs/project/tasks/A05.md','| 两个不同案件保存并刷新 |','| 未保存时新建／切换，分别选择三个选项及触发保存失败 | 保存成功才继续；放弃仅丢未保存变化；取消或保存失败留原案 |\n| 两个不同案件保存并刷新 |')
replace('docs/project/tasks/A07.md','T10 明列持续远程访问紧急提示依据','T10明列持续远程访问的简单风险关注提示、报告来源及合成指引条件；未核对标记、依据冲突／失效也给固定预期，不计算风险分数')
replace('tests/README.md','实际结果放在 [evidence/test-results](../evidence/test-results/README.md)','实际结果统一放在evidence/task-results/任务编号/执行批次/；[test-results](../evidence/test-results/README.md)只作汇总入口')
replace('tests/README.md','执行结果和失败／复测证据在 [evidence/test-results](../evidence/test-results/)','执行结果和失败／复测证据在evidence/task-results/任务编号/执行批次/；[test-results](../evidence/test-results/README.md)只索引')
replace('tests/README.md','| T10 紧急提示 |','| T10 简单风险关注提示 |')
replace('tests/README.md','有依据的紧急提示及时展示，注明事实和指引','简单提示及时展示，注明报告来源和指引；未核对标为Reported — not yet checked，不计算风险分数，依据失效改为待核实')
replace('tests/README.md','## 失败与边界检查','''补充固定操作：人工修改建议或正文后，保留原内容与Employee edited标记，对应对象需重审；不新增自由文本语义拦截。未保存时新建／切换案件分别选择保存后继续、放弃后继续、取消，并触发保存失败，按PRD 4.5核对原案和目标案。

## 失败与边界检查''')
write('evidence/test-results/README.md','''# 应用验收证据索引

实际证据统一存放evidence/task-results/任务编号/执行批次/，本目录只索引，不复制动态结论。对应任务卡记录唯一状态和执行结果。

每批记录基础副本编号、系统、模型／mock及配置版本、固定输入、顺序动作、预期／实际、失败／未执行和证据文件。修复另建批次并链接原缺陷，保留首次失败。报告完整性与产品是否通过分别判断。

依据见[验收计划](../../tests/README.md)，实际范围见[STATUS](../../docs/project/STATUS.md)。当前尚无成员任务验收结果，不预填通过记录。
''')
write('evidence/README.md','''# 验证证据入口

| 位置 | 用途 |
|---|---|
| [preparation/](preparation/README.md) | 公共基座已有实际结果，不能继承为成员任务通过 |
| [task-restructure/](task-restructure/README.md) | 任务结构检查证据，不是任务执行 |
| [test-results/](test-results/README.md) | 应用验收证据索引 |
| task-results/任务编号/执行批次/ | 成员实际执行、失败和复测；由任务首次运行时创建 |
| [reference-conversion/](reference-conversion/) | 资料来源、转换及完整性检查 |
| [ai-usage/](ai-usage/README.md) | 关键选择、失败和修订的必要脱敏证据 |

任务只写自己的目录；不覆盖preparation或另一任务证据。当前实现和未执行项见[STATUS](../docs/project/STATUS.md)。密钥、实际个人信息、私人完整会话和本地案件不进入共享证据。
''')
replace('README.md','## 从这里开始','文档分类见[文档导航](docs/README.md)；成员只读已指派任务卡列出的材料。\n\n## 从这里开始')
replace('README.md','[完整教学案件](docs/product/examples/WORKED_CASE.md)：来源样例，不是有效配置或已通过验收。','[完整参考案件](docs/product/examples/WORKED_CASE.md)：当前有限批准内容的可读示例，不是运行配置或验收记录。')
replace('docs/project/STATUS.md','B／E 可基于实际组件和固定 mock 做展示／排版准备','B可基于实际组件和固定mock做展示；E01等待B01的CSS集成后做排版准备')
replace('docs/project/STATUS.md','旧教学稿、source 包及 pending JSON 保留原文，不能当当前批准登记','固定来源快照、source包及pending JSON保留来源／负向身份，不能当当前批准登记')
replace('docs/architecture/CONTRACTS.md','批准包与旧模拟案件结构分离','原来源哈希由data/evaluation/baseline/T09.source.json定位固定字节快照；当前PRD正常修订不刷新旧哈希。批准包与模拟案件结构分离')
replace('docs/architecture/RUNBOOK.md','npm run check:browser\n','npm run check:browser -- evidence/task-results/RUNBOOK/manual-01\n')
replace('docs/architecture/RUNBOOK.md','运行细节以 tests/browser-check.ts 为准，实际结果见证据','运行细节以tests/browser-check.ts为准。卡内使用本卡目录；独立手工执行示例使用RUNBOOK/manual-01，重复执行先改为新的批次目录，不覆盖原证据')
print('Current documentation, source navigation, prototype rules and evidence locations updated.')
