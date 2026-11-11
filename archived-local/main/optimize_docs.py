from pathlib import Path
import json, re, hashlib, shutil

ROOT = Path(__file__).resolve().parents[1]
def read(name): return (ROOT / name).read_text(encoding='utf-8-sig')
def write(name, value):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value.rstrip() + '\n', encoding='utf-8')
def replace(name, old, new):
    text = read(name)
    assert old in text, (name, old[:90])
    write(name, text.replace(old, new))
def section(name, title, body):
    text = read(name)
    pattern = rf'(?ms)^## {re.escape(title)}\n.*?(?=^## |\Z)'
    assert re.search(pattern, text), (name, title)
    write(name, re.sub(pattern, lambda m: f'## {title}\n\n{body.strip()}\n\n', text))

# Retain exact source bytes and their original hashes before changing current documents.
source_name = 'data/evaluation/baseline/T09.source.json'
package = json.loads(read(source_name))
assert 'sourceSnapshots' not in package, 'Source capture must not be run twice'
snapshots = {}
for name, expected in package['sourceHashes'].items():
    source = ROOT / name
    assert hashlib.sha256(source.read_bytes()).hexdigest() == expected, name
    destination = 'evidence/preparation/source-snapshot/' + name + '.txt'
    target = ROOT / destination
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    snapshots[name] = destination
package['sourceSnapshots'] = snapshots
write(source_name, json.dumps(package, ensure_ascii=False, indent=2))

write('CONTRIBUTING.md', '''# 成员文件交付步骤

当前采用文件交A。任务从[任务入口](docs/project/TASKS.md)进入，责任见[团队规则](docs/project/TEAM_EXECUTION.md)。成员不自行提交、推送、建PR或部署。

## A发放工作包

1. 在任务卡填好[工作包清单](docs/project/WORK_PACKAGE.md)，实际成员、系统、绝对路径、副本编号和基线不可留空。
2. 提供完整项目副本及锁文件，排除node_modules、dist、.env、local和机器缓存。不要只给尚未发布新增文件的远端链接。
3. 在该副本实际执行卡内启动、检查和固定操作，记录命令、入口、目标画面及证据。后续卡须在前置交付验收后填写，不能提前写成已就绪。
4. 每个允许文件记录发放时SHA256；新建产物记“本卡创建”。A在PowerShell使用Get-FileHash -Algorithm SHA256 -LiteralPath并填实际路径，macOS使用shasum -a 256并填实际路径。哈希用于识别副本，不由成员解释技术影响。
5. 共用文件按TASKS的先后顺序发放集成后的新副本；每人一次一个主任务。

## 成员执行

1. 将卡交给agent，核对工作包字段。只读指定条款和文件，记录本机路径，不猜另一台电脑路径。
2. 按RUNBOOK安装和启动；缺Node、缺文件、命令失败、基线不符或有未交接修改时，保留现场，把原始错误交A。
3. 按卡内顺序修改允许范围，不自行安装额外依赖或扩大文件范围。
4. 成员亲自观察各检查行，在任务卡唯一执行记录填写通过／失败／未执行及证据；不把agent生成文件当作本人观察。

## 收集并交回

让agent在当前副本的local/delivery/本卡编号/下整理：

```text
local/delivery/本卡编号/
  MANIFEST.md
  changed-files/       只放本卡改动，保留项目相对路径
  evidence/            本卡截图、脱敏日志、导出文件
```

1. 对照A发放副本检查差异。有Git时可只读查看git diff，未跟踪文件也逐个列出；不能认为git diff覆盖所有新增文件。无Git基线时与发放副本比较，不自行初始化仓库。
2. 将实际修改的允许文件复制到changed-files/，保留相对路径；包括更新后的本任务卡。不交完整项目覆盖包。
3. 将evidence/task-results/本卡编号/中本次执行证据复制到evidence/，保留批次目录。密钥、.env、local中的其他文件、实际个人信息及缓存不交付。
4. 按[清单模板](docs/project/DELIVERY_MANIFEST.md)填写MANIFEST.md。清单只索引文件、基线和唯一执行记录，不维护第二份状态。
5. 成员按A实际指定的渠道人工交回，agent不自动对外发送。

A接收后核对副本编号、基线及允许差异，逐项集成并检查。冲突由A处理；不整份替换项目。后续修复另建执行批次，保留首次失败。

## 完成与验收

任务实际状态只在指定卡或Issue记录，STATUS由A汇总。内容稿、代码修改、检查报告与产品通过分别判断。报告真实完整可被接收，其中的产品失败仍待修复。A检查技术，F按固定步骤独立观察。
''')

write('docs/project/WORK_PACKAGE.md', '''# 工作包发放清单

供A准备任务，不是成员另领的任务。实际值填回指定卡的“工作包与交付门槛”，动态结果只记该卡唯一执行记录。

| 字段 | A必须提供的实际值 |
|---|---|
| 工作包编号 | 任务编号加发放批次，例如B01-01；示例不表示已发放 |
| 基础副本编号 | 包含未提交文件的完整项目快照编号，不能只写Git HEAD |
| 成员与系统 | 实际操作者、本次Windows或macOS |
| 工作副本路径 | 操作者电脑实际绝对路径 |
| 文件基线 | 每个允许文件的SHA256；新文件记本卡创建 |
| 依赖接收 | 各依赖卡A验收记录及交付副本编号 |
| 固定输入与目标 | 卡内具体检查行、输入、目标画面或实际文本 |
| 操作入口 | 本副本的准确命令、URL、加载操作及按钮；A实际执行证据 |
| 交付位置 | local/delivery/本卡编号/及A指定的人工交付渠道 |

任何一项缺失都未达到成员指派门槛。未来接口未实现时写“待前置交付后填写”，不编造按钮、命令或通过记录。

指派前确认：有已填的可运行起点；公共事件已接通；一种主要改动；明确的输入、步骤、观察位置及预期；无待成员决定的产品规则；检查不会覆盖其他批次证据；共用文件已串行交接。

方法见[CONTRIBUTING](../../CONTRIBUTING.md)，交付索引见[清单模板](DELIVERY_MANIFEST.md)。
''')
write('docs/project/DELIVERY_MANIFEST.md', '''# 文件交付清单模板

复制到local/delivery/本卡编号/MANIFEST.md后填真实值。此处不维护另一份状态或通过结论。

```text
任务编号：[本卡编号]
工作包编号：[A发放编号]
基础副本编号：[A发放完整副本编号]
实际操作者与系统：[实际值]
本机工作路径：[实际绝对路径]
唯一执行记录：[本任务卡或A明确切换的Issue]

本次文件：
项目相对路径 | 发放SHA256或本卡创建 | 具体变化
[实际路径] | [A提供基线] | [具体修改]

本次证据：
[项目内证据路径] -> [交付目录内对应路径]

缺失或未交付项：[具体内容；没有写无]
```

说明例：B01调整partial长文本换行，文件行填写app/src/components/AnalysisPanel.tsx及其真实基线；证据索引到本次partial截图。实际检查结论填B01卡，不再复制到本清单。本例不表示任务已执行。
''')

# Responsibility and dependency changes. Keep the 19 identifiers and existing execution records.
registry_name = 'docs/project/task-map.json'
registry = json.loads(read(registry_name))
rows = {r['id']: r for r in registry['tasks']}
rows['E01']['dependencies'] = ['B01']
rows['E01']['gate'] = 'B01已验收并由A集成CSS；使用A重新发放的完整副本。'
rows['A06']['dependencies'] = ['A02','A03','A04','A05','C01','D01']
rows['A06']['gate'] = '公共逻辑已验收；由A接通最小完整界面、输出和故障入口，不等待B02或E02。'
rows['A06']['creates'] += rows['B02']['creates']
for file in ['app/src/components/CasePanel.tsx','app/src/components/AnalysisPanel.tsx','app/src/style.css','app/src/export/OutputPanel.tsx']:
    if file not in rows['A06']['writes']: rows['A06']['writes'].append(file)
rows['E02']['dependencies'] = ['A04','E01','A06']
rows['E02']['gate'] = 'A06实际可操作页面及逐步检查说明已验收；A发放有效、失效、无指引三条运行步骤。'
rows['B02'].update(title='完善运行案件事实区的展示', dependencies=['B01','A06','E02'],
    requirements=['FR-02','FR-04'], creates=[],
    reads=['app/src/components/CasePanel.tsx','data/business/T09.json','docs/architecture/RUNBOOK.md','docs/architecture/ACCEPTANCE_RUNBOOK.md'],
    writes=['app/src/components/CasePanel.tsx','app/src/style.css'],
    gate='A06最小完整界面和E02排版已验收；A指定事实区局部修改及目标画面后指派。')
if 'B02' not in rows['F02']['dependencies']: rows['F02']['dependencies'].append('B02')
for key in ['A02','A03','A04']:
    for file in ['shared/write-schemas.ts','shared/export-schemas.ts'] + rows['A01']['creates'][2:] + [x for x in rows['A01']['writes'] if x.startswith('data/schemas/')]:
        if file not in rows[key]['writes']: rows[key]['writes'].append(file)
for file in ['data/business/schemas/BusinessApproval.schema.json','data/business/schemas/ApprovedRole.schema.json','data/business/schemas/ApprovedGuideline.schema.json','data/business/schemas/BusinessCase.schema.json','data/business/schemas/BusinessBaseline.schema.json']:
    if file not in rows['A07']['writes']: rows['A07']['writes'].append(file)
write(registry_name, json.dumps(registry, ensure_ascii=False, indent=2))

for key, row in rows.items():
    name = f'docs/project/tasks/{key}.md'
    text = read(name)
    text = re.sub(r'^# .*', f"# {key}：{row['title']}", text, count=1)
    text = re.sub(r'目标：.*?，只完成本卡范围。', f"目标：{row['title']}，只完成本卡范围。", text, count=1)
    text = re.sub(r'产品规则：.*?，以 PRD 对应条款为准。', '产品规则：' + ', '.join(row['requirements']) + '，以卡内指定PRD条款为准。', text, count=1)
    dep_line = '依赖：' + ('、'.join(f'[{d}]({d}.md)' for d in row['dependencies']) if row['dependencies'] else '无开发任务依赖；使用当前已验证公共基座。')
    text = re.sub(r'^依赖：.*$', dep_line, text, count=1, flags=re.M)
    if row['gate']:
        text = re.sub(r'(依赖：[^\n]+\n\n).*?(?=\n\nA 指派时)', lambda m:m.group(1)+row['gate'], text, count=1, flags=re.S)
    text = re.sub(r'^现有文件：.*$', '现有文件：' + ('、'.join(f'`{f}`' for f in row['writes']) if row['writes'] else '无；只核对、运行和记录，不修改程序、配置或标准答案。'), text, count=1, flags=re.M)
    text = re.sub(r'^本卡新建产物（当前不要求存在）：.*$', '本卡新建产物（当前不要求存在）：' + ('、'.join(f'`{f}`' for f in row['creates']) if row['creates'] else '无业务／程序新文件。'), text, count=1, flags=re.M)
    # Use future reads only after their declared producer is accepted.
    if key == 'B02':
        head = '- [AGENTS.md](../../../AGENTS.md)\n- [当前状态](../STATUS.md)\n- [PRD](../../product/PRD.md)：只读4.1、4.4与第5节中事实更正和变更提示。\n'
        text = re.sub(r'(?ms)(## 必读与固定输入\n\n).*?(?=\n## 允许修改与交付)', lambda m:m.group(1)+head+'\n'.join(f'- `{f}`'+('：依赖验收后由A交付，未存在时不开展。' if 'ACCEPTANCE_RUNBOOK' in f else '') for f in row['reads'])+'\n', text, count=1)
    work = '''## 工作包与交付门槛

由A按[发放清单](../WORK_PACKAGE.md)填入本卡真实值；未填完整不指派。实际状态仍只记下方唯一执行记录。

- 工作包编号／基础副本编号：待A发放时填写。
- 文件基线：待A逐个填写允许文件SHA256；新建文件记本卡创建。
- 依赖验收位置与副本：待A填写；无依赖写不适用。
- 本次固定输入／目标画面／A已执行入口及证据：见本卡检查表；实际副本验证待A填写。
- 交付渠道：待A指定；本机收集到local/delivery/''' + key + '''/。

'''
    text = text.replace('## 唯一执行记录\n', work+'## 唯一执行记录\n')
    # Explicit per-task command; never suggest writing over preparation evidence.
    text = text.replace('已有 npm run check／build／check:business／check:browser 见 RUNBOOK', f'已有检查见 RUNBOOK；本卡浏览器命令为 `npm run check:browser -- evidence/task-results/{key}/browser`')
    text = text.replace('STATUS时除外', 'STATUS时除外')
    text = text.replace('给 B02 暴露实际列表与打开入口', '给 A06 暴露实际列表与打开入口')
    write(name, text)

section('docs/project/tasks/B02.md', '顺序步骤', '''1. A先在已验收页面操作T09，给出更正前2000、更正后200、有候选冲突三张目标画面。缺具体画面、当前组件或绑定好的更正操作时停止，不创建聊天／审核／历史组件。
2. 只在CasePanel调整事实标签、来源／历史展开、未知／冲突文字和长文本换行；CSS仅改事实区作用域。保留事件绑定、字段ID、可访问名称及按钮条件。
3. 按A06已填的T09步骤观察更正200、部分回答和刷新；本卡只核对事实区显示，不承担业务功能接通。
4. 在1440×900和1024×768分别截图；键盘可展开来源，错误不只靠颜色区分。不修改审核区、聊天区、历史区、API设置和输出模板。
5. 执行npm run build、npm run check；按A06实际提供的业务浏览器命令复查，记录命令原文。交回两个允许文件及本卡记录／证据。''')
section('docs/project/tasks/B02.md', '固定检查与预期', '''| 固定输入／动作 | 应观察到的结果 | 证据名 |
|---|---|---|
| T09原始输入，查看TX-01金额 | 金额2000及其原文来源可定位；不显示已确认损失 | original.png |
| 按A06步骤更正为200，再重读原文 | 当前200；历史保留2000；候选冲突可见，未自动改回 | corrected.png |
| 部分回答后刷新 | 当前案件及事实来源一致，不把未知显示为否／0 | restored.png |

以上动作入口由A06在验收后交付，当前不宣称存在。窗口截图文件名追加1440或1024。实际通过／失败／未执行填唯一执行记录。''')
section('docs/project/tasks/A06.md', '顺序步骤', '''1. 逐项集成已验收公共逻辑及B01／E01基础展示。由A创建ConversationPanel、ReviewPanel、HistoryPanel，在Workbench接通自由描述、更正、补问、建议决定、最终审核、历史和输出；成员不补事件绑定或设计阶段切换。
2. 实际走通T09：角色→输入→提取更正→首次审核→部分回答／未知／结束→建议与拒绝→摘要两稿→对象最终审核→导出→刷新恢复；独立走通无指引摘要路径。当前固定fixture不代替运行工作流。
3. 在tests/acceptance-controls.ts提供生成失败、无效返回、保存失败、复制／MD／PDF失败、旧请求释放、零题／上限、角色与指引变体的实际操作入口；不混入普通岗位权限。
4. 创建ACCEPTANCE_RUNBOOK，逐行填写实际命令、URL、固定输入、按钮顺序、观察位置、确定预期和重置方式。必须有输出对象编辑、重新审核、单稿失效及另一稿不失效的可操作步骤，供E02直接照做。给B02预填三种事实状态的目标截图与局部改动目标。
5. 将新检查接入package scripts，运行核心、服务、构建、基座及业务浏览器检查；证据写本卡目录。给F02按tests/README每项准备已填检查行，不要求F拆测试计划。保留真实模型及跨系统未执行状态；不伪造员工操作或独立验收。''')
replace('docs/project/tasks/A02.md','导出 useWorkflow 的命令与选择器供 B02 使用','导出 useWorkflow 的命令与选择器供 A06 接入界面')
replace('docs/project/tasks/A04.md','记录生成方式给 E02','记录生成方式给 A06，E02通过A06页面操作')
replace('docs/project/tasks/E02.md','先用 A04 给出的固定运行快照构造方式生成 T09 摘要、银行稿、电信稿','先按 A06 的 ACCEPTANCE_RUNBOOK 在页面实际生成并审核 T09 摘要、银行稿、电信稿')
replace('docs/project/tasks/E02.md','按 A04 固定动作修改银行稿','按 A06 实际页面动作修改银行稿')
replace('docs/project/tasks/E02.md','- [docs/architecture/CONTRACTS.md](../../../docs/architecture/CONTRACTS.md)','- `docs/architecture/ACCEPTANCE_RUNBOOK.md`：A06验收后读取实际步骤；当前尚未建立。')
replace('docs/project/tasks/F02.md','所有依赖已验收且真实模型结果可定位','所有依赖报告／交付已由A接收，B02展示已集成，且真实模型结果可定位')
replace('docs/project/tasks/F02.md','每项记录系统、应用版本或文件摘要','先使用A06已填逐行检查表和A07固定预期，不自行编写标准；每项记录系统、基础副本编号、应用版本或文件摘要')
replace('docs/project/tasks/F02.md','任何关键失败均不验收；mock与真实分栏','任何关键失败均阻止产品通过；检查报告仍可如实交付，mock与真实分栏')
replace('docs/project/tasks/B01.md','记录三种指定状态前后截图','记录partial、stale、no-guidance三种状态前后截图（文件名分别为partial-before/after、stale-before/after、no-guidance-before/after，均为.png）')
for key in ['A02','A03','A04']:
    name = f'docs/project/tasks/{key}.md'
    text = read(name)
    marker = '## 固定检查与预期'
    text = text.replace(marker, '共享结构变化后执行 `npm run schemas`，核对data/schemas生成差异与本卡契约同步；只交实际受影响文件。未改结构不为刷新时间戳重写生成物。\n\n'+marker)
    write(name,text)

# Rebuild the current task index from the registry, avoiding a second hand-maintained dependency list.
old_index = read('docs/project/TASKS.md')
coverage = old_index[old_index.index('## 覆盖与验证'):]
index = '''# 开发任务入口

本索引列出19张任务定义。任务卡只有在A填好工作包、验证实际副本并指派后才可执行。目录存在、基座通过或依赖图无环不表示当前卡已就绪；实际结果只在卡内或A明确切换的Issue记录。

成员读取AGENTS、STATUS、获指派的一张卡及其中指定条款，不遍历全部参考资料。[工作包清单](WORK_PACKAGE.md)供A发放；[文件交付](../../CONTRIBUTING.md)供成员操作。

## 领取与依赖

团队两台Windows、四台macOS，成员映射待A人工确认，采用文件交A。每人一次一个主任务；A卡也串行处理共享文件。当前开发卡均未执行，不继承基座验证结果。

| 任务 | 方向 | 交付 | 前置卡 |
|---|---|---|---|
'''
for row in registry['tasks']:
    index += f"| [{row['id']}](tasks/{row['id']}.md) | {row['role']} | {row['title']} | { '、'.join(row['dependencies']) or '无；仍需工作包与实际指派' } |\n"
index += '''
## 执行顺序与文件协调

1. A01与A07按A实际投入依次准备；B01、C01、D01、F01可在工作包完整后开展。B01集成后重新发副本给E01，禁止两人同时改旧副本CSS。
2. A01/C01后做A02，A01/D01后做A03，A01后做A05；A串行整合。A07后D02核对，E01与A02/A03后A04接通输出。
3. A06接通最小完整界面和受控验收入口，不等待B02或E02。A06后E02观察运行输出并调整排版；A集成E02后B02只调整运行事实区显示。C02等A06/A07/D02齐备后检查模型效果，提示改动由A集成到最终测试副本。
4. F02等待所有列明交付，使用同一集成副本执行；F03收报告、逐项复测。报告可包含产品失败；A08只在关键规则通过及必要真实／跨系统验证有证据后交付。

A06负责Workbench及Conversation/Review/History组件和全部事件绑定。成员不从签名或空组件补工作流。E01→A04→A06→E02→B02按顺序交接输出和CSS；新增冲突交A处理。依赖产物缺失时只停止受影响步骤，不自行补架构。

'''+coverage
write('docs/project/TASKS.md',index)
replace('docs/project/TEAM.md','按已有操作稿核对页面、限定修改指定组件','在已接通页面上限定调整展示和核对操作')
replace('docs/architecture/README.md','B 在指定展示组件工作','A先接通完整最小界面与事件绑定；B在指定展示组件工作')
replace('docs/architecture/FOUNDATION_PROPOSAL.md','A 统一状态与请求；B 修改指定展示组件','A统一状态、请求、完整最小界面与事件绑定；B修改指定展示组件')
replace('docs/project/FOUNDATION_READINESS.md','完整聊天与业务流程尚不具备，具体修改范围见B01／B02','完整聊天与业务流程由A06接通后再开展B02事实区展示，不由B补流程')
print('Responsibility, task dependency and work-package updates written; source hashes retained in exact snapshots.')
