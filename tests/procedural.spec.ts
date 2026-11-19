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
    page.on("request", (r) => {
      if (/\.(glb|gltf|png|jpe?g|webp|ktx2?)(\?|$)/i.test(r.url()))
        forbidden.push(r.url());
    });
    await page.goto("http://127.0.0.1:4175/procedural.html");
    await expect(page.locator("#metrics")).toContainText(
      "5,950 drawn triangles",
    );
    for (let repeat = 0; repeat < 2; repeat++) {
      await page.locator("#r06").click();
      await expect(page.locator("#metrics")).toContainText(
        "633 drawn triangles",
      );
      await page.locator("#north").click();
      await expect(page.locator("#metrics")).toContainText(
        "2,379 drawn triangles",
      );
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
        "5,950 drawn triangles",
      );
    }
    expect(errors).toEqual([]);
    expect(forbidden).toEqual([]);
  });
}
test("late surface module cannot replace a newer overview selection", async ({
  page,
}) => {
  await page.route("**/wah-ming-authored-*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.continue();
  });
  await page.goto("http://127.0.0.1:4175/procedural.html");
  await expect(page.locator("#metrics")).toContainText("5,950 drawn triangles");
  const response = page.waitForResponse((r) =>
    r.url().includes("wah-ming-authored-"),
  );
  await page.locator("#carpark10").click();
  await page.locator("#overview").click();
  await response;
  await expect(page.locator("#metrics")).toContainText("5,950 drawn triangles");
  await expect(page.locator("#metrics")).not.toContainText(
    "selected surface generation",
  );
});
