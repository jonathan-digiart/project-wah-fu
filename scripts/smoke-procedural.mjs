/* global document */
import process from "node:process";
import console from "node:console";
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  chromiumSandbox: true,
  headless: true,
  ignoreDefaultArgs: [
    "--enable-unsafe-swiftshader",
    "--unsafely-disable-devtools-self-xss-warnings",
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  const errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("http://127.0.0.1:4191/procedural.html");
  await page.waitForFunction(() =>
    document.querySelector("#metrics")?.textContent.includes("modules"),
  );
  const overview = await page.locator("#metrics").textContent();
  await page.locator("#carpark").click();
  await page.locator("#overview").click();
  await page.locator("#carpark").click();
  await page.setViewportSize({ width: 600, height: 800 });
  await page.locator("#overview").click();
  const result = {
    overview,
    errors,
    requests,
    scope:
      "Partial building/plan scaffold, not v128 parity. Navigation and resize smoke only.",
  };
  writeFileSync(
    "verification/procedural-v129/browser-smoke.json",
    JSON.stringify(result, null, 2),
  );
  console.log(result);
  if (
    errors.length ||
    requests.some((u) => /\.(glb|gltf|bin|gz|png|jpg|jpeg|webp)(\?|$)/i.test(u))
  )
    process.exitCode = 1;
} finally {
  await browser.close();
}
