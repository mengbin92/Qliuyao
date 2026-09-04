/* 量子六爻 端到端验收脚本 — 桌面 + 移动
 * 运行: npm run e2e（需先启动 next start -p 3210）
 * 依赖: playwright（devDependencies 已声明；首次使用需 npx playwright install chromium）
 *
 * 为什么是 .mjs：项目 ESLint 开了 @typescript-eslint/no-require-imports，
 * 用 require() 会直接让 lint 和 next build 双双失败。
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3210";
const SHOT = "/tmp/qliuyao-shots";
fs.mkdirSync(SHOT, { recursive: true });

const issues = [];
function report(ok, msg) {
  console.log(`${ok ? "✅" : "❌"} ${msg}`);
  if (!ok) issues.push(msg);
}

async function mockInterpretation(context) {
  await context.route("**/api/interpret", async (route) => {
    const { question } = route.request().postDataJSON();
    const text = question.includes("纯文本")
      ? "这是一段没有 Markdown 标题的完整解读，结束后仍应可见。"
      : "## 一、卦象大意\n测试解读：先明确问题。\n## 二、动爻指点\n测试解读：关注变化。\n## 三、变卦趋势\n测试解读：观察趋势。\n## 四、综合分析与建议\n" + "回归测试内容。".repeat(45);
    await route.fulfill({ status: 200, contentType: "text/event-stream", body: `data: ${JSON.stringify({ text })}\n\ndata: [DONE]` });
  });
}

async function checkPrimaryAction(page, name) {
  const button = page.getByRole("button", { name: "开始起卦", exact: true });
  const box = await button.boundingBox();
  report(box && box.y >= 0 && box.y + box.height <= page.viewportSize().height, `${name}: 起卦按钮在首屏内`);
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
  await mockInterpretation(desktop);
  const d = await desktop.newPage();
  d.on("console", (m) => {
    if (m.type() === "error") console.log(`  [console.error] ${m.text().slice(0, 160)}`);
  });

  console.log("\n===== 桌面端 1440x900 =====");
  await checkPage(d, `${BASE}/`, "desktop-home");
  await checkPrimaryAction(d, "desktop-home");

  await d.fill("textarea", "今年适合换工作吗？请给我一个方向。");
  await d.getByRole("button", { name: "开始起卦", exact: true }).click();
  try {
    await d.locator('[aria-label="起卦结果"]').waitFor({ state: "visible", timeout: 20000 });
    report(true, "desktop-home: 摇卦流程产出卦象");
  } catch {
    report(false, "desktop-home: 摇卦后 20s 内未出现卦象");
  }
  await d.waitForTimeout(2500);
  await d.screenshot({ path: `${SHOT}/desktop-home-cast.png`, fullPage: true });

  // 使用固定 SSE，避免配置/模型延迟影响布局回归，也不消耗真实 API。
  try {
    await d.getByText("解读已完成", { exact: true }).waitFor({ state: "visible", timeout: 10000 });
    const interpretText = await d.getByRole("region", { name: "AI 解读" }).textContent();
    const failed = /解卦失败/.test(interpretText);
    report(true, `desktop-home: AI 解卦区出现（${failed ? "无 Key 优雅报错，符合预期" : "有内容输出"}）`);
    if (!failed) {
      try {
        await d.waitForSelector("text=/四、综合分析与建议/", { timeout: 60000 });
        await d.waitForFunction(
          () => !document.querySelector("section .animate-pulse"),
          null,
          { timeout: 60000 }
        );
        report(true, "desktop-home: AI 解卦完整产出四段");
        const full = await d.getByRole("region", { name: "AI 解读" }).textContent();
        const seg = full.split("四、综合分析与建议")[1] || "";
        report(seg.length >= 250, `desktop-home: 综合分析段长度=${seg.length} 字（≥250）`);
      } catch {
        report(false, "desktop-home: AI 解卦未在 60s 内产出「四、综合分析与建议」或未结束");
      }
    }
  } catch {
    report(false, "desktop-home: AI 解卦区 25s 内无反馈");
  }
  await d.screenshot({ path: `${SHOT}/desktop-home-interpret.png`, fullPage: true });

  const details = d.locator("details.result-details");
  report(await details.count() === 3, "desktop-results: 三个经文/分析折叠面板");
  report(await d.locator("details.result-details[open]").count() === 0, "desktop-results: 详情默认折叠");
  await details.first().locator("summary").click();
  report(await details.first().getByText("彖传", { exact: true }).first().isVisible(), "desktop-results: 经文可展开");
  await d.emulateMedia({ media: "print" });
  await d.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  report(await d.locator("details.result-details[open]").count() === 3, "print: 所有详情已展开");
  report(await d.locator(".result-summary").isVisible(), "print: 卦象摘要可见");
  await d.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await d.emulateMedia({ media: "screen" });
  report(await d.locator("details.result-details[open]").count() === 1, "print: 恢复原先展开状态");

  await d.getByRole("button", { name: "再起一卦", exact: true }).last().click();
  await d.getByRole("textbox", { name: "求问内容" }).waitFor({ state: "visible" });
  await d.getByRole("textbox", { name: "求问内容" }).fill("纯文本解读回归");
  await d.getByRole("button", { name: "开始起卦", exact: true }).click();
  await d.getByText("解读已完成", { exact: true }).waitFor({ state: "visible", timeout: 15000 });
  report(await d.getByText("这是一段没有 Markdown 标题的完整解读，结束后仍应可见。", { exact: true }).isVisible(), "AI: 纯文本完成后保留");

  await checkPage(d, `${BASE}/quantum`, "desktop-quantum");
  await checkPage(d, `${BASE}/index-64`, "desktop-index64");
  await checkPage(d, `${BASE}/index-64/111111`, "desktop-hexagram-detail");
  await checkPage(d, `${BASE}/about`, "desktop-about");
  await checkPage(d, `${BASE}/disclaimer`, "desktop-disclaimer");

  for (const [label, target] of [["起卦", "/"], ["量子原理", "/quantum"], ["卦典", "/index-64"], ["项目背景", "/about"], ["免责声明", "/disclaimer"]]) {
    await d.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    if (["项目背景", "免责声明"].includes(label)) await d.locator("header details summary").click();
    await d.click(`header nav >> text=${label}`);
    await d.waitForTimeout(800);
    report(new URL(d.url()).pathname === target, `desktop-nav: 点击「${label}」→ ${d.url()}`);
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
  await mockInterpretation(mobile);

  console.log("\n===== 移动端 390x844 =====");
  await checkPage(m, `${BASE}/`, "mobile-home");
  await checkPrimaryAction(m, "mobile-home");

  await m.fill("textarea", "最近的感情运势如何？");
  await m.getByRole("button", { name: "开始起卦", exact: true }).click();
  try {
    await m.locator('[aria-label="起卦结果"]').waitFor({ state: "visible", timeout: 20000 });
    report(true, "mobile-home: 摇卦流程产出卦象");
  } catch {
    report(false, "mobile-home: 摇卦后 20s 内未出现卦象");
  }
  await m.waitForTimeout(2500);
  await m.screenshot({ path: `${SHOT}/mobile-home-cast.png`, fullPage: true });
  report(await m.locator(".result-summary").evaluate((el) => el.getBoundingClientRect().top) < await m.getByRole("region", { name: "AI 解读" }).evaluate((el) => el.getBoundingClientRect().top), "mobile-results: 卦象摘要先于长解读");
  report(await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), "mobile-results: 无横向溢出");

  await m.getByRole("button", { name: "打开历史卦签" }).click();
  await m.getByRole("dialog", { name: "我的卦签集" }).waitFor({ state: "visible" });
  await m.keyboard.press("Escape");
  report(await m.getByRole("dialog").count() === 0, "history: Escape 关闭弹窗");
  report(await m.getByRole("button", { name: "打开历史卦签" }).evaluate((el) => el === document.activeElement), "history: 焦点返回触发按钮");

  await m.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const burger = m.locator("header button[aria-label*='导航']");
  if (await burger.count()) {
    await burger.click();
    await m.waitForTimeout(400);
    const menuVisible = await m.locator("header nav a:visible", { hasText: "卦典" }).first().isVisible();
    report(menuVisible, "mobile-nav: 汉堡菜单展开可见导航项");
    await m.screenshot({ path: `${SHOT}/mobile-nav-open.png` });
    await m.locator("header nav a:visible", { hasText: "卦典" }).first().click();
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
