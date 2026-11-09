import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { build } from "vite";

test("Vite-built ES2022 class fields use define semantics in the browser", async ({
  page,
}) => {
  const result = await build({
    configFile: false,
    build: {
      target: "es2022",
      lib: {
        entry: fileURLToPath(
          new URL("./fixtures/class-fields.ts", import.meta.url),
        ),
        formats: ["es"],
      },
      write: false,
      minify: true,
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunks = outputs.flatMap((output) =>
    "output" in output
      ? output.output.filter((item) => item.type === "chunk")
      : [],
  );
  expect(chunks).toHaveLength(1);
  await page.setContent('<output id="result">pending</output>');
  await page.addScriptTag({ type: "module", content: chunks[0]!.code });
  await expect(page.locator("#result")).toHaveText(
    JSON.stringify({ value: 42, setterCalls: 0, own: true }),
  );
});

test("existing visible inert control cannot dispatch clicks until enabled", async ({
  page,
}) => {
  await page.setContent(
    '<div id="panel" inert><button id="target">Continue</button></div><output id="clicks">0</output><button id="enable">Enable control</button>',
  );
  await page.evaluate(() => {
    let clicks = 0;
    document.querySelector("#target")!.addEventListener("click", () => {
      document.querySelector("#clicks")!.textContent = String(++clicks);
    });
    document.querySelector("#enable")!.addEventListener("click", () => {
      document.querySelector("#panel")!.removeAttribute("inert");
    });
  });
  const button = page.locator("#target");
  await expect(button).toHaveCount(1);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await expect(page.locator("#panel")).toHaveAttribute("inert", "");
  await expect(button.click({ timeout: 500 })).rejects.toThrow(/Timeout/);
  await expect(page.locator("#clicks")).toHaveText("0");
  await page.locator("#enable").click();
  await expect(page.locator("#panel")).not.toHaveAttribute("inert", "");
  await button.click();
  await expect(page.locator("#clicks")).toHaveText("1");
});
