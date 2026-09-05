# -*- coding: utf-8 -*-
"""
量子六爻 —— 主程序入口。

完整流程：
    1. 让用户输入心中所问之事
    2. 用本源量子 pyqpanda3 起六爻
    3. 打印卦象 + 卦辞 + 爻辞
    4. 调用 OpenAI 兼容大模型（默认 DeepSeek）结合问题给出白话解读
       —— 没有 API key 时跳过这一步，只打印卦象，让你自己悟

直接在 PyCharm 里右键 → Run 'main' 即可。
"""

import argparse
import os
import sys
from typing import List, Optional

from hexagrams import HEXAGRAMS, get_hexagram
from liuyao import (
    Yao,
    cast_six_yaos,
    yaos_to_binary,
    changing_indices,
    has_changing,
    HAS_PYQPANDA3,
)
import ai_interpreter


# ──────────────────────── 美化打印 ────────────────────────

def _print_header(title: str) -> None:
    bar = "═" * 60
    print(f"\n{bar}")
    print(f"  {title}")
    print(bar)


def print_circuit_diagram() -> None:
    print("量子电路（每一爻独立运行一次）：")
    print()
    print("        ┌───┐    ┌─┐")
    print("  q0 ───┤ H ├────┤M├──")
    print("        ├───┤    ├─┤")
    print("  q1 ───┤ H ├────┤M├──")
    print("        ├───┤    ├─┤")
    print("  q2 ───┤ H ├────┤M├──")
    print("        └───┘    └─┘")
    print()
    print("  Hadamard 把 |0⟩ 送进叠加态 (|0⟩+|1⟩)/√2，三比特张量积 → 8 个等概率的本征态。")
    print("  单次测量后波函数坍缩，对应一次「摇卦」的结果。")


def print_six_yaos(yaos: List[Yao]) -> None:
    """从上到下打印六爻（上爻在最上方，符合传统画卦习惯）。"""
    _print_header("六次量子测量结果")
    print(f"{'爻位':<6}{'量子比特':<14}{'1的个数':<10}{'爻象':<8}{'卦画'}")
    print("─" * 60)
    yao_names_top_down = ["上爻", "五爻", "四爻", "三爻", "二爻", "初爻"]
    for label, yao in zip(yao_names_top_down, reversed(yaos)):
        bits = f"|{yao.bitstring}⟩"
        print(f"{label:<6}{bits:<14}{yao.ones:<10}{yao.name:<8}{yao.symbol}")


def print_hexagram(binary: str, title: str, mark_lines: Optional[List[int]] = None) -> None:
    """
    打印指定卦的卦名、卦辞、六爻爻辞。
    mark_lines: 需要标星号高亮的爻位（0=初爻 ... 5=上爻），用于本卦动爻提醒。
    """
    info = get_hexagram(binary)
    mark_lines = mark_lines or []

    _print_header(f"{title}：第 {info['num']} 卦  {info['symbol']}  {info['name']}（{info['pinyin']}）")
    print(f"卦辞：{info['judgment']}")
    print()
    print("爻辞：")
    # 自上而下打印
    for i in reversed(range(6)):
        marker = "  ★" if i in mark_lines else "   "
        print(f"  {marker} {info['lines'][i]}")
    if "extra" in info:
        print(f"     {info['extra']}")


def interpret_changing(yaos: List[Yao], ben_bin: str, bian_bin: str) -> None:
    """按朱熹《启蒙》六爻断卦原则给出参考解读方向（不调用 AI 的简易版）。"""
    _print_header("断卦提示（朱子《易学启蒙》六爻断法）")
    n = sum(1 for y in yaos if y.is_changing)
    ben = get_hexagram(ben_bin)
    bian = get_hexagram(bian_bin)

    if n == 0:
        guidance = "六爻皆静 → 以本卦卦辞断之。"
        focus = ben["judgment"]
    elif n == 1:
        idx = next(i for i, y in enumerate(yaos) if y.is_changing)
        guidance = f"一爻动 → 以本卦该动爻爻辞断之（第{idx+1}爻）。"
        focus = ben["lines"][idx]
    elif n == 2:
        idxs = [i for i, y in enumerate(yaos) if y.is_changing]
        guidance = f"二爻动 → 以本卦两动爻爻辞断之，以上爻（第{idxs[1]+1}爻）为主。"
        focus = "  / ".join(ben["lines"][i] for i in idxs)
    elif n == 3:
        guidance = "三爻动 → 以本卦及变卦卦辞参看，本卦为贞，变卦为悔。"
        focus = f"本卦：{ben['judgment']}\n      变卦：{bian['judgment']}"
    elif n == 4:
        idxs = [i for i, y in enumerate(yaos) if not y.is_changing]
        guidance = f"四爻动 → 以变卦两不变爻爻辞断之，以下爻（第{idxs[0]+1}爻）为主。"
        focus = "  / ".join(bian["lines"][i] for i in idxs)
    elif n == 5:
        idx = next(i for i, y in enumerate(yaos) if not y.is_changing)
        guidance = f"五爻动 → 以变卦不变爻爻辞断之（第{idx+1}爻）。"
        focus = bian["lines"][idx]
    else:  # n == 6
        if ben_bin == "111111":
            guidance = "六爻皆动（乾卦）→ 用九：见群龙无首，吉。"
            focus = "用九：见群龙无首，吉。"
        elif ben_bin == "000000":
            guidance = "六爻皆动（坤卦）→ 用六：利永贞。"
            focus = "用六：利永贞。"
        else:
            guidance = "六爻皆动 → 以变卦卦辞断之。"
            focus = bian["judgment"]

    print(guidance)
    print()
    print("重点参看：")
    for line in focus.split("\n"):
        print(f"  {line}")


def print_ai_interpretation(question: str, yaos, ben_bin: str, bian_bin: str) -> None:
    """调用 AI 解卦并打印。失败时给出友好提示。"""
    _print_header("AI 解卦")
    if not ai_interpreter.is_available():
        print("⚠️  未检测到 API key，跳过 AI 解卦。")
        print()
        print("    要打开 AI 解卦：")
        print("      1. 从所用模型服务商获取 API key")
        print("      2. 在 shell 设置环境变量：")
        print("           export LLM_API_KEY='你的 API key'")
        print("      3. 重新运行本程序")
        print()
        print("    或者在 PyCharm 的 Run Configuration → Environment variables 里加 LLM_API_KEY。")
        print("    默认使用 DeepSeek；使用其他服务时，还需设置 LLM_BASE_URL 和 LLM_MODEL。")
        return

    print(f"问题：{question}")
    print()
    print("⏳ 正在请求大模型解卦……（约需 5–20 秒）")
    print()
    try:
        text = ai_interpreter.interpret(question, yaos, ben_bin, bian_bin)
    except RuntimeError as e:
        print(f"❌ AI 解卦失败：{e}")
        return
    print(text)


# ──────────────────────── 主流程 ────────────────────────

def ask_for_question(cli_question: Optional[str]) -> str:
    """获取用户的问题。优先使用命令行参数，否则交互式输入。"""
    if cli_question:
        return cli_question.strip()

    print()
    print("─" * 60)
    print("请说出心中所问之事（例如：「最近想换工作，是去还是留？」）")
    print("不便/不愿提供问题就直接回车，跳过 AI 解卦只摇卦。")
    print("─" * 60)
    try:
        q = input("➤ ").strip()
    except (EOFError, KeyboardInterrupt):
        print()
        return ""
    return q


def main() -> None:
    parser = argparse.ArgumentParser(description="量子六爻 —— 用本源量子 SDK 摇一卦 + AI 解卦")
    parser.add_argument(
        "--question", "-q",
        help="所问之事；不传会交互式提示输入",
    )
    parser.add_argument(
        "--no-ai",
        action="store_true",
        help="不调用 AI 解卦，只打印卦象与朱子断卦法提示",
    )
    parser.add_argument(
        "--classical",
        action="store_true",
        help="不使用 pyqpanda3，改用纯随机模拟（在没装 SDK 的环境里也能跑）",
    )
    parser.add_argument(
        "--list-models",
        action="store_true",
        help="列出当前模型服务可用的模型 ID 然后退出（用于配置 LLM_MODEL）",
    )
    args = parser.parse_args()

    # 如果只是查模型列表，提前处理然后退出
    if args.list_models:
        try:
            models = ai_interpreter.list_models()
        except RuntimeError as e:
            print(f"❌ {e}")
            sys.exit(1)
        print("可用模型 ID：")
        current_model = os.environ.get("LLM_MODEL") or ai_interpreter.DEFAULT_MODEL
        for m in models:
            mark = "  ← 当前使用" if m == current_model else ""
            print(f"  - {m}{mark}")
        return

    use_quantum = (not args.classical) and HAS_PYQPANDA3
    backend = "本源量子 pyqpanda3 CPU 虚拟机" if use_quantum else "经典伪随机模拟（pyqpanda3 不可用）"

    _print_header("量子六爻 · Quantum Liuyao")
    print(f"后端：{backend}")
    print()
    print_circuit_diagram()

    if not use_quantum and not args.classical:
        print()
        print("⚠️  未检测到 pyqpanda3，已自动降级到经典模式。")
        print("    安装命令：pip install pyqpanda3")
        print("    要求：Python 3.10–3.14，macOS 13+ / Windows / Linux x86_64")

    # 1. 先问问题（在起卦前问，符合"心诚求问"的传统）
    question = ask_for_question(args.question)

    # 2. 起卦
    yaos = cast_six_yaos(use_quantum=use_quantum)
    print_six_yaos(yaos)

    ben_bin, bian_bin = yaos_to_binary(yaos)
    moving = changing_indices(yaos)

    # 3. 打印本卦 / 变卦
    print_hexagram(ben_bin, "本卦", mark_lines=moving)
    if has_changing(yaos):
        print_hexagram(bian_bin, "变卦")

    # 4. 朱子断卦法提示（永远打印，作为对照）
    interpret_changing(yaos, ben_bin, bian_bin)

    # 5. AI 解卦：默认开，--no-ai 关；没有 question 也跳过
    if args.no_ai:
        _print_header("AI 解卦")
        print("已通过 --no-ai 关闭。")
    elif not question:
        _print_header("AI 解卦")
        print("未提供问题，跳过 AI 解卦。")
        print("（提示：心中无所问而起卦，传统上称为「无问之卦」，宜留作每日一签自参。）")
    else:
        print_ai_interpretation(question, yaos, ben_bin, bian_bin)

    _print_header("完成")
    print("提示：变爻在本卦爻辞旁标 ★。结果仅作娱乐与文化参考。")


if __name__ == "__main__":
    main()
