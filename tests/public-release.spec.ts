import { expect, test } from "@playwright/test";
test("public v128 renders accepted geometry with minimal navigation and credits", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const networkIssues: string[] = [];
  const localPath = (url: string) => {
    const parsed = new URL(url);
    return parsed.origin === "http://127.0.0.1:4174" ? parsed.pathname : null;
  };
  page.on("requestfailed", (request) => {
    const path = localPath(request.url());
    const errorCode = request
      .failure()
      ?.errorText.match(/(?:net::)?ERR_[A-Z_]+/u)?.[0];
    if (path) networkIssues.push(`${path}: ${errorCode ?? "request failed"}`);
  });
  page.on("response", (response) => {
    const path = localPath(response.url());
    if (path && response.status() >= 400)
      networkIssues.push(`${path}: HTTP ${response.status()}`);
  });
  await page.goto("http://127.0.0.1:4174/");
  await expect(page.locator("#home")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#scene")).toBeVisible();
  try {
    await expect(page.locator("#status")).toContainText(
      "167 / 167 selected visible chunks ready · 0 loading",
      {
        timeout: 120_000,
      },
    );
  } catch (error) {
    const runtime = await page
      .evaluate(() => {
        const review = Reflect.get(window, "estateFoundationReview");
        const timeouts: unknown = review?.session?.loadTimeouts;
        return Array.isArray(timeouts) ? timeouts.slice(-20) : [];
      })
      .catch(() => null);
    console.error(
      "Public v128 detail-load diagnostics:",
      JSON.stringify({
        networkIssues: networkIssues.slice(-20),
        pageErrorCount: errors.length,
        runtime,
      }).slice(0, 12_000),
    );
    throw error;
  }
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
