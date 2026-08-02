import { chromium } from "playwright";

const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => errors.push("PAGE: " + e.message + "\n" + (e.stack || "")));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push("CONSOLE: " + msg.text());
});

await page.goto("http://localhost:5173/login", { waitUntil: "networkidle", timeout: 30000 });
await page.fill('input[type="email"], input[name="email"]', "admin@absresolve.com");
await page.fill('input[type="password"], input[name="password"]', "admin123");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
console.log("AFTER_LOGIN", page.url());

for (const path of ["/automacoes", "/configuracoes", "/inbox", "/kanban"]) {
  await page.goto("http://localhost:5173" + path, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200);
  const text = (await page.locator("body").innerText()).slice(0, 800);
  console.log("===", path, "===");
  console.log("URL", page.url());
  console.log("TEXT", JSON.stringify(text));
  console.log("HTML_LEN", (await page.content()).length);
}

await page.goto("http://localhost:5173/automacoes", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const link = page.locator('a[href*="/automacoes/"]').first();
if (await link.count()) {
  await link.click();
  await page.waitForTimeout(2500);
  const edText = (await page.locator("body").innerText()).slice(0, 800);
  console.log("=== EDITOR ===");
  console.log("URL", page.url());
  console.log("TEXT", JSON.stringify(edText));
  console.log("REACT_FLOW_COUNT", await page.locator(".react-flow").count());
} else {
  console.log("No flow link");
}

console.log("=== ERRORS ===");
console.log(errors.join("\n---\n") || "(none)");
await browser.close();
