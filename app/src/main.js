import './style.css';
import { hydrateState, demoProfile, demoDirections, artifactDefinitions, readingSlots, normalizeReadingCount } from './data.js';
import { buildFirstPrompt, buildSecondPrompt, buildThirdPrompt } from './prompts.js';
import { loadState, saveState as persistState, putFile, getFile, deleteFile, downloadBlob } from './storage.js';
import { archiveEntries, createArchive, profileMarkdown } from './archive.js';

let state = loadState();
let toastTimer;

const steps = [
  { id: 'step0', number: '00', title: '个人卡片', subtitle: '研究设置与首次提示词' },
  { id: 'step1', number: '01', title: '接收调研成果', subtitle: '保存文件与文献增补' },
  { id: 'step2', number: '02', title: '文献增补与精读', subtitle: '方向选择与全文准备' },
  { id: 'step3', number: '03', title: '候选选题报告', subtitle: '成果保存与流程归档' },
];

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const formatSize = (bytes = 0) => bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function saveState() {
  try {
    persistState(state);
    document.querySelector('#save-status').textContent = '已保存在当前浏览器';
  } catch {
    showToast('浏览器存储空间不足，请导出进度并清理不需要的文件。', 'warning');
  }
  updateProgress();
}

function showToast(message, type = 'success') {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 4200);
}

function markStale(...names) {
  names.forEach((name) => { if (state.prompts[name]) state.stale[name] = true; });
  names.forEach(renderPrompt);
}

function profileInput(id, label, placeholder = '', wide = false, required = false) {
  return `<label class="field ${wide ? 'wide' : ''}"><span>${label}${required ? ' <b>*</b>' : ''}</span><input data-profile="${id}" value="${escapeHtml(state.profile[id])}" placeholder="${escapeHtml(placeholder)}"></label>`;
}
function profileArea(id, label, placeholder = '', wide = true) {
  return `<label class="field ${wide ? 'wide' : ''}"><span>${label}</span><textarea data-profile="${id}" rows="3" placeholder="${escapeHtml(placeholder)}">${escapeHtml(state.profile[id])}</textarea></label>`;
}
function profileSelect(id, label, options) {
  return `<label class="field"><span>${label}</span><select data-profile="${id}">${options.map((option) => `<option ${state.profile[id] === option ? 'selected' : ''}>${option}</option>`).join('')}</select></label>`;
}
function promptArea(name, title, description, buttonLabel) {
  return `<section class="output-area" id="output-${name}" ${state.prompts[name] ? '' : 'hidden'}>
    <div class="output-heading"><div><span class="section-index">↗</span><div><h2>${title}</h2><p>${description}</p></div></div><span class="output-badge">本地生成</span></div>
    <div class="inline-warning" id="stale-${name}" ${state.stale[name] ? '' : 'hidden'}>相关内容已修改，请重新生成提示词。</div>
    <textarea class="prompt-output" id="prompt-${name}" readonly aria-label="${title}"></textarea>
    <div class="output-actions"><button class="secondary-button" data-copy="${name}">复制提示词</button><button class="secondary-button" data-download-prompt="${name}">下载提示词</button></div>
  </section>
  <div class="action-bar"><div><strong>生成后请核对内容与文件。</strong><span>复制到你选择的平台后，相关提示词内容才会发送给该平台。</span></div><button class="primary-button" data-generate="${name}">${buttonLabel}<span>→</span></button></div>`;
}
function artifactCard(key) {
  const definition = artifactDefinitions.find((item) => item.key === key);
  return `<div class="artifact-upload"><div><strong>${definition.label}</strong><p>${definition.hint}</p></div><div class="artifact-list" id="artifact-${key}"></div><label class="secondary-button file-button">${definition.multiple ? '添加文件' : '选择文件'}<input type="file" data-artifact="${key}" accept="${definition.accept}" ${definition.multiple ? 'multiple' : ''} hidden></label></div>`;
}

document.querySelector('#app').innerHTML = `
<div class="app-shell">
  <aside class="sidebar">
    <div class="brand"><div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div><div><strong>选题工作台</strong><small>Research topic studio</small></div></div>
    <div class="sidebar-caption">从调研到候选选题</div>
    <nav class="step-nav" aria-label="工作流阶段">${steps.map((step) => `<button class="step-link" data-step="${step.id}"><span class="step-number">${step.number}</span><span><strong>${step.title}</strong><small>${step.subtitle}</small></span><i id="nav-${step.id}">待开始</i></button>`).join('')}</nav>
    <div class="local-note"><div><strong>本地安装与运行</strong><p>工作台在你的电脑本地运行，文件保存在当前浏览器，不上传项目服务器。只有你把提示词或文件交给 AI 平台时，内容才会发送给该平台。</p></div></div>
  </aside>
  <div class="main-shell">
    <header class="topbar"><div><span class="status-dot"></span><span id="save-status">本地工作区已就绪</span></div><div class="top-actions"><button class="text-button" id="import-state">导入进度</button><input type="file" id="state-file" accept=".json" hidden><button class="text-button" id="export-state">导出进度</button></div></header>
    <main>
      <section class="panel" id="panel-step0">
        <div class="hero hero-0"><div class="eyebrow">00 · YOUR RESEARCH CONTEXT</div><h1>先认识你的研究处境，<br><em>再开始有效调研。</em></h1><p>个人卡片只用于最终选题论证。第一次 LeapSpace 提示词仅包含研究主题和学术检索边界。</p><div class="hero-tags"><span>本地保存</span><span>三次交互</span><span>人工核验</span></div></div>
        <div class="section-heading"><div><span class="section-index">01</span><div><h2>培养方案与研究主题</h2><p>带 * 的主题信息用于生成第一次提示词；其他内容可稍后补充。</p></div></div><button class="subtle-button" id="load-demo">载入虚构示例</button></div>
        <div class="form-grid">
          ${profileSelect('degreeType', '培养类型', ['学硕', '专硕', '学术博士', '工程博士', '其他'])}
          ${profileSelect('duration', '学制（年）', ['2', '2.5', '3', '4', '5', '其他'])}
          ${profileInput('major', '专业方向', '例如：能源动力', false, true)}
          ${profileInput('topicZh', '中文研究主题', '例如：电力负荷预测', true, true)}
          ${profileInput('topicEn', '英文主题词与同义词', '例如：electric load forecasting', true, true)}
          ${profileInput('startYear', '首次调研起始年份', '推荐 2020')}
          ${profileInput('directionCount', '候选方向参考数量', '4–6')}
          ${profileInput('venues', '来源侧重', '期刊、会议或数据库；可不预设', true)}
          ${profileArea('exclusions', '学术排除范围', '例如：纯电价预测；不要在这里写个人资源限制')}
        </div>
        <div class="section-heading"><div><span class="section-index">02</span><div><h2>已有基础与个人追求</h2><p>这些信息不会进入第一次提示词，只在第三次收敛选题时使用。</p></div></div></div>
        <div class="form-grid">
          ${profileArea('groupDirections', '课题组研究方向与基础', '研究方向、已有项目、可继承的方法或资源')}
          ${profileArea('dataFoundation', '已有数据与使用边界', '有哪些数据？授权和学位论文使用状态如何？')}
          ${profileArea('experimentFoundation', '实验与软件基础', '已有设备、实验条件、代码和建模经验')}
          ${profileArea('hardware', '硬件基础', '可用计算资源与明确限制')}
          ${profileArea('goal', '个人目标与偏好', '例如：按期完成、方法研究、工程应用或就业方向')}
          ${profileArea('constraints', '明确不能做的选题约束', '数据、合规、设备、时间或个人边界')}
        </div>
        <div class="privacy-note"><strong>第一次提示词不含上述个性化信息。</strong><span>下载的个人卡片请妥善保管；第三次提示词会包含这些信息。</span></div>
        <div class="output-actions standalone"><button class="secondary-button" id="download-profile">下载个人卡片</button></div>
        ${promptArea('first', '第一次｜LeapSpace 文献调研提示词', '500 字符以内：近年文献初筛、4—6 个研究方向、原始 CSV 与调研 PDF。', '生成 LeapSpace 文献调研提示词')}
      </section>

      <section class="panel" id="panel-step1" hidden>
        <div class="hero compact hero-1"><div class="eyebrow">01 · BRING BACK THE EVIDENCE</div><h1>保存第一次调研，<br><em>为方向增补做好准备。</em></h1><p>直接保留 LeapSpace 的原始 PDF 和 CSV。不做字段转换、质量评分或人工选种。</p></div>
        <div class="section-heading"><div><span class="section-index">01</span><div><h2>上传 LeapSpace 原始成果</h2><p>文件仅保存到当前浏览器，可在最后一步重新下载。</p></div></div></div>
        <div class="artifact-grid">${artifactCard('leapPdf')}${artifactCard('leapCsv')}</div>
        <div class="section-heading"><div><span class="section-index">02</span><div><h2>记录 4—6 个研究方向</h2><p>从 LeapSpace 报告复制名称；补充一句定义可减少第二次调研偏差。</p></div></div><button class="subtle-button" id="add-direction">添加方向</button></div>
        <div id="direction-editor" class="direction-editor"></div>
        <div class="section-heading"><div><span class="section-index">03</span><div><h2>OpenAlex 增补设置</h2><p>默认从 2010 年梳理研究脉络，经典文献可突破年份并标记。</p></div></div></div>
        <div class="form-grid settings-grid"><label class="field"><span>第二次增补起始年份</span><input id="expansion-year" type="number" min="1900" max="2100" value="${escapeHtml(state.expansionYear)}"></label><label class="field"><span>每方向核心精读数量</span><span class="reading-count-control"><input id="reading-count" type="number" min="5" step="1" value="${normalizeReadingCount(state.readingCount)}"><small>默认 5 篇，不少于 5 篇；修改后需重新生成第二次提示词。</small></span></label></div>
        <div class="key-panel">
          <div class="key-options"><label><input type="radio" name="key-mode" value="environment" ${state.keyMode === 'environment' ? 'checked' : ''}><span><strong>使用本地环境变量（推荐）</strong><small>工作台不保存 key，提示词也不包含 key。</small></span></label><label><input type="radio" name="key-mode" value="direct" ${state.keyMode === 'direct' ? 'checked' : ''}><span><strong>保存并写入提示词</strong><small>需明确同意；key 会随提示词发送给你使用的 AI 服务。</small></span></label></div>
          <div id="environment-guide" class="environment-guide" ${state.keyMode === 'environment' ? '' : 'hidden'}><strong>本地配置步骤</strong><ol><li>在运行智能体或脚本的终端设置 OPENALEX_API_KEY。</li><li>Git Bash 临时设置：export OPENALEX_API_KEY="你的key"</li><li>不要把真实 key 写进公开脚本、截图或 GitHub。</li></ol></div>
          <div id="direct-key-area" ${state.keyMode === 'direct' ? '' : 'hidden'}><label class="field"><span>OpenAlex API key</span><input id="api-key" type="password" autocomplete="off" value="${escapeHtml(state.apiKey)}" placeholder="仅在你理解数据流向后填写"></label><label class="consent"><input id="key-consent" type="checkbox" ${state.keyConsent ? 'checked' : ''}><span>我理解：浏览器存储不等于加密；key 会出现在提示词中并发送给所选 AI 服务，导出的进度也会包含它。公开分享前我会删除或更换 key。</span></label></div>
        </div>
        ${promptArea('second', '第二次｜OpenAlex 文献增补提示词', '继承第一轮成果并完成 OpenAlex 增补，输出研究 MD、累计内容的增补 CSV，并按 01 设置的数量推荐核心精读。', '生成文献增补提示词')}
      </section>

      <section class="panel" id="panel-step2" hidden>
        <div class="hero compact hero-2"><div class="eyebrow">02 · READ BEFORE DECIDING</div><h1>先读懂重点文献，<br><em>再收敛你的课题。</em></h1><p>保存第二次调研成果，选择 2—4 个优先方向，并按 01 设置的数量登记重点文献的实际全文状态。</p></div>
        <div class="section-heading"><div><span class="section-index">01</span><div><h2>上传文献增补成果</h2><p>MD 包含累计继承说明；CSV 包含第一轮保留与第二轮新增文献，两者都需要保存。</p></div></div></div>
        <div class="artifact-grid">${artifactCard('researchMd')}${artifactCard('expandedCsv')}</div>
        <div class="section-heading"><div><span class="section-index">02</span><div><h2>选择 2—4 个优先方向</h2><p>第三次只对选中的方向进行选题收敛。</p></div></div><span class="selection-count" id="selection-count"></span></div>
        <div id="priority-list" class="priority-list"></div>
        <div class="section-heading"><div><span class="section-index">03</span><div><h2>登记重点精读文献</h2><p>按 01 设置的数量，从第二次 MD 复制各方向核心精读题名。只有实际上传全文的文献才会作为全文证据。</p></div></div><button class="subtle-button" id="demo-readings">填入虚构题名</button></div>
        <div id="reading-list" class="reading-list"></div>
        <div class="privacy-note"><strong>第三次提示词包含个人卡片。</strong><span>复制到 AI 平台前，请确认其中没有你不愿发送的个人信息；全文仍须通过合法渠道获取。</span></div>
        ${promptArea('third', '第三次｜候选选题收敛提示词', '结合第二轮累计成果、个人卡片与实际全文，形成 1—2 份候选选题论证报告。', '生成候选选题收敛提示词')}
      </section>

      <section class="panel" id="panel-step3" hidden>
        <div class="hero compact hero-3"><div class="eyebrow">03 · KEEP A TRACEABLE RECORD</div><h1>保存候选论证，<br><em>把判断留给导师和你。</em></h1><p>这里管理的是选题证据与过程产物，不承诺自动获得最终课题或符合本校开题格式。</p></div>
        <div class="section-heading"><div><span class="section-index">01</span><div><h2>上传最终报告</h2><p>可分别上传 1—2 份 DOCX、Markdown 或 PDF。</p></div></div></div>
        ${artifactCard('finalReport')}
        <div class="section-heading"><div><span class="section-index">02</span><div><h2>流程产物与提示词</h2><p>文件保存在浏览器本地；导出进度 JSON 不包含文件本体。</p></div></div></div>
        <div id="archive-summary" class="archive-summary"></div>
        <div class="archive-export-bar"><div><strong>导出完整档案包</strong><p>按需选择提示词、两次调研成果、每篇精读全文和候选报告，打包为 ZIP 备份。</p></div><button class="primary-button" id="open-archive-export">选择导出内容</button></div>
        <div class="section-heading"><div><span class="section-index">03</span><div><h2>下一步</h2><p>核对证据缺口、个人条件与学校要求，再与导师讨论。</p></div></div></div>
        <div class="final-checks"><label><input type="checkbox" disabled> 文献事实与全文位置已人工抽查</label><label><input type="checkbox" disabled> 数据许可、实验条件和培养要求已确认</label><label><input type="checkbox" disabled> 已与导师讨论通过、修改或回退方案</label></div>
      </section>
    </main>
    <footer><span>研究生选题工作流 · 本地优先</span><span>AI 辅助整理，人工核验与导师决策不可替代</span></footer>
  </div>
</div><div id="toast" class="toast" role="status" aria-live="polite"></div>
<dialog id="archive-dialog" class="archive-dialog" aria-labelledby="archive-dialog-title">
  <div class="archive-dialog-heading"><div><h2 id="archive-dialog-title">选择档案包内容</h2><p>所有已上传的中间产物都可以独立选择，默认全选。</p></div><button class="text-button" id="close-archive-dialog" aria-label="关闭导出窗口">关闭</button></div>
  <div class="archive-selection-tools"><div><button class="subtle-button" id="archive-select-all">全选</button><button class="subtle-button" id="archive-select-none">清空</button></div><span id="archive-selected-count"></span></div>
  <div id="archive-options" class="archive-options"></div>
  <div class="privacy-note"><strong>档案包不包含工作台保存的 API key。</strong><span>进度 JSON 和生成的提示词会移除 key；上传文件按原内容打包，请自行检查敏感信息。ZIP 用于本地备份与文件取回，不是进度导入格式。</span></div>
  <div class="archive-dialog-actions"><button class="secondary-button" id="cancel-archive-export">取消</button><button class="primary-button" id="confirm-archive-export">导出 ZIP</button></div>
</dialog>`;

function renderPrompt(name) {
  const output = document.querySelector(`#output-${name}`);
  if (!output) return;
  output.hidden = !state.prompts[name];
  document.querySelector(`#prompt-${name}`).value = state.prompts[name];
  document.querySelector(`#stale-${name}`).hidden = !state.stale[name];
}

function artifactItems(key) {
  const value = state.artifacts[key];
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function renderArtifact(key) {
  const container = document.querySelector(`#artifact-${key}`);
  if (!container) return;
  container.innerHTML = artifactItems(key).map((file) => `<div class="file-row"><span title="${escapeHtml(file.name)}">${escapeHtml(file.name)}<small>${formatSize(file.size)}</small></span><button class="text-button" data-download-file="${escapeHtml(file.id)}" data-file-name="${escapeHtml(file.name)}">下载</button><button class="text-button danger" data-remove-artifact="${key}" data-file-id="${escapeHtml(file.id)}">移除</button></div>`).join('');
}

function renderAllArtifacts() { artifactDefinitions.forEach((item) => renderArtifact(item.key)); }

function renderDirections() {
  const container = document.querySelector('#direction-editor');
  container.innerHTML = state.directions.length ? state.directions.map((item, index) => `<div class="direction-row"><span class="direction-number">${String(index + 1).padStart(2, '0')}</span><div class="direction-fields"><input data-direction-name="${item.id}" value="${escapeHtml(item.name)}" placeholder="研究方向名称（必填）" aria-label="方向 ${index + 1} 名称"><input data-direction-description="${item.id}" value="${escapeHtml(item.description || '')}" placeholder="一句定义或边界（可选）" aria-label="方向 ${index + 1} 定义"></div><button class="text-button danger" data-remove-direction="${item.id}" aria-label="删除方向 ${index + 1}">删除</button></div>`).join('') : '<div class="empty-inline">尚未记录方向。可添加 4—6 个，或在第 00 步载入虚构示例。</div>';
}

function ensureReadings(directionId) {
  const count = normalizeReadingCount(state.readingCount);
  const existing = Array.isArray(state.readings[directionId]) ? state.readings[directionId] : [];
  if (existing.length === count) return;
  state.readings[directionId] = readingSlots(directionId, count).map((slot, index) => existing[index] ? { ...slot, ...existing[index], slot: index } : slot);
}

function renderPriorities() {
  document.querySelector('#selection-count').textContent = `已选 ${state.selectedDirections.length} / 2—4`;
  document.querySelector('#priority-list').innerHTML = state.directions.length ? state.directions.map((item) => `<label class="priority-card ${state.selectedDirections.includes(item.id) ? 'selected' : ''}"><input type="checkbox" data-priority="${item.id}" ${state.selectedDirections.includes(item.id) ? 'checked' : ''}><span><strong>${escapeHtml(item.name || '未命名方向')}</strong><small>${escapeHtml(item.description || '暂无方向定义')}</small></span></label>`).join('') : '<div class="empty-inline">请先在第 01 步记录研究方向。</div>';
}

function renderReadings() {
  const selected = state.directions.filter((item) => state.selectedDirections.includes(item.id));
  selected.forEach((item) => ensureReadings(item.id));
  document.querySelector('#reading-list').innerHTML = selected.length ? selected.map((direction) => `<section class="reading-group"><h3>${escapeHtml(direction.name)}<span>每方向 ${normalizeReadingCount(state.readingCount)} 篇</span></h3>${state.readings[direction.id].map((item, index) => `<div class="reading-row"><span class="reading-index">${index + 1}</span><input data-reading-title="${direction.id}" data-index="${index}" value="${escapeHtml(item.title)}" placeholder="重点文献题名" aria-label="${escapeHtml(direction.name)} 第 ${index + 1} 篇题名"><select data-reading-status="${direction.id}" data-index="${index}" aria-label="全文状态"><option value="missing" ${item.status === 'missing' ? 'selected' : ''}>尚未获得</option><option value="abstract" ${item.status === 'abstract' ? 'selected' : ''}>只有摘要</option><option value="full" ${item.status === 'full' ? 'selected' : ''}>已获得全文</option></select><label class="file-mini">${item.file ? '更换 PDF' : '上传 PDF'}<input type="file" accept=".pdf,application/pdf" data-reading-file="${direction.id}" data-index="${index}" hidden></label><div class="reading-file">${item.file ? `<span title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</span><button class="text-button" data-download-file="${item.file.id}" data-file-name="${escapeHtml(item.file.name)}">下载</button>` : '<span>无全文文件</span>'}</div></div>`).join('')}</section>`).join('') : `<div class="empty-inline">选择优先方向后，这里会生成每方向 ${normalizeReadingCount(state.readingCount)} 个精读槽位。</div>`;
}

function renderArchive() {
  const files = artifactDefinitions.flatMap((definition) => artifactItems(definition.key).map((file) => ({ ...file, label: definition.label })));
  const readingFiles = Object.values(state.readings).flat().filter((item) => item.file).map((item) => ({ ...item.file, label: '重点精读全文' }));
  const all = [...files, ...readingFiles];
  document.querySelector('#archive-summary').innerHTML = `<div class="archive-prompts"><h3>已生成提示词</h3>${['first', 'second', 'third'].map((name, index) => `<div><span>第 ${index + 1} 次交互</span><button class="text-button" data-download-prompt="${name}" ${state.prompts[name] ? '' : 'disabled'}>下载提示词</button></div>`).join('')}</div><div class="archive-files"><h3>已保存文件（${all.length}）</h3>${all.length ? all.map((file) => `<div><span>${escapeHtml(file.label)}｜${escapeHtml(file.name)}</span><button class="text-button" data-download-file="${file.id}" data-file-name="${escapeHtml(file.name)}">下载</button></div>`).join('') : '<p>尚未保存文件。</p>'}</div>`;
}

function selectedArchiveIds() {
  return [...document.querySelectorAll('[data-archive-entry]:checked')].map((input) => input.dataset.archiveEntry);
}

function updateArchiveSelection() {
  const count = selectedArchiveIds().length;
  document.querySelector('#archive-selected-count').textContent = `已选择 ${count} 项`;
  document.querySelector('#confirm-archive-export').disabled = count === 0;
}

function renderArchiveExportOptions() {
  const entries = archiveEntries(state);
  const groups = new Map();
  entries.forEach((entry) => {
    if (!groups.has(entry.group)) groups.set(entry.group, []);
    groups.get(entry.group).push(entry);
  });
  document.querySelector('#archive-options').innerHTML = [...groups.entries()].map(([group, items]) => `<section class="archive-option-group"><h3>${escapeHtml(group)}<span>${items.length} 项</span></h3>${items.map((entry) => `<label class="archive-option"><input type="checkbox" data-archive-entry="${escapeHtml(entry.id)}" checked><span><strong>${escapeHtml(entry.label)}</strong><small>${entry.kind === 'file' ? formatSize(entry.size) : entry.kind === 'prompt' ? '文本提示词' : '流程数据'}</small></span></label>`).join('')}</section>`).join('');
  updateArchiveSelection();
}

async function exportArchive() {
  const selectedIds = selectedArchiveIds();
  if (!selectedIds.length) { showToast('请至少选择一项导出内容。', 'warning'); return; }
  const button = document.querySelector('#confirm-archive-export');
  button.disabled = true;
  button.textContent = '正在打包…';
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    const now = new Date();
    const { blob, itemCount } = await createArchive(state, selectedIds, getFile, now);
    const pad = (value) => String(value).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    downloadBlob(`研究生选题档案包-${date}.zip`, blob);
    document.querySelector('#archive-dialog').close();
    showToast(`档案包已导出，共 ${itemCount} 项；工作台保存的 API key 未包含在内。`);
  } catch (error) {
    showToast(error.code === 'MISSING_FILES' ? error.message : '档案包导出失败，请检查浏览器存储空间后重试。', 'warning');
  } finally {
    button.textContent = '导出 ZIP';
    updateArchiveSelection();
  }
}

function updateProgress() {
  const completion = {
    step0: Boolean(state.prompts.first) && !state.stale.first,
    step1: Boolean(state.prompts.second) && !state.stale.second,
    step2: Boolean(state.prompts.third) && !state.stale.third,
    step3: artifactItems('finalReport').length > 0,
  };
  steps.forEach((step) => {
    const badge = document.querySelector(`#nav-${step.id}`);
    if (!badge) return;
    badge.textContent = completion[step.id] ? '已完成' : state.activeStep === step.id ? '进行中' : '待开始';
    badge.classList.toggle('done', completion[step.id]);
  });
}

function setStep(step) {
  state.activeStep = step;
  document.querySelectorAll('.panel').forEach((panel) => { panel.hidden = panel.id !== `panel-${step}`; });
  document.querySelectorAll('.step-link').forEach((button) => button.classList.toggle('active', button.dataset.step === step));
  if (step === 'step3') renderArchive();
  saveState();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateSecond() {
  const missing = [];
  if (!state.artifacts.leapPdf) missing.push('LeapSpace PDF');
  if (!state.artifacts.leapCsv) missing.push('LeapSpace CSV');
  if (state.directions.length < 4 || state.directions.length > 6 || state.directions.some((item) => !item.name.trim())) missing.push('4—6 个已命名方向');
  if (state.keyMode === 'direct' && !state.apiKey.trim()) missing.push('OpenAlex key');
  if (state.keyMode === 'direct' && !state.keyConsent) missing.push('key 使用风险确认');
  return missing;
}

function validateThird() {
  const missing = [];
  if (!state.artifacts.researchMd) missing.push('方向研究 MD');
  if (!state.artifacts.expandedCsv) missing.push('增补文献 CSV');
  if (state.selectedDirections.length < 2 || state.selectedDirections.length > 4) missing.push('2—4 个优先方向');
  state.directions.filter((item) => state.selectedDirections.includes(item.id)).forEach((direction) => {
    ensureReadings(direction.id);
    state.readings[direction.id].forEach((item, index) => {
      if (!item.title.trim()) missing.push(`${direction.name}第 ${index + 1} 篇题名`);
      if (item.status === 'full' && !item.file) missing.push(`${direction.name}第 ${index + 1} 篇全文 PDF`);
    });
  });
  return missing;
}

function generate(name) {
  const missing = name === 'first'
    ? [['major', '专业方向'], ['topicZh', '中文研究主题'], ['topicEn', '英文主题词']].filter(([key]) => !state.profile[key].trim()).map(([, label]) => label)
    : name === 'second' ? validateSecond() : validateThird();
  if (missing.length) { showToast(`请先完成：${missing.slice(0, 5).join('、')}${missing.length > 5 ? '等' : ''}`, 'warning'); return; }
  const nextPrompt = name === 'first' ? buildFirstPrompt(state.profile) : name === 'second' ? buildSecondPrompt(state) : buildThirdPrompt(state);
  if (name === 'first' && nextPrompt.length > 500) {
    showToast(`首次提示词当前 ${nextPrompt.length} 字符，超过 LeapSpace 的 500 字符限制。请缩短主题词、来源侧重或排除范围。`, 'warning');
    return;
  }
  state.prompts[name] = nextPrompt;
  state.stale[name] = false;
  renderPrompt(name);
  saveState();
  showToast('提示词已生成，请核对后复制。');
  document.querySelector(`#output-${name}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function uploadArtifact(key, files) {
  const definition = artifactDefinitions.find((item) => item.key === key);
  try {
    const uploaded = [];
    for (const file of files) {
      const id = `artifact:${key}:${crypto.randomUUID()}`;
      await putFile(id, file);
      uploaded.push({ id, name: file.name, size: file.size, type: file.type });
    }
    state.artifacts[key] = definition.multiple ? [...artifactItems(key), ...uploaded] : uploaded[0];
    renderArtifact(key);
    if (key === 'researchMd' || key === 'expandedCsv') markStale('third');
    saveState();
    showToast(`已保存 ${uploaded.length} 个文件到当前浏览器。`);
  } catch { showToast('文件保存失败，可能是浏览器存储空间不足。', 'warning'); }
}

async function removeArtifact(key, id) {
  await deleteFile(id);
  if (Array.isArray(state.artifacts[key])) state.artifacts[key] = state.artifacts[key].filter((item) => item.id !== id);
  else delete state.artifacts[key];
  renderArtifact(key);
  if (key === 'leapPdf' || key === 'leapCsv') markStale('second');
  if (key === 'researchMd' || key === 'expandedCsv') markStale('third');
  saveState();
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.step) setStep(button.dataset.step);
  if (button.dataset.generate) generate(button.dataset.generate);
  if (button.dataset.copy) {
    const text = state.prompts[button.dataset.copy];
    try { await navigator.clipboard.writeText(text); showToast('提示词已复制。'); }
    catch { document.querySelector(`#prompt-${button.dataset.copy}`).select(); showToast('请按 Ctrl+C 复制已选中的提示词。', 'warning'); }
  }
  if (button.dataset.downloadPrompt) {
    const name = button.dataset.downloadPrompt;
    if (state.prompts[name]) downloadBlob(`第${{ first: '一', second: '二', third: '三' }[name]}次交互提示词.txt`, state.prompts[name]);
  }
  if (button.dataset.downloadFile) {
    const file = await getFile(button.dataset.downloadFile);
    if (file) downloadBlob(button.dataset.fileName, file);
    else showToast('文件本体不在当前浏览器中，请重新上传。', 'warning');
  }
  if (button.dataset.removeArtifact) await removeArtifact(button.dataset.removeArtifact, button.dataset.fileId);
  if (button.id === 'add-direction') {
    if (state.directions.length >= 6) { showToast('最多记录 6 个方向。', 'warning'); return; }
    state.directions.push({ id: crypto.randomUUID(), name: '', description: '' });
    renderDirections(); markStale('second', 'third'); saveState();
  }
  if (button.dataset.removeDirection) {
    const id = button.dataset.removeDirection;
    state.directions = state.directions.filter((item) => item.id !== id);
    state.selectedDirections = state.selectedDirections.filter((item) => item !== id);
    delete state.readings[id];
    renderDirections(); renderPriorities(); renderReadings(); markStale('second', 'third'); saveState();
  }
  if (button.id === 'load-demo') {
    state.profile = { ...demoProfile };
    state.directions = demoDirections.map((item) => ({ ...item }));
    document.querySelectorAll('[data-profile]').forEach((input) => { input.value = state.profile[input.dataset.profile]; });
    renderDirections(); renderPriorities(); renderReadings(); markStale('first', 'second', 'third'); saveState(); showToast('已载入虚构示例，不代表真实科研条件。');
  }
  if (button.id === 'demo-readings') {
    if (!state.selectedDirections.length) { showToast('请先选择优先方向。', 'warning'); return; }
    state.selectedDirections.forEach((id) => {
      ensureReadings(id);
      state.readings[id].forEach((item, index) => { item.title = `虚构精读文献 ${index + 1}（仅界面演示）`; });
    });
    renderReadings(); markStale('third'); saveState();
  }
  if (button.id === 'download-profile') downloadBlob('个人卡片.local.md', profileMarkdown(state.profile), 'text/markdown;charset=utf-8');
  if (button.id === 'export-state') {
    downloadBlob('选题工作台进度.json', JSON.stringify(state, null, 2), 'application/json;charset=utf-8');
    showToast(state.keyMode === 'direct' && state.apiKey ? '进度已导出；其中包含 API key，请勿公开分享。文件本体需另行下载。' : '进度已导出；文件本体需另行下载。', 'warning');
  }
  if (button.id === 'import-state') document.querySelector('#state-file').click();
  if (button.id === 'open-archive-export') {
    renderArchiveExportOptions();
    document.querySelector('#archive-dialog').showModal();
  }
  if (button.id === 'close-archive-dialog' || button.id === 'cancel-archive-export') document.querySelector('#archive-dialog').close();
  if (button.id === 'archive-select-all' || button.id === 'archive-select-none') {
    const checked = button.id === 'archive-select-all';
    document.querySelectorAll('[data-archive-entry]').forEach((input) => { input.checked = checked; });
    updateArchiveSelection();
  }
  if (button.id === 'confirm-archive-export') await exportArchive();
});

document.addEventListener('input', (event) => {
  const input = event.target;
  if (input.dataset.profile) {
    state.profile[input.dataset.profile] = input.value;
    markStale('first', 'third'); saveState();
  }
  if (input.dataset.directionName) {
    const item = state.directions.find((direction) => direction.id === input.dataset.directionName);
    if (item) item.name = input.value;
    markStale('second', 'third'); saveState();
  }
  if (input.dataset.directionDescription) {
    const item = state.directions.find((direction) => direction.id === input.dataset.directionDescription);
    if (item) item.description = input.value;
    markStale('second', 'third'); saveState();
  }
  if (input.dataset.readingTitle) {
    ensureReadings(input.dataset.readingTitle);
    state.readings[input.dataset.readingTitle][Number(input.dataset.index)].title = input.value;
    markStale('third'); saveState();
  }
  if (input.id === 'expansion-year') { state.expansionYear = input.value; markStale('second'); saveState(); }
  if (input.id === 'api-key') { state.apiKey = input.value; markStale('second'); saveState(); }
});

document.addEventListener('change', async (event) => {
  const input = event.target;
  if (input.id === 'reading-count') {
    state.readingCount = String(normalizeReadingCount(input.value));
    input.value = state.readingCount;
    Object.keys(state.readings).forEach(ensureReadings);
    renderReadings(); markStale('second', 'third'); saveState();
  }
  if (input.name === 'key-mode') {
    state.keyMode = input.value;
    if (input.value === 'environment') {
      state.apiKey = '';
      state.keyConsent = false;
      document.querySelector('#api-key').value = '';
      document.querySelector('#key-consent').checked = false;
    }
    document.querySelector('#environment-guide').hidden = input.value !== 'environment';
    document.querySelector('#direct-key-area').hidden = input.value !== 'direct';
    markStale('second'); saveState();
  }
  if (input.id === 'key-consent') { state.keyConsent = input.checked; markStale('second'); saveState(); }
  if (input.dataset.archiveEntry) updateArchiveSelection();
  if (input.dataset.artifact) { await uploadArtifact(input.dataset.artifact, [...input.files]); input.value = ''; }
  if (input.dataset.priority) {
    if (input.checked && state.selectedDirections.length >= 4) { input.checked = false; showToast('最多选择 4 个优先方向。', 'warning'); return; }
    state.selectedDirections = input.checked ? [...state.selectedDirections, input.dataset.priority] : state.selectedDirections.filter((id) => id !== input.dataset.priority);
    if (input.checked) ensureReadings(input.dataset.priority);
    renderPriorities(); renderReadings(); markStale('third'); saveState();
  }
  if (input.dataset.readingStatus) {
    const item = state.readings[input.dataset.readingStatus][Number(input.dataset.index)];
    item.status = input.value;
    markStale('third'); saveState();
  }
  if (input.dataset.readingFile) {
    const file = input.files[0];
    if (!file) return;
    const directionId = input.dataset.readingFile;
    const index = Number(input.dataset.index);
    ensureReadings(directionId);
    const id = `reading:${directionId}:${index}:${crypto.randomUUID()}`;
    try {
      await putFile(id, file);
      state.readings[directionId][index].file = { id, name: file.name, size: file.size, type: file.type };
      state.readings[directionId][index].status = 'full';
      renderReadings(); markStale('third'); saveState(); showToast('精读 PDF 已保存，并标记为已获得全文。');
    } catch { showToast('PDF 保存失败，请检查浏览器存储空间。', 'warning'); }
  }
  if (input.id === 'state-file') {
    const file = input.files[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported.profile || !imported.prompts) throw new Error('invalid');
      state = hydrateState(imported);
      document.querySelectorAll('[data-profile]').forEach((field) => { field.value = state.profile[field.dataset.profile]; });
      document.querySelector('#expansion-year').value = state.expansionYear;
      document.querySelector('#reading-count').value = state.readingCount;
      document.querySelector('#api-key').value = state.apiKey;
      document.querySelector('#key-consent').checked = state.keyConsent;
      document.querySelector(`input[name="key-mode"][value="${state.keyMode}"]`).checked = true;
      document.querySelector('#environment-guide').hidden = state.keyMode !== 'environment';
      document.querySelector('#direct-key-area').hidden = state.keyMode !== 'direct';
      ['first', 'second', 'third'].forEach(renderPrompt);
      renderDirections(); renderPriorities(); renderReadings(); renderAllArtifacts(); setStep(state.activeStep);
      showToast('进度已导入。JSON 不包含文件本体，缺失文件需要重新上传。');
    } catch { showToast('无法导入：进度文件格式不正确。', 'warning'); }
    input.value = '';
  }
});

['first', 'second', 'third'].forEach(renderPrompt);
renderDirections(); renderPriorities(); renderReadings(); renderAllArtifacts();
setStep(state.activeStep);
