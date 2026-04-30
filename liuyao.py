# -*- coding: utf-8 -*-
"""
量子六爻 —— 基于本源量子 pyqpanda3 的三比特电路起卦。

电路：
        ┌───┐    ┌─┐
  q0 ───┤ H ├────┤M├──
        ├───┤    ├─┤
  q1 ───┤ H ├────┤M├──
        ├───┤    ├─┤
  q2 ───┤ H ├────┤M├──
        └───┘    └─┘

每爻：三个量子比特经 Hadamard 进入 |+⟩|+⟩|+⟩ 叠加态，再单次测量得到 3 位串。
按"3 枚铜钱"的传统映射统计 1 的个数：
    3 个 1 → 老阳 (变爻 → 阴)   概率 1/8
    2 个 1 → 少阴               概率 3/8
    1 个 1 → 少阳               概率 3/8
    0 个 1 → 老阴 (变爻 → 阳)   概率 1/8

整卦六爻分别对应初爻、二爻、三爻、四爻、五爻、上爻。
"""

from dataclasses import dataclass
from typing import List, Tuple

# pyqpanda3 是本源量子的新一代 SDK，包名跟旧版 pyqpanda 不同
try:
    from pyqpanda3.core import CPUQVM, QProg, H, measure
    HAS_PYQPANDA3 = True
    _IMPORT_ERROR = None
except ImportError as e:  # pragma: no cover
    HAS_PYQPANDA3 = False
    _IMPORT_ERROR = e


# 爻象常量
LAO_YANG = "老阳"   # ⚊ 变爻
SHAO_YIN = "少阴"   # ⚋
SHAO_YANG = "少阳"  # ⚊
LAO_YIN = "老阴"    # ⚋ 变爻


@dataclass
class Yao:
    """单个爻的信息。"""
    index: int           # 爻位：0=初爻, 5=上爻
    bitstring: str       # 量子测量结果，例如 "101"
    ones: int            # 1 的数量
    name: str            # 老阳/少阴/少阳/老阴
    is_yang: bool        # 当前是否为阳
    is_changing: bool    # 是否为变爻

    @property
    def symbol(self) -> str:
        """ASCII 友好的爻形符号。"""
        if self.is_yang and self.is_changing:
            return "━━━━━━━━━ ◯"   # 老阳，将变阴
        elif self.is_yang:
            return "━━━━━━━━━"     # 少阳
        elif (not self.is_yang) and self.is_changing:
            return "━━━━ ━━━━ ✕"   # 老阴，将变阳
        else:
            return "━━━━ ━━━━"     # 少阴

    @property
    def changed_bit(self) -> str:
        """变爻之后的阴阳位。"""
        if self.is_changing:
            return "0" if self.is_yang else "1"
        return "1" if self.is_yang else "0"


def _interpret(bitstring: str, index: int) -> Yao:
    """将 3 位测量结果解析为爻象。"""
    ones = bitstring.count("1")
    if ones == 3:
        return Yao(index, bitstring, ones, LAO_YANG, True, True)
    if ones == 2:
        return Yao(index, bitstring, ones, SHAO_YIN, False, False)
    if ones == 1:
        return Yao(index, bitstring, ones, SHAO_YANG, True, False)
    return Yao(index, bitstring, ones, LAO_YIN, False, True)


def _build_program() -> "QProg":
    """构造一次起爻用的量子电路：H⊗H⊗H + 三比特批量测量。"""
    prog = QProg()
    # pyqpanda3 里 qubit 直接用整数下标，<< 是叠加门到 prog 末尾
    prog << H(0) << H(1) << H(2)
    # measure 接两个等长 list，一次性把三个比特测到三个经典寄存器
    prog << measure([0, 1, 2], [0, 1, 2])
    return prog


def cast_one_yao_pyqpanda3(index: int) -> Yao:
    """用本源 pyqpanda3 的 CPU 量子虚拟机起一爻。"""
    if not HAS_PYQPANDA3:
        raise RuntimeError(
            "pyqpanda3 未安装。请运行：pip install pyqpanda3\n"
            f"原始 ImportError：{_IMPORT_ERROR!r}"
        )

    qvm = CPUQVM()
    prog = _build_program()
    qvm.run(prog, shots=1)            # 跑一次电路
    counts = qvm.result().get_counts()  # 形如 {'010': 1}
    bitstring = next(iter(counts.keys()))

    # pyqpanda3 的 get_counts 习惯是高位在左、低位在右；
    # 我们这里只关心"几个 1"，所以高低位的解释不影响结果。
    return _interpret(bitstring, index)


def cast_one_yao_classical(index: int) -> Yao:
    """退化方案：纯经典随机模拟（pyqpanda3 不可用时使用）。"""
    import random
    bits = "".join(random.choice("01") for _ in range(3))
    return _interpret(bits, index)


def cast_six_yaos(use_quantum: bool = True) -> List[Yao]:
    """起六爻，按从初爻到上爻的顺序返回。"""
    if use_quantum and HAS_PYQPANDA3:
        cast = cast_one_yao_pyqpanda3
    else:
        cast = cast_one_yao_classical
    return [cast(i) for i in range(6)]


def yaos_to_binary(yaos: List[Yao]) -> Tuple[str, str]:
    """
    把六爻列表转为本卦与变卦的二进制串。
    返回值：(本卦 binary, 变卦 binary)，均以初爻在 index 0。
    """
    ben = "".join("1" if y.is_yang else "0" for y in yaos)
    bian = "".join(y.changed_bit for y in yaos)
    return ben, bian


def has_changing(yaos: List[Yao]) -> bool:
    """是否存在变爻。"""
    return any(y.is_changing for y in yaos)


def changing_indices(yaos: List[Yao]) -> List[int]:
    """变爻的爻位列表（0=初爻 ... 5=上爻）。"""
    return [y.index for y in yaos if y.is_changing]


if __name__ == "__main__":
    # 简单自测：用经典随机做一遍，验证逻辑
    import random
    random.seed(42)
    yaos = cast_six_yaos(use_quantum=False)
    for y in yaos:
        print(f"第{y.index + 1}爻  bits={y.bitstring}  {y.name:>3}  {y.symbol}")
    ben, bian = yaos_to_binary(yaos)
    print("本卦二进制:", ben)
    print("变卦二进制:", bian)
    print("变爻爻位:", [i + 1 for i in changing_indices(yaos)])
