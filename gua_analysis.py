# -*- coding: utf-8 -*-
"""
卦象分析工具 —— 衍生卦的计算 + 爻位结构分析。

本模块全是纯函数（无 IO、无外部依赖），输入是 6 位 0/1 卦串，输出是结构化字典。
所有结果会被打包进 AI 解卦的 prompt，让大模型不靠瞎想，而是基于"易学公式"做推理。

涉及概念：
    互卦（hùgua）：取本卦 2-3-4 爻为新下卦、3-4-5 爻为新上卦，揭示卦象内在结构。
    错卦（cuògua）：六爻全部阴阳反转，揭示卦象的"对立面/影子"。
    综卦（zōnggua）：六爻自下而上倒过来读，揭示"换个视角"。
    当位：阳爻在阳位（初/三/五）或阴爻在阴位（二/四/上）= 当位，否则不当位。
    中位：二爻、五爻为中位（在上下卦中央）。
    应位：初-四、二-五、三-上 三对，阴阳相对则"有应"，同性则"敌应"。
    承乘：相邻两爻，阴在阳之下为"承"（顺）；阴在阳之上为"乘"（逆）。
"""

from typing import Dict, List, Tuple


# ────────────────────────── 衍生卦计算 ──────────────────────────

def hu_gua(binary: str) -> str:
    """互卦：取 2、3、4 爻为新下卦，3、4、5 爻为新上卦。"""
    if len(binary) != 6:
        raise ValueError(binary)
    # 索引：0=初爻 ... 5=上爻
    new_lower = binary[1] + binary[2] + binary[3]
    new_upper = binary[2] + binary[3] + binary[4]
    return new_lower + new_upper


def cuo_gua(binary: str) -> str:
    """错卦：每一爻阴阳反转。"""
    return "".join("0" if c == "1" else "1" for c in binary)


def zong_gua(binary: str) -> str:
    """综卦：六爻自下而上倒过来读。"""
    return binary[::-1]


# ────────────────────────── 爻位结构分析 ──────────────────────────

# 爻位的"阴阳属性"：奇数位（1/3/5）= 阳位、偶数位（2/4/6）= 阴位
# 这里 index 0=初爻=第1位（阳位），index 5=上爻=第6位（阴位）
_POSITION_IS_YANG = [True, False, True, False, True, False]
_POSITION_NAME = ["初", "二", "三", "四", "五", "上"]


def _line_label(idx: int, is_yang: bool) -> str:
    """生成"九X" / "六X"形式的爻位标号。"""
    return f"{'九' if is_yang else '六'}{_POSITION_NAME[idx]}" if idx in (0,) and False else _build_label(idx, is_yang)


def _build_label(idx: int, is_yang: bool) -> str:
    pos_name_for_yao = ["初", "二", "三", "四", "五", "上"]
    if idx == 0:  # 初爻
        return f"{'初九' if is_yang else '初六'}"
    if idx == 5:  # 上爻
        return f"{'上九' if is_yang else '上六'}"
    return f"{'九' if is_yang else '六'}{pos_name_for_yao[idx]}"


def position_analysis(binary: str) -> List[Dict]:
    """
    返回 6 个爻的位置分析（自下而上）。每个爻包含：
        index, label, is_yang, position_yang, dang_wei, zhong_wei, zhong_zheng
    """
    out = []
    for i, c in enumerate(binary):
        is_yang = (c == "1")
        pos_yang = _POSITION_IS_YANG[i]
        dang_wei = (is_yang == pos_yang)
        zhong_wei = i in (1, 4)  # 二爻、五爻
        out.append({
            "index": i,
            "label": _build_label(i, is_yang),
            "is_yang": is_yang,
            "position_is_yang": pos_yang,
            "dang_wei": dang_wei,
            "zhong_wei": zhong_wei,
            "zhong_zheng": (zhong_wei and dang_wei),  # 中正之位（最理想）
        })
    return out


def correspondence_analysis(binary: str) -> List[Dict]:
    """
    应位分析：初-四、二-五、三-上 三对配对。
    返回 3 条记录，每条说明这一对是有应/敌应。
    """
    pairs = [(0, 3), (1, 4), (2, 5)]
    out = []
    for lo, hi in pairs:
        a, b = binary[lo], binary[hi]
        relation = "有应（阴阳相对，相通）" if a != b else "敌应（同性相斥）"
        out.append({
            "pair": (lo, hi),
            "labels": (_build_label(lo, a == "1"), _build_label(hi, b == "1")),
            "relation": relation,
        })
    return out


def cheng_cheng_analysis(binary: str) -> List[Dict]:
    """
    承乘分析：相邻两爻的阴阳关系。
    阴在阳下 = 承（柔顺）
    阴在阳上 = 乘（逆位）
    同性相邻则无承乘关系。
    """
    out = []
    for i in range(5):
        below = binary[i]
        above = binary[i + 1]
        if below == "0" and above == "1":
            rel = "承（柔承刚，顺）"
        elif below == "1" and above == "0":
            rel = "乘（柔乘刚，逆）"
        else:
            rel = "比（同性相邻）"
        out.append({
            "pair": (i, i + 1),
            "labels": (_build_label(i, below == "1"), _build_label(i + 1, above == "1")),
            "relation": rel,
        })
    return out


# ────────────────────────── 一站式打包 ──────────────────────────

def full_analysis(binary: str) -> Dict:
    """
    把上面所有分析打包成一个 dict，方便序列化进 AI prompt。
    """
    return {
        "binary": binary,
        "hu_gua": hu_gua(binary),
        "cuo_gua": cuo_gua(binary),
        "zong_gua": zong_gua(binary),
        "positions": position_analysis(binary),
        "correspondences": correspondence_analysis(binary),
        "neighbors": cheng_cheng_analysis(binary),
    }


# ────────────────────────── 自测 ──────────────────────────

if __name__ == "__main__":
    # 验证：屯 100010
    binary = "100010"
    a = full_analysis(binary)
    print(f"原卦: {binary} (屯)")
    print(f"  互卦: {a['hu_gua']}")
    print(f"  错卦: {a['cuo_gua']}")
    print(f"  综卦: {a['zong_gua']}")
    print(f"  位置分析:")
    for p in a["positions"]:
        flags = []
        if p["zhong_zheng"]: flags.append("中正")
        elif p["zhong_wei"]: flags.append("中位")
        if p["dang_wei"]: flags.append("当位")
        else: flags.append("不当位")
        print(f"    {p['label']}  {'阳' if p['is_yang'] else '阴'}爻在{'阳' if p['position_is_yang'] else '阴'}位  [{', '.join(flags)}]")
    print(f"  应位:")
    for c in a["correspondences"]:
        print(f"    {c['labels'][0]} ↔ {c['labels'][1]}  {c['relation']}")
    print(f"  承乘:")
    for n in a["neighbors"]:
        print(f"    {n['labels'][0]} → {n['labels'][1]}  {n['relation']}")

    # 互卦验证：屯 100010 的互卦应当是 剥 (000001)
    # 取 binary[1..3] = "000"，binary[2..4] = "001"
    # 拼接 = "000001" = 剥
    assert hu_gua("100010") == "000001", f"互卦错: {hu_gua('100010')}"
    # 错卦验证：屯 100010 的错卦 = 011101 = 鼎
    assert cuo_gua("100010") == "011101"
    # 综卦验证：屯 100010 的综卦 = 010001 = 蒙
    assert zong_gua("100010") == "010001"
    print(f"\n✓ 互错综计算验证通过")
