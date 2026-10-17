# 分析提示入口

运行时唯一提示文件为[intake.txt](intake.txt)，适配器从该文件加载。职责和输出结构见[CONTRACTS](../../docs/architecture/CONTRACTS.md)，产品规则见[PRD](../../docs/product/PRD.md)。

C01只按当前结构核对提示；新增补问返回与程序控制由A02实现。成员只执行已指派的[任务卡](../../docs/project/TASKS.md)，不从本文件另领任务。固定输入与参考预期见[批准包](../../data/business/README.md)。
