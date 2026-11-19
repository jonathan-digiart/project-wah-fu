import { expect, test } from "@playwright/test";
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`code-only surface switching at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    const forbidden: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        /shader|webglprogram/i.test(message.text())
      )
        errors.push(message.text());
    });
    page.on("request", (r) => {
      if (/\.(glb|gltf|png|jpe?g|webp|ktx2?)(\?|$)/i.test(r.url()))
        forbidden.push(r.url());
    });
    await page.goto("http://127.0.0.1:4175/procedural.html");
    await expect(page.locator("#metrics")).toContainText(
      "7,064 drawn triangles",
    );
    await expect(page.locator("#view-note")).toContainText(
      "Building envelopes and the graded Wah Ming carpark",
    );
    await expect(page.locator("#metrics")).toContainText(
      "125 registered modules",
    );
    await page.locator("#carpark10").click();
    await expect(page.locator("#metrics")).toContainText(
      "125 registered modules",
    );
    await expect(page.locator("#metrics")).toContainText(
      "1,260 drawn triangles",
    );
    await page.locator("#overview").click();
    for (let repeat = 0; repeat < 2; repeat++) {
      await page.locator("#r06").click();
      await expect(page.locator("#metrics")).toContainText(
        "633 drawn triangles",
      );
      await page.locator("#north").click();
      await expect(page.locator("#metrics")).toContainText(
        "2,379 drawn triangles",
      );
      await page.getByRole("button", { name: "Wah Ming north edge" }).click();
      await expect(page.locator("#view-note")).toContainText(
        "Surrounding terrain and the other carpark edges are not rebuilt.",
      );
      await expect(page.locator("#metrics")).toContainText(
        "1,291 drawn triangles",
      );
      await expect(page.locator("#metrics")).toContainText("3 draw calls");
      // Existing paving is reused; only the wall and bank are additional.
      await expect(page.locator("#metrics")).toContainText(
        `${129 + repeat * 2} registered modules`,
      );
      await expect(page.locator("canvas")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.locator("#carpark10").click();
      await expect(page.locator("#metrics")).toContainText(
        "1,260 drawn triangles",
      );
      await expect(page.locator("#metrics")).toContainText("1 draw calls");
      await page.locator("#carpark50").click();
      await expect(page.locator("#metrics")).toContainText(
        "1,616 drawn triangles",
      );
      await page.locator("#carpark").click();
      await expect(page.locator("#metrics")).toContainText(
        "146 drawn triangles",
      );
      await expect(page.locator("#metrics")).not.toContainText(
        "selected surface generation",
      );
      await page.locator("#overview").click();
      await expect(page.locator("#metrics")).toContainText(
        "7,064 drawn triangles",
      );
    }
    expect(errors).toEqual([]);
    expect(forbidden).toEqual([]);
  });
}
test("late surface module cannot replace a newer overview selection", async ({
  page,
}) => {
  await page.route("**/wah-ming-north-edge-*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.continue();
  });
  await page.goto("http://127.0.0.1:4175/procedural.html");
  await expect(page.locator("#metrics")).toContainText("7,064 drawn triangles");
  const response = page.waitForResponse((r) =>
    r.url().includes("wah-ming-north-edge-"),
  );
  await page.locator("#wah-ming-north-edge").click();
  await page.locator("#overview").click();
  await response;
  await expect(page.locator("#metrics")).toContainText("7,064 drawn triangles");
  await expect(page.locator("#metrics")).not.toContainText(
    "selected surface generation",
  );
});
