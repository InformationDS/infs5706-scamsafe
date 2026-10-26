# D01 首轮实现及复测步骤

本目录记录代码生成和检查启动失败，不代表应用或业务验收通过。15个业务测试用例已编写，尚未执行；没有浏览器截图、真实模型结果或员工最终审核记录。

## 本机环境及命令

工作目录：`/Users/wenlinsheng/Documents/ChatGPT/INFS5706 Team Work`。

系统：macOS；使用Codex内置Node v24.22.1。系统git因未安装Xcode工具不可用，改用Codex提供的git克隆仓库。系统没有npm，已将npm 11.6.2解压到忽略目录`local/tools/npm/`。初次npm ci因网络限制未完成；联网安装请求未获批准，安装停止。node_modules仅有未完成安装产生的空目录，不可视为已安装依赖。

原仓库锁文件和package.json未修改。未安装额外业务依赖，未提交、推送、建PR或部署。

本轮实际命令记录见`checks.json`。npm通过下列本地工具调用（功能等同npm命令，不改仓库脚本）：

```sh
PATH=/Users/wenlinsheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH /Users/wenlinsheng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node local/tools/npm/bin/npm-cli.js run check
```

## 依赖就绪后的复测

在有Node 24与npm的环境按RUNBOOK完成`npm ci`及浏览器安装，然后执行任务卡规定命令：

```sh
npm run check:business
npm run check
npm run build
npm run check:module -- guidance evidence/task-results/D01/run-02/guidance
```

模块检查仍是A01公共MOCK控件检查；真实D逻辑测试由`npm run check`包含的`tests/guidance.test.ts`执行，不能混同。

启动`npm run dev`，访问`http://127.0.0.1:5173/?module=guidance`，逐项人工观察：

1. 固定输入选择T09，Reset fixed input；有未保存弹窗时选择Discard changes and continue。点击Recalculate guidance。应出现REC-01–03，初始决定均pending；展示指引编号、版本、事实、来源、优先级和并行说明。未核对事实显示Reported — not yet checked。
2. 填写Employee identifier；在REC-03理由输入Duplicate information，点击Reject REC-03。再重算和重新加载指引，拒绝状态、理由、历史和REC-03编号应保留；事实、问题计数不变。
3. 修改REC-01正文并填写理由，点击Modify REC-01。应有Employee edited及原内容历史；接受后再重算，人工正文仍保留，未新增最终审核。
4. 切换为No drafting authority。已有建议仅作历史，不可决定；事实、首次核对历史和题数保留。恢复唯一批准岗位后重算。
5. 点击Suspend guidance。应显示固定无指引提示及过期状态，旧建议不可继续作为行动；重复重算不能自行解除过期。点击Reload approved guidance后按当前事实重算，旧拒绝仍保留。
6. 固定输入选择no-guidance并重置。应显示Insufficient approved guidance; human review required、仅事实摘要资格，无相关机构路径或行动建议。
7. rejected或output-error变体用于观察已有输出依赖。改变REC-03决定后应标明HANDOVER-TELCO需更新；D保留旧正文以供E更新，不能将历史正文当成当前可导出稿。A01固定mock状态可能使用较宽依赖，精确依赖传播另由单元测试覆盖。
8. Save runtime case成功后刷新，已保存的决定及历史应恢复。D不另造持久化机制，沿用公共存储。

上述步骤均为待执行，不能由本文件推定通过。

## 范围与对接

- 确定性匹配只支持当前批准包的三条教学指引。文本上下文按批准的S1/S3/S4/S5来源快照保守校验；新措辞不自动解释为满足，缺依据时转人工。
- 不创建第二个批准岗位；权限选择中的无权限项是对现有岗位的限制上下文。
- `evaluateGuidance`提供匹配原因、来源、未知项及仅摘要资格；`recalculateGuidance`更新受控运行案件；`decideRecommendation`保存员工选择；`activeRecommendations`及`actionableRecommendations`区分历史和可用建议。
- `guidanceHandoff`输出建议版本、依赖、决定、是否可作为行动及待更新输出ID。E须消费该接口或等价校验，重写受影响正文、移除拒绝动作并进行最终审核；本轮未修改E正文或公共导出服务。
- 为保留旧输出与审核引用，失效建议保存在历史数组中，以失效依赖排除；不能直接把整个recommendations数组当行动列表。
- 当前公共schema要求历史建议仍引用运行指引中的同ID／版本。因此跨版本替换或删除仍被引用的指引需A协调归档／迁移接口；本模块支持暂停及重载当前批准包，不自行改公共schema。
- 风险触发配置为空，不生成提醒或评分。没有真实模型调用，没有外部发送或实际处置。
