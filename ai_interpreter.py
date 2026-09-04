# -*- coding: utf-8 -*-
"""
AI 解卦模块（v2）—— 把卦象、衍生卦、爻位结构、彖传大象都整合进 prompt，
强制大模型按"易学方法论 + 引用原文"的方式做结构化推理，而不是泛泛抒情。

默认走 DeepSeek API（OpenAI 兼容协议）。要换别的供应商，只需调整环境变量：
    LLM_API_KEY     —— API key（必填）
    LLM_BASE_URL    —— API endpoint，默认 https://api.deepseek.com/v1
    LLM_MODEL       —— 模型名，默认 deepseek-chat

为了**零额外依赖**，本模块只用 Python 标准库的 urllib，不引入 openai/requests。
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional

from hexagrams import get_hexagram
from hexagram_wings import get_wings
from trigrams import parse_trigrams, trigram_pair_label
from gua_analysis import full_analysis
from liuyao import Yao


# ───────────────────── 配置 ─────────────────────

DEFAULT_BASE_URL = "https://api.deepseek.com/v1"
# 默认模型必须与 Web 端保持一致（web/src/app/api/interpret/route.ts 的
# DEFAULT_MODEL），否则同一个卦在 CLI 和网页上会喂给不同的模型，
# 解出来的内容质量与风格对不上。改一端就要改另一端。
# 用户可以用 LLM_MODEL 环境变量覆盖。如果模型名变了，--list-models 可查可用列表。
DEFAULT_MODEL = "deepseek-chat"
DEFAULT_TIMEOUT_S = 120  # 加大超时：升级版 prompt 内容多，模型推理更久


# ───────────── 零依赖 .env 加载 ─────────────

def _load_dotenv(env_path: Optional[Path] = None) -> None:
    if env_path is None:
        env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.is_file():
        return
    try:
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            os.environ.setdefault(key, val)
    except OSError:
        pass


_load_dotenv()


def _read_api_key() -> Optional[str]:
    return os.environ.get("LLM_API_KEY") or os.environ.get("DEEPSEEK_API_KEY")


def is_available() -> bool:
    return bool(_read_api_key())


# ───────────────────── System Prompt：易学方法论 + Few-shot ─────────────────────

SYSTEM_PROMPT = """\
你是一位精通《周易》的解卦顾问，受过经学训练。你的工作不是占卜算命，而是**结合卦象帮求问者做反思和决策推演**。

# 你必须遵循的方法论（违反任何一条都算失败）

## 一、必读的"原料"
求问者会向你提供：
1. 求问的具体问题
2. 本卦：卦名 / 卦辞 / 彖传 / 大象传 / 上下卦象意 / 六爻爻辞（动爻有标记）
3. 衍生卦：互卦（揭示卦象内部结构）/ 错卦（揭示对立面）/ 综卦（揭示换视角看）
4. 变卦（如有动爻）：卦名 / 卦辞 / 彖传 / 大象传
5. 爻位结构分析：当位、中正、应位、承乘
6. 朱子《易学启蒙》断卦法应用建议

## 二、必须做的推理步骤（按顺序）
1. **辨象**：先从上下卦象意（八卦）切入，说出本卦的核心象征是什么，与求问之事如何对应。
2. **取辞**：根据动爻数和朱子断卦法，确定该重点看哪一段（卦辞 / 动爻爻辞 / 变卦卦辞），**必须直接引用原文**，并用现代白话翻译一遍。
3. **观结构**：讲一下当位/应位/承乘对所问事的提示。例如"二爻五爻有应"暗示求问者与上司/合作方关系顺。
4. **看动向**：如有动爻，重点讲变卦——它揭示事情的发展终点。如无动爻，跳过此步。
5. **参互错综**：用一两句简要说明互卦/错卦/综卦给的补充视角（不必每个都讲，挑最相关的）。
6. **综合给建议**：基于以上推理，给出 2–3 条**具体可操作**的行动建议或思考方向。

## 三、八卦象意速查（推理时随时查）
- ☰ 乾（天/健）：父、首、刚健、领导、果敢、玉、金、君主
- ☷ 坤（地/顺）：母、腹、柔顺、承载、孕育、大众、土地、布
- ☳ 震（雷/动）：长男、足、震动、奋起、行动开始、龙
- ☵ 坎（水/陷）：中男、耳、险难、深陷、智谋、忧患、月、隐伏
- ☶ 艮（山/止）：少男、手、停止、稳重、山岳、坚守、笃实
- ☴ 巽（风/入）：长女、股、风、谦逊、不果、进退、绳直
- ☲ 离（火/丽）：中女、目、光明、附丽、文明、太阳、华美
- ☱ 兑（泽/悦）：少女、口、喜悦、口舌、毁折、刚卤

## 四、爻位概念速查
- 当位：阳爻在初/三/五位 或 阴爻在二/四/上位 = 顺位（吉）；反之为不当位（要改进）
- 中位：二爻、五爻；中位且当位 = 中正（最理想）
- 应位：初-四、二-五、三-上 三对，阴阳相对 = 有应（顺）；同性 = 敌应（阻）
- 承乘：相邻两爻，阴在阳下 = 承（顺势）；阴在阳上 = 乘（逆势）

## 五、绝对禁忌（违反 = 失败）
1. 不预测具体事件、时间、人名、数字（不许说"明年三月会涨工资"这种）
2. 不绝对化吉凶（用"倾向于"、"提示需要注意"、"有助于"，不用"必然"、"一定"、"肯定"）
3. 卦象与所问事关联确实弱时，必须诚实说明，不许硬解
4. 不允许大段抄袭古文不翻译，每段引用必须配现代白话
5. 不允许只给一句"听天命"这种空话——必须给出可操作的反思方向

## 六、输出格式（严格遵守）

```
<推理>
（按上面"推理步骤 1-6"逐条做演算，每步标号。这一段是给自己的推理草稿，不必修辞。）
</推理>

## 一、卦象大意
（80–150 字。从上下卦象意切入，落到所问事，必须引用卦辞或彖传。）

## 二、动爻指点
（80–150 字。引用具体动爻爻辞 + 白话翻译 + 对所问事的提示。无动爻时写"六爻皆静，事在当下"并阐释本卦卦辞。）

## 三、变卦趋势
（80–150 字。变卦预示事态走向。无动爻时写"无变卦，势态稳定"加一句简单提示。）

## 四、综合建议
（**2–3 条**编号列表。每条 30–60 字，必须是具体可操作的反思方向或行动建议。
 不要"加强自身修养"这种空话，要"在与 A 的合作里多倾听少决断"这种具体话。）
```

# Few-shot 示例（按上面格式做的标准答案）

求问问题示例："最近想接一个新项目，时间比较紧但回报很大，应该接吗？"

假设起卦得到：
- 本卦：屯（水雷屯，下震上坎）。卦辞"元亨利贞，勿用有攸往，利建侯。"
- 一爻动：第三爻动。三爻爻辞"即鹿无虞，惟入于林中，君子几不如舍，往吝。"
- 变卦：既济（水火既济）

标准解读如下——

<推理>
1. 辨象：下震（雷/动）上坎（水/险），雷在水下欲动而不能畅。屯，初创艰难之象。对应"接新项目时间紧"——动机有但环境险。
2. 取辞：一爻动，按朱子取本卦九三爻辞。"即鹿无虞，惟入于林中"——追鹿没向导，闯进树林深处。"君子几不如舍，往吝"——明智者宁可放弃，硬闯反受困。直接对应所问之事，强烈不建议接。
3. 观结构：九三阳爻在阳位当位，但在下卦顶端、上承六四之阴，且上无应（上六亦阴）——形势上有冲劲但缺外援。
4. 看动向：变卦既济，本是"已成"，但既济之吉在于慎守不变；此处由屯变既济，提示"若不能克制冒进，反而误了真正的成就时机"。
5. 参互：互卦剥（山地剥），消落之象，再次提示当下不宜进。
6. 综合：当下不接 ≠ 未来不接，要的是"等向导/等条件/等团队齐"。
</推理>

## 一、卦象大意
本卦屯，下震上坎，象征雷在水中欲动而被陷——正是"想动但条件还没就绪"的局面。彖传讲"刚柔始交而难生，动乎险中"。对照你想接项目这事：你有冲的能量（震），但外部环境是险（坎），属于"动机对、时机不对"。

## 二、动爻指点
九三动，爻辞说"即鹿无虞，惟入于林中，君子几不如舍，往吝"。白话：追鹿没向导，闯进林子越走越深；明白人懂得见好就收，硬上反而受困。这话非常直白对应所问——时间紧 + 缺资源准备（无虞），就是"无虞之猎"。"舍"不是放弃，是择时。

## 三、变卦趋势
变卦既济（水火既济），本身寓意"事已成"，但《易》最忌既济之后骄惰失守。此处由屯而既济提示：若现在硬接，短期可能完成，但大概率"成之不固"——埋下后续反复的坑，与既济卦最忌讳的"终止则乱"高度合拍。

## 四、综合建议
1. 当前不接，但不是永远不接——具体把"无虞"两个字落实成清单：缺什么人、什么经验、什么时间窗，对一项才考虑。
2. 与对方坦白讲"现在不行、什么条件下可以"。屯卦"利建侯"——找到合适的合作方/带路人再动。
3. 利用这次机会内观自己"为什么手痒想接"——是钱诱惑还是怕错过？区分清楚再做长期决策。
"""


# ───────────────────── User Prompt 构造 ─────────────────────

def _format_position_block(positions: List[Dict]) -> str:
    """生成爻位结构的简洁列表。"""
    lines = []
    for p in positions:
        flags = []
        if p["zhong_zheng"]:
            flags.append("中正")
        elif p["zhong_wei"]:
            flags.append("中位")
        if p["dang_wei"]:
            flags.append("当位")
        else:
            flags.append("不当位")
        yang_yin = "阳" if p["is_yang"] else "阴"
        pos_yang_yin = "阳" if p["position_is_yang"] else "阴"
        lines.append(f"  {p['label']}：{yang_yin}爻在{pos_yang_yin}位，{', '.join(flags)}")
    return "\n".join(lines)


def _format_corr_block(correspondences: List[Dict]) -> str:
    return "\n".join(f"  {c['labels'][0]} ↔ {c['labels'][1]}：{c['relation']}" for c in correspondences)


def _format_neighbor_block(neighbors: List[Dict]) -> str:
    return "\n".join(f"  {n['labels'][0]} → {n['labels'][1]}：{n['relation']}" for n in neighbors)


def _short_gua_card(binary: str, label: str) -> str:
    """衍生卦的简短信息卡（互/错/综 用）。"""
    info = get_hexagram(binary)
    wings = get_wings(binary)
    lower, upper = parse_trigrams(binary)
    da_xiang = wings.get("da_xiang", "（无）")
    return (
        f"【{label}】第 {info['num']} 卦 {info['symbol']} {info['name']}"
        f"（{info['pinyin']}，{trigram_pair_label(binary)}：上{upper['name']} 下{lower['name']}）\n"
        f"  卦辞：{info['judgment']}\n"
        f"  大象：{da_xiang}"
    )


def _full_gua_card(binary: str, yaos: Optional[List[Yao]] = None, label: str = "本卦",
                   moving_indices: Optional[List[int]] = None) -> str:
    """本卦/变卦的完整信息卡（卦辞 + 彖 + 大象 + 上下卦 + 全部爻辞 + 结构分析）。"""
    info = get_hexagram(binary)
    wings = get_wings(binary)
    lower, upper = parse_trigrams(binary)
    analysis = full_analysis(binary)
    moving = set(moving_indices or [])

    lines_block = []
    for i in range(6):
        marker = "  ★ 动爻" if i in moving else ""
        lines_block.append(f"  {info['lines'][i]}{marker}")

    return (
        f"【{label}】第 {info['num']} 卦 {info['symbol']} {info['name']}（{info['pinyin']}）\n"
        f"  上下卦：上{upper['name']}（{upper['element']}/{upper['attribute']}）"
        f" 下{lower['name']}（{lower['element']}/{lower['attribute']}） = {trigram_pair_label(binary)}{info['name']}\n"
        f"  卦辞：{info['judgment']}\n"
        f"  彖传：{wings.get('tuan', '（缺）')}\n"
        f"  大象：{wings.get('da_xiang', '（缺）')}\n"
        f"  六爻爻辞（自下而上）：\n" + "\n".join(lines_block) + "\n\n"
        f"  爻位结构分析：\n" + _format_position_block(analysis["positions"]) + "\n"
        f"  应位关系：\n" + _format_corr_block(analysis["correspondences"]) + "\n"
        f"  承乘关系：\n" + _format_neighbor_block(analysis["neighbors"])
    )


_RULE_MAP = {
    0: "六爻皆静 → 应以本卦卦辞断之",
    1: "一爻动 → 应以本卦该动爻爻辞为主断之",
    2: "二爻动 → 应以本卦两动爻爻辞断之，以上爻为主",
    3: "三爻动 → 本卦卦辞为贞、变卦卦辞为悔，二者参看",
    4: "四爻动 → 应以变卦两不变爻爻辞断之，以下爻为主",
    5: "五爻动 → 应以变卦不变爻爻辞断之",
    6: "六爻全动 → 应以变卦卦辞断之",
}


def _build_user_prompt(question: str, yaos: List[Yao], ben_bin: str, bian_bin: str) -> str:
    moving = [y.index for y in yaos if y.is_changing]
    n_moving = len(moving)
    rule = _RULE_MAP.get(n_moving, "")
    if n_moving == 6:
        if ben_bin == "111111":
            rule = "六爻全动（乾卦）→ 取『用九：见群龙无首，吉』"
        elif ben_bin == "000000":
            rule = "六爻全动（坤卦）→ 取『用六：利永贞』"

    moving_label = f"第 {[i+1 for i in moving]} 爻" if moving else "无动爻"

    # 衍生卦
    ben_analysis = full_analysis(ben_bin)
    hu_card = _short_gua_card(ben_analysis["hu_gua"], "互卦（揭示内部结构）")
    cuo_card = _short_gua_card(ben_analysis["cuo_gua"], "错卦（对立面/影子）")
    zong_card = _short_gua_card(ben_analysis["zong_gua"], "综卦（换视角）")

    parts = [
        f"# 求问者的问题",
        f"{question}",
        "",
        f"# 起卦结果",
        "",
        _full_gua_card(ben_bin, yaos, label="本卦", moving_indices=moving),
        "",
    ]
    if n_moving > 0:
        parts.append(_full_gua_card(bian_bin, label="变卦"))
        parts.append("")

    parts.extend([
        "# 衍生卦（参考）",
        "",
        hu_card,
        "",
        cuo_card,
        "",
        zong_card,
        "",
        "# 朱子断卦法",
        f"动爻数：{n_moving}（{moving_label}）",
        f"建议：{rule}",
        "",
        "请按 system prompt 中规定的格式给出 <推理> 段 + 四段最终解读。"
        "记住：每段都必须引用具体卦辞 / 爻辞 / 彖传作为依据，不能空泛抒情。",
    ])

    return "\n".join(parts)


# ───────────────────── 核心调用 ─────────────────────

def interpret(
    question: str,
    yaos: List[Yao],
    ben_bin: str,
    bian_bin: str,
    *,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
    timeout: int = DEFAULT_TIMEOUT_S,
) -> str:
    api_key = _read_api_key()
    if not api_key:
        raise RuntimeError(
            "未检测到 API key。\n"
            "  请先获取 DeepSeek API key（https://platform.deepseek.com/api_keys ），\n"
            "  然后在 .env 文件里设置：\n"
            "    DEEPSEEK_API_KEY=sk-...\n"
            "  再重新运行。"
        )

    base = (base_url or os.environ.get("LLM_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
    mdl = model or os.environ.get("LLM_MODEL") or DEFAULT_MODEL
    url = f"{base}/chat/completions"

    user_prompt = _build_user_prompt(question, yaos, ben_bin, bian_bin)

    payload = {
        "model": mdl,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.6,   # 略低，鼓励基于原文的稳定推理
        "max_tokens": 3000,   # 加大：推理段 + 四段输出需要更多空间
        "stream": False,
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json; charset=utf-8",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace") if e.fp else ""
        raise RuntimeError(
            f"AI 接口返回错误（HTTP {e.code}）：{e.reason}\n"
            f"  端点：{url}\n  响应：{detail[:500]}"
        ) from e
    except urllib.error.URLError as e:
        raise RuntimeError(
            f"无法连接到 AI 接口：{e.reason}\n"
            f"  端点：{url}\n"
            "  请检查网络（或代理）。如果你在国内访问 DeepSeek 官方接口，一般无需代理。"
        ) from e
    except Exception as e:  # pragma: no cover
        raise RuntimeError(f"调用 AI 时发生未预期错误：{e!r}") from e

    try:
        return body["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(
            f"AI 响应格式异常：{json.dumps(body, ensure_ascii=False)[:500]}"
        ) from e


# ───────────────────── 工具函数 ─────────────────────

def list_models(base_url: Optional[str] = None, timeout: int = 30) -> List[str]:
    """调用 /v1/models 端点拿到当前账号可用的模型 ID 列表。"""
    api_key = _read_api_key()
    if not api_key:
        raise RuntimeError("未检测到 API key，无法查询模型列表。")
    base = (base_url or os.environ.get("LLM_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
    url = f"{base}/models"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {api_key}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace") if e.fp else ""
        raise RuntimeError(f"查询模型列表失败 HTTP {e.code}：{detail[:300]}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"无法连接到模型列表端点：{e.reason}") from e
    return [m.get("id", "?") for m in body.get("data", [])]


# ───────────────────── 调试入口 ─────────────────────

if __name__ == "__main__":
    from liuyao import _interpret as parse_yao

    # 模拟一卦：贲（101001）一爻动（第三爻）
    sample_yaos = [
        parse_yao("011", 0),  # 少阴
        parse_yao("000", 1),  # 老阴 —— 动爻
        parse_yao("011", 2),  # 少阴
        parse_yao("100", 3),  # 少阳
        parse_yao("100", 4),  # 少阳
        parse_yao("011", 5),  # 少阴
    ]
    ben = "".join("1" if y.is_yang else "0" for y in sample_yaos)
    bian = "".join(y.changed_bit for y in sample_yaos)
    prompt = _build_user_prompt("最近想接一个新项目，时间比较紧但回报很大，应该接吗？", sample_yaos, ben, bian)
    print("=== System Prompt 长度：", len(SYSTEM_PROMPT), "字符 ===")
    print("=== User Prompt 长度：", len(prompt), "字符 ===")
    print()
    print("=== User Prompt 完整内容 ===")
    print(prompt)
    print()
    print("=== 当前 API 配置 ===")
    print("API key 是否设置：", is_available())
    print("base_url:", os.environ.get("LLM_BASE_URL", DEFAULT_BASE_URL))
    print("model:", os.environ.get("LLM_MODEL", DEFAULT_MODEL))
