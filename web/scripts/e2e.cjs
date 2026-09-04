/* 量子六爻 端到端验收脚本 — 桌面 + 移动
 * 运行: node scripts/e2e.cjs（需先启动 next start -p 3210）
 * 依赖: 优先使用项目内 playwright；未安装时回落到 micro-one-api 的共享安装
 */
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require("/Users/neo/vscode/mengbin/micro-one-api/web/node_modules/playwright"));
}

const BASE = "http://localhost:3210";
const SHOT = "/tmp/qliuyao-shots";
const fs = require("fs");
fs.mkdirSync(SHOT, { recursive: true });

const issues = [];
function report(ok, msg) {
  console.log(`${ok ? "✅" : "❌"} ${msg}`);
  if (!ok) issues.push(msg);
}

async function checkPage(page, url, name) {
  const resp = await page.goto(url, { waitUntil: "networkidle" });
  report(resp && resp.status() < 400, `${name}: HTTP ${resp && resp.status()}`);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  report(overflow <= 1, `${name}: 无横向溢出 (overflow=${overflow}px)`);
  const title = await page.title();
  report(title.length > 0, `${name}: 标题 "${title}"`);
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  report(/Noto Sans SC/i.test(font), `${name}: 正文字体 = ${font.split(",")[0]}`);
  await page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: true });
}

(async () => {
  const browser = await chromium.launch();

  /* 桌面端 */
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await desktop.newPage();
  d.on("console", (m) => {
    if (m.type() === "error") console.log(`  [console.error] ${m.text().slice(0, 160)}`);
  });

  console.log("\n===== 桌面端 1440x900 =====");
  await checkPage(d, `${BASE}/`, "desktop-home");

  await d.fill("textarea", "今年适合换工作吗？请给我一个方向。");
  await d.locator("button", { hasText: /起\s*·\s*卦/ }).first().click();
  try {
    await d.waitForSelector("text=/第[一二三四五六]爻|本卦|卦象/", { timeout: 20000 });
    report(true, "desktop-home: 摇卦流程产出卦象");
  } catch {
    report(false, "desktop-home: 摇卦后 20s 内未出现卦象");
  }
  await d.waitForTimeout(2500);
  await d.screenshot({ path: `${SHOT}/desktop-home-cast.png`, fullPage: true });

  // AI 解卦在起卦后自动开始；本地无 DEEPSEEK_API_KEY，应优雅报错而非卡死
  try {
    await d.waitForSelector("text=/解卦失败|解卦师正在落笔|重新解卦/", { timeout: 25000 });
    const interpretText = await d.locator("section", { hasText: "AI 解卦" }).first().textContent();
    const failed = /解卦失败/.test(interpretText);
    report(true, `desktop-home: AI 解卦区出现（${failed ? "无 Key 优雅报错，符合预期" : "有内容输出"}）`);
  } catch {
    report(false, "desktop-home: AI 解卦区 25s 内无反馈");
  }
  await d.screenshot({ path: `${SHOT}/desktop-home-interpret.png`, fullPage: true });

  await checkPage(d, `${BASE}/quantum`, "desktop-quantum");
  await checkPage(d, `${BASE}/index-64`, "desktop-index64");
  await checkPage(d, `${BASE}/index-64/111111`, "desktop-hexagram-detail");
  await checkPage(d, `${BASE}/about`, "desktop-about");
  await checkPage(d, `${BASE}/disclaimer`, "desktop-disclaimer");

  for (const label of ["起卦", "量子电路", "六十四卦", "项目背景", "声明"]) {
    await d.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await d.click(`header nav >> text=${label}`);
    await d.waitForTimeout(800);
    report(true, `desktop-nav: 点击「${label}」→ ${d.url()}`);
  }

  for (const [path, name, min] of [["/opengraph-image", "og", 5000], ["/icon", "icon", 1000]]) {
    const r = await d.request.get(`${BASE}${path}`);
    const buf = await r.body();
    report(r.ok() && buf.length > min, `${name}: ${path} -> ${r.status()}, ${buf.length} bytes`);
    fs.writeFileSync(`${SHOT}/${name}.png`, buf);
  }
  await desktop.close();

  /* 移动端 */
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const m = await mobile.newPage();

  console.log("\n===== 移动端 390x844 =====");
  await checkPage(m, `${BASE}/`, "mobile-home");

  await m.fill("textarea", "最近的感情运势如何？");
  await m.locator("button", { hasText: /起\s*·\s*卦/ }).first().click();
  try {
    await m.waitForSelector("text=/本卦|卦象|第[一二三四五六]爻/", { timeout: 20000 });
    report(true, "mobile-home: 摇卦流程产出卦象");
  } catch {
    report(false, "mobile-home: 摇卦后 20s 内未出现卦象");
  }
  await m.waitForTimeout(2500);
  await m.screenshot({ path: `${SHOT}/mobile-home-cast.png`, fullPage: true });

  await m.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const burger = m.locator("header button[aria-label*='导航']");
  if (await burger.count()) {
    await burger.click();
    await m.waitForTimeout(400);
    const menuVisible = await m.locator("header nav a:visible", { hasText: "六十四卦" }).first().isVisible();
    report(menuVisible, "mobile-nav: 汉堡菜单展开可见导航项");
    await m.screenshot({ path: `${SHOT}/mobile-nav-open.png` });
    await m.locator("header nav a:visible", { hasText: "六十四卦" }).first().click();
    await m.waitForTimeout(1000);
    report(m.url().includes("/index-64"), `mobile-nav: 菜单跳转 -> ${m.url()}`);
  } else {
    report(false, "mobile-nav: 未找到汉堡菜单按钮");
  }

  await checkPage(m, `${BASE}/quantum`, "mobile-quantum");
  await checkPage(m, `${BASE}/index-64`, "mobile-index64");
  await checkPage(m, `${BASE}/index-64/111111`, "mobile-hexagram-detail");
  await checkPage(m, `${BASE}/about`, "mobile-about");
  await checkPage(m, `${BASE}/disclaimer`, "mobile-disclaimer");

  await mobile.close();
  await browser.close();

  console.log(`\n===== 结果：${issues.length === 0 ? "全部通过" : issues.length + " 个问题"} =====`);
  issues.forEach((i) => console.log(" - " + i));
  process.exit(issues.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error("FATAL:", e);
  process.exit(2);
});
