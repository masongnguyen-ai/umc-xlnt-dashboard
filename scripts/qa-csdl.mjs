import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(base + "/login", { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(600);

const email = `qa.csdl.${Date.now()}@umc.edu.vn`;
const password = "UmcXlnt2026!";

await page.getByRole("button", { name: /chưa có tài khoản/i }).click();
await page.waitForTimeout(200);
await page.locator("input").nth(0).fill("QA CSDL");
await page.locator('input[type="email"]').fill(email);
await page.locator('input[type="password"]').fill(password);
await page.getByRole("button", { name: /tạo tài khoản/i }).click();
await page.waitForURL(/\/app/, { timeout: 25000 });
await page.waitForTimeout(1000);

const shots = [
  ["/app/theodoi", "theodoi"],
  ["/app/hoachat", "hoachat"],
  ["/app/thietbi", "thietbi"],
  ["/app/quantri", "quantri"],
  ["/app/ai", "ai"],
];

for (const [path, name] of shots) {
  await page.goto(base + path, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png`, fullPage: false });
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base + "/app/theodoi", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/theodoi-mobile.png" });

console.log(JSON.stringify({ errors, email }, null, 2));
await browser.close();
if (errors.length) process.exit(2);
