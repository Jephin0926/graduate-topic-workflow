import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const output = path.resolve(root, '..', 'docs', 'assets', 'readme');
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '7101', '--strictPort'], { cwd: root, stdio: 'pipe' });
const executablePath = process.env.CHROME_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const csvRows = ['Title,Researchers,Publication Date,Source Title,DOI,Cited By', ...Array.from({ length: 12 }, (_, index) => `虚构文献 ${index + 1},虚构作者,2024-01-01,虚构期刊,10.0000/demo.${index + 1},0`)];
const csvFile = { name: '虚构文献元数据.csv', mimeType: 'text/csv', buffer: Buffer.from(`﻿${csvRows.join('\n')}`) };
const pdfFile = { name: '虚构调研报告.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% fictional README fixture') };
const mdFile = { name: '虚构方向研究与精读指南.md', mimeType: 'text/markdown', buffer: Buffer.from('# 虚构方向研究\n\n仅用于公开界面演示。') };
let browser;

async function capture(page, name) {
  await page.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement) document.activeElement.blur(); });
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(output, name), fullPage: true, animations: 'disabled' });
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch('http://127.0.0.1:7101/'); if (response.ok) { ready = true; break; } } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error('Vite server did not start');
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:7101/', { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: `
    .toast { display: none !important; }
    @media (min-width: 761px) {
      .app-shell { position: relative; }
      .sidebar { position: absolute !important; inset: 0 auto 0 0 !important; height: auto !important; }
      .topbar { position: relative !important; }
    }
  ` });

  await page.locator('#load-demo').click();
  await page.locator('[data-generate="first"]').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(output, 'workbench-overview.png') });
  await capture(page, 'step-00-personal-card.png');

  await page.locator('[data-step="step1"]').click();
  await page.locator('[data-artifact="leapPdf"]').setInputFiles(pdfFile);
  await page.locator('[data-artifact="leapCsv"]').setInputFiles(csvFile);
  await page.locator('[data-generate="second"]').click();
  await capture(page, 'step-01-research-results.png');

  await page.locator('[data-step="step2"]').click();
  await page.locator('[data-artifact="researchMd"]').setInputFiles(mdFile);
  await page.locator('[data-artifact="expandedCsv"]').setInputFiles(csvFile);
  const priorities = page.locator('[data-priority]');
  await priorities.nth(0).check();
  await priorities.nth(1).check();
  await page.locator('#demo-readings').click();
  await page.locator('[data-reading-file]').first().setInputFiles({ name: '虚构精读全文.pdf', mimeType: 'application/pdf', buffer: pdfFile.buffer });
  await page.locator('[data-generate="third"]').click();
  await capture(page, 'step-02-expansion-reading.png');

  await page.locator('[data-step="step3"]').click();
  await page.locator('[data-artifact="finalReport"]').setInputFiles({ name: '虚构候选选题论证报告.md', mimeType: 'text/markdown', buffer: Buffer.from('# 虚构候选选题论证报告\n\n仅用于公开界面演示。') });
  await capture(page, 'step-03-candidate-reports.png');
  console.log(`README screenshots saved: ${output}`);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else { server.once('exit', resolve); setTimeout(resolve, 3000); } });
}
