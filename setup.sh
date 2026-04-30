#!/usr/bin/env bash
# 量子六爻一键安装（macOS / Linux）
# 用法：bash setup.sh

set -e

ENV_NAME="qliuyao"
PY_VERSION="3.11"

echo "═══════════════════════════════════════════════"
echo "  量子六爻 · 一键安装"
echo "═══════════════════════════════════════════════"
echo ""

# 1. 检查 conda
if ! command -v conda &> /dev/null; then
    echo "❌ 没找到 conda 命令"
    echo "   请先装 Miniconda：https://docs.conda.io/projects/miniconda/en/latest/"
    exit 1
fi
echo "✓ conda 已就位 ($(conda --version))"

# 2. 创建环境（已存在则跳过）
if conda env list | grep -q "^${ENV_NAME} "; then
    echo "✓ conda 环境 '${ENV_NAME}' 已存在，跳过创建"
else
    echo ""
    echo "→ 创建 conda 环境 '${ENV_NAME}' (Python ${PY_VERSION})..."
    conda create -n "${ENV_NAME}" python="${PY_VERSION}" -y
    echo "✓ 环境已创建"
fi

# 3. 装依赖（用 conda run 在环境里执行 pip）
echo ""
echo "→ 安装 pyqpanda3..."
conda run -n "${ENV_NAME}" pip install -r requirements.txt
echo "✓ 依赖装好"

# 4. 验证
echo ""
echo "→ 验证安装..."
if conda run -n "${ENV_NAME}" python -c "import pyqpanda3.core; print('OK')" 2>&1 | grep -q OK; then
    echo "✓ pyqpanda3 import 正常"
else
    echo "⚠️  pyqpanda3 import 失败，可能是平台不兼容"
    echo "   仍可用 'python main.py --classical' 跑经典随机版本"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "  安装完成！下一步："
echo "═══════════════════════════════════════════════"
echo ""
echo "  conda activate ${ENV_NAME}"
echo "  python main.py"
echo ""
echo "  或者直接传问题："
echo "  python main.py -q \"今年是否适合换工作？\""
echo ""
