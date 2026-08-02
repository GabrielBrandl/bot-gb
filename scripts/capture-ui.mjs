import { chromium } from "playwright";
import { mkdirSync } from "fs";

mkdirSync("screenshots", { recursive: true });
const chrome = "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe";
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto("http://localhost:5173/login", { waitUntil: "networkidle", timeout: 30000 });
await page.fill('input[type="email"], input[name="email"]', "admin@absresolve.com");
await page.fill('input[type="password"], input[name="password"]', "admin123");
await page.click('button[type="submit"]');
await page.waitForTimeout(2500);
console.log("url", page.url());

const shots = [
  ["/", "01-inicio.png"],
  ["/inbox", "02-inbox.png"],
  ["/automacoes", "03-automacoes.png"],
  ["/configuracoes", "04-config-whatsapp.png"],
];
for (const [path, file] of shots) {
  await page.goto("http://localhost:5173" + path, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "screenshots/" + file, fullPage: true });
  console.log("shot", file);
}

await page.goto("http://localhost:5173/automacoes", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const link = page.locator('a[href*="/automacoes/"]').first();
if (await link.count()) {
  await link.click();
  await page.waitForTimeout(2500);
  const rf = await page.locator(".react-flow").count();
  await page.screenshot({ path: "screenshots/03b-flow-editor.png", fullPage: true });
  console.log("editor react-flow", rf);
}

await page.goto("http://localhost:5173/configuracoes", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const qrBtn = page.locator('button[title="Mostrar QR Code"]');
if (await qrBtn.count()) {
  await qrBtn.last().click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "screenshots/04b-qr-area.png", fullPage: true });
  console.log("qr shot");
}
await browser.close();
console.log("ALL_SHOTS_DONE");
