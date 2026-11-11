from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
def read(n):return (ROOT/n).read_text(encoding='utf-8-sig')
def write(n,s):
    p=ROOT/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s.rstrip()+'\n',encoding='utf-8')
def replace(n,a,b):
    s=read(n);assert a in s,(n,a[:60]);write(n,s.replace(a,b))

reg=json.loads(read('docs/project/task-map.json'))
for row in reg['tasks']:
    if row['id']=='C01':
        row['reads']=['server/prompts/intake.txt','data/business/T09.json','data/fixtures/intake.json','docs/architecture/RUNBOOK.md']
write('docs/project/task-map.json',json.dumps(reg,ensure_ascii=False,indent=2))

for path in (ROOT/'docs/project/tasks').glob('*.md'):
    n=str(path.relative_to(ROOT));key=path.stem;s=read(n)
    s=re.sub(r'交付方式：文件交 A。只交本卡允许文件的改动清单、实际结果与证据；不自行暂存、提交、推送、建 PR、部署或发送给外部人员。Git 分支／远端／PR 目标：不适用。',
        '交付方式：文件交A，按[CONTRIBUTING](../../../CONTRIBUTING.md)收集允许差异、本卡和证据；不执行Git交付。',s)
    s=s.replace('字段使用时只查 FIELD_DICTIONARY.md 对应组与字段；不要遍历全部参考资料。上列文件属于当前实际输入。依赖卡新建的文件仅在依赖验收后才作为本卡输入，不把计划路径当成已存在。',
        '字段只查字典对应项。前置卡新建文件在验收后读取，缺失时停止相关步骤，不按计划路径推定已存在。')
    common='''缺输入、接口冲突或需要范围外修改时，保留现场并停止受影响步骤，按[AGENTS](../../../AGENTS.md)报告具体缺项；不自行补架构、改业务规则或标准答案。

成员填写实际观察，A审核技术与集成。'''
    if key in ['C02','F02','F03']:
        common+='本卡交付是检查报告，真实完整可被接收，产品失败仍需修复。报告接收不等于产品通过，关键失败或必要真实／跨系统未执行仍阻止A08交付。'
    else:
        common+='本卡要求的交付与检查有证据、相关问题解决且A确认后才标已验收；不继承基座通过结论。'
    common+=f'\n\n证据写evidence/task-results/{key}/run-01/；复测使用run-02等新批次，保留首次失败。\n\n'
    s=re.sub(r'(?ms)(## 停止、审核与完成条件\n\n).*?(?=^## 工作包与交付门槛)',lambda m:m.group(1)+common,s,count=1)
    s=s.replace('（本卡明确允许STATUS时除外）','（仅本卡允许范围列出时可改STATUS）')
    if key=='C01':
        for filename in ['server/src/model.ts','shared/schema.ts','shared/source-text.ts','tests/server.test.ts']:
            s=s.replace(f'- [{filename}](../../../{filename})\n','')
        s=s.replace('- [data/business/T09.json](../../../data/business/T09.json)', '- [data/business/T09.json](../../../data/business/T09.json)\n- [固定intake输入](../../../data/fixtures/intake.json)：只查看analysis的实际字段，不改JSON。\n- [运行说明](../../architecture/RUNBOOK.md)')
    write(n,s)

replace('docs/architecture/RUNBOOK.md','node --version\nnpm --version\nnpm.cmd ci','node --version\nnpm.cmd --version\nnpm.cmd ci')
replace('docs/project/TEAM_EXECUTION.md','截图、脱敏日志及输出放各卡指定的evidence/task-results/编号/执行批次/','截图、脱敏日志及输出放各卡指定的evidence/task-results/编号/执行批次/；首次run-01、复测run-02，保留失败')
replace('docs/project/STATUS.md','B可基于实际组件和固定mock做展示；E01等待B01的CSS集成后做排版准备','B可基于实际组件和固定mock做展示；E01等待B01的CSS集成后做排版准备')
replace('docs/project/STATUS.md','## 验证与协作','''## 当前协作与产品约定

A06负责完整最小界面和事件绑定；E02在A06后操作运行输出，B02此后只调整事实区展示。工作包需填写副本、基线、实际入口和具体预期，当前开发卡仍未执行，未来页面／检查表没有因文档修订而实现。

PRD已确定原型采用轻量人工编辑标记和重审、不做文本语义拦截；未保存时新建／切换提供保存后继续、放弃后继续、取消，保存失败留原案；风险关注只保留有限合成提示，不做风险评分。这些是待相应A卡实现的产品要求，不是当前已通过的功能。

## 验证与协作''')
replace('docs/architecture/CONTRACTS.md','## 当前明确未实现','''## 目标规则与后续接口交付

PRD 4.4的Employee edited、4.5的未保存三选项及简单风险关注提示是当前产品要求，尚未据此扩展基座接口。A02/A03/A04/A05按卡实现后更新本契约及同源schema；A06接通最小完整界面与逐行验收入口。B/E只调整已接通的指定显示，不在组件内补业务控制。

## 当前明确未实现''')
replace('docs/project/reviews/2026-10-17-documentation-review.md','复核日期：2026-10-17（Australia/Sydney）。','复核日期：2026-10-17（Australia/Sydney）。本报告保留复核时发现，不作为当前指令；后续逐项文档修订见[优化结果](../../../evidence/documentation-optimization/README.md)。')
print('Common instructions consolidated; current status and future implementation boundaries aligned.')
