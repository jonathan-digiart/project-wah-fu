import { expect, test } from "@playwright/test";
const fixture = {
  boundary: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ],
  buildings: [
    {
      id: "fixture",
      name: "Synthetic building",
      footprint: [
        [20, 20],
        [40, 20],
        [40, 30],
        [20, 30],
      ],
      base: 10,
      height: 30,
      uncertainty: "Synthetic fixture",
    },
  ],
  terrainControls: [
    { x: 0, z: 0, height: 10 },
    { x: 100, z: 100, height: 20 },
  ],
  provenance: { synthetic: true },
};
test("missing parameters fail closed without pretending to render", async ({
  page,
}) => {
  await page.route("**/site-data.json", (route) =>
    route.fulfill({ status: 404, body: "Missing" }),
  );
  await page.goto("/");
  await expect(page.locator("#status")).toContainText("not supplied");
  await expect(page.locator("canvas")).toHaveCount(0);
});
test("clay review loads and repeat navigation/reset/reload remains stable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/site-data.json", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto("/");
  await expect(page.locator("#status")).toContainText(
    "1 reference-derived clay masses",
  );
  await expect(page.locator("canvas")).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Synthetic building" }).click();
    await page.locator("#top").click();
    await page.locator("#reset").click();
    await page.locator("#boundary").uncheck();
    await page.locator("#boundary").check();
  }
  await page.reload();
  await expect(page.locator("#status")).toContainText(
    "1 reference-derived clay masses",
  );
  expect(errors).toEqual([]);
});
test("WebGL unavailable preserves readable reference list", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.route("**/site-data.json", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto("/");
  await expect(page.locator("#status")).toContainText("WebGL 2 is unavailable");
  await expect(
    page.getByRole("button", { name: "Synthetic building" }),
  ).toBeDisabled();
});
