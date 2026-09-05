#!/usr/bin/env bash
# release.sh —— 量子六爻一键发布到 GitHub
#
# 你只需要改下面两行 ↓↓↓
#
GITHUB_USER="Keith9922"      # ← 改成你的，例如 "ronggang"
REPO_NAME="quantum-liuyao"         # ← 仓库名，可保留默认或改
#
# 然后：
#   bash release.sh
#
# 脚本会自动检测 gh CLI；
#   有 gh：自动建仓 + 推代码（一步到位）
#   没 gh：会提示你去网页建空仓，再自动推
# ─────────────────────────────────────────────

set -e

DEFAULT_BRANCH="main"

# 颜色
G='\033[0;32m'
Y='\033[1;33m'
R='\033[0;31m'
B='\033[0;36m'
N='\033[0m'

echo -e "${B}═══════════════════════════════════════════════${N}"
echo -e "${B}  量子六爻 · 一键发布到 GitHub${N}"
echo -e "${B}═══════════════════════════════════════════════${N}"
echo ""

# 0. 校验参数
if [ "$GITHUB_USER" = "你的GitHub用户名" ]; then
    echo -e "${R}❌ 还没改 GITHUB_USER！请用编辑器打开 release.sh 改第 6 行${N}"
    exit 1
fi

# 1. 安全检查：确认没有真实凭据会被推送出去
#    公开仓库里一旦出现 .env，GitHub 的密钥扫描机器人几分钟内就会发现，
#    所以这里在推送前做硬校验，而不是靠人工记得不提交。
echo -e "${G}→ 检查是否有凭据文件会被推送${N}"
LEAKED_FILES=""
for f in .env .env.local web/.env web/.env.local; do
    if [ -f "$f" ] && ! git check-ignore -q "$f"; then
        LEAKED_FILES="$LEAKED_FILES $f"
    fi
done
if [ -n "$LEAKED_FILES" ]; then
    echo -e "${R}❌ 以下凭据文件未被 .gitignore 覆盖，推送后会泄露：${N}"
    for f in $LEAKED_FILES; do echo -e "   ${R}$f${N}"; done
    echo ""
    echo "   处理办法：把它们加进 .gitignore（.env 已在默认模板中），"
    echo "   或改用 .env.example 占位后重新运行本脚本。"
    exit 1
fi
echo -e "   ${G}✓ 无凭据文件会被推送${N}"

# 2. 初始化 git（如果还没初始化）
if [ ! -d .git ]; then
    echo -e "${G}→ 初始化 git 仓库${N}"
    git init -q
    git branch -M $DEFAULT_BRANCH
fi

# 3. 添加文件
echo -e "${G}→ 添加所有文件${N}"
git add .

# 4. 看看暂存区
echo ""
echo "── 待提交的文件 ──"
git diff --cached --name-status | head -30
echo ""

# 5. Commit
if git rev-parse HEAD &>/dev/null; then
    echo -e "${G}→ 已有提交记录，新建 commit${N}"
    git commit -m "Update: 后续修改" || echo "   （没有变更，跳过 commit）"
else
    echo -e "${G}→ 创建首个提交${N}"
    git commit -q -m "✨ 量子六爻 · Initial release

把铜钱换成量子比特，让 AI 替你解卦。

特性：
- 真量子电路（pyqpanda3 三比特 Hadamard + 单 shot 测量）
- 完整易学知识库（64 卦 + 彖传 + 大象传 + 互错综 + 当位应承）
- OpenAI 兼容大模型强结构化解卦（6 步推理 + few-shot）
- 卡方检验工具自带证伪机制
- 一键安装脚本 + 统一环境变量配置模型服务

灵感：莱布尼茨遇见易经 + 薛定谔的卦"
fi

# 6. 推送（用 gh CLI 还是手动）
if command -v gh &>/dev/null && gh auth status &>/dev/null; then
    echo -e "${G}→ 检测到 GitHub CLI 已认证，自动建仓 + 推送${N}"

    # 检查仓库是否已存在
    if gh repo view "${GITHUB_USER}/${REPO_NAME}" &>/dev/null; then
        echo -e "${Y}   仓库已存在，直接推送${N}"
        if ! git remote get-url origin &>/dev/null; then
            git remote add origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
        fi
        git push -u origin $DEFAULT_BRANCH
    else
        gh repo create "${REPO_NAME}" --public --source=. --remote=origin --push \
            --description "把铜钱换成量子比特，让 AI 替你解卦。Quantum I Ching divination with pyqpanda3 + OpenAI-compatible LLMs." \
            --homepage "https://github.com/${GITHUB_USER}/${REPO_NAME}"
    fi

    # 设置 topics
    echo -e "${G}→ 设置仓库 topics${N}"
    gh repo edit "${GITHUB_USER}/${REPO_NAME}" \
        --add-topic quantum-computing \
        --add-topic i-ching \
        --add-topic iching \
        --add-topic divination \
        --add-topic pyqpanda3 \
        --add-topic chinese-philosophy \
        --add-topic for-fun \
        --add-topic llm \
        --add-topic python || true

else
    echo -e "${Y}ℹ 没检测到 gh CLI（或没登录）${N}"
    echo ""
    echo "   请手动操作："
    echo -e "   ${B}1.${N} 浏览器打开 https://github.com/new"
    echo -e "   ${B}2.${N} Repository name: ${G}${REPO_NAME}${N}"
    echo -e "   ${B}3.${N} 选 Public"
    echo -e "   ${B}4.${N} ${R}不要勾选${N} 'Add a README'、'Add .gitignore'、'Choose a license'"
    echo -e "   ${B}5.${N} 点 'Create repository'"
    echo ""
    read -p "   建好后按回车继续... "

    if ! git remote get-url origin &>/dev/null; then
        # 优先用 SSH，失败时让用户改 HTTPS
        git remote add origin "git@github.com:${GITHUB_USER}/${REPO_NAME}.git"
    fi

    echo -e "${G}→ 推送到 GitHub${N}"
    git push -u origin $DEFAULT_BRANCH || {
        echo -e "${Y}   SSH 推送失败，改用 HTTPS 重试${N}"
        git remote set-url origin "https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
        git push -u origin $DEFAULT_BRANCH
    }
fi

# 7. 完成
echo ""
echo -e "${G}═══════════════════════════════════════════════${N}"
echo -e "${G}  ✅ 发布成功！${N}"
echo -e "${G}═══════════════════════════════════════════════${N}"
echo ""
echo -e "  仓库地址：${B}https://github.com/${GITHUB_USER}/${REPO_NAME}${N}"
echo ""
echo "  ─── 推荐做的几件事 ───"
echo ""
echo "  1. 浏览器打开仓库，确认 README 渲染正常（banner、八卦图、Mermaid 流程图）"
echo "  2. About 处补充一句话简介"
echo "  3. Settings → 启用 Discussions（让人能交流）"
echo "  4. 写一篇 Release（GitHub 顶部 Releases → Draft a new release）"
echo "  5. 分享到 V2EX、即刻、Twitter、知乎—— '科技 × 玄学' 这种内容很容易传播"
echo ""
echo "  ─── 关于 API key ───"
echo ""
echo "  .env 已被 .gitignore 排除，不会进仓库——所以线上拿不到 key，需要单独配："
echo "    · Vercel：项目 Settings → Environment Variables 里加 LLM_API_KEY"
echo "    · 自托管：在运行环境的 .env 里放 key，用 docker-compose 的 env_file 注入"
echo ""
echo "  如果你手里还留着旧的历史 key（曾误提交进仓库的那把），请去"
echo "  https://platform.deepseek.com/api_keys 吊销它——历史提交视同已泄露。"
echo ""
