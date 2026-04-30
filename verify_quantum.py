# -*- coding: utf-8 -*-
"""
量子电路验证脚本 —— 证明（或证伪）你那 3 比特 H⊗H⊗H 电路的输出确实符合理论分布。

理论：每个量子比特经 Hadamard 后处于 (|0⟩+|1⟩)/√2，
     三比特张量积 → 8 个本征态等概率（每个 1/8 ≈ 12.5%）
     映射到爻象 → 老阳 1/8、少阴 3/8、少阳 3/8、老阴 1/8

跑法：
    python verify_quantum.py            # 10000 次默认
    python verify_quantum.py 50000      # 自定义次数

验证两件事：
    1. 单 shot 重复 N 次     —— 验证"每爻独立起卦"这个流程对不对
    2. 一次 N shots 批量     —— 验证 pyqpanda3 的批量采样跟单次重复结果一致
    3. 卡方检验              —— 给个数学上的"是否显著偏离均匀分布"判定
"""

import sys
import time
from collections import Counter

try:
    from pyqpanda3.core import CPUQVM, QProg, H, measure
    HAS = True
except ImportError as e:
    print(f"❌ pyqpanda3 未安装：{e}")
    print("   pip install pyqpanda3")
    sys.exit(1)


def _new_prog():
    prog = QProg()
    prog << H(0) << H(1) << H(2)
    prog << measure([0, 1, 2], [0, 1, 2])
    return prog


def cast_single_shot() -> str:
    """单 shot：跑一次电路，返回一个 3 位串。"""
    qvm = CPUQVM()
    qvm.run(_new_prog(), shots=1)
    return next(iter(qvm.result().get_counts().keys()))


def cast_batch(n: int) -> dict:
    """批量 shot：一次跑 n shots，返回 {bitstring: count}。"""
    qvm = CPUQVM()
    qvm.run(_new_prog(), shots=n)
    return dict(qvm.result().get_counts())


# 卡方检验：H0 = 八种结果均匀分布，自由度 7
# 0.05 显著性水平的临界值（df=7）= 14.0671
CHI2_CRIT_005 = 14.0671


def chi_square(counts: dict, total: int) -> float:
    expected = total / 8.0
    bins = ["000", "001", "010", "011", "100", "101", "110", "111"]
    return sum((counts.get(b, 0) - expected) ** 2 / expected for b in bins)


def yao_distribution(counts: dict) -> dict:
    """把 8 种 3 比特结果归到 4 种爻象。"""
    yao = {"老阳 (3 ones, 1/8)": 0, "少阴 (2 ones, 3/8)": 0,
           "少阳 (1 one,  3/8)": 0, "老阴 (0 ones, 1/8)": 0}
    for b, n in counts.items():
        ones = b.count("1")
        if ones == 3: yao["老阳 (3 ones, 1/8)"] += n
        elif ones == 2: yao["少阴 (2 ones, 3/8)"] += n
        elif ones == 1: yao["少阳 (1 one,  3/8)"] += n
        else: yao["老阴 (0 ones, 1/8)"] += n
    return yao


def fmt_table(counts: dict, total: int, header: str) -> None:
    print(f"\n--- {header} ---")
    print(f"{'结果':<8}{'次数':>8}{'实测占比':>12}{'理论占比':>12}{'偏差':>10}")
    bins = ["000", "001", "010", "011", "100", "101", "110", "111"]
    for b in bins:
        n = counts.get(b, 0)
        pct = n / total * 100
        diff = pct - 12.5
        print(f"  |{b}⟩  {n:>8}  {pct:>10.2f}%  {12.5:>10.2f}%  {diff:>+8.2f}%")


def fmt_yao(yao: dict, total: int) -> None:
    print(f"\n--- 爻象分布 ---")
    expected = {"老阳 (3 ones, 1/8)": 12.5, "少阴 (2 ones, 3/8)": 37.5,
                "少阳 (1 one,  3/8)": 37.5, "老阴 (0 ones, 1/8)": 12.5}
    print(f"{'爻象':<22}{'次数':>8}{'实测':>10}{'理论':>10}{'偏差':>10}")
    for label, n in yao.items():
        pct = n / total * 100
        exp = expected[label]
        print(f"  {label:<20}{n:>8}{pct:>9.2f}%{exp:>9.2f}%{pct-exp:>+9.2f}%")


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10000

    print(f"=" * 60)
    print(f"  量子电路验证 · {n} 次测量")
    print(f"=" * 60)

    # ── Test 1: 重复单 shot ─────────────────────
    print(f"\n[1/2] 跑 {n} 次「单 shot 单独起卦」...")
    t0 = time.time()
    single_counts = Counter()
    for i in range(n):
        single_counts[cast_single_shot()] += 1
        if (i + 1) % 1000 == 0:
            print(f"    进度 {i+1}/{n}", end="\r")
    t1 = time.time()
    print(f"    完成，耗时 {t1-t0:.2f}s（每次 {(t1-t0)/n*1000:.2f}ms）")

    fmt_table(dict(single_counts), n, f"{n} 次单 shot 测量分布")
    chi2_a = chi_square(dict(single_counts), n)
    print(f"\n  卡方统计量 χ² = {chi2_a:.3f}   (临界值 χ²₀.₀₅,df=7 = {CHI2_CRIT_005})")
    if chi2_a < CHI2_CRIT_005:
        print(f"  ✓ χ² < {CHI2_CRIT_005}：与均匀分布无显著差异，电路工作正常")
    else:
        print(f"  ⚠ χ² ≥ {CHI2_CRIT_005}：偏离均匀分布显著，注意是否多次运行就 OK（5% 概率假阳性）")

    fmt_yao(yao_distribution(dict(single_counts)), n)

    # ── Test 2: 一次批量 shot ─────────────────────
    print(f"\n[2/2] 跑 1 次「{n} shots 批量起卦」...")
    t0 = time.time()
    batch_counts = cast_batch(n)
    t1 = time.time()
    print(f"    完成，耗时 {t1-t0:.2f}s")

    fmt_table(batch_counts, n, f"1 次 {n} shots 批量测量分布")
    chi2_b = chi_square(batch_counts, n)
    print(f"\n  卡方统计量 χ² = {chi2_b:.3f}   (临界值 χ²₀.₀₅,df=7 = {CHI2_CRIT_005})")
    if chi2_b < CHI2_CRIT_005:
        print(f"  ✓ χ² < {CHI2_CRIT_005}：与均匀分布无显著差异")
    else:
        print(f"  ⚠ χ² ≥ {CHI2_CRIT_005}：偏离显著")

    fmt_yao(yao_distribution(batch_counts), n)

    # ── 解读 ─────────────────────
    print(f"\n" + "=" * 60)
    print("  结论与说明")
    print("=" * 60)
    print("""
1. 如果两个测试 χ² 都显著小于 14.07 → 电路确实在做 H⊗H⊗H 的量子模拟，
   8 种本征态的概率分布与理论一致。

2. 关于"是不是真量子"——这里用的是 pyqpanda3 的 CPUQVM (CPU 量子虚拟机):
   - 数学上严格按量子力学计算 H 门作用后的态向量
   - 单次测量按量子概率分布采样
   - 但底层熵源仍是经典伪随机数 (PRNG)

   要拿"物理真随机"——需要把电路提交到本源云的悟源超导真机:
       from pyqpanda3.qcloud import QCloud
       qm = QCloud("YOUR_API_KEY")
       qm.run(prog, shots=1, chip_id="...")
   分布会和模拟器一致，区别只在熵源是物理系统 vs PRNG。

3. 单 shot 重复 vs 批量 shot 的卡方应该都接近，
   差异较大说明 pyqpanda3 内部状态有问题，需要排查。
""")


if __name__ == "__main__":
    main()
