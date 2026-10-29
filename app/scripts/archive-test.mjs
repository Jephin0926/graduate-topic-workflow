import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import { archiveEntries, createArchive, sanitizeArchiveState } from '../src/archive.js';
import { demoProfile } from '../src/data.js';

const file = (id, name) => ({ id, name, size: 8, type: 'application/octet-stream' });
const state = {
  profile: demoProfile,
  directions: [{ id: 'direction-1', name: '方向/一', description: '虚构方向' }],
  selectedDirections: ['direction-1'],
  readings: { 'direction-1': [{ title: '虚构全文一', status: 'full', file: file('reading-1', '全文.pdf') }] },
  artifacts: {
    leapPdf: file('leap-pdf', '报告.pdf'),
    leapCsv: file('leap-csv', '文献.csv'),
    researchMd: file('research-md', '方向研究.md'),
    expandedCsv: file('expanded-csv', '增补文献.csv'),
    finalReport: [file('final-1', '报告.pdf'), file('final-2', '报告.pdf')],
  },
  prompts: {
    first: '第一次提示词',
    second: '用户已明确选择在本次提示词中提供 OpenAlex API key：old-secret\n不要记录 current-secret',
    third: '第三次提示词',
  },
  keyMode: 'direct', apiKey: 'current-secret', keyConsent: true,
  expansionYear: '2010', readingCount: '5', stale: {}, activeStep: 'step3',
};
const fileBodies = Object.fromEntries(['leap-pdf', 'leap-csv', 'research-md', 'expanded-csv', 'final-1', 'final-2', 'reading-1'].map((id) => [id, new Blob([`content:${id}`])]));
const readFile = async (id) => fileBodies[id];
const entries = archiveEntries(state);
assert.equal(entries.filter((entry) => entry.kind === 'file').length, 7);
assert.equal(entries.filter((entry) => entry.kind === 'prompt').length, 3);
assert.equal(sanitizeArchiveState(state).apiKey, '');
assert.doesNotMatch(sanitizeArchiveState(state).prompts.second, /old-secret|current-secret/);

const all = await createArchive(state, entries.map((entry) => entry.id), readFile, new Date('2026-10-29T10:00:00Z'));
assert.equal(all.itemCount, entries.length);
const unzipped = unzipSync(new Uint8Array(await all.blob.arrayBuffer()));
assert.ok(unzipped['01_第一次调研/报告.pdf']);
assert.ok(unzipped['02_第二次调研/方向研究.md']);
assert.ok(unzipped['03_精读全文/方向_一/全文.pdf']);
assert.ok(unzipped['04_候选报告/报告.pdf']);
assert.ok(unzipped['04_候选报告/报告 (2).pdf']);
assert.equal(strFromU8(unzipped['03_精读全文/方向_一/全文.pdf']), 'content:reading-1');
const secondPrompt = strFromU8(unzipped['提示词/第二次交互提示词.txt']);
assert.match(secondPrompt, /\[已移除 OpenAlex API key\]/);
assert.doesNotMatch(secondPrompt, /old-secret|current-secret/);
const progress = strFromU8(unzipped['流程数据/选题工作台进度.json']);
assert.doesNotMatch(progress, /old-secret|current-secret/);
assert.equal(JSON.parse(progress).apiKey, '');
const manifest = JSON.parse(strFromU8(unzipped['档案清单.json']));
assert.equal(manifest.apiKeyIncluded, false);
assert.equal(manifest.itemCount, entries.length);

const subset = await createArchive(state, ['leap-pdf', 'reading-1'], readFile);
const subsetFiles = unzipSync(new Uint8Array(await subset.blob.arrayBuffer()));
assert.equal(subset.itemCount, 2);
assert.ok(subsetFiles['01_第一次调研/报告.pdf']);
assert.ok(subsetFiles['03_精读全文/方向_一/全文.pdf']);
assert.equal(subsetFiles['提示词/第二次交互提示词.txt'], undefined);
assert.equal(subsetFiles['02_第二次调研/方向研究.md'], undefined);

await assert.rejects(
  createArchive(state, ['leap-pdf'], async () => undefined),
  (error) => error.code === 'MISSING_FILES' && /文件本体缺失/.test(error.message),
);
await assert.rejects(createArchive(state, [], readFile), /EMPTY_ARCHIVE/);

console.log('PASS: 全产物可选、ZIP 目录与清单、同名文件去重、全文打包、子集导出、缺失文件拦截及新旧 API key 清除。');
