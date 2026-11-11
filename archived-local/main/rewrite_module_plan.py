from pathlib import Path
import json
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]
assert ROOT.name == 'GroupAssignment'
ARCHIVE = ROOT / 'evidence/task-restructure/module-plan-source'
ARCHIVE.mkdir(parents=True, exist_ok=True)

def write(name, text):
    path = ROOT / name
    assert path.resolve().is_relative_to(ROOT.resolve())
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text.strip() + '\n', encoding='utf-8')

manifest = []
old_names = sorted((ROOT / 'docs/project/tasks').glob('*.md'))
for path in old_names:
    target = ARCHIVE / (path.name + '.txt')
    if not target.exists():
        target.write_bytes(path.read_bytes())
    manifest.append({'source': path.relative_to(ROOT).as_posix(), 'snapshot': target.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
for name in ['docs/project/task-map.json', 'docs/project/TASKS.md', 'docs/project/TEAM_EXECUTION.md', 'docs/project/reviews/2026-10-17-documentation-review.md', 'docs/project/reviews/2026-10-17-documentation-rereview.md']:
    path = ROOT / name
    target = ARCHIVE / (name.replace('/', '__') + '.txt')
    if not target.exists():
        target.write_bytes(path.read_bytes())
    manifest.append({'source': name, 'snapshot': target.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
write('evidence/task-restructure/module-plan-source/manifest.json', json.dumps(manifest, ensure_ascii=False, indent=2))

runtime = ['shared/runtime.ts', 'shared/module-ports.ts', 'shared/runtime-fixtures.ts', 'docs/architecture/MODULE_CONTRACTS.md', 'data/evaluation/prototype.json']
common = ['docs/product/PRD.md', 'docs/architecture/RUNBOOK.md', 'data/business/T09.json']
cards = []
def card(id, title, phase, deps, reqs, reads, writes, creates, gate, steps, checks, prd):
    cards.append(dict(id=id, title=title, role=id[0], phase=phase, dependencies=deps, requirements=reqs, reads=reads, writes=writes, creates=creates, gate=gate, steps=steps, checks=checks, prd=prd))

card('A01', '准备可并行开发的公共起点', 'prepare', [], ['FR-01','FR-02','FR-09','FR-11','FR-12'],
    common + ['shared/schema.ts','shared/core.ts','shared/business.ts','app/src/Workbench.tsx','server/src/app.ts','docs/architecture/CONTRACTS.md'],
    ['shared/schema.ts','shared/core.ts','shared/index.ts','shared/business.ts','shared/export-schemas.ts','shared/write-schemas.ts','app/src/main.tsx','app/src/Workbench.tsx','app/src/style.css','server/src/app.ts','package.json','docs/architecture/CONTRACTS.md','docs/architecture/RUNBOOK.md','docs/project/STATUS.md','docs/project/FOUNDATION_READINESS.md'],
    runtime + ['app/src/module-preview.tsx','app/src/runtime-storage.ts','tests/runtime-foundation.test.ts','tests/module-browser.ts','data/schemas/RuntimeCaseRecord.schema.json','data/schemas/RuntimeExportSnapshot.schema.json'], '',
    [
    '先按现有RUNBOOK执行npm run check、npm run check:business和npm run build，记录当前基座。复用获批技术与业务包，不重新选框架，不把pending模拟审核改成真实审核。',
    '在shared/runtime.ts确定运行案件、来源、字段／记录ID、版本、首次与最终审核、建议决定和输出依赖的统一结构；在shared/module-ports.ts明确模型分析、案件更新、建议和输出的输入／返回／错误／失效约定。写入MODULE_CONTRACTS，列每个模块的导出名称、props、回调、HTTP结构、保存确认和异步请求身份，不把接口设计留给四位成员各自决定。',
    '实现app/src/runtime-storage.ts：运行案件保存、刷新恢复、列表／打开和JSON备份基础。按PRD保护未保存修改、校验坏备份和同号确认。导入遇到未保存修改的组合规则未定时，先标为未支持并阻止覆盖，交A确认PRD后再开放；不自行增加弹窗行为。',
    '提供可直接启动的module-preview及固定注入端口：URL分别为/?module=intake、model、guidance、outputs；自动发现对应模块入口，不要求成员改主页面。无真实模块时显示明确的模拟替身。给B/C/D/E准备实际可显示的输入、模拟响应、保存回调、错误及重置操作，不能只交空函数签名。C的服务适配调用点由A预接到现有app.ts，C不需要修改公共路由。',
    '在runtime-fixtures及prototype.json给出T09主线与独立变体：2000→200、旧请求晚返回时250、部分回答／未知、3轮9问、主动结束、拒绝REC-03、角色／指引失效、无指引摘要、单稿编辑、保存／输出失败。每项写来源、动作、确定预期与禁止结果。新增角色或内容由A实际审阅；负向变体只供模拟，不进入正常批准配置。完整十五例保留扩展验收范围，不作为四模块开工条件。',
    '在MODULE_CONTRACTS固定B/C/D/E入口及文件所有权；在package.json提供npm run check:module -- 模块名 证据目录，实际验证四个模拟入口及重置。同步运行schema生成物与契约，记录生成器实际影响范围和差异。禁止覆盖固定来源快照或修改批准登记凑校验。',
    '运行核心、业务包、构建和module检查；把四模块使用的同一副本、输入、实际命令、URL及可观察预期填好后一次发放。未来模块尚未实现；通过仅表示公共起点就绪。'
    ], [
    ('四个module URL及固定注入', '都能启动、加载、重置；不依赖其他模块已完成，替身有mock标记'),
    ('运行结构／保存／模拟审核', '身份不混淆；保存成功才显示已保存，模拟审核不能成为真实审核'),
    ('T09及无指引预期', '独立变体可定位；当前200／晚返回250不串位，预期不从模型结果反推')
    ], '第2–3节、4.1–4.5、第6–7节；只准备共同结构、保存及固定输入，不提前包办四模块业务。')

card('B01', '完成案件录入、事实核对与补问模块', 'module', ['A01'], ['FR-02','FR-03','FR-04','FR-05'],
    common + runtime + ['app/src/components/CasePanel.tsx','app/src/components/AnalysisPanel.tsx'],
    ['app/src/components/CasePanel.tsx','app/src/components/AnalysisPanel.tsx'],
    ['shared/intake.ts','app/src/modules/intake/index.tsx','app/src/modules/intake/useIntake.ts','app/src/modules/intake/style.css','tests/intake.test.ts'],
    'A01公共结构、固定输入、模拟分析端口、保存回调和intake独立页面已实际验收；不等待C01、D01或E01。',
    [
    '启动A01发放的/?module=intake，使用固定分析替身，按prototype.json独立加载T09；记录接收模块的具体函数／回调，不自行定义第二套案件状态。',
    '实现自由描述输入、来源记录、事实／候选类型展示、更正、冲突候选及首次核对；金额2000→人工200后重读原文不覆盖人工值。按币种／交易状态汇总，多笔交易答案不串位，未知不变成否或0。',
    '实现当前轮问答、部分回答、未知／无法回答／不适用、结束及后补答案；字段＋记录目标和问题ID稳定。展示并保存成功才计数，失败重试不重复；3轮9问和未知不重复问由程序控制。',
    '完成本模块界面、样式和事件绑定；首次核对后直接变更需确认，正常补问更新在最终审核处理。通过A01命令端口返回状态变化及失效信息，不在本模块匹配指引或生成草稿。',
    '用固定正常／无效／延迟分析返回检查失败与人工保护；模型端口可换成C实现但不等待它。不改A主页面、公共schema或全局CSS。',
    '运行npm run check、npm run build和A01实际验过的intake模块检查；交回完整模块、固定操作和结果。后续集中修复仍追加本卡批次，不另开展示卡。'
    ], [
    ('T09更正200、旧请求期间改250', '人工值／历史／候选保留；旧响应不覆盖新事实或审核'),
    ('1轮3问仅答Q1，随后未知／结束／后补', '留同轮，计数稳定，不重复问或自动重开'),
    ('corrected／stale独立变体', 'corrected当前200；stale当前250，200为历史，失效信息可供E阻断输出'),
    ('零题、3轮／9问、保存失败', '零题不计；上限不新增题；失败不虚报已保存')
    ], 'FR-02/03/04/05、4.1、4.2、4.4变更规则及第5–6节。')

card('C01', '完成模型接入、分析与API设置模块', 'module', ['A01'], ['FR-02','FR-03','FR-05','FR-12'],
    common + runtime + ['server/src/model.ts','server/src/model-settings.ts','server/src/config.ts','shared/model-settings.ts','app/src/components/ModelSettings.tsx','server/prompts/intake.txt'],
    ['server/src/model.ts','server/src/model-settings.ts','server/src/config.ts','shared/model-settings.ts','app/src/components/ModelSettings.tsx','server/prompts/intake.txt','tests/model-settings.test.ts'],
    ['app/src/modules/model/index.tsx','app/src/modules/model/style.css','tests/model.test.ts'],
    'A01已冻结分析输入／响应及调用点，model独立页面和固定案件可运行；不等待B01。',
    [
    '用/?module=model及A01提供的案件调用点开始，复用产品内API设置及服务适配器；保持默认Mock，可独立检查服务，不要求B先交界面。',
    '按冻结接口支持自由叙述及已有来源／记录的事实提议、候选分类、依据、缺口和补问提议；严格校验返回。模型不创建角色、批准、审核，不决定问题计数。原始叙述中的新记录按A01约定产生稳定候选ID，由B确认／合并，不沿用只允许已有固定字段的基座限制。',
    '更新实际intake提示与输出结构说明，未知／否／冲突分开、英语输出、保留来源、保护人工更正；建议仍由D生成。问题带目标与理由，但是否开轮和计数由B控制。',
    '实现超时、结构失败、当前请求与配置快照标识；失败保留原输入。设置保存不调用模型，密钥不回显、不进案件备份；保存失败保留旧配置。',
    '用本地假提供商核对T09、人工更正、指令干扰和无效响应；实际真实调用由人类在产品配置并主动执行，记录所用模型和结果。没有真实调用就标未执行，不为交卡索要密钥。',
    '运行npm run check、npm run build和A01实际验证的model模块检查；交实现、提示及失败结果，不另建十五例比较模板。主app.ts、package与公共运行schema变更交A处理。'
    ], [
    ('T09固定输入／未知／输入指令干扰', '有来源、候选及不确定性；不捏造事实、权限或审核'),
    ('timeout／invalid／delayed及配置变化', '可理解错误，旧响应有身份可拒绝，不伪装新配置结果'),
    ('API保存／清除／重启／备份', '不自动调用、不回显密钥；失败保持旧设置，备份无凭证'),
    ('Mock与真实模型', '分别记录；真实未运行不写通过')
    ], 'FR-02/03/05/12、模型设置、4.1、4.2及第6节。')

card('D01', '完成岗位、指引匹配与建议模块', 'module', ['A01'], ['FR-01','FR-06','FR-07','FR-09'],
    common + runtime + ['data/business/role.json','data/business/guidelines.json','data/business/approval.json','shared/business.ts','docs/product/examples/APPROVED_BASELINE.md'], [],
    ['shared/guidance.ts','app/src/modules/guidance/index.tsx','app/src/modules/guidance/style.css','tests/guidance.test.ts'],
    'A01提供运行事实、批准包读取端口及guidance独立页面，负向配置与有效配置分离；不等待B01或C01。',
    [
    '在/?module=guidance用固定T09事实与实际批准包开始；先核对岗位、接收方、EX-G01–03 v1及来源，不改批准内容或哈希。',
    '实现机构／岗位选择、权限边界与确定性指引匹配；检查批准、有效性、必须满足、允许未知、冲突及来源，不能只靠类型名称命中。部分缺依据仅省略对应步骤并解释。',
    '实现相关机构／本岗位事项、优先级与依赖展示，简单风险关注提示仅用A01已审阅触发条件；未核对与依据失效清楚标注，不评分。',
    '完成建议接受／修改／拒绝、理由和Employee edited历史；拒绝不删事实，重算不自动撤销选择。输出受影响建议版本与依赖信息，由E更新关联输出。',
    '实现角色／指引变更，事实、首次核对历史及计数不重置；无有效依据时返回固定英文提示及仅事实摘要资格，不生成机构路径或交接建议。完成本模块UI和事件绑定，不等待其他模块。',
    '运行npm run check:business、npm run check、npm run build及guidance模块检查；交回实现和固定匹配／拒绝／失效结果。需扩业务内容时先交A审阅，不自行刷新批准登记。'
    ], [
    ('T09有效EX-G01–03', '建议引用编号／版本及事实，负责人和并行顺序明确，不宣称已执行'),
    ('拒绝REC-03再重算', '理由保留，依赖变化可供E更新；拒绝不换ID复活'),
    ('未审核／失效／冲突／权限不足', '对应步骤不输出；零匹配返回Insufficient approved guidance; human review required'),
    ('切换角色、有限风险提示', '保留事实与题数，受影响依据变化；提示有来源，失效不继续有效')
    ], 'FR-01/06/07/09、4.3、风险关注提示及4.4建议决定／权限变更。')

card('E01', '完成摘要草稿、最终审核与输出模块', 'module', ['A01'], ['FR-08','FR-09','FR-10'],
    common + runtime + ['app/src/export/OutputPanel.tsx','shared/export.ts','docs/product/examples/APPROVED_BASELINE.md'],
    ['app/src/export/OutputPanel.tsx','shared/export.ts'],
    ['shared/outputs.ts','app/src/modules/outputs/index.tsx','app/src/modules/outputs/style.css','tests/outputs.test.ts'],
    'A01提供事实、模拟建议／决定、保存回调及outputs独立页面；不等待B01、C01或D01。',
    [
    '在/?module=outputs使用A01的运行结构、固定T09事实与模拟建议。参考批准正文生成未审核摘要和银行／电信草稿，不能直接加载参考审核为真实员工通过。',
    '实现输出对象版本、依赖、编辑历史和Employee edited标记；生成／重算保留员工内容并提示确认。拒绝建议不得继续作为待执行事项，只有依赖受影响对象失效。',
    '完成最终审核界面及事件绑定；检查最新事实／分类、建议和各输出，保留不确定性。B负责首次核对，E消费其确认／变更信息；最终审核绑定对象与依赖，不要求无指引路径接受不存在的建议。',
    '实现统一快照资格与复制、Markdown／HTML／PDF正文；无指引只形成事实摘要。未保存、待确认或过期审核阻断；输出失败保留正文和有效审核，同版本可重试。向A提供可在服务端复验的纯函数，A02负责HTTP挂载，不在公共路由加另一套资格判断。',
    '完成本模块预览、排版和UI。样式放outputs/style.css并加模块作用域，不改全局CSS；用固定建议端口完成单稿修改／另一稿保持和两稿共享事实变更检查，不等D。',
    '运行npm run check、npm run build及outputs模块检查；实际生成PDF并逐页观察中文、长文本及表格，记录真实限制。交回模块和文件，不把单系统结果写为两系统都通过。'
    ], [
    ('T09摘要＋银行稿＋电信稿', '同一对象快照供预览／复制／双格式；版本与接收方准确'),
    ('改银行稿／改共用金额／拒绝REC-03', '分别只失效相关对象，拒绝动作不留在待执行正文，人工内容不静默丢失'),
    ('无指引摘要及模拟审核身份', '仅摘要可最终审核后输出；模拟替身与真实审核明确区分'),
    ('未保存／过期／输出失败／PDF', '资格阻断有效，故障不丢审核；PDF实际打开逐页核对')
    ], 'FR-08/09/10、4.3无指引路径、4.4、第6节输出失败。')

card('A02', '集成四模块并跑通完整原型', 'integrate', ['A01','B01','C01','D01','E01'], ['FR-01','FR-02','FR-03','FR-04','FR-05','FR-06','FR-07','FR-08','FR-09','FR-10','FR-11','FR-12'],
    common + runtime + ['shared/intake.ts','shared/guidance.ts','shared/outputs.ts','app/src/modules/intake/index.tsx','app/src/modules/model/index.tsx','app/src/modules/guidance/index.tsx','app/src/modules/outputs/index.tsx','app/src/runtime-storage.ts','server/src/model.ts'],
    ['app/src/main.tsx','app/src/Workbench.tsx','app/src/style.css','server/src/app.ts','server/src/index.ts','package.json','docs/architecture/CONTRACTS.md','docs/architecture/RUNBOOK.md','docs/project/STATUS.md','docs/project/FOUNDATION_READINESS.md'],
    ['app/src/PrototypeWorkbench.tsx','tests/prototype-browser.ts','docs/architecture/PROTOTYPE_RUNBOOK.md'],
    '四模块实现及局部检查已由A接收，文件基于同一A01结构；有失败必须明确，未完成实现不能用报告接收代替。',
    [
    '核对四份副本与允许差异，先收齐再集中合并；模块内部问题退回原卡修复，不把全部业务重新写在主页面。跨模块共享结构由A调整并通知受影响成员一次同步。',
    '在PrototypeWorkbench连接C分析→B更正／首次核对／补问→D指引及建议→E摘要／草稿／最终审核／输出；接上A01保存与列表入口。每次变更通过统一状态端口，禁止各面板持有相互不同的当前案件。',
    '在公共服务挂载C模型与E输出校验，服务端重建并验证快照后导出。API配置、角色／指引变化和旧请求检查用同一案件／依赖身份；拒绝建议传播到输出，不用全案版本使无关草稿全部失效。',
    '实际从自由输入走通T09，不能用Load training state跳过提取／补问／审核。再走无指引摘要；保存刷新恢复、错误重试和多案不串案。使用mock时明确模式；真实调用由人类配置并主动完成。',
    'PROTOTYPE_RUNBOOK写实际命令、URL、按钮、固定输入／答案、观察预期和重置。提供超时、无效响应、保存／输出失败、旧请求、上限、低权限／无指引的受控入口；F只操作，不改公共代码造故障。',
    '接入npm run check:prototype -- 证据目录，执行check、check:business、build和原型浏览器检查；把一个完整集成副本及简短操作交F。现有固定基座check:browser保留，其通过不能代替完整流程。'
    ], [
    ('T09从输入到审核输出', '使用真实模块和同一运行案件；没有模拟替身冒充已接通模块'),
    ('无指引／拒绝／事实更正／单稿编辑', '边界、依赖失效及重审正确，未保存或失效不导出'),
    ('保存刷新／两案／请求与配置变化', '记录不串案，旧响应不覆盖新案或更正，密钥不进案件'),
    ('给F的运行说明', '按钮及故障入口真实存在，预期事先确定，未执行项如实保留')
    ], '第3–6节；按各模块实际接口集成，不重新定义产品行为。')

card('F01', '集中检查原型并提交缺陷', 'verify', ['A02'], ['FR-01','FR-02','FR-03','FR-04','FR-05','FR-06','FR-07','FR-08','FR-09','FR-10','FR-11','FR-12'],
    common + ['docs/architecture/PROTOTYPE_RUNBOOK.md','data/evaluation/prototype.json'], [], [],
    'A02已交完整副本和实际步骤；F从安装运行开始集中检查，不提前穿插模块开发。',
    [
    '在实际检查电脑按RUNBOOK安装和启动，记录系统、路径、Node／浏览器及副本；先确认默认Mock，保留现有数据。只对实测电脑下结论，不等待六台电脑都完成。',
    '按PROTOTYPE_RUNBOOK走T09输入、更正200、首次核对、部分回答／未知／结束、建议决定、摘要两稿、最终审核与复制／双格式；核对PDF实际内容与标记。',
    '独立检查无指引摘要、人工更正保护、3轮9问／重试、拒绝传播、角色权限、单稿编辑失效、保存刷新及原型实际提供的失败入口。不要从页面结果反推标准答案。',
    '检查演示采用的真实模型时，由人类主动调用，记录实际结果；mock、真实、失败及未执行分开。完整T01–T15作为扩展覆盖可按已准备输入继续检查，不因未准备而阻塞第一轮原型报告，不声称全范围通过。',
    '把问题集中编号为F01-001等，记录最短输入／动作／预期／实际／证据及所属模块。一次提交汇总，A统一分派；F不改产品实现或验收标准。报告包含失败仍可被接收，供F02进入复测。'
    ], [
    ('T09与无指引路径', '有实际逐步结果及输出文件；缺入口记失败／未执行'),
    ('关键失效、权限、问题上限及恢复', '任何影响演示或关键边界的问题列为交付阻塞，不被多数通过抵消'),
    ('模式及环境', '只写实际模型与系统，不复制作者结果代替独立检查')
    ], '第7节；规则细节只按PROTOTYPE_RUNBOOK引用的条款查阅。')

card('F02', '集中复测并给出原型结论', 'retest', ['F01'], ['FR-02','FR-05','FR-06','FR-09','FR-10','FR-11','FR-12'],
    common + ['docs/architecture/PROTOTYPE_RUNBOOK.md','data/evaluation/prototype.json'], [], [],
    'F01报告已接收；A汇总B/C/D/E及公共修复为一个副本，未修复项保留阻塞。无缺陷也可检查最终副本，不虚构修复。',
    [
    '接收A统一修复副本与缺陷对应说明，按F01编号原始输入／步骤逐项复测，保留首次失败，不为每个成员反复收不同副本。',
    '原责任人集中修复：B案件与补问、C模型、D指引建议、E审核输出；A负责公共保存及跨模块问题。F只执行，未收到修复的项不得标解决。',
    '在最终副本完整重走T09和无指引路径。提示或结构变更至少补跑受影响演示步骤；不要求为本轮修复建立全十五例回归工程。模型、输出及环境的未验证范围明确保留。',
    '给出“可演示／仍阻塞”结论、实际模式和环境、已知限制。阻碍启动、核心流程或导致越权／审核错误／数据丢失的问题未解决时不得写可演示；报告真实完整可以接收，但A03交付须有可演示结论。'
    ], [
    ('同缺陷同输入复测', '保留原编号及失败；有实际结果，不以代码已改替代通过'),
    ('最终T09／无指引', '完整路径通过，注明真实／mock和实际运行电脑'),
    ('仍失败或未验证', '明确阻塞或限制，不包装成完整PRD验收')
    ], '第7节及实际缺陷关联条款；不新增验收规则。')

card('A03', '整理可运行原型与交付说明', 'deliver', ['F02'], ['FR-10','FR-11','FR-12'],
    common + ['README.md','docs/project/STATUS.md','docs/architecture/PROTOTYPE_RUNBOOK.md','deliverables/README.md'],
    ['README.md','docs/architecture/RUNBOOK.md','docs/architecture/PROTOTYPE_RUNBOOK.md','docs/project/STATUS.md','docs/project/FOUNDATION_READINESS.md','deliverables/README.md'],
    ['deliverables/LOCAL_DELIVERY.md'],
    'F02结论为可演示，启动与核心流程问题解决；限制及未执行项明确。只收到仍阻塞报告不满足交付门槛。',
    [
    '核对最终副本及F02实际结果，列明已实现、实际验证、mock／真实模型、实际系统与限制，不把单例通过写成十五例或全部PRD通过。',
    '整理完整源码、锁文件与必要数据，排除node_modules、dist、.env、local和机器缓存。保留模拟标记与批准来源；不只交dist，不复制开发者密钥。',
    'LOCAL_DELIVERY写准确安装、启动、模型设置、T09／无指引演示、保存刷新与所用输出格式，指向最终操作说明；尚未支持的功能明确说明。',
    '按说明在实际演示电脑确认启动并走一次核心流程，更新当前状态与入口。缺陷回原模块卡集中修复，F02复测；不新增反复穿插的任务。成果先本地交用户，不自动提交、推送或部署。'
    ], [
    ('完整交付项目', '按说明在演示电脑可启动并走核心流程，不依赖A本机路径或凭证'),
    ('最终说明', '实际功能、模式、验证及未覆盖范围一致，无虚构完成状态')
    ], 'FR-10/11/12、第7节及原型实际交付范围。')

for item in cards:
    ident = item['id']
    deps = '、'.join(f'[{d}]({d}.md)' for d in item['dependencies']) or '无开发任务前置；从当前实际基座开始。'
    references = '\n'.join(f'- [{p}](../../../{p})' if (ROOT / p).exists() else f'- `{p}`：由前置卡交付，实际存在并验收后读取。' for p in item['reads'])
    changes = '、'.join(f'`{p}`' for p in item['writes']) or '无现有程序文件；只记录本卡与证据。'
    creates = '、'.join(f'`{p}`' for p in item['creates']) or '无程序新文件。'
    steps = '\n'.join(f'{i}. {s}' for i,s in enumerate(item['steps'], 1))
    checks = '\n'.join(f'| {a} | {b} |' for a,b in item['checks'])
    body = f'''# {ident}：{item['title']}

## 目标与责任

建议角色：{item['role']}；真实成员待A指派。产品要求：{', '.join(item['requirements'])}。本卡交付包含本责任范围的界面、逻辑、事件绑定及局部检查；检查卡只观察与记录。一次集中交付，后续集中修复追加本卡批次。

## 开工条件

依赖：{deps}

{item['gate'] or '执行本卡是准备公共起点，不要求B/C/D/E已实现。当前用户授权的文档优化不等于本卡已执行。'}

收到副本后回报本机路径，A确认实际成员、副本和文件范围再正式开发。代码任务按A01冻结接口开发，不自行改变PRD或公共结构；接口确有缺项交A一次协调。不要因其他并行模块未完成而等待或替它实现。

## 必读与固定输入

- [AGENTS](../../../AGENTS.md)、[当前状态](../STATUS.md)。
- [PRD](../../product/PRD.md)：{item['prd']}
{references}

只读本模块相关条款与文件。计划路径不表示当前已实现；A01以前未产生的运行接口不能凭名称猜测。

## 允许修改与交付

现有文件：{changes}

本卡新建：{creates}

另可更新本卡唯一记录及`evidence/task-results/{ident}/run-01/`；复测用run-02等新目录。成员只改自己模块，不改主页面、公共schema、全局CSS、package或其他模块（本卡明确列出的A职责除外）。模块style.css必须作用于自身根容器；不能用全局元素选择器影响其他模块。只交实际变化，凭证和真实个人信息不交付。方法见[文件交付](../../../CONTRIBUTING.md)。

## 顺序步骤

{steps}

## 固定检查与预期

| 固定输入／动作 | 应观察到的结果 |
|---|---|
{checks}

命令在项目根目录执行，Windows使用npm.cmd，macOS使用npm。模块命令和按钮在A01实际交付后填入工作包；未来命令不当作现成入口。Mock局部通过不代表真实模块已集成或真实模型通过。

## 停止、审核与完成条件

输入、接口或允许范围缺失时，只停止受影响部分并交A明确缺项；已具备的独立部分可继续。不得伪造批准、员工审核、实际操作或检查结果。实现卡须交可运行模块及局部结果，由A接收后进入集成；F报告可包含失败，接收报告不等于产品通过。

公共结构／版本等跨模块缺陷由A处理，模块内部缺陷回本卡集中修复。实际状态只记下方卡片或A明确指定的对应Issue，不在各处复制；STATUS由A汇总。文档定义不计作开发完成。

## 工作包与交付门槛

- 实际成员／本次系统：待指派。
- 基础副本编号／允许文件基线：待A发放；包括本地新增文件，不能只写Git HEAD。
- 本机绝对路径：收到解压副本后回报。
- 前置验收位置：待A确认；无前置写不适用。
- 实际命令／URL／固定输入及重置：待前置实际交付，按本卡固定检查填写。
- 人工交付渠道：待A指定；本机收集到local/delivery/{ident}/。

## 唯一执行记录

- 实际负责人：待A人工指派。
- 状态：待指派；本卡尚未执行。
- 对应Issue：无，当前以本卡为准。
- 工作路径／系统／浏览器／Node：待记录。
- 实际修改、命令及逐项观察：未执行。
- 模式／内容批准／真实审核：未执行，不继承基座结论。
- 失败、未执行项、证据及A接收：未执行。
- 集中修复批次及关联F缺陷：无。
'''
    write(f'docs/project/tasks/{ident}.md', body)

allowed = {c['id'] for c in cards}
old_ids = {f'A{i:02}' for i in range(1,9)} | {f'{r}{i:02}' for r in 'BCDE' for i in (1,2)} | {f'F{i:02}' for i in range(1,4)}
for path in old_names:
    if path.stem not in allowed:
        assert path.stem in old_ids and path.resolve().parent == (ROOT / 'docs/project/tasks').resolve()
        assert (ARCHIVE / (path.name + '.txt')).exists()
        path.unlink()

registry = {'scope': 'Current module-based task definitions; no implementation or acceptance claimed', 'tasks': [{k:v for k,v in c.items() if k not in {'steps','checks','prd'}} for c in cards]}
write('docs/project/task-map.json', json.dumps(registry, ensure_ascii=False, indent=2))

write('docs/project/TASKS.md', '''# 原型任务入口

当前9张任务卡，按“公共准备→四模块并行→集中集成→F检查→集中修复与复测→交付”执行。均为任务定义，尚未执行；公共基座的已有结果不继承为任务验收。

| 阶段 | 任务 | 责任 | 前置 |
|---|---|---|---|
| 1 | [A01](tasks/A01.md) 公共起点 | A：运行结构、接口、持久化底座、固定输入和独立模块预览 | 当前实际基座 |
| 2 并行 | [B01](tasks/B01.md) 案件与补问 | B：输入、事实／类型核对、更正、首次核对、补问及界面 | A01 |
| 2 并行 | [C01](tasks/C01.md) 模型分析 | C：API设置、模型适配、提示、结构校验、错误及界面 | A01 |
| 2 并行 | [D01](tasks/D01.md) 岗位与建议 | D：角色、指引匹配、建议决定、风险提示及界面 | A01 |
| 2 并行 | [E01](tasks/E01.md) 审核与输出 | E：摘要／草稿、编辑保护、最终审核、复制／双格式及界面 | A01 |
| 3 | [A02](tasks/A02.md) 集成完整原型 | A：装配四模块、公共服务、统一状态与保存、实际操作说明 | A01、B01、C01、D01、E01 |
| 4 | [F01](tasks/F01.md) 集中检查 | F：安装启动、T09与无指引流程、关键错误及缺陷报告 | A02 |
| 5 | [F02](tasks/F02.md) 集中复测 | F：在A汇总的修复副本复测，给出可演示／仍阻塞 | F01及实际修复副本 |
| 6 | [A03](tasks/A03.md) 原型交付 | A：最终项目、启动及演示说明、限制 | F02可演示结论 |

## 实施与等待

1. A01先实际完成统一结构、注入端口、固定预期及四个独立预览入口，再一次发同一基础副本给B/C/D/E。
2. 四人用固定替身独立开发：B不等C，D不等B，E不等D。每人交一个完整模块，包含自己界面、逻辑、绑定、样式和局部检查。
3. A02收齐后连接：输入→C分析→B核对／补问→D建议→E最终审核及输出，并接通A01保存。模块内部问题回原卡，不由A重写全部业务。
4. F01最后集中检查并汇总问题。A一次分派回原模块卡，成员集中修复，A整合为一个副本给F02；不为每个缺陷创建穿插任务。无缺陷也需F02复核最终副本。
5. A03只在可演示结论后交付。先跑通T09及无指引两条流程；完整十五例保留扩展覆盖，未跑不声称全PRD验收。

## 文件所有权

| 所有者 | 独占区域 |
|---|---|
| A | 公共runtime／ports／fixtures、持久化底座、主页面、公共路由、全局CSS、package、契约及最终操作说明 |
| B | shared/intake.ts、modules/intake/、CasePanel／AnalysisPanel及本模块测试 |
| C | 模型适配与设置文件、ModelSettings、实际提示、modules/model/及本模块测试 |
| D | shared/guidance.ts、modules/guidance/及本模块测试；批准包只读 |
| E | shared/outputs.ts、shared/export.ts、OutputPanel、modules/outputs/及本模块测试 |
| F | 自己的执行记录与证据；不改程序或预期 |

各模块样式有自身作用域；公共接口缺项交A统一调整。详细路径以卡和[task-map](task-map.json)为准。成员接收自己的模块卡，不必阅读其他模块全部实现。

## 开工与验证

成员、系统、副本、文件范围及实际入口由A发放时确认，真实路径在成员收到副本后记录；不伪填、不从目录存在推断就绪。[工作包](WORK_PACKAGE.md)与[文件交付](../../CONTRIBUTING.md)说明具体操作。

python scripts/maintenance/check_tasks.py只检查任务定义、依赖、文件所有权及FR映射，不运行任务。产品规则见PRD，实际范围见[STATUS](STATUS.md)。
''')

write('docs/project/TEAM_EXECUTION.md', '''# 团队执行规则

团队采用vibe coding，按功能模块分工。A准备共同起点并集成，B/C/D/E各完成一个模块的逻辑、界面、绑定及局部检查，F最后集中检查。两台Windows、四台macOS，真实成员映射由A确认；采用文件交A，不要求截止日期。

## 责任与执行顺序

| 成员 | 集中负责范围 | 卡 |
|---|---|---|
| A | 公共结构／端口、保存底座、固定输入、主页面与服务装配、集成修复及交付 | A01→A02→A03 |
| B | 案件输入、事实／类型更正、首次核对及补问 | B01 |
| C | API设置、模型请求、提示、响应校验与错误处理 | C01 |
| D | 岗位权限、指引匹配、建议决定与重算 | D01 |
| E | 摘要草稿、编辑、最终审核与输出 | E01 |
| F | 实际安装运行、集中缺陷报告及复测 | F01→F02 |

依赖与文件范围以[TASKS](TASKS.md)及各卡为准。A01完成后B/C/D/E同时使用同一基础副本；不互相等待、不接管别人的模块。A02收齐后集成，F不提前穿插开发。成员通常一轮模块开发加一轮集中修复。

## 并行开发约定

- A01必须交实际可运行的独立预览与固定输入、注入的模拟端口、可观察预期；不是只交类型或空签名。模块成员自行完成本模块内部逻辑及UI，不等待A先实现业务。
- 四模块接口以A01交付的MODULE_CONTRACTS为准。B消费模拟分析，D消费固定事实，E消费固定事实与建议；集成时换成真实实现，不另建状态系统。
- 首次核对归B，最终审核归E；问题提议归C，计数与合并归B；建议与权限归D；持久化、主页面及公共路由归A。依赖变化通过统一端口传递，不能互相直接写内部状态。
- 成员只改卡内独占路径，各自使用有作用域的样式；不同时改公共schema、全局CSS、主页面或package。接口缺项由A一次协调，受影响部分暂停，其余独立部分继续。
- 产品行为以PRD为准，字段语义以字典为准；业务批准与员工审核、mock与真实结果分开。实现选择可在模块内完成，产品规则冲突交A决定。

## 任务说明与执行记录

任务卡维护目标、输入、范围和预期；尚无对应Issue时，实际负责人、状态、结果只写该卡唯一执行记录。A明确切换到Issue后，卡只链接它，不复制动态状态。TASKS只索引依赖，STATUS由A汇总。

状态为待指派→进行中→待审核→已验收；模块已验收表示A接收其实现和局部结果，不表示产品已集成通过。F01/F02报告可以包含失败，报告接收不等于可交付。缺陷集中回原模块卡追加修复批次，保留原失败；F02只接收A汇总后的统一副本。跨模块及保存问题由A处理。

## 文件交付

A按[工作包](WORK_PACKAGE.md)给同一基础副本和各自允许文件，排除node_modules、dist、.env、local和缓存。成员收到后回报实际路径，再开始正式修改。按[CONTRIBUTING](../../CONTRIBUTING.md)只交本模块差异、本卡和证据，不整份覆盖项目，不自动提交、推送、建PR、部署或发送给他人。

证据放evidence/task-results/任务号/run-01/，复测run-02；密钥与真实个人信息不交付。F的每项观察写实际系统与模式；没有跨系统实测不声称两系统都通过，也不为跑原型建立多操作者证据汇合流程。

## 验证和修复

成员实际操作观察，A审核接口及集成，F独立检查最终流程。模型真实调用由人类在产品中配置并主动发起，agent不索要密钥或自动付费调用。T09及无指引先跑通；十五例为扩展覆盖，未跑项如实保留。越权、无依据动作、审核错误、计数错误及核心数据丢失不能用总体通过率抵消。

给agent的指令：按AGENTS、STATUS与已指派卡执行；核对副本和允许范围，使用A01固定替身独立完成本模块，不等待其他模块。公共接口变更交A；记录实际命令、观察和未执行项，只更新本卡；不提交或推送。
''')

write('docs/project/TEAM.md', '''# 小组成员

团队两台Windows、四台macOS；A是项目发起人，B–F为待确认成员代号，不自动对应账号。成员映射由A确认，不要求截止日期。

| 代号 | 完整责任 | 姓名 | GitHub用户名 |
|---|---|---|---|
| A | 公共起点、持久化、集中集成及交付 | 待填 | InformationDS |
| B | 案件录入、事实核对与补问模块 | 待填 | 待填 |
| C | 模型分析、API设置与错误处理模块 | 待填 | 待填 |
| D | 岗位、指引与建议模块 | 待填 | 待填 |
| E | 摘要草稿、最终审核与输出模块 | 待填 | 待填 |
| F | 集中检查、缺陷报告及复测 | 待填 | 待填 |

B/C/D/E各自实现逻辑、界面、绑定与局部检查；A准备后并行开发，A集成后F集中检查。具体卡和依赖见[TASKS](TASKS.md)，协作规则见[TEAM_EXECUTION](TEAM_EXECUTION.md)。本表不维护任务状态，实际结果只记对应卡或A明确指定的Issue。
''')

write('docs/project/WORK_PACKAGE.md', '''# 工作包发放清单

A01验收后，A一次向B/C/D/E发同一完整基础副本和各自模块卡；不要求其他三个模块已完成。F在A02集成后接收检查副本。接收、解压和回报本机路径不属于正式开发。

| 必要信息 | 填写方式 |
|---|---|
| 成员与系统 | A确认实际操作者 |
| 基础副本编号 | 能识别包含未提交文件的完整快照，不能只写Git HEAD |
| 文件范围／基线 | 依卡列出现有文件SHA256；新文件记本卡创建 |
| 实际工作路径 | 成员收到并解压后回报，不填写A电脑路径 |
| 独立入口 | A01已跑过的module URL、命令及重置，F使用A02实际操作说明 |
| 固定输入／预期 | 卡内检查及prototype.json，不能从模型输出反推 |
| 交付位置 | local/delivery/任务号/及A指定人工渠道 |

A确认信息后开始正式修改。缺真实入口或接口时保留未就绪，不能用模拟业务完成状态发放；替身可以用于独立开发，但必须有明确mock身份及确定预期。B/C/D/E分别交完整模块，成员不因其他模块未完成再次等待领卡。实际值写回本卡，不维护第二份状态表。

方法见[CONTRIBUTING](../../CONTRIBUTING.md)，清单见[DELIVERY_MANIFEST](DELIVERY_MANIFEST.md)。
''')

write('evidence/task-restructure/module-plan-source/README.md', '''# 任务重组来源快照

此目录仅保留任务调整前文件的原始字节，扩展名为.txt，不能作为当前执行指令。manifest.json记录来源、快照路径及SHA256。当前唯一任务入口是[当前任务](../../../docs/project/TASKS.md)。不从这些快照领取任务或判断当前状态。
''')
for name in ['2026-10-17-documentation-review.md','2026-10-17-documentation-rereview.md']:
    snapshot = 'docs__project__reviews__' + name + '.txt'
    write('docs/project/reviews/' + name, f'''# 历史文档复核记录

本文件保留复核来源入口，不是当前待办。用户已确定按完整功能模块并行开发，当前分工与依赖以[任务入口](../TASKS.md)和[团队规则](../TEAM_EXECUTION.md)为准。

原始复核正文见[只读来源快照](../../../evidence/task-restructure/module-plan-source/{snapshot})；它反映当时文件和分工，不能用于当前任务指派。任务重组不代表程序或任务已完成。
''')

print('Wrote', len(cards), 'current task cards and preserved source snapshots.')
