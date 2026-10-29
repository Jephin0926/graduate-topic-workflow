import assert from 'node:assert/strict';
import { buildFirstPrompt, buildSecondPrompt, buildThirdPrompt } from '../src/prompts.js';
import { demoProfile, readingSlots, normalizeReadingCount, hydrateState } from '../src/data.js';

const first = buildFirstPrompt(demoProfile);
assert.match(first, /2020 年 1 月 1 日至今/);
assert.match(first, /文献 CSV/);
assert.match(first, /调研报告 PDF/);
assert.match(first, /文献编号/);
assert.match(first, /摘要（可获得时）/);
assert.equal(first.length <= 500, true, `首次提示词超过 500 字符：${first.length}`);
assert.doesNotMatch(first, /必须交付的文件/);
assert.doesNotMatch(first, /课题组已有电力系统/);
assert.doesNotMatch(first, /个人目标与偏好/);

const directions = Array.from({ length: 4 }, (_, index) => ({ id: `d${index}`, name: `方向${index}`, description: '方向定义' }));
const base = {
  profile: demoProfile, directions, selectedDirections: ['d0', 'd1', 'd2'], expansionYear: '2010', readingCount: '5',
  artifacts: { leapPdf: { name: '调研.pdf' }, leapCsv: { name: '文献.csv' } },
  keyMode: 'environment', apiKey: '', readings: {},
};
const second = buildSecondPrompt(base);
assert.match(second, /2010 年 1 月 1 日至今/);
assert.match(second, /7\. 5 篇/);
assert.match(second, /默认继承有效文献/);
assert.match(second, /第一轮保留文献/);
assert.match(second, /第二轮新增文献/);
assert.match(second, /累计继承说明/);
assert.match(second, /方向研究与精读指南\.md/);
assert.match(second, /文件名保持为“增补文献\.csv”/);
assert.match(second, /OPENALEX_API_KEY/);
assert.doesNotMatch(second, /unit-test-secret/);
assert.doesNotMatch(second, /个人卡片/);

const seven = buildSecondPrompt({ ...base, readingCount: '7' });
assert.match(seven, /7\. 7 篇/);
assert.doesNotMatch(seven, /7\. 5 篇/);
assert.match(buildSecondPrompt({ ...base, readingCount: '2' }), /7\. 5 篇/);
assert.equal(normalizeReadingCount('3'), 5);
assert.equal(normalizeReadingCount('7'), 7);
assert.equal(readingSlots('minimum', 3).length, 5);
assert.equal(readingSlots('seven', 7).length, 7);
assert.equal(hydrateState({ readingCount: 2 }).readingCount, '5');
assert.equal(hydrateState({}).readingCount, '5');

const direct = buildSecondPrompt({ ...base, keyMode: 'direct', apiKey: 'unit-test-secret' });
assert.match(direct, /unit-test-secret/);
assert.match(direct, /用户已明确选择/);

for (const id of base.selectedDirections) {
  base.readings[id] = readingSlots(id, base.readingCount).map((item, index) => ({ ...item, title: `文献${index}` }));
}
const noFulltext = buildThirdPrompt(base);
assert.match(noFulltext, /当前没有已上传全文/);
assert.match(noFulltext, /只输出候选选题框架/);
assert.match(noFulltext, /培养类型：学硕/);
assert.match(noFulltext, /课题组研究方向与基础/);
assert.match(noFulltext, /无需再向我索取第一轮文件/);
assert.match(noFulltext, /至少 30 篇/);
assert.match(noFulltext, /约占总正文 35%/);
assert.match(noFulltext, /科学问题→研究目标→研究内容/);
assert.match(noFulltext, /拟创新点、预期成果与进度安排/);
assert.match(noFulltext, /规范参考文献表/);
assert.match(noFulltext, /核心全文证据位置附录/);

base.readings.d0[0].status = 'full';
base.readings.d0[0].file = { name: 'full.pdf' };
const partial = buildThirdPrompt(base);
assert.match(partial, /当前只有部分全文/);
assert.match(partial, /可以生成候选选题论证报告/);
assert.match(partial, /不得把摘要或未获得材料写成已精读/);

for (const id of base.selectedDirections) {
  base.readings[id].forEach((item) => { item.status = 'full'; item.file = { name: `${item.title}.pdf` }; });
}
const complete = buildThirdPrompt(base);
assert.match(complete, /均已上传全文/);
assert.match(complete, /可以生成完整候选选题论证报告/);
assert.match(complete, /分别输出 \.docx/);

base.readingCount = '7';
for (const id of base.selectedDirections) {
  base.readings[id] = readingSlots(id, 7).map((item, index) => ({ ...item, title: `文献${index}`, status: 'full', file: { name: `文献${index}.pdf` } }));
}
assert.match(buildThirdPrompt(base), /均已上传全文/);
base.readings.d0.pop();
assert.match(buildThirdPrompt(base), /当前只有部分全文/);

console.log('PASS: 三次提示词、累计继承、30 篇引用与报告结构、个人信息隔离、key 两种模式、动态精读数量及全文分级。');
