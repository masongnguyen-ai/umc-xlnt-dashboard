import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message || e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto("http://127.0.0.1:8080/login", { waitUntil: "networkidle", timeout: 45000 });
await page.getByRole("button", { name: "Chưa có tài khoản? Đăng ký" }).click();
await page.locator('input[type="email"]').fill("quanly@umc.edu.vn");
await page.locator('input[type="password"]').fill("umcxlnt2026");
await page.locator("form").locator("input").first().fill("Mà Song Nguyễn");
await page.getByRole("button", { name: "Tạo tài khoản" }).click();
await page.waitForURL("**/app/**", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);

const shots = [
  ["/app/theodoi", "theodoi"],
  ["/app/canhbao", "canhbao"],
  ["/app/nhatky", "nhatky"],
  ["/app/nguong", "nguong"],
  ["/app/hoachat", "hoachat"],
  ["/app/thietbi", "thietbi"],
  ["/app/baocao", "baocao"],
  ["/app/ai", "ai"],
  ["/app/quantri", "quantri"],
];

for (const [path, name] of shots) {
  await page.goto("http://127.0.0.1:8080" + path, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
}

await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:8080/app/theodoi", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "/workspace/screenshots/theodoi-mobile.png" });

console.log(JSON.stringify({ errors, title: await page.title() }, null, 2));
await browser.close();
if (errors.length) process.exit(2);
