$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$rootPrefix = $projectRoot.TrimEnd('\') + '\'
function Resolve-ProjectPath([string]$relativePath) {
    $absolutePath = [IO.Path]::GetFullPath((Join-Path $projectRoot $relativePath))
    if (-not $absolutePath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside GroupAssignment: $relativePath"
    }
    return $absolutePath
}
$map = [ordered]@{
    'PROJECT_STATUS.md' = 'docs/project/STATUS.md'
    'TASKS.md' = 'docs/project/TASKS.md'
    'ScamSafe_Prototype_PRD_工作稿.md' = 'docs/project/archive/ScamSafe_Prototype_PRD_工作稿.md'
    'ScamSafe_字段字典_v1.md' = 'docs/product/FIELD_DICTIONARY.md'
    'INFS5706 Team Project Assessment Guide.pdf' = 'references/assignment/Assessment_Guide.pdf'
    'INFS5706 Team Project Assessment Guide.md' = 'references/assignment/Assessment_Guide.md'
    'targeting-scams-report-2025.pdf' = 'references/accc/Targeting_Scams_2025.pdf'
    'targeting-scams-report-2025.md' = 'references/accc/Targeting_Scams_2025.md'
    'README_资料转换与下载清单.md' = 'references/CONVERSION_LOG.md'
    'references/accc_conversion_check.json' = 'evidence/reference-conversion/accc_conversion_check.json'
    'references/download_manifest.json' = 'evidence/reference-conversion/download_manifest.json'
    'tmp/download.py' = 'scripts/references/download_sources.py'
    'tmp/prepare_html.py' = 'scripts/references/prepare_html.py'
    'tmp/convert_accc.py' = 'scripts/references/convert_accc.py'
}
$directoryMap = [ordered]@{
    'references/originals' = 'references/unsw/originals'
    'references/markdown' = 'references/unsw/markdown'
    'references/assets/accc_pages' = 'references/accc/assets/pages'
    'tmp' = 'local/reference-work'
}
# Expand directory entries into explicit files before moving anything.
foreach ($entry in $directoryMap.GetEnumerator()) {
    $sourceDirectory = Resolve-ProjectPath $entry.Key
    if (Test-Path -LiteralPath $sourceDirectory) {
        foreach ($file in Get-ChildItem -LiteralPath $sourceDirectory -File -Recurse) {
            $sourceRelative = [IO.Path]::GetRelativePath($projectRoot, $file.FullName).Replace('\', '/')
            if ($map.Contains($sourceRelative)) { continue }
            $suffix = [IO.Path]::GetRelativePath($sourceDirectory, $file.FullName).Replace('\', '/')
            $map[$sourceRelative] = $entry.Value + '/' + $suffix
        }
    }
}
$records = @()
foreach ($entry in $map.GetEnumerator()) {
    $sourcePath = Resolve-ProjectPath $entry.Key
    $targetPath = Resolve-ProjectPath $entry.Value
    if (Test-Path -LiteralPath $sourcePath) {
        if (Test-Path -LiteralPath $targetPath) { throw "Target already exists: $targetPath" }
        $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
        $sourceLength = (Get-Item -LiteralPath $sourcePath).Length
        $targetParent = Split-Path -Parent $targetPath
        New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
        Move-Item -LiteralPath $sourcePath -Destination $targetPath
        if ((Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash -ne $sourceHash) {
            throw "Moved file hash mismatch: $targetPath"
        }
        $records += [pscustomobject]@{ source = $entry.Key; target = $entry.Value; bytes = $sourceLength; sha256_at_move = $sourceHash }
    } elseif (-not (Test-Path -LiteralPath $targetPath)) {
        throw "Source and target missing: $($entry.Key)"
    }
}
foreach ($relativeDirectory in @('tmp','references/originals','references/markdown','references/assets/accc_pages','references/assets')) {
    $candidatePath = Resolve-ProjectPath $relativeDirectory
    if ((Test-Path -LiteralPath $candidatePath) -and @(Get-ChildItem -LiteralPath $candidatePath -Force).Count -eq 0) {
        Remove-Item -LiteralPath $candidatePath # Empty directory only; never recursive.
    }
}
$recordPath = Resolve-ProjectPath 'evidence/reference-conversion/layout_migration.json'
if ($records.Count -gt 0) {
    @{ date = '2026-10-13'; timezone = 'Australia/Sydney'; files = $records } |
        ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $recordPath -Encoding utf8
}
Write-Output "Moved $($records.Count) files; all target paths stayed inside GroupAssignment and all hashes matched at move time."
