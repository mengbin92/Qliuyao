# 量子六爻（Qliuyao）项目评审 · 统一整改清单

> 评审日期：2026-09-04 ｜ 性质：**只读评审，未修改任何源码**
> 参与：架构评审（architect-review）+ 质量门禁审计（qa-review）｜ 汇总：交付总监（team-lead）
> 原始报告：[architecture-review.md](./architecture-review.md) · [quality-audit.md](./quality-audit.md)
> 口径：每一条结论均有命令输出或 `文件:行号` 支撑；未验证项如实标注 N/A，不谎报已核查。

---

## 1. TL;DR

| 维度 | 结论 |
|---|---|
| 领域算法正确性 | ✅ **优秀** —— 双端程序化对拍，起爻映射/64 卦索引/互错综/当位应承/朱子断卦法 **零漂移** |
| 代码质量 | ✅ 良好 —— TypeScript 全量无 `any`，`typecheck` 0 错，Python 9/9 可编译 |
| 工程门禁 | ❌ **不达标** —— `lint` 3 错、`build` 确定性红、无 CI、无自动化测试 |
| 凭据安全 | 🚨 **P0 已失陷** —— 真实 DeepSeek key 自首个 commit 起在 git 历史中 |
| 流程纪律 | ⚠️ 薄弱 —— CLAUDE.md 写得很硬，实际落地约 1/3 |

**一句话**：算法和代码本身是健康的，**问题全在工程纪律和凭据管理上**。

---

## 2. 门禁实测结果（合并）

| 检查项 | 命令 | 结果 | 判定 |
|---|---|---|---|
| Web 类型检查 | `npm run typecheck` | 0 errors | ✅ |
| Web ESLint | `npm run lint` | 3 errors（`scripts/e2e.cjs:7,9,14` 的 `require()`） | ❌ |
| Web 生产构建 | `npm run build` | 代码层确定性红（`next.config.mjs` 未关 build-lint，会被同一 e2e.cjs 拦断） | ❌ |
| Python 语法编译 | `py_compile *.py` | 9/9 通过 | ✅ |
| Python 逻辑自检 | `python3 check_project.py` | **7/7 通过**，真 `AssertionError` 断言 | ✅ |
| Python 量子验证 | `python3 verify_quantum.py` | 缺 `pyqpanda3` 无法运行 | N/A |
| CI 流水线 | — | 无 `.github/workflows` | ❌ |
| 自动化测试 | — | 无 `tests/`、无 pytest/unittest | ❌ |

> **build 未实跑的说明**：QA 报环境层被沙箱 `safe-delete` 护栏拦截（`.next` 清理 count=2653 > threshold=50），无法产出路由清单与 bundle 体积 → 该子项 **N/A**。但代码层判定是确定的：`next build` 默认跑 ESLint，而 e2e.cjs 的 3 个 error 未被 ignore → **就算环境放行也必红**。

---

## 3. 核心结论：算法是对的

架构师写了校验脚本（`/tmp/verify_hexagrams.py`）做双端程序化对拍：

| 算法项 | Python 端 | Web 端 | 双端一致 | 正确性 |
|---|---|---|---|---|
| 起爻映射（1/8·3/8·3/8·1/8） | `liuyao.py:74-83` | `quantum.ts:66-74` | ✅ | ✅ |
| 64 卦二进制索引 | `hexagrams.py` | `hexagrams.json` | ✅ **drift=0** | ✅ King Wen mismatches=0 |
| 互卦 / 错卦 / 综卦 | `gua_analysis.py:23-40` | `analysis.ts:11-25` | ✅ | ✅ |
| 当位 / 应位 / 承乘 | `gua_analysis.py:46-128` | `analysis.ts:5-128` | ✅ | ✅ |
| 朱子断卦法（含乾坤用九用六） | `main.py:86-124` | `quantum.ts:113-130` | ✅ | ✅ |
| 解卦 prompt 模板 | `ai_interpreter.py:117-136` | `prompt.ts:59-77` | ⚠️ **不一致** | 呈现层差异 |
| 默认模型 | `deepseek-v4-pro` | `deepseek-chat` | ❌ **不一致** | 见 P1-2 |

可复现卦例（屯 ䷂ = `100010`）：互卦→剥、错卦→鼎、综卦→蒙，两端逐爻相等。

---

## 4. 统一问题清单（按严重度）

### 🚨 P0

| # | 问题 | 证据 | 影响 | 处置 |
|---|---|---|---|---|
| 1 | **真实 API key 自首个 commit 起在 git 历史中** | `git ls-files`→`.env`；`git check-ignore -v .env` rc=1；`.env:3` 真实格式 `sk-...`；`.gitignore:15-18` 注释「故意不忽略」；`git log --all -- .env` → `28dc31d Initial release` | 任何能克隆仓库者皆持此凭据；GitHub 密钥扫描机器人会持续告警；`release.sh:39-46` 还主动对外公开 | ① 立即在 DeepSeek 后台**轮换/吊销** ② 仓内仅留 `.env.example` ③ 根 `.gitignore` 解开 `.env` ④ `git filter-repo` 清历史（**需你授权，本次未执行任何历史改写**） |

### ⚠️ P1

| # | 问题 | 证据 | 影响 | 处置 |
|---|---|---|---|---|
| 2 | **默认模型名三处不一致**，Python 默认值疑似无效 | `ai_interpreter.py:35` `deepseek-v4-pro` / `api/interpret/route.ts:7` `deepseek-chat` / `docker-compose.yml:15` `deepseek-v4-pro-0813` | Python 端若模型名无效，AI 解卦直接 4xx | 统一为 `deepseek-chat`（Web 端已验证可用），三处引用同一常量 |
| 3 | **lint/build 双红**，根因是 e2e.cjs 的 `require()` | `scripts/e2e.cjs:7,9,14` `@typescript-eslint/no-require-imports`；`eslint.config.mjs:21-23` 未 ignore `scripts/`；`next.config.mjs:7-12` 未设 `ignoreDuringBuilds` | PJR 门禁不达标；一旦上 CI 立刻挂 | e2e.cjs 改 ESM `import`（或动态 `import()`）。**优先修源码，不要图省事关掉检查** |
| 4 | **无 CI、无自动化测试**，逻辑自检未接入回归 | 无 `.github/workflows`；无 `tests/`；`check_project.py` 仅手动跑 | 改动无自动防护，回归靠人工 | 加 `.github/workflows/ci.yml`：lint + typecheck + build + `python3 check_project.py` |
| 5 | **Playwright E2E 不可复现** | `package.json` 无 `playwright` 依赖；`web/node_modules/playwright` 不存在；`e2e.cjs:9` 硬编码**另一项目的绝对路径** `.../micro-one-api/web/node_modules/playwright` | CLAUDE.md 强制的端到端验收实际等于没落地；换机器即失效 | `playwright`+`@playwright/test` 入 devDependencies；删绝对路径回退；注册 `npm run e2e`；纳入 CI |

### 📋 P2

| # | 问题 | 证据 | 处置 |
|---|---|---|---|
| 6 | 双端领域逻辑双份实现 | `hexagrams.py`(805行) vs `hexagrams.json`；`gua_analysis.py` vs `analysis.ts`；`liuyao.py` vs `quantum.ts`；`ai_interpreter.py` vs `prompt.ts` | 当前数学零漂移，但 prompt/模型已漂移。以 JSON 为唯一源，Python 端加载或 codegen |
| 7 | prompt 双份且格式不一致 | `ai_interpreter.py:117-136`（含 `<推理>`+few-shot）vs `prompt.ts:59-77`（无 `<推理>`） | 抽统一模板，差异参数化 |
| 8 | git 工作流未落地 | `git log origin/dev..main` → `4c2c103`、`74f6a6a` 直提 main；无 worktree | 后续走 worktree → dev → release 合 main |
| 9 | `api/interpret` 未校验 `benBin`/`bianBin` | `route.ts:32-38` 仅校验 `question`/`yaos` | 加 6 位 `0/1` 格式校验，非法返 400 |
| 10 | `verify_quantum.py` 只 print 不 assert，且强依赖 pyqpanda3 | `:120-140` 无 raise/非零退出；`:23-29` 缺依赖即 exit(1) | 改为真断言 + 加经典随机回退，纳入 CI |
| 11 | Python 无依赖锁 | `requirements.txt` 仅一行 `pyqpanda3>=0.3.5` | 固定版本或引入 uv/pip-tools |
| 12 | `next` 与 `eslint-config-next` 次版本漂移 | `package.json:17` `^15.0.3` vs `:29` `^15.5.15` | 统一 15.x 补丁基线 |
| 13 | `docker-compose.yml` 运行时注入 `.env` | `docker-compose.yml:11-12` `env_file: - .env` | 配合 P0 解决后改用不入仓的 env 文件 |

### ✅ 已确认健康（不必动）

- 依赖锁定有效：`package-lock.json` 存在（219KB）
- **无废依赖**：5 个声明依赖全部被实际引用
- 无构建产物误跟踪：`node_modules/`、`.next/`、`__pycache__/` 均未入库
- Docker **镜像层**安全：`.dockerignore` 已正确排除 `.env`
- 类型纪律：`web/src` 全量无 `any`（`eslint.config.mjs:14` 设了 error 规则）
- 部署配置：`web/vercel.json` 存在且正确（framework=nextjs, region=hkg1）

> ⚠️ **报告矛盾修正**：架构报告 §3 P3 称「无 `vercel.json`」，经核实**有误** —— `web/vercel.json` 确实存在（105 字节，内容正常）。以 QA 报告的「存在」为准。该项从问题清单移除。

---

## 5. CLAUDE.md 守则落地核查

| 守则 | 判定 | 依据 |
|---|---|---|
| 类型严格（不用 `any`） | ✅ | `eslint.config.mjs:14` 设 error；`web/src` 全量无匹配；typecheck 通过 |
| 分支结构（main/dev） | ✅ | `git branch -a` 两条均在 |
| Vercel 环境变量配置 | ✅ | `api/interpret/route.ts:40-51` 正确读取 |
| worktree（复杂任务必须） | ❌ | 仅 `main`，无 worktree/特性分支痕迹 |
| 不直接合 main | ❌ | `4c2c103`、`74f6a6a` 直提 main，`origin/dev` 落后 |
| Playwright 端到端（桌面+移动） | ⚠️ | 脚本存在且覆盖桌面+移动，但未声明依赖、硬编码他人路径、自身破坏 lint → 未真正落地 |
| PJR 门禁（lint→build→类型→逻辑） | ❌ | lint ❌、build ❌、typecheck ✅、逻辑验证 ✅ → 未全绿 |
| Skill 加载 / simplify / 找茬式验证 | N/A | 流程层，无代码或记录可证伪 |

**落地率：约 1/3**（类型纪律与分支结构做到了，工程流程类基本没做到）。

---

## 6. 分阶段整改路线

| 阶段 | 目标 | 动作 | 代价 |
|---|---|---|---|
| **阶段 0 · 安全止血** | 消除 P0 | 轮换 key → 仅留 `.env.example` → `.gitignore` 启用 `.env` → `git filter-repo` 清历史（需授权） | ~0.5h |
| **阶段 1 · 门禁转绿** | P1-3/4/5 | e2e.cjs 改 ESM → 建 CI → playwright 入 devDeps + 注册 `npm run e2e` | ~2-3h |
| **阶段 2 · 收口漂移** | P1-2, P2-6/7 | 统一模型名常量；prompt 抽统一模板 | ~2h |
| **阶段 3 · 单一数据源** | P2-6 | `hexagrams.json` 为唯一源，Python 端加载/codegen（**注意 Edge 约束：quantum simulator 必须保留双份，改为加对拍测试锁定行为**） | ~0.5-1d |
| **阶段 4 · 纪律常态化** | P2-8~13 | worktree→dev→main 流程；依赖锁；入参校验；`verify_quantum.py` 改真断言 | 持续 |

---

## 7. 未验证 / 存疑项（诚实标注）

| 项 | 状态 | 原因 |
|---|---|---|
| `verify_quantum.py` 实际运行 | N/A | 本环境未装 `pyqpanda3`，脚本缺依赖即 exit(1)。卡方逻辑（df=7、临界值 14.067）经代码核对正确 |
| `next build` 路由清单与 bundle 体积 | N/A | 沙箱 safe-delete 护栏拦截 `.next` 清理，3 次尝试（含关闭沙箱）均被拦 |
| 64 卦古文逐字考据 | N/A | 仅程序化校验「二进制↔卦名↔卦序」全对，未逐条核对 805 行经文文本 |
| `deepseek-v4-pro` 是否为真实模型名 | 待确认 | 疑似非公开现名，需人工核实；若无效即触发 P1-2 |
| Vercel 实际部署状态 | 待确认 | 配置文件存在，线上状态不在评审范围 |
| Skill 加载 / simplify / PJR 是否执行 | N/A | 流程层，无记录可证伪 |
