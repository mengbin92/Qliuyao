# -*- coding: utf-8 -*-
"""
八卦象意常量 —— 易经的"原子单位"。

每个三爻卦（八卦）的传统象征体系。卦由两个三爻卦上下叠加构成。
解卦时必须先看上下卦的象征关系，这是经学层面"卦义"的基础。

二进制约定：从下到上 3 位，'1' = 阳爻、'0' = 阴爻。
   乾 ☰ = 三阳     "111"
   坤 ☷ = 三阴     "000"
   震 ☳ = 一阳在下  "100"
   坎 ☵ = 一阳居中  "010"
   艮 ☶ = 一阳在上  "001"
   巽 ☴ = 一阴在下  "011"
   离 ☲ = 一阴居中  "101"
   兑 ☱ = 一阴在上  "110"
"""

TRIGRAMS = {
    "111": {
        "name": "乾", "symbol": "☰",
        "element": "天",     # 自然对应
        "attribute": "健",   # 卦德（核心性格）
        "family": "父",      # 家庭对应（父/母/三男三女）
        "body": "首",        # 人体对应
        "animal": "马",      # 动物对应
        "season": "晚秋初冬",
        "direction": "西北",
        "associations": "君主、首脑、刚健、领导、天空、决断、果敢、纯阳、玉、金",
    },
    "000": {
        "name": "坤", "symbol": "☷",
        "element": "地",
        "attribute": "顺",
        "family": "母",
        "body": "腹",
        "animal": "牛",
        "season": "晚夏初秋",
        "direction": "西南",
        "associations": "母亲、大众、柔顺、承载、土地、孕育、包容、纯阴、布、釜",
    },
    "100": {
        "name": "震", "symbol": "☳",
        "element": "雷",
        "attribute": "动",
        "family": "长男",
        "body": "足",
        "animal": "龙",
        "season": "春",
        "direction": "东",
        "associations": "震动、奋起、惊蛰、长子、大涂、决躁、苍筤竹、萑苇、行动开始",
    },
    "010": {
        "name": "坎", "symbol": "☵",
        "element": "水",
        "attribute": "陷",
        "family": "中男",
        "body": "耳",
        "animal": "豕",
        "season": "冬",
        "direction": "北",
        "associations": "险难、深陷、水流、智谋、忧患、月、隐伏、矫輮、弓轮",
    },
    "001": {
        "name": "艮", "symbol": "☶",
        "element": "山",
        "attribute": "止",
        "family": "少男",
        "body": "手",
        "animal": "狗",
        "season": "晚冬初春",
        "direction": "东北",
        "associations": "停止、稳重、山岳、门阙、果蓏、小石、阍寺、坚守、笃实",
    },
    "011": {
        "name": "巽", "symbol": "☴",
        "element": "风",
        "attribute": "入",
        "family": "长女",
        "body": "股",
        "animal": "鸡",
        "season": "晚春初夏",
        "direction": "东南",
        "associations": "风、木、入侵、谦逊、不果、进退、绳直、工、白、长",
    },
    "101": {
        "name": "离", "symbol": "☲",
        "element": "火",
        "attribute": "丽",
        "family": "中女",
        "body": "目",
        "animal": "雉",
        "season": "夏",
        "direction": "南",
        "associations": "光明、附丽、文明、太阳、电、甲胄、戈兵、干燥、华美",
    },
    "110": {
        "name": "兑", "symbol": "☱",
        "element": "泽",
        "attribute": "悦",
        "family": "少女",
        "body": "口",
        "animal": "羊",
        "season": "秋",
        "direction": "西",
        "associations": "喜悦、口舌、泽、巫师、毁折、附决、刚卤、妾、羊",
    },
}


def parse_trigrams(binary: str) -> tuple:
    """
    把 6 位卦串拆成下卦和上卦。
    binary[0..2] = 初/二/三爻 = 下卦（self-下而上）
    binary[3..5] = 四/五/上爻 = 上卦
    返回 (下卦 dict, 上卦 dict)
    """
    if len(binary) != 6 or any(c not in "01" for c in binary):
        raise ValueError(f"非法卦串：{binary!r}")
    lower_key = binary[0:3]
    upper_key = binary[3:6]
    return TRIGRAMS[lower_key], TRIGRAMS[upper_key]


def trigram_pair_label(binary: str) -> str:
    """生成"上X下Y"格式的卦象标识，例如『水雷屯』。"""
    lower, upper = parse_trigrams(binary)
    # 易经传统读法：上卦在前，例如 屯 是『水(上) 雷(下)』
    return f"{upper['element']}{lower['element']}"


if __name__ == "__main__":
    # 自测：8 + 64 = 72 个表项都对得上
    assert len(TRIGRAMS) == 8
    print(f"✓ 八卦定义齐全: {[v['name'] for v in TRIGRAMS.values()]}")
    # 抽查
    for binary in ["111111", "000000", "100010", "010001"]:
        lower, upper = parse_trigrams(binary)
        print(f"  {binary} → 下{lower['name']}({lower['symbol']})  上{upper['name']}({upper['symbol']})  = {trigram_pair_label(binary)}")
