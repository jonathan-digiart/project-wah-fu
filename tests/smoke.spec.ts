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
    "1 estate + 0 other legacy building objects",
  );
  await expect(page.locator("canvas")).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Synthetic building" }).click();
    await expect(
      page.getByRole("button", { name: "Synthetic building" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.locator("#pan").click();
    await expect(page.locator("#pan")).toHaveAttribute("aria-pressed", "true");
    await page.locator("#pan").click();
    await page.locator("#top").click();
    await page.locator("#reset").click();
    await expect(page.locator("#boundary")).toHaveCount(0);
  }
  await page.reload();
  await expect(page.locator("#status")).toContainText(
    "1 estate + 0 other legacy building objects",
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

test("context starts visible, multipart source has one focus entry and focusing restores hidden context", async ({
  page,
}) => {
  const part = {
    ...fixture.buildings[0]!,
    category: "context",
    sourceId: "campus",
    group: "Synthetic campus",
    boundaryRelation: "full",
  };
  await page.route("**/site-data.json", (route) =>
    route.fulfill({
      json: {
        ...fixture,
        buildings: [
          fixture.buildings[0],
          { ...part, id: "campus-a" },
          { ...part, id: "campus-b" },
        ],
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator("#status")).toContainText(
    "1 estate + 1 other legacy building objects",
  );
  await expect(page.locator("#context")).toBeChecked();
  await page.locator("#context").uncheck();
  await page.locator("summary").click();
  await expect(page.locator("#context-buildings button")).toHaveCount(1);
  await page.getByRole("button", { name: "Synthetic campus · campus" }).click();
  await expect(page.locator("#context")).toBeChecked();
  await expect(
    page.getByRole("button", { name: "Synthetic campus · campus" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("project repository link is visible and keyboard accessible on desktop and mobile", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.route("**/site-data.json", (route) =>
      route.fulfill({ status: 404, body: "Missing" }),
    );
    await page.goto("/");
    const link = page.getByRole("link", {
      name: "View Project Wah Fu on GitHub",
    });
    await expect(link).toHaveAttribute(
      "href",
      "https://github.com/jonathan-digiart/project-wah-fu",
    );
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press("Tab");
      if (await link.evaluate((element) => element === document.activeElement))
        break;
    }
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS("outline-style", "solid");
    await page.unroute("**/site-data.json");
  }
});
