function value(text, fallback = '未额外说明') {
  return String(text || '').trim() || fallback;
}

function coreReadingCount(state) {
  const count = Number.parseInt(state.readingCount, 10);
  return Number.isFinite(count) ? Math.max(5, count) : 5;
}

export function buildFirstPrompt(profile) {
  return `围绕「${profile.topicZh}（${profile.topicEn}）」调研 ${profile.startYear || '2020'} 年 1 月 1 日至今的文献，归纳 ${profile.directionCount || '4–6'} 个研究方向。期刊为主，兼顾高影响会议；来源侧重：${value(profile.venues, '不预设')}；排除：${value(profile.exclusions, '无')}。每个方向给出名称、定义与边界、代表性论文、趋势依据、核心挑战、实际检索式和筛选标准，并导出：1. 调研报告 PDF：正文引用与文献编号对应，区分文献事实与趋势推断；2. 文献 CSV：包含编号、标题、作者、年份、来源、DOI、摘要（可获得时）及被引信息。PDF 与 CSV 中的文献编号应一致。无法核实的信息留空，不补写。`;
}

export function buildSecondPrompt(state) {
  const directions = state.directions.map((item, index) => `${index + 1}. ${item.name}${item.description ? `：${item.description}` : ''}`).join('\n');
  const readingCount = coreReadingCount(state);
  const keyInstruction = state.keyMode === 'direct'
    ? `用户已明确选择在本次提示词中提供 OpenAlex API key：${state.apiKey}\n仅将 key 用于本次 OpenAlex 请求，不要在输出报告、CSV、日志或代码中复述它。`
    : '从本地 OPENALEX_API_KEY 环境变量读取 key。不要要求用户把 key 粘贴到对话中，不要在输出报告、CSV、日志或代码中记录它。若当前环境不能访问 API，请给出可运行的本地脚本与操作步骤。';
  return `请基于我上传的 LeapSpace 调研报告 PDF 和原始文献 CSV，对下列研究方向分别进行 OpenAlex 文献增补，并梳理研究脉络与方法学演化。

本轮要形成可供下一次选题收敛独立使用的累计成果包，不生成最终选题报告。

【输入文件】
- LeapSpace 调研报告：${state.artifacts.leapPdf?.name || '尚未提供'}
- 原始文献 CSV：${state.artifacts.leapCsv?.name || '尚未提供'}

【研究方向】
${directions}

【OpenAlex 访问】
${keyInstruction}

【第一轮成果继承】
1. 逐条核对第一轮 CSV 中的文献，默认继承有效文献；第二轮以增补为主，不是重新筛选后只保留少量锚点。
2. 只有以下情况可以剔除或合并：重复记录、明显超出主题边界、无法核实且无法修正、与本次方向无关。不得仅因年份较早、被引较低或不属于本次新增而删除。
3. 重复文献合并时保留原始编号与累计文献编号的对应关系。
4. 剔除文献应在 MD 附录中列出原始编号、题名和剔除原因，不得静默遗漏。
5. 第一轮报告中与这些方向有关的定义、趋势依据、争议、负面证据和证据局限也应继承；如被后续检索修正，应说明修正依据。
6. 最终 CSV 必须同时包含“第一轮保留文献”和“第二轮新增文献”，不能只输出新增部分。

【OpenAlex 增补】
1. 以方向为单位开展增补，不是机械地对 CSV 中每篇论文逐篇扩展。
2. 默认时间范围：${state.expansionYear || '2010'} 年 1 月 1 日至今。
3. 对奠基性、方法源头或不可替代的经典文献，允许突破起始年份，但必须标记“经典文献”及保留理由。
4. 结合第一轮报告确定代表性工作、检索词及关键 references 与 cited_by，重点补充研究脉络缺失、方法源头、重要争议、近期演化与交叉方向证据。
5. 保留真实 DOI、OpenAlex ID、查询日期、来源轮次和扩展路径。尊重接口限流，采用有界重试；失败和空结果如实记录，不得用模型记忆伪造检索结果。
6. 引文关系不等于研究价值，被引次数不等于质量，趋势判断必须说明证据边界。

【输出一：方向研究与精读指南.md】
首先给出“累计继承说明”，包括：
- 第一轮文献总数、保留数、重复合并数、剔除数；
- 第二轮新增数、最终累计文献数；
- 第一轮原有质量问题及处理方式；
- 本次检索范围、失败记录和仍然存在的证据缺口。

随后按方向分别包含：
1. 方向定义与研究边界；
2. 研究脉络与关键方法转折；
3. 代表性工作及横向比较；
4. 主要技术路线、近期演化与不同方向之间的联系；
5. 关键争议、负面证据、研究缺口与证据局限；
6. 本次增补过程、检索式和失败记录；
7. ${readingCount} 篇需要我从高校或研究机构图书馆资源获取的核心精读文献，以及其余保留文献构成的扩展证据池。

每篇核心精读文献必须列出标题、作者、年份、DOI 或其他可核验标识、选择理由、拟回答的精读问题。不要提供未经授权的下载方式。
研究缺口应区分“某篇文献未报告”“本轮检索范围内未发现”和“有充分检索证据支持的领域缺口”，不得混写。

【输出二：增补文献.csv】
文件名保持为“增补文献.csv”，内容为第一轮保留文献与第二轮新增文献的合并去重结果，而不是仅包含新增文献。
至少保留：累计文献编号、原始编号、方向、标题、作者、年份、来源、文献类型、DOI、OpenAlex ID、摘要（可获得时）、被引信息、查询日期、来源轮次、来源路径、证据范围、是否经典文献、是否核心精读和备注。无法核实的字段留空并说明，不得补写。

【交付前自检】
确认第一轮有效文献均已进入累计 CSV 或剔除附录；MD 中的文献判断可以回溯到累计 CSV、输入材料或本次真实检索记录；不要把仅新增的文献表误称为累计成果。`;
}

export function buildThirdPrompt(state) {
  const selected = state.directions.filter((item) => state.selectedDirections.includes(item.id));
  const p = state.profile;
  const readingCount = coreReadingCount(state);
  const directionText = selected.map((direction) => {
    const readings = state.readings[direction.id] || [];
    const list = readings.map((item, index) => {
      const status = { full: '已获得全文', abstract: '只有摘要', missing: '尚未获得' }[item.status] || '尚未获得';
      return `  ${index + 1}. ${item.title}｜${status}${item.file?.name ? `｜文件：${item.file.name}` : ''}`;
    }).join('\n');
    return `### ${direction.name}\n${direction.description || ''}\n${list}`;
  }).join('\n\n');
  const fullCount = selected.reduce((sum, direction) => sum + (state.readings[direction.id] || []).filter((item) => item.status === 'full' && item.file).length, 0);
  const outputRule = fullCount === 0
    ? '当前没有已上传全文。只输出候选选题框架、待全文验证清单和后续精读计划，不生成伪装成已完成论证的正式初稿。'
    : fullCount < selected.length * readingCount
      ? '当前只有部分全文。可以生成候选选题论证报告，但必须明确证据缺口，不得把摘要或未获得材料写成已精读。'
      : '当前所选方向的重点文献均已上传全文。可以生成完整候选选题论证报告，仍须逐项核验引文和个人条件。';

  return `请结合我上传的方向研究 MD、增补文献 CSV、个人卡片和实际提供的精读文献 PDF，将以下优先方向收敛为 1—2 个候选课题，并分别形成“候选选题论证报告”。

第二轮成果已累计继承第一轮调研，无需再向我索取第一轮文件。

【优先方向与精读材料】
${directionText}

【个人卡片】
- 培养类型：${p.degreeType}，学制 ${p.duration} 年
- 专业方向：${value(p.major)}
- 课题组研究方向与基础：${value(p.groupDirections)}
- 已有数据：${value(p.dataFoundation)}
- 实验基础：${value(p.experimentFoundation)}
- 硬件基础：${value(p.hardware)}
- 个人目标与偏好：${value(p.goal)}
- 明确不能做的选题约束：${value(p.constraints)}

【证据与引用规则】
${outputRule}
1. 实际提供的全文是核心证据。涉及具体方法、数据、实验设置、结果和局限的关键论断，应尽量由全文支持，并保留页码、章节或图表定位。
2. 方向研究 MD 和增补文献 CSV 中的已核验文献，可以用于选题背景、研究分类、方法脉络、代表工作比较和研究现状论述，但不得超出其记录的证据范围。
3. 只有元数据的文献可以进入参考文献，但只能使用其可核验的研究主题和书目信息，不得虚构其方法、数据、结果或结论，也不得声称已经精读。
4. 每份候选报告应引用至少 30 篇去重且可核验、与课题直接相关的文献，并优先使用实际可得的 10—15 篇核心全文作为关键论据。两份候选报告可以共享部分文献，但应分别满足引用要求。
5. 所有文后参考文献都必须在正文中实际引用；不得为了凑足数量添加未使用文献。证据不足时应明确列出缺口和待补充清单，不得编造补齐。
6. 不得把“本轮检索未发现”写成“该领域无人研究”。没有充分依据时，不使用“首次”“空白”“完全没有人做过”等表述。
7. 不得编造数据、设备、课题组条件、个人经历或文献。个人卡片不明确时列为待确认事项，不得自行补全。
8. 若核心数据不可得、不合规或时间窗明显不足，应作为硬性风险，不得用其他优势掩盖。

【每份报告的结构与篇幅】
1. 候选题目、摘要与关键词；
2. 选题背景与研究意义；
3. 国内外研究现状：约占总正文 35%，作为重点展开；
4. 科学问题与研究目标：约占 15%；
5. 研究内容、研究方法与技术路线：约占 20%—25%；
6. 个性化可行性分析：约占 15%；
7. 主要风险、备选方案与待确认事项；
8. 拟创新点、预期成果与进度安排；
9. 规范参考文献表；
10. 核心全文证据位置附录。

研究现状不能只写成分篇摘要或一张演化表。应按主题连续论述，每个主题包含“代表研究—方法比较—证据与争议—适用边界—未解决问题—与本课题的关系”，最后逐层导出科学问题。
拟创新点必须与已有研究比较后谨慎表述，不得仅因更换模型、数据或应用场景就声称创新，不得轻率使用“首次”。

增加“科学问题→研究目标→研究内容→研究方法→评价指标→所需证据→预期交付物”的对应矩阵，确保每个科学问题都有研究内容回应，每项核心研究内容都服务于科学问题。
可行性必须结合个人卡片展开，说明“已有条件具体支撑哪个研究任务、尚缺什么、如何补齐”。区分已确认事实、合理假设、待验证条件和硬停止条件。
参考文献表应完整列出本轮实际引用的文献；核心全文的页码与章节定位另列证据附录，不要把参考文献表缩减为仅包含全文的证据清单。

【交付方式】
- 分别形成 1—2 份报告，并在开头用简短对比说明各自适用条件，不替导师作最终决定。
- 如果当前工具支持文件生成，请分别输出 .docx；如果不支持，输出结构完整的 Markdown，供我导出或转换。
- 未提供学校正式模板时采用通用结构，不声称符合本校开题格式；如提供模板，再按栏目映射并提醒人工核对格式。

【交付前自检】
核对研究现状是否充分展开、每份报告是否至少引用 30 篇、正文引用与文后条目是否一致、科学问题与研究内容是否对应、可行性是否真正使用个人卡片，以及是否存在超出证据范围的论断。`;
}
