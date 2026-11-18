import { expect, test } from "@playwright/test";
test("public v128 renders accepted geometry with minimal navigation and credits", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4174/");
  await expect(page.locator("#home")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#scene")).toBeVisible();
  await expect(page.locator("#status")).toContainText(
    "167 / 167 selected visible chunks ready · 0 loading",
    {
      timeout: 120_000,
    },
  );
  await expect(page.locator("#retry")).toBeHidden();
  for (const id of [
    "overview",
    "top",
    "home",
    "pan",
    "orbit",
    "zoom-in",
    "zoom-out",
  ])
    await page.locator("#" + id).click();
  for (const id of ["roads", "houses", "surroundings", "sea", "base"]) {
    await page.locator("#" + id).uncheck();
    await page.locator("#" + id).check();
  }
  await expect(page.locator("#fail-next")).toBeHidden();
  await expect(page.getByRole("link", { name: "GitHub ↗" })).toHaveAttribute(
    "href",
    "https://github.com/jonathan-digiart/project-wah-fu",
  );
  expect(errors).toEqual([]);
  await page.goto("http://127.0.0.1:4174/credits.html");
  await expect(page.locator("body")).toContainText("Lands Department");
});
