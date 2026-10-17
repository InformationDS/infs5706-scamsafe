import { mkdirSync, writeFileSync } from 'node:fs';
import { fixtureNames, makeFixture } from './fixtures.js';
mkdirSync('data/fixtures', { recursive: true });
for (const stage of fixtureNames) writeFileSync(`data/fixtures/${stage}.json`, JSON.stringify(makeFixture(stage), null, 2) + '\n');
writeFileSync('data/roles/example-role.pending.json', JSON.stringify(makeFixture().role, null, 2) + '\n');
