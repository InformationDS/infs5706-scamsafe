# Existing dependency finding

Read-only npm audit on 2026-10-26 reports body-parser 2.0.0–2.3.0 affected by GHSA-27r3-jxmh-p828 (high): denial of service through trailing bytes after a compressed request. Fixed range starts at 2.4.0.

Source: https://github.com/advisories/GHSA-27r3-jxmh-p828

This is in the original shared lockfile, not introduced by C01. package.json, package-lock.json and server/src/app.ts are A-owned and remain unchanged. A should update the shared dependency baseline and rerun integration checks. The local Host/Origin restrictions are not a claim that the dependency vulnerability is fixed.
