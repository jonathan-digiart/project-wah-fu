import { expect, test } from "@playwright/test";

test("ES2022 class fields use define semantics in the test runner", () => {
  let setterCalls = 0;
  class Base {
    set value(_value: number) {
      setterCalls += 1;
    }
  }
  class Derived extends Base {
    // Deliberate runtime fixture: define semantics must not invoke the setter.
    // @ts-expect-error An accessor is deliberately shadowed by an own field.
    value = 42;
  }
  const instance = new Derived();
  expect(instance.value).toBe(42);
  expect(setterCalls).toBe(0);
  expect(Object.hasOwn(instance, "value")).toBe(true);
});

test("inert controls stay blocked until enabled", async ({ page }) => {
  await page.setContent("<div inert><button>Continue</button></div>");
  const button = page.getByRole("button", { name: "Continue" });
  await expect(button.click({ timeout: 200 })).rejects.toThrow(/Timeout/);
  await page
    .locator("div")
    .evaluate((element) => element.removeAttribute("inert"));
  await button.click();
});
