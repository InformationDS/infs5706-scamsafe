# 资料转换工具

转换输入由操作者另行提供；本目录不包含原 PDF。

- `convert_accc.py --source /path/to/report.pdf`：使用另行提供的 ACCC 原 PDF 重建 Markdown、页图及校验记录；不复制原 PDF 到仓库。需要 pdfplumber、pypdfium2、pypdf。
- `prepare_html.py --input-dir /path/to/html`：对另行提供的 HTML 预处理，输出至 local/reference-work；不独立完成 Markdown 转换。
- `download_sources.py`：默认不联网、不创建资料目录。仅显式使用 `--download` 时，将指定来源下载到 Git 忽略的本地目录。

仅在任务明确要求处理资料时运行转换工具。日常仓库检查使用 `python scripts/maintenance/check_repository.py`。
