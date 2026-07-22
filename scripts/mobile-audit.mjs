// Headless mobile audit: load key pages at 375x812 with a demo session and
// report horizontal overflow + the widest offending elements per page.
import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";
const PAGES = [
  ["/work", "user-michael"],
  ["/work/leaderboard", "user-michael"],
  ["/scorecard", "user-michael"],
  ["/operations", "user-admin"],
  ["/projects", "user-admin"],
  ["/projects/proj-sf", "user-admin"],
  ["/wrap-ups", "user-admin"],
  ["/time-clock", "user-admin"],
  ["/qa-center", "user-admin"],
  ["/executive", "user-admin"],
  ["/requests", "user-admin"],
  ["/roi", "user-admin"],
];

const browser = await chromium.launch();
for (const [path, persona] of PAGES) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await ctx.addCookies([
    { name: "flow_demo_user_id", value: persona, url: BASE },
    { name: "flow_demo_session", value: "1", url: BASE },
  ]);
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    const result = await page.evaluate(() => {
      const vw = window.innerWidth;
      const offenders = [];
      document.querySelectorAll("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        // Elements wider than viewport that are NOT inside a horizontal scroller
        if (r.width > vw + 8) {
          let p = el.parentElement;
          let scrollable = false;
          while (p && p !== document.body) {
            const o = getComputedStyle(p).overflowX;
            if (o === "auto" || o === "scroll") { scrollable = true; break; }
            p = p.parentElement;
          }
          if (!scrollable) {
            const cls = typeof el.className === "string" ? el.className.split(" ").slice(0, 4).join(" ") : "";
            offenders.push({ tag: el.tagName.toLowerCase(), cls, w: Math.round(r.width) });
          }
        }
      });
      offenders.sort((a, b) => b.w - a.w);
      const seen = new Set();
      return {
        docWidth: document.documentElement.scrollWidth,
        vw,
        top: offenders.filter((o) => { const k = o.tag + o.cls; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 5),
      };
    });
    const status = result.docWidth > result.vw + 4 ? "OVERFLOW" : "ok";
    console.log(`${status.padEnd(9)} ${path} (doc ${result.docWidth}px)`);
    if (status === "OVERFLOW") for (const o of result.top) console.log(`    <${o.tag}> ${o.w}px  ${o.cls}`);
  } catch (e) {
    console.log(`ERROR     ${path}: ${e.message.split("\n")[0]}`);
  }
  await ctx.close();
}
await browser.close();
