from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
def write(name, content):
    (ROOT / name).write_text(content.strip() + '\n', encoding='utf-8')
def replace(name, old, new):
    p = ROOT / name
    s = p.read_text(encoding='utf-8')
    assert old in s, (name, old[:80])
    p.write_text(s.replace(old, new), encoding='utf-8')

replace('AGENTS.md', '- 按卡内实际文件范围操作。B–F 从 A 提供的已填起始稿、固定输入和明确预期开始；不从空白设计业务规则或验收标准。代码任务另需 A 已验证的运行入口；框架、共享结构、状态规则、模型接入、持久化、最小完整界面、事件绑定和检查工具由 A 统筹。未填工作包或只有空组件／函数签名时，不能下发成员接入任务。', '- 按功能模块进行vibe coding。A准备公共结构、固定输入、模拟端口、持久化底座和可运行预览；B/C/D/E在同一起点并行完成各自逻辑、界面、事件绑定及局部检查，不等待其他模块先实现。A集中集成后F统一检查。模块可在范围内自主实现，不自行改变PRD；公共接口缺项交A协调，不另造案件状态。')
replace('AGENTS.md', '- 新手互审只确认可观察结果；技术正确性由 A 审核。agent 自评通过不能替代人工观察和实际运行。', '- 模块负责人检查本模块实现与实际操作，A审核公共接口并集成，F独立检查完整流程。agent自评通过不能替代实际运行与观察。')
replace('README.md', '当前19张任务卡、依赖及领取条件。', '当前9张任务卡：公共准备、四模块并行、集中集成、检查复测与交付。')
replace('docs/README.md', '| 实际接口 | [CONTRACTS](architecture/CONTRACTS.md) | A；成员仅按卡查 |', '| 实际接口与公共边界 | [CONTRACTS](architecture/CONTRACTS.md) | 模块开发按需查；运行模块接口由A01实际交付 |')
replace('docs/README.md', '| 检查覆盖 | [tests/README](../tests/README.md) | A编制操作表；F按已填步骤执行 |', '| 检查覆盖 | [tests/README](../tests/README.md) | 成员做局部检查；A集成后F集中执行 |')

write('docs/project/STATUS.md', '''# 当前集成状态

维护人：A。开发使用[当前任务入口](TASKS.md)的9张任务卡。任务定义已建立，均未执行；真实成员、状态和动态结果只记对应卡或A明确指定的Issue。文档优化不等于模块已完成。

## 实际已有基础

Windows/macOS本地技术基础、MiMo OpenAI兼容配置入口、IndexedDB与JSON备份、文件交A已获确认。现有页面、本地服务、Zod结构、十个固定模拟状态、单例保存恢复、模型适配器、模拟审核及基础输出已建立；根目录npm run dev，或npm run build后npm start。操作见[RUNBOOK](../architecture/RUNBOOK.md)，既有实际结果见[验证证据](../../evidence/preparation/README.md)。

本轮有限合成岗位、两个接收方、EX-G01–03 v1、T09／EXAMPLE-01输入及参考预期已获内容批准，实际配置在data/business/，GET /api/business提供读取，npm run check:business检查结构、哈希及引用。来源快照和pending负向数据不是当前批准登记。

当前模型结果仅作对照，不自动合并为完整业务流程；reviewed／handover仍是开发模拟，不能代替实际员工审核。真实MiMo、macOS与第二台电脑尚未实际验证，没有部署或线上交付。

## 尚未实现

完整自由输入／聊天、运行案件分析合并与补问、指引匹配／建议决定与拒绝传播、完整岗位切换、实际摘要草稿审核、多案件历史及完整十五例尚未完成。A01计划中的runtime／ports、独立模块预览、固定运行输入及持久化底座尚未建立，不能由路径或卡片存在推定已经可用。

## 当前分工与下一步

1. A01先准备共同运行结构、接口、固定T09／无指引输入、模拟端口及保存基础，实际验证四个独立预览后发同一副本。
2. B01案件与补问、C01模型、D01指引建议、E01审核输出并行开发，每人完成自己界面、逻辑、绑定与局部检查，不相互等待。
3. A02接通完整流程与实际操作说明，再交F01集中检查；原责任人集中修复、A汇总一个副本交F02复测；A03最后整理交付。

团队两台Windows、四台macOS，成员映射由A后续确认，不要求截止日期。成员接收副本后记录本机路径；不把所有电脑验证、完整十五例或协作审计作为首个原型集成的前置。未验证项目如实说明，不声称全部PRD通过。

## 产品约定

PRD为行为依据，字段字典为语义依据。人工编辑采用保留原内容、Employee edited及重审；风险提示只用有限合成依据、不评分；未保存新建／切换采用保存后继续、放弃后继续、取消，保存失败留原案。这些目标规则未因本轮分工调整自动实现。导入未保存内容的组合规则未定时，不开放覆盖操作，仍需先确定产品规则。

当前协作采用文件交A，不自动提交、推送或部署；仓库远端链接不证明本地新增文件已经发布。
''')

write('docs/project/FOUNDATION_READINESS.md', '''# 公共基础与模块开工就绪情况

日期：2026-10-17，Australia/Sydney。产品与技术选择见[统一方案](../architecture/FOUNDATION_PROPOSAL.md)，当前实际功能见[STATUS](STATUS.md)，现有运行见[RUNBOOK](../architecture/RUNBOOK.md)。

## 已有实际起点

现有React／TypeScript／Vite界面、Node／Express服务、Zod／JSON Schema、IndexedDB单例保存与备份、产品内模型设置、模拟审核与快照输出、十个固定状态及批准业务包均有文件和运行入口。团队为两台Windows、四台macOS，真实成员映射待A确认；不要求截止时间。

既有验证结果保留在[evidence/preparation](../../evidence/preparation/README.md)：Windows程序31项、基座浏览器16项及PDF观察属于此前公共基座证据；不代表新任务执行、四模块完成或完整业务流程通过。真实MiMo、macOS、第二台电脑及完整十五例尚未实际验证。

当前固定模拟案件与独立批准业务包分离。内容批准不等于员工实际审核、模型正确或指引匹配已经实现。保留来源及pending模拟身份，不通过改标记凑正式运行。

## 当前模块开工条件

| 责任 | 已有可复用基础 | 开工还需要什么 |
|---|---|---|
| A01 | 现有公共基座、T09批准包、PRD | 实际完成冻结运行结构／端口、持久化底座、独立预览与固定输入；本卡未执行 |
| B01 | CasePanel、AnalysisPanel、原固定状态及核心函数 | A01运行结构、模拟分析与保存端口、intake独立入口；不等C/D/E |
| C01 | 实际模型适配器、设置、提示及本地假提供商测试 | A01冻结请求／响应、调用点与model独立入口；不等B |
| D01 | 当前批准岗位、指引及业务包校验 | A01固定事实、批准包端口、guidance入口及受控负向变体；不等B/C |
| E01 | OutputPanel、共享模板与模拟快照 | A01固定事实／建议／保存端口和outputs入口；不等B/D |
| A02 | 四模块尚未交付 | 收齐B/C/D/E实现与局部结果后集中集成，不替四人提前实现全部逻辑 |
| F01／F02 | 现有运行说明和基座检查可复用 | A02完整副本、实际操作及故障入口，再集中检查／复测 |

所有运行接口和路径的实际定义由A01交付后更新契约；当前任务卡中的未来产物不冒充现有API。产品内已有Configure model API可供人类自主配置与调用，agent不索要密钥。实际电脑安装或下载失败保留原错，按影响处理；只对实际验证环境作结论。

## 范围与限制

原型先走T09及无指引摘要，再按需要扩展验收。PRD十五例范围保留，但不作为四模块开工或首次集成前置；未完成扩展覆盖时不得声称全PRD验收。资料检查不代替程序、页面、模型或PDF观察。

完整任务及唯一依赖见[TASKS](TASKS.md)。本文件只盘点就绪，不维护第二套任务状态。
''')

replace('CONTRIBUTING.md', '1. 在任务卡填好[工作包清单](docs/project/WORK_PACKAGE.md)，实际成员、系统、绝对路径、副本编号和基线不可留空。', '1. 按[工作包清单](docs/project/WORK_PACKAGE.md)确认成员、系统、副本、允许范围及基线，提供完整副本。成员收到解压后回报实际绝对路径，再确认正式开工；不猜另一台电脑路径。')
replace('CONTRIBUTING.md', '3. 在该副本实际执行卡内启动、检查和固定操作，记录命令、入口、目标画面及证据。后续卡须在前置交付验收后填写，不能提前写成已就绪。', '3. A01实际验证四模块独立入口、模拟端口与固定输入后，同一批发给B/C/D/E；成员不等待其他模块实现。A02集成后再把实际完整流程说明及副本交F。未来入口未实现不写已就绪。')
replace('CONTRIBUTING.md', '5. 共用文件按TASKS的先后顺序发放集成后的新副本；每人一次一个主任务。', '5. B/C/D/E各自独占模块路径和有作用域的样式，不改公共schema、主页面、全局CSS或package。A收齐后集中集成；后续缺陷回原卡集中修复，统一副本交F复测。')

write('docs/product/WORKSPACE_LAYOUT.md', '''# 工作台布局说明

产品交互见[PRD第5节](PRD.md#5-同屏双栏交互)，实际状态见[STATUS](../project/STATUS.md)。

B完成输入、事实核对和补问界面，C完成模型设置／分析入口，D完成岗位与建议界面，E完成摘要／最终审核／输出界面。四人各自完成绑定和模块样式；A01准备独立预览，A02装配到统一案件工作台。具体范围只按[任务卡](../project/TASKS.md)，本文件不分配额外工作。
''')
replace('docs/product/EXPORT_LAYOUT.md', 'E01只修改固定模拟输出排版；E02等待A06交付实际可操作页面后核对运行输出。', 'E01负责摘要草稿生成、编辑保护、最终审核、快照资格及预览／双格式输出，先使用A01固定事实和模拟建议独立开发；A02接入真实模块。')
replace('docs/architecture/CONTRACTS.md', 'A03–A06 的上下文来源，不由模型推断', '案件的岗位上下文来源，不由模型推断')
replace('docs/architecture/CONTRACTS.md', 'PRD 4.4的Employee edited、4.5的未保存三选项及简单风险关注提示是当前产品要求，尚未据此扩展基座接口。A02/A03/A04/A05按卡实现后更新本契约及同源schema；A06接通最小完整界面与逐行验收入口。B/E只调整已接通的指定显示，不在组件内补业务控制。', 'PRD 4.4的Employee edited、4.5未保存三选项及简单风险关注提示是当前目标，尚未据此扩展基座。A01交付运行结构、模拟端口、保存底座及MODULE_CONTRACTS后，B/C/D/E各自完成业务逻辑、UI与事件绑定。A02再接入主页面及公共服务。未来MODULE_CONTRACTS以A01实际实现为准；当前上文仍描述现有基座，不能当作新模块已经就绪。')
replace('docs/architecture/CONTRACTS.md', '不能将这些未实现项交给成员自行补公共逻辑。', '这些功能按当前模块卡实现；成员沿用A01公共接口，不自行改公共schema。')
replace('docs/architecture/README.md', 'A 维护依赖、状态、共享结构、审核、持久化与基础服务；A先接通完整最小界面与事件绑定；B在指定展示组件工作，C 核对提示，D 核对已批准样板及内容格式，E 处理指定模板与版式，F 观察公共基座并记录缺陷。', 'A准备公共运行结构、持久化及模拟端口；B开发案件与首次核对／补问，C开发模型接入，D开发岗位与建议，E开发最终审核和输出，各自完成界面及绑定。A集中集成后F统一检查与复测。')
replace('docs/architecture/FOUNDATION_PROPOSAL.md', 'A统一状态、请求、完整最小界面与事件绑定；B修改指定展示组件，E 修改输出模板', 'A定义公共结构并装配主页面；B/C/D/E各自实现完整模块的逻辑、界面和绑定，样式作用域隔离')
replace('docs/architecture/FOUNDATION_PROPOSAL.md', '| app/src/components/ | B 的事实与分析展示起点；共享状态由 A 管理 |', '| app/src/components/ | 既有展示起点；B/C/D/E按模块卡分别开发，公共状态接口由A01准备 |')
replace('docs/architecture/FOUNDATION_PROPOSAL.md', 'A 维护调用／校验；C 核对提示与固定结构', 'C实现模型调用／校验、设置与提示，A维护公共路由')
replace('app/README.md', '中的B01／B02和E01／E02，按各卡依赖执行。', '中的B01、C01、D01、E01；A01准备独立预览及注入接口，四人完成模块内逻辑与绑定，A02装配主页面。')
replace('shared/README.md', 'See `docs/product/examples/BASELINE_CONFIRMATION.md` for the pending business scope.', 'Approved content is registered separately in `data/business/`; legacy fixtures remain pending simulations. New runtime ports are an A01 deliverable, not currently implemented; B/C/D/E build their domain modules against those ports, and A02 integrates them.')

replace('docs/product/PRD.md', '其他14例由A07准备并逐项审阅。', '其他14例在扩展验收时由A组织准备并逐项审阅。原型先跑通T09及无指引摘要，完整十五例不作为模块开发或首次集成前置；未完成时不声称全范围验收通过。')
replace('tests/README.md', '[A07](../docs/project/tasks/A07.md)建立完整固定验收集，[D02](../docs/project/tasks/D02.md)核对，[F02](../docs/project/tasks/F02.md)实际执行。', '[A01](../docs/project/tasks/A01.md)先准备T09及无指引原型输入，各模块做局部检查，[A02](../docs/project/tasks/A02.md)集成后由[F01](../docs/project/tasks/F01.md)集中检查，[F02](../docs/project/tasks/F02.md)复测。完整十五例是扩展覆盖，不作为四模块开工或首次集成前置；未跑不能声称全PRD验收。')
replace('tests/README.md', '[A06](../docs/project/tasks/A06.md)负责建立运行工作流与故障验收入口', '[A02](../docs/project/tasks/A02.md)负责装配运行工作流与故障检查入口')

write('data/evaluation/README.md', '''# 固定合成评估输入

当前T09批准输入、回答、事实及正文预期见[业务包](../business/README.md)。A01先建立prototype.json，提供T09和无指引及关键独立变体；四模块用固定替身并行开发，A02集成后F01观察、F02复测。新输入在实际产生并审阅前不当作已批准。

- [cases/](cases/README.md)、[expected/](expected/README.md)：可读输入和独立预期。
- [baseline/](baseline/README.md)：来源原文及哈希，保留pending身份，不是实际审核或执行结果。

完整十五例编号与扩展覆盖见[测试计划](../../tests/README.md)，后续由A组织补充并审阅，不作为首个原型集成前置。不得从模型输出反推预期。执行结果放evidence/task-results/任务号/批次/，不放本目录。
''')
write('data/evaluation/cases/README.md', '''# 验收输入

当前[T09](T09.md)指向已批准的固定叙述、更正与问答。A01准备prototype.json供四模块独立开发和原型演示；在实际建立前不推定可用。

完整T01–T15保留为[扩展覆盖](../../../tests/README.md)，A后续组织准备及内容审阅，不作为首个原型集成前置。当前实际范围见[STATUS](../../../docs/project/STATUS.md)。
''')
write('data/evaluation/expected/README.md', '''# 独立参考预期

当前[T09](T09.md)链接到批准事实、建议、正文与参考检查。A01在prototype.json给出原型固定预期；模块负责人用它做局部检查，A02集成后F01观察，F02复测。未建立的输入不推定存在。

预期须在运行前确定，不从模型或页面反推。本目录不存通过结论；完整十五例为扩展覆盖，未执行如实保留。实际范围见[STATUS](../../../docs/project/STATUS.md)。
''')

# Explicitly list generated artifacts for the two tasks that own shared structures.
registry = json.loads((ROOT / 'docs/project/task-map.json').read_text(encoding='utf-8'))
generated = [p.relative_to(ROOT).as_posix() for folder in ['data/schemas','data/business/schemas'] for p in sorted((ROOT / folder).glob('*.json'))]
for row in registry['tasks']:
    if row['id'] not in {'A01','A02'}:
        continue
    extra = generated.copy()
    if row['id'] == 'A02':
        extra += ['shared/runtime.ts','shared/module-ports.ts','shared/runtime-fixtures.ts','shared/schema.ts','shared/core.ts','shared/index.ts','shared/export-schemas.ts','shared/write-schemas.ts','app/src/runtime-storage.ts','data/schemas/RuntimeCaseRecord.schema.json','data/schemas/RuntimeExportSnapshot.schema.json','docs/architecture/MODULE_CONTRACTS.md']
    extra = [p for p in extra if p not in row['writes'] and p not in row['creates']]
    row['writes'].extend(extra)
    card = ROOT / f'docs/project/tasks/{row["id"]}.md'
    s = card.read_text(encoding='utf-8')
    anchor = '\n\n本卡新建：'
    s = s.replace(anchor, '\n\n公共结构及生成物同步允许范围：' + '、'.join(f'`{p}`' for p in extra) + '。只交实际受影响文件，运行生成器后核对差异。' + anchor, 1)
    card.write_text(s, encoding='utf-8')
write('docs/project/task-map.json', json.dumps(registry, ensure_ascii=False, indent=2))
print('Synchronized active navigation, responsibility, status and source boundaries.')
