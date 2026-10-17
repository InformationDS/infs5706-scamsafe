# 固定合成评估输入

当前T09批准输入、回答、事实及正文预期见[业务包](../business/README.md)。A01先建立prototype.json，提供T09和无指引及关键独立变体；四模块用固定替身并行开发，A02集成后F01观察、F02复测。新输入在实际产生并审阅前不当作已批准。

- [cases/](cases/README.md)、[expected/](expected/README.md)：可读输入和独立预期。
- [baseline/](baseline/README.md)：来源原文及哈希，保留pending身份，不是实际审核或执行结果。

完整十五例编号与扩展覆盖见[测试计划](../../tests/README.md)，后续由A组织补充并审阅，不作为首个原型集成前置。不得从模型输出反推预期。执行结果放evidence/task-results/任务号/批次/，不放本目录。
