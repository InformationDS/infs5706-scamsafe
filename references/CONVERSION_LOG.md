# 资料处理记录

## 当前保留内容

- [作业指南编辑版](assignment/Assessment_Guide.md)：保留原 PDF 页码标记，但已删改，不是完整原文。
- [ACCC 转换版](accc/Targeting_Scams_2025.md)：正文、等宽表格、外部来源和 49 张页图。

## 历史处理

2026-10-12 转换作业指南、ACCC 报告及当时可访问的 UNSW 资料。ACCC 原 PDF 由用户下载；转换采用 pdfplumber 提取及 PDFium 渲染。Moodle 与时间工具按用户要求排除。

2026-10-13 先完成目录迁移，随后按用户明确要求删除 references/unsw 及两份原始 PDF；作业指南 Markdown 删除指定 AI 相关限制，并标记为编辑后的参考资料。删除不恢复任何资料副本。

## 当前校验依据

- [迁移历史](../evidence/reference-conversion/layout_migration.json)
- [授权删除记录](../evidence/reference-conversion/user_requested_removals.json)
- [作业指南编辑记录](../evidence/reference-conversion/assignment_edit.json)
- [最近仓库检查](../evidence/reference-conversion/repository_check.json)

迁移记录保留历史路径和哈希，不代表所有历史文件仍存在。检查脚本仅对仍保留的资料做存在性及哈希检查，并识别明确授权的删除。
