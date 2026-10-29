import { test, expect } from "@playwright/test";

test("hydrates without eval or CSP errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await page.getByRole("tab", { name: "About this agent" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("AI representation");
  expect(
    errors.filter((message) =>
      /eval\(\)|unsafe-eval|content.security.policy|violates.*directive/i.test(
        message,
      ),
    ),
  ).toEqual([]);
});
