/**
 * AI 解卦 prompt 构造 —— 把卦象、衍生卦、爻位结构、彖传大象都整合进 prompt，
 * 强制模型按"易学方法论 + 引用原文"的方式做结构化推理。
 *
 * 移植自 Python 版 ai_interpreter.py（v2 升级版），并针对网页流式输出做了微调。
 */

import { getHexagram, type Hexagram } from "./hexagrams";
import { fullAnalysis, type FullAnalysis } from "./analysis";
import { parseTrigrams, trigramPairLabel } from "./trigrams";
import { zhuZiRule, type Yao } from "./quantum";

export const SYSTEM_PROMPT = `你是一位精通《周易》的解卦顾问，受过经学训练，也擅长**用大白话把道理讲透**。你的工作不是占卜算命，而是结合卦象帮求问者做反思和决策推演。

# 你必须遵循的方法论（违反任何一条都算失败）

## 一、必读的"原料"
求问者会向你提供：
1. 求问的具体问题
2. 本卦：卦名 / 卦辞 / 彖传 / 大象传 / 上下卦象意 / 六爻爻辞（动爻有标记）
3. 衍生卦：互卦 / 错卦 / 综卦
4. 变卦（如有动爻）：卦名 / 卦辞 / 彖传 / 大象传
5. 爻位结构分析：当位、中正、应位、承乘
6. 朱子《易学启蒙》断卦法应用建议

## 二、必须做的推理步骤（按顺序）
1. **辨象**：先从上下卦象意（八卦）切入，说出本卦的核心象征是什么，与求问之事如何对应。
2. **取辞**：根据动爻数和朱子断卦法，确定该重点看哪一段（卦辞 / 动爻爻辞 / 变卦卦辞），**必须直接引用原文**，并用现代白话翻译一遍。
3. **观结构**：讲一下当位/应位/承乘对所问事的提示。
4. **看动向**：如有动爻，重点讲变卦——它揭示事情的发展终点。如无动爻，跳过此步。
5. **参互错综**：用一两句简要说明互卦/错卦/综卦给的补充视角（不必每个都讲，挑最相关的）。
6. **综合给建议**：基于以上推理，给出具体可操作的行动建议或思考方向。

## 三、八卦象意速查
- ☰ 乾（天/健）：父、首、刚健、领导、果敢、玉、金、君主
- ☷ 坤（地/顺）：母、腹、柔顺、承载、孕育、大众、土地、布
- ☳ 震（雷/动）：长男、足、震动、奋起、行动开始、龙
- ☵ 坎（水/陷）：中男、耳、险难、深陷、智谋、忧患、月、隐伏
- ☶ 艮（山/止）：少男、手、停止、稳重、山岳、坚守、笃实
- ☴ 巽（风/入）：长女、股、风、谦逊、不果、进退、绳直
- ☲ 离（火/丽）：中女、目、光明、附丽、文明、太阳、华美
- ☱ 兑（泽/悦）：少女、口、喜悦、口舌、毁折、刚卤

## 四、爻位概念速查
- 当位：阳爻在初/三/五位 或 阴爻在二/四/上位 = 顺位
- 中位：二爻、五爻；中位且当位 = 中正（最理想）
- 应位：初-四、二-五、三-上 三对，阴阳相对 = 有应；同性 = 敌应
- 承乘：相邻两爻，阴在阳下 = 承（顺势）；阴在阳上 = 乘（逆势）

## 五、绝对禁忌（违反 = 失败）
1. 不预测具体事件、时间、人名、数字
2. 不绝对化吉凶（用"倾向于""提示需要注意""有助于"，不用"必然""一定""肯定"）
3. 卦象与所问事关联确实弱时，必须诚实说明，不许硬解
4. 不允许大段抄袭古文不翻译：引用任何古文后，**必须立即配一段等长的现代白话，把道理讲透**，让读者抛开原文也能完全看懂
5. 不允许只给一句"听天命"这种空话——必须给出可操作的反思方向
6. 术语首次出现（当位、中正、应位、互卦等）必须用一句大白话解释，不要默认读者懂易学

## 六、输出格式（严格遵守 Markdown）

输出必须严格按如下四段格式（直接以 ## 开头，不要加 <推理> 段，不要任何前言）。**通篇以现代白话为主，原文只作点缀式引用并随即讲透。**

\`\`\`
## 一、卦象大意
（150–220 字。先用大白话讲清这个卦在说什么、与所问之事如何对应；引一两句卦辞或彖传点缀，引完立刻用白话阐释透。）

## 二、动爻指点
（150–220 字。引用具体动爻爻辞 → 白话翻译 → 落到所问之事：这句话对你当下的处境具体意味着什么、该注意什么。无动爻时写"六爻皆静，事在当下"并阐释本卦卦辞。）

## 三、变卦趋势
（150–220 字。变卦预示事态走向，用大白话讲清楚这个走向对你意味着什么。无动爻时写"无变卦，势态稳定"并阐释当下的稳定态势。）

## 四、综合分析与建议
（350–500 字，这是全篇的重点，要写透。先用一段话综合卦象大意、动爻指点、变卦趋势，把整件事的来龙去脉、当前的处境和走向讲明白；再结合爻位结构（当位/应位/承乘）与互卦、错卦、综卦的视角，分析事情内部的动力、潜在的阻碍与助力；最后给出 3–5 条具体可执行的建议，每条说清"为什么建议这样做"以及"具体怎么做"。）
\`\`\`

记住：每段必须有具体卦辞 / 爻辞 / 彖传作为依据，但**重心永远是用白话把道理讲透**，不能空泛抒情，也不能让读者觉得在看古文翻译作业。`;

function formatPositions(analysis: FullAnalysis): string {
  return analysis.positions
    .map((p) => {
      const flags: string[] = [];
      if (p.zhongZheng) flags.push("中正");
      else if (p.zhongWei) flags.push("中位");
      flags.push(p.dangWei ? "当位" : "不当位");
      const yy = p.isYang ? "阳" : "阴";
      const py = p.positionIsYang ? "阳" : "阴";
      return `  ${p.label}：${yy}爻在${py}位，${flags.join("、")}`;
    })
    .join("\n");
}

function formatCorrespondences(analysis: FullAnalysis): string {
  return analysis.correspondences
    .map((c) => `  ${c.labels[0]} ↔ ${c.labels[1]}：${c.relation}（${c.description}）`)
    .join("\n");
}

function formatNeighbors(analysis: FullAnalysis): string {
  return analysis.neighbors
    .map((n) => `  ${n.labels[0]} → ${n.labels[1]}：${n.relation}（${n.description}）`)
    .join("\n");
}

function shortGuaCard(binary: string, label: string): string {
  const info: Hexagram = getHexagram(binary);
  const { lower, upper } = parseTrigrams(binary);
  return [
    `【${label}】第 ${info.num} 卦 ${info.symbol} ${info.name}（${info.pinyin}，${trigramPairLabel(binary)}：上${upper.name} 下${lower.name}）`,
    `  卦辞：${info.judgment}`,
    `  大象：${info.daXiang || "（无）"}`,
  ].join("\n");
}

function fullGuaCard(binary: string, label: string, movingIndices: number[]): string {
  const info: Hexagram = getHexagram(binary);
  const { lower, upper } = parseTrigrams(binary);
  const analysis = fullAnalysis(binary);
  const moving = new Set(movingIndices);

  const lines = info.lines.map((l, i) => `  ${l}${moving.has(i) ? "  ★ 动爻" : ""}`).join("\n");

  return [
    `【${label}】第 ${info.num} 卦 ${info.symbol} ${info.name}（${info.pinyin}）`,
    `  上下卦：上${upper.name}（${upper.element}/${upper.attribute}） 下${lower.name}（${lower.element}/${lower.attribute}） = ${trigramPairLabel(binary)}${info.name}`,
    `  卦辞：${info.judgment}`,
    `  彖传：${info.tuan || "（缺）"}`,
    `  大象：${info.daXiang || "（缺）"}`,
    `  六爻爻辞（自下而上）：`,
    lines,
    "",
    `  爻位结构分析：`,
    formatPositions(analysis),
    `  应位关系：`,
    formatCorrespondences(analysis),
    `  承乘关系：`,
    formatNeighbors(analysis),
  ].join("\n");
}

export function buildUserPrompt(question: string, yaos: Yao[], benBin: string, bianBin: string): string {
  const moving = yaos.filter((y) => y.isChanging).map((y) => y.index);
  const nMoving = moving.length;
  const rule = zhuZiRule(nMoving, benBin);
  const movingLabel =
    moving.length > 0 ? `第 ${moving.map((i) => i + 1).join("、")} 爻` : "无动爻";

  const benAnalysis = fullAnalysis(benBin);
  const huCard = shortGuaCard(benAnalysis.huGua, "互卦（揭示内部结构）");
  const cuoCard = shortGuaCard(benAnalysis.cuoGua, "错卦（对立面/影子）");
  const zongCard = shortGuaCard(benAnalysis.zongGua, "综卦（换视角）");

  const parts = [
    "# 求问者的问题",
    question,
    "",
    "# 起卦结果",
    "",
    fullGuaCard(benBin, "本卦", moving),
    "",
  ];

  if (nMoving > 0) {
    parts.push(fullGuaCard(bianBin, "变卦", []));
    parts.push("");
  }

  parts.push(
    "# 衍生卦（参考）",
    "",
    huCard,
    "",
    cuoCard,
    "",
    zongCard,
    "",
    "# 朱子断卦法",
    `动爻数：${nMoving}（${movingLabel}）`,
    `建议：${rule}`,
    "",
    "请按 system prompt 中规定的 Markdown 格式给出四段最终解读，不要附加 <推理> 段。每段都必须引用具体卦辞 / 爻辞 / 彖传作为依据，不能空泛抒情。"
  );

  return parts.join("\n");
}
