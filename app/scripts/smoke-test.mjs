import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';

const root = path.resolve(import.meta.dirname, '..');
const artifacts = path.join(root, 'artifacts');
const csvRows = ['Title,Researchers,Publication Date,Source Title,DOI,Cited By', ...Array.from({ length: 102 }, (_, index) => `虚构文献 ${index + 1},虚构作者,2024-01-01,虚构期刊,10.0000/demo.${index + 1},0`)];
const csvFile = { name: '虚构文献元数据.csv', mimeType: 'text/csv', buffer: Buffer.from(`﻿${csvRows.join('\n')}`) };
await mkdir(artifacts, { recursive: true });
const server = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '7102', '--strictPort'], { cwd: root, stdio: 'pipe' });
let browser;
const consoleErrors = [];
const pdfFile = { name: '调研报告.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% browser workflow fixture') };
const mdFile = { name: '方向研究与精读指南.md', mimeType: 'text/markdown', buffer: Buffer.from('# 方向研究\n\n仅用于浏览器流程测试。') };
const executablePath = process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch('http://127.0.0.1:7102/'); if (response.ok) { ready = true; break; } } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  assert.equal(ready, true, 'Vite server did not start');
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.goto('http://127.0.0.1:7102/', { waitUntil: 'networkidle' });
  assert.match(await page.title(), /选题工作台/);
  assert.equal(await page.locator('.step-link').count(), 4);

  await page.locator('#load-demo').click();
  await page.locator('[data-generate="first"]').click();
  const first = await page.locator('#prompt-first').inputValue();
  assert.match(first, /2020 年 1 月 1 日至今/);
  assert.equal(first.length <= 500, true, `首次提示词超过 500 字符：${first.length}`);
  assert.doesNotMatch(first, /必须交付的文件/);
  assert.doesNotMatch(first, /课题组已有电力系统/);
  assert.doesNotMatch(first, /个人目标与偏好/);
  await page.screenshot({ path: path.join(artifacts, 'step0-desktop.png'), fullPage: true });

  await page.locator('[data-step="step1"]').click();
  await page.locator('[data-artifact="leapPdf"]').setInputFiles(pdfFile);
  await page.locator('[data-artifact="leapCsv"]').setInputFiles(csvFile);
  await page.locator('#artifact-leapCsv').filter({ hasText: '虚构文献元数据.csv' }).waitFor();
  assert.match(await page.locator('#artifact-leapCsv').innerText(), /虚构文献元数据.csv/);
  await page.locator('[data-generate="second"]').click();
  let second = await page.locator('#prompt-second').inputValue();
  assert.match(second, /7\. 5 篇/);
  assert.match(second, /默认继承有效文献/);
  assert.match(second, /第一轮保留文献/);
  assert.match(second, /文件名保持为“增补文献\.csv”/);
  assert.doesNotMatch(second, /unit-test-secret/);

  await page.locator('input[name="key-mode"][value="direct"]').check();
  await page.locator('#api-key').fill('unit-test-secret');
  await page.locator('#key-consent').check();
  await page.locator('[data-generate="second"]').click();
  second = await page.locator('#prompt-second').inputValue();
  assert.match(second, /unit-test-secret/);
  await page.locator('input[name="key-mode"][value="environment"]').check();
  await page.locator('[data-generate="second"]').click();
  assert.doesNotMatch(await page.locator('#prompt-second').inputValue(), /unit-test-secret/);
  await page.locator('[data-step="step2"]').click();
  await page.locator('[data-artifact="researchMd"]').setInputFiles(mdFile);
  await page.locator('[data-artifact="expandedCsv"]').setInputFiles(csvFile);
  const priorities = page.locator('[data-priority]');
  for (let index = 0; index < 2; index += 1) await priorities.nth(index).check();
  assert.equal(await page.locator('.reading-group').count(), 2);
  assert.equal(await page.locator('[data-reading-title]').count(), 10);
  await page.locator('#demo-readings').click();
  await page.locator('[data-reading-title]').first().fill('需要保留的虚构题名');

  await page.locator('[data-step="step1"]').click();
  await page.locator('#reading-count').fill('3');
  await page.locator('#reading-count').press('Tab');
  assert.equal(await page.locator('#reading-count').inputValue(), '5');
  await page.locator('#reading-count').fill('7');
  await page.locator('#reading-count').press('Tab');
  await page.locator('[data-generate="second"]').click();
  second = await page.locator('#prompt-second').inputValue();
  assert.match(second, /7\. 7 篇/);
  await page.screenshot({ path: path.join(artifacts, 'step1-desktop.png'), fullPage: true });

  await page.locator('[data-step="step2"]').click();
  assert.equal(await page.locator('[data-reading-title]').count(), 14);
  assert.equal(await page.locator('[data-reading-title]').first().inputValue(), '需要保留的虚构题名');
  await page.locator('#demo-readings').click();
  await page.locator('[data-generate="third"]').click();
  let third = await page.locator('#prompt-third').inputValue();
  assert.match(third, /当前没有已上传全文/);
  assert.match(third, /只输出候选选题框架/);
  assert.match(third, /课题组研究方向与基础/);

  const firstReadingFile = page.locator('[data-reading-file]').first();
  await firstReadingFile.setInputFiles(pdfFile);
  await page.locator('[data-generate="third"]').click();
  third = await page.locator('#prompt-third').inputValue();
  assert.match(third, /当前只有部分全文/);
  assert.match(third, /可以生成候选选题论证报告/);
  await page.screenshot({ path: path.join(artifacts, 'step2-desktop.png'), fullPage: true });

  await page.reload({ waitUntil: 'networkidle' });
  assert.match(await page.locator('#prompt-third').inputValue(), /候选选题/);
  assert.equal(await page.locator('#panel-step2').isVisible(), true);
  assert.equal(await page.locator('[data-reading-title]').count(), 14);
  assert.match(await page.locator('#artifact-leapCsv').innerText(), /虚构文献元数据.csv/);

  await page.locator('[data-step="step3"]').click();
  await page.locator('[data-artifact="finalReport"]').setInputFiles({ name: '候选选题论证报告.md', mimeType: 'text/markdown', buffer: Buffer.from('# 候选选题论证报告') });
  assert.match(await page.locator('#archive-summary').innerText(), /虚构文献元数据.csv/);
  assert.match(await page.locator('#archive-summary').innerText(), /调研报告.pdf/);
  await page.screenshot({ path: path.join(artifacts, 'step3-desktop.png'), fullPage: true });

  await page.locator('#open-archive-export').click();
  assert.equal(await page.locator('#archive-dialog').isVisible(), true);
  assert.equal(await page.locator('[data-archive-entry]').count(), 11);
  assert.equal(await page.locator('[data-archive-entry]:checked').count(), 11);
  await page.screenshot({ path: path.join(artifacts, 'archive-export-dialog.png'), fullPage: true });
  const [archiveDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#confirm-archive-export').click()]);
  const archivePath = path.join(artifacts, 'full-archive.zip');
  await archiveDownload.saveAs(archivePath);
  const archive = unzipSync(await readFile(archivePath));
  assert.ok(archive['01_第一次调研/调研报告.pdf']);
  assert.ok(archive['02_第二次调研/方向研究与精读指南.md']);
  assert.ok(archive['03_精读全文/短期与日前负荷预测/调研报告.pdf']);
  assert.ok(archive['04_候选报告/候选选题论证报告.md']);
  assert.equal(JSON.parse(strFromU8(archive['档案清单.json'])).itemCount, 11);
  assert.doesNotMatch(strFromU8(archive['流程数据/选题工作台进度.json']), /unit-test-secret/);

  await page.locator('#open-archive-export').click();
  await page.locator('[data-archive-entry="profile"]').uncheck();
  await page.locator('[data-archive-entry="progress"]').uncheck();
  await page.locator('[data-archive-entry^="artifact:leapCsv:"]').uncheck();
  assert.equal(await page.locator('[data-archive-entry]:checked').count(), 8);
  const [subsetDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#confirm-archive-export').click()]);
  const subsetPath = path.join(artifacts, 'subset-archive.zip');
  await subsetDownload.saveAs(subsetPath);
  const subset = unzipSync(await readFile(subsetPath));
  assert.equal(subset['01_第一次调研/虚构文献元数据.csv'], undefined);
  assert.equal(subset['流程数据/个人卡片.md'], undefined);
  assert.equal(subset['流程数据/选题工作台进度.json'], undefined);
  assert.ok(subset['03_精读全文/短期与日前负荷预测/调研报告.pdf']);
  assert.equal(JSON.parse(strFromU8(subset['档案清单.json'])).itemCount, 8);

  const [progressDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#export-state').click()]);
  const progressPath = path.join(artifacts, 'progress.json');
  await progressDownload.saveAs(progressPath);
  const progress = JSON.parse(await readFile(progressPath, 'utf8'));
  assert.equal(progress.selectedDirections.length, 2);
  assert.equal(Object.keys(progress.readings).length, 2);
  assert.equal(progress.readingCount, '7');
  assert.equal(Object.values(progress.readings).every((items) => items.length === 7), true);
  assert.doesNotMatch(JSON.stringify(progress), /unit-test-secret/);
  await page.locator('#state-file').setInputFiles(progressPath);
  await page.locator('#toast').filter({ hasText: '进度已导入' }).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-step="step1"]').click();
  await page.screenshot({ path: path.join(artifacts, 'step1-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Mobile settings should not overflow horizontally');
  await page.locator('[data-step="step2"]').click();
  await page.screenshot({ path: path.join(artifacts, 'step2-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Mobile page should not overflow horizontally');
  await page.locator('[data-step="step3"]').click();
  await page.locator('#open-archive-export').click();
  await page.screenshot({ path: path.join(artifacts, 'archive-export-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Mobile archive dialog should not overflow horizontally');
  await page.locator('#close-archive-dialog').click();
  assert.equal(consoleErrors.length, 0, `Browser errors: ${consoleErrors.join('\n')}`);
  console.log('PASS: 四步流程、三次提示词、文件保存、key 选择、动态精读槽位、全文分级、持久化、进度导入导出、完整与子集 ZIP 实际下载、API key 清理、桌面与移动端。');
  console.log(`Artifacts: ${artifacts}`);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else { server.once('exit', resolve); setTimeout(resolve, 3000); } });
}
