from pathlib import Path
import json
import hashlib

ROOT = Path(__file__).resolve().parents[1]
def change(name, old, new):
    p = ROOT / name
    s = p.read_text(encoding='utf-8')
    assert old in s, name
    p.write_text(s.replace(old, new), encoding='utf-8')
def write(name, s):
    p = ROOT / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(s.strip() + '\n', encoding='utf-8')

change('data/evaluation/cases/T09.md', '实际运行步骤由A06交付后按对应任务卡执行', 'A01先提供固定输入与预期，A02集成后提供完整实际运行步骤，再按对应任务卡执行')
change('data/evaluation/expected/T09.md', '逐项执行表由A06/A07预填，D核对、F实际观察。', 'A01提供固定预期，各模块负责人做局部检查；A02提供完整实际操作，F集中观察与复测。')
change('docs/project/DELIVERY_MANIFEST.md', '说明例：B01调整partial长文本换行，文件行填写app/src/components/AnalysisPanel.tsx及其真实基线；证据索引到本次partial截图。', '说明例：B01交付shared/intake.ts和本模块界面，文件行分别填写新建身份或真实基线；证据索引到本次更正200及部分回答的实际观察。')
change('docs/project/tasks/A01.md', '收到副本后回报本机路径，A确认实际成员、副本和文件范围再正式开发。代码任务按A01冻结接口开发，不自行改变PRD或公共结构；接口确有缺项交A一次协调。不要因其他并行模块未完成而等待或替它实现。', 'A确认当前工作路径和已有改动后执行公共准备；本卡负责产出四模块共享接口，不要求该接口事先存在。产品规则未定时先明确规则，不替B/C/D/E提前完成全部业务。')
change('docs/project/tasks/A01.md', 'C的服务适配调用点由A预接到现有app.ts，C不需要修改公共路由。', 'C的分析调用点及E的输出服务注册点由A预接到现有app.ts；分别能注入模拟实现，并在对应模块文件出现后使用其真实实现。E须能在独立预览实际生成并打开PDF，不等待A02挂载完整主页面。模块成员不需要修改公共路由。')
change('docs/project/tasks/E01.md', '向A提供可在服务端复验的纯函数，A02负责HTTP挂载，不在公共路由加另一套资格判断。', '提供可在服务端复验的纯函数及server/src/output-service.ts，接到A01预留输出注册点，独立检查时即可实际生成PDF。A02装配完整页面沿用同一服务，不在公共路由加另一套资格判断。')
change('docs/project/tasks/E01.md', '`tests/outputs.test.ts`\n', '`tests/outputs.test.ts`、`server/src/output-service.ts`\n')
change('docs/project/TASKS.md', 'shared/outputs.ts、shared/export.ts、OutputPanel、modules/outputs/及本模块测试', 'shared/outputs.ts、shared/export.ts、output-service.ts、OutputPanel、modules/outputs/及本模块测试')
registry = json.loads((ROOT / 'docs/project/task-map.json').read_text(encoding='utf-8'))
next(row for row in registry['tasks'] if row['id']=='E01')['creates'].append('server/src/output-service.ts')
next(row for row in registry['tasks'] if row['id']=='A02')['reads'].append('server/src/output-service.ts')
p = ROOT / 'docs/project/tasks/A02.md'
s = p.read_text(encoding='utf-8').replace('- `shared/outputs.ts`：', '- `server/src/output-service.ts`：由E01交付，验收后读取。\n- `shared/outputs.ts`：')
p.write_text(s, encoding='utf-8')
write('docs/project/task-map.json', json.dumps(registry, ensure_ascii=False, indent=2))

# Keep former evidence narratives as raw provenance, not active task instructions.
manifest_path = ROOT / 'evidence/task-restructure/module-plan-source/manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for name in ['evidence/task-restructure/README.md','evidence/documentation-optimization/README.md']:
    p = ROOT / name
    target = ROOT / 'evidence/task-restructure/module-plan-source' / (name.replace('/', '__') + '.txt')
    if not target.exists():
        target.write_bytes(p.read_bytes())
        manifest.append({'source': name, 'snapshot': target.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
write('evidence/task-restructure/module-plan-source/manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))
write('evidence/task-restructure/README.md', '''# 当前任务定义验证

当前为9张模块任务卡，执行入口见[TASKS](../../docs/project/TASKS.md)。本目录的检查只验证任务定义，不表示任务已执行。

本次结果见[module-plan](module-plan/README.md)。检查覆盖路径、依赖、FR映射、并行模块只依赖公共起点、文件写入所有权不冲突、集成等待四模块。

调整前卡片及复核正文的原始字节保留在[来源快照](module-plan-source/README.md)，不能作为当前任务。其他既有JSON、日志和浏览器结果是此前批次证据，不覆盖为本轮结果，也不继承为新卡验收。
''')
write('evidence/documentation-optimization/README.md', '''# 既有文档优化证据

本目录保存此前文档、来源及基座检查结果，不是当前任务指令，不代表新模块已实现。当前9张卡及依赖见[TASKS](../../docs/project/TASKS.md)，本次任务重组验证见[当前记录](../task-restructure/module-plan/README.md)。

此前优化说明的原始正文见[只读快照](../task-restructure/module-plan-source/evidence__documentation-optimization__README.md.txt)。本目录原有检查JSON、程序日志和来源记录保留，不能作为本轮重新运行的结果。
''')
write('evidence/task-restructure/module-plan/README.md', '''# 模块任务方案验证

日期：2026-10-17，Australia/Sydney。范围为任务卡、依赖、文件所有权、分工及当前入口同步；未实现新模块或执行开发卡。

当前9张卡：A01公共起点；B01/C01/D01/E01并行模块；A02集成；F01检查；F02复测；A03交付。四模块只依赖A01，使用独立预览及模拟端口，文件范围互不重叠；公共保存及主页面由A维护。T09／无指引先跑通，十五例保留扩展覆盖，未执行不能声称全PRD验收。

- [任务定义检查](tasks-check.json)：路径、生产者、依赖及FR映射，并行阶段无交叉写入。
- [仓库资料检查](repository-check.json)：当前Markdown链接、117字段和来源资料。
- [来源完整性检查](source-check.json)：固定原始字节／哈希保持，不以当前文档覆盖来源。
- [维护测试](maintenance-tests.txt)：并行依赖／共用文件／集成缺项的负向检查，以及原有来源快照测试。
- [归档哈希检查](archive-check.json)：调整前卡片、索引与复核等原始快照保持。

当前任务状态全部为未执行。未重跑应用／浏览器／PDF、真实模型或另一系统，未提交、推送或部署；本文记录的是定义与工具验证，不是产品运行验收。
''')
print('Final ownership and historical entry points synchronized.')
