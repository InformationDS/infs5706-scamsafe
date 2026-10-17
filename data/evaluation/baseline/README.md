# 固定来源包

[T09.source.json](T09.source.json)保留原始来源哈希、人工输入及参考正文；其approvals全部pending，仅记录来源身份，不是当前批准登记。

原始字节固定于[evidence/preparation/source-snapshot](../../../evidence/preparation/source-snapshot/README.md)，sourceSnapshots按原路径定位对应.txt。原sourceHashes不刷新，避免当前PRD正常编辑改变历史证据。片段与哈希检查读取固定快照，当前产品规则仍只读[PRD](../../../docs/product/PRD.md)。

运行python scripts/maintenance/check_preparation.py应返回passed，只证明固定来源未变。当前批准见[data/business](../../business/README.md)，不从来源包恢复案件或推定员工审核。
