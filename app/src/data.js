export const STORAGE_KEY = 'graduate-topic-workbench-v2';

export const blankProfile = {
  degreeType: '学硕', duration: '3', major: '', topicZh: '', topicEn: '',
  startYear: '2020', venues: '', directionCount: '4–6', exclusions: '',
  groupDirections: '', dataFoundation: '', experimentFoundation: '', hardware: '',
  goal: '', constraints: '',
};

export const demoProfile = {
  degreeType: '学硕', duration: '3', major: '能源动力', topicZh: '电力负荷预测',
  topicEn: 'electric load forecasting; electricity demand forecasting', startYear: '2020',
  venues: 'Applied Energy、IEEE Transactions on Smart Grid、Energy 等；不限于这些来源',
  directionCount: '4–6', exclusions: '纯电价预测；与电力负荷无直接关系的可再生能源功率预测',
  groupDirections: '课题组已有电力系统数据分析与负荷建模基础（虚构演示）。',
  dataFoundation: '已有公开负荷数据集；私有数据授权状态尚未确认（虚构演示）。',
  experimentFoundation: '可开展 Python 建模与对比实验（虚构演示）。',
  hardware: '单卡消费级 GPU，不开展超大模型预训练（虚构演示）。',
  goal: '优先形成可验证、可按期完成的方法研究（虚构演示）。',
  constraints: '不依赖未授权私有电网数据，不依赖昂贵专用设备（虚构演示）。',
};

export const demoDirections = [
  { id: crypto.randomUUID(), name: '短期与日前负荷预测', description: '关注小时级、日前与日内负荷预测。' },
  { id: crypto.randomUUID(), name: '概率预测与不确定性', description: '关注区间、分位数和分布预测。' },
  { id: crypto.randomUUID(), name: '多源特征融合', description: '关注天气、日历及其他外生变量。' },
  { id: crypto.randomUUID(), name: '迁移学习与跨域泛化', description: '关注跨区域、数据稀缺与在线更新。' },
];

export function normalizeReadingCount(value) {
  const count = Number.parseInt(value, 10);
  return Number.isFinite(count) ? Math.max(5, count) : 5;
}

export function blankState() {
  return {
    profile: { ...blankProfile }, directions: [], selectedDirections: [], readings: {},
    expansionYear: '2010', readingCount: '5', keyMode: 'environment', apiKey: '', keyConsent: false,
    artifacts: {}, prompts: { first: '', second: '', third: '' },
    stale: { first: false, second: false, third: false }, activeStep: 'step0',
  };
}

export function hydrateState(saved) {
  const base = blankState();
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base, ...saved,
    profile: { ...base.profile, ...(saved.profile || {}) },
    directions: Array.isArray(saved.directions) ? saved.directions : [],
    selectedDirections: Array.isArray(saved.selectedDirections) ? saved.selectedDirections : [],
    readings: saved.readings && typeof saved.readings === 'object' ? saved.readings : {},
    readingCount: String(normalizeReadingCount(saved.readingCount ?? base.readingCount)),
    artifacts: saved.artifacts && typeof saved.artifacts === 'object' ? saved.artifacts : {},
    prompts: { ...base.prompts, ...(saved.prompts || {}) },
    stale: { ...base.stale, ...(saved.stale || {}) },
    activeStep: ['step0', 'step1', 'step2', 'step3'].includes(saved.activeStep) ? saved.activeStep : 'step0',
  };
}

export const artifactDefinitions = [
  { key: 'leapPdf', label: 'LeapSpace 调研报告', accept: '.pdf,application/pdf', hint: '第一次交互导出的 PDF', step: 'step1' },
  { key: 'leapCsv', label: 'LeapSpace 文献元数据', accept: '.csv,text/csv', hint: '保留原始 CSV，不做字段转换', step: 'step1' },
  { key: 'researchMd', label: '方向研究与精读指南', accept: '.md,.txt,text/markdown,text/plain', hint: '第二次交互生成的 MD，包含累计继承说明', step: 'step2' },
  { key: 'expandedCsv', label: 'OpenAlex 增补文献', accept: '.csv,text/csv', hint: '文件名保持不变；内容包含第一轮保留文献与第二轮新增文献', step: 'step2' },
  { key: 'finalReport', label: '候选选题论证报告', accept: '.docx,.md,.pdf', hint: '第三次交互的 1—2 份报告，可逐个上传', multiple: true, step: 'step3' },
];

export function readingSlots(directionId, count = 5) {
  return Array.from({ length: normalizeReadingCount(count) }, (_, index) => ({ title: '', status: 'missing', file: null, slot: index }));
}
