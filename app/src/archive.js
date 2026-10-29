import { zipSync } from 'fflate';
import { artifactDefinitions } from './data.js';
import { getFile } from './storage.js';

const promptDefinitions = [
  { key: 'first', label: '第一次交互提示词', name: '第一次交互提示词.txt' },
  { key: 'second', label: '第二次交互提示词', name: '第二次交互提示词.txt' },
  { key: 'third', label: '第三次交互提示词', name: '第三次交互提示词.txt' },
];

const encoder = new TextEncoder();
const encode = (text) => encoder.encode(text);

function scrubSecret(text = '', apiKey = '') {
  return String(text)
    .replace(/(用户已明确选择在本次提示词中提供 OpenAlex API key：)[^\r\n]*/g, '$1[已移除 OpenAlex API key]')
    .split(apiKey || '\u0000').join('[已移除 OpenAlex API key]');
}

export function sanitizeArchiveState(state) {
  return {
    ...state,
    apiKey: '',
    keyConsent: false,
    prompts: Object.fromEntries(promptDefinitions.map(({ key }) => [key, scrubSecret(state.prompts[key], state.apiKey)])),
  };
}

export function profileMarkdown(profile) {
  return `# 个人卡片\n\n> 本地生成，包含个人研究条件。第三次提示词会使用这些信息，请妥善保管。\n\n## 培养与研究主题\n\n- 培养类型：${profile.degreeType}\n- 学制：${profile.duration} 年\n- 专业方向：${profile.major}\n- 中文主题：${profile.topicZh}\n- 英文主题词：${profile.topicEn}\n\n## 课题组与个人基础\n\n- 课题组研究方向与基础：${profile.groupDirections || '待补充'}\n- 已有数据：${profile.dataFoundation || '待补充'}\n- 实验基础：${profile.experimentFoundation || '待补充'}\n- 硬件基础：${profile.hardware || '待补充'}\n- 个人目标：${profile.goal || '待补充'}\n- 明确约束：${profile.constraints || '待补充'}\n`;
}

export function archiveEntries(state) {
  const entries = [
    { id: 'profile', kind: 'profile', group: '流程与提示词', label: '个人卡片（含个人研究条件）', name: '个人卡片.md' },
    { id: 'progress', kind: 'progress', group: '流程与提示词', label: '流程进度 JSON（不含 API key）', name: '选题工作台进度.json' },
  ];
  promptDefinitions.forEach((definition) => {
    if (state.prompts[definition.key]) entries.push({ ...definition, id: `prompt:${definition.key}`, kind: 'prompt', group: '流程与提示词' });
  });
  artifactDefinitions.forEach((definition) => {
    const value = state.artifacts[definition.key];
    const files = !value ? [] : Array.isArray(value) ? value : [value];
    files.forEach((file) => entries.push({
      id: file.id, kind: 'file', group: definition.step === 'step1' ? '第一次调研成果' : definition.step === 'step2' ? '第二次调研成果' : '候选选题报告',
      label: `${definition.label}｜${file.name}`, name: file.name, size: file.size, file, stage: definition.step,
    }));
  });
  state.directions.forEach((direction) => {
    (state.readings[direction.id] || []).forEach((reading) => {
      if (!reading.file) return;
      entries.push({
        id: reading.file.id, kind: 'file', group: '重点精读全文',
        label: `${direction.name || '未命名方向'}｜${reading.title || reading.file.name}`, name: reading.file.name,
        size: reading.file.size, file: reading.file, stage: 'reading', directionName: direction.name || '未命名方向', readingTitle: reading.title || '',
      });
    });
  });
  return entries;
}

function safeName(name, fallback = '未命名文件') {
  const cleaned = String(name || '').replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/[. ]+$/g, '').trim();
  return (cleaned || fallback).slice(0, 120);
}

function uniquePath(path, used) {
  const extensionIndex = path.lastIndexOf('.');
  const stem = extensionIndex > path.lastIndexOf('/') ? path.slice(0, extensionIndex) : path;
  const extension = extensionIndex > path.lastIndexOf('/') ? path.slice(extensionIndex) : '';
  let candidate = path;
  let index = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${stem} (${index})${extension}`;
    index += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function entryPath(entry, used) {
  if (entry.kind === 'profile') return uniquePath('流程数据/个人卡片.md', used);
  if (entry.kind === 'progress') return uniquePath('流程数据/选题工作台进度.json', used);
  if (entry.kind === 'prompt') return uniquePath(`提示词/${safeName(entry.name)}`, used);
  if (entry.stage === 'reading') return uniquePath(`03_精读全文/${safeName(entry.directionName, '未命名方向')}/${safeName(entry.name)}`, used);
  const folder = { step1: '01_第一次调研', step2: '02_第二次调研', step3: '04_候选报告' }[entry.stage] || '其他文件';
  return uniquePath(`${folder}/${safeName(entry.name)}`, used);
}

function entryText(state, entry) {
  if (entry.kind === 'profile') return profileMarkdown(state.profile);
  if (entry.kind === 'progress') return JSON.stringify(sanitizeArchiveState(state), null, 2);
  return scrubSecret(state.prompts[entry.key], state.apiKey);
}

export async function createArchive(state, selectedIds, readFile = getFile, now = new Date()) {
  const selected = new Set(selectedIds);
  const entries = archiveEntries(state).filter((entry) => selected.has(entry.id));
  if (!entries.length) throw new Error('EMPTY_ARCHIVE');
  const used = new Set(['档案清单.json', '档案说明.txt']);
  const files = {};
  const manifestFiles = [];
  const missing = [];
  for (const entry of entries) {
    const path = entryPath(entry, used);
    if (entry.kind === 'file') {
      const content = await readFile(entry.file.id);
      if (!content) {
        missing.push(entry.label);
        continue;
      }
      files[path] = new Uint8Array(await content.arrayBuffer());
    } else {
      files[path] = encode(entryText(state, entry));
    }
    manifestFiles.push({
      path,
      kind: entry.kind,
      stage: entry.stage || entry.key || entry.kind,
      name: entry.name,
      size: entry.size ?? files[path].byteLength,
      direction: entry.directionName,
      readingTitle: entry.readingTitle,
    });
  }
  if (missing.length) {
    const error = new Error(`有 ${missing.length} 个文件本体缺失，请重新上传或取消选择后重试。`);
    error.code = 'MISSING_FILES';
    error.missing = missing;
    throw error;
  }
  const manifest = {
    format: 'graduate-topic-workflow-archive', version: 1, exportedAt: now.toISOString(),
    apiKeyIncluded: false, itemCount: manifestFiles.length, files: manifestFiles,
  };
  files['档案清单.json'] = encode(JSON.stringify(manifest, null, 2));
  files['档案说明.txt'] = encode(`研究生选题工作台完整档案包\n\n导出时间：${now.toLocaleString('zh-CN')}\n已选择内容：${manifestFiles.length} 项\n\n工作台生成的进度 JSON 和提示词已移除 OpenAlex API key。上传文件按原内容打包，请自行检查其中是否含有账号、key 或其他敏感信息。\n个人卡片、进度和第三次提示词可能包含个人研究条件；精读全文请遵守文献使用权限。\n本 ZIP 用于本地备份与文件取回，不是“导入进度”所使用的 JSON 格式。\n`);
  const bytes = zipSync(files, { level: 0 });
  return { blob: new Blob([bytes], { type: 'application/zip' }), itemCount: manifestFiles.length };
}
