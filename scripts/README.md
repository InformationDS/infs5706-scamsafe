# 辅助工具

- `maintenance/check_repository.py`：只读检查本地链接、字段定义、资料页码、页图与迁移来源哈希。
- `maintenance/migrate_initial_layout.ps1`：首次整理的记录性迁移脚本；已于 2026-10-13 运行。迁移路径已不再是日常项目入口。
- `maintenance/repair_migrated_links.py`：首次迁移的链接修复，完成后应跳过，避免重复按旧目录解释链接。
- `references/`：资料转换工具，依赖与使用方式见该目录 README。

不要自动执行迁移或联网下载作为应用启动步骤。
