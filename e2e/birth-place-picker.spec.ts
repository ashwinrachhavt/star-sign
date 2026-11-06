/**
 * Birth-place picker (owner request: searchable place selection).
 *
 * Typing shows a candidate dropdown (name + admin1 + country + zone);
 * an explicit pick locks lat/lon/timezone; a no-match query surfaces
 * the API's actionable error — nothing fails silently. Open-Meteo is
 * called live (free, keyless) against local Supabase + the dev server.
 */
import { test, expect, type Locator } from "@playwright/test";

const email = `picker-${Date.now()}@example.com`;
const password = "picker-password-123";

/** Keyboard-pick the first option matching nameRe (ArrowDown × n + Enter). */
async function keyboardPick(listbox: Locator, nameRe: RegExp) {
  const options = listbox.getByRole("option");
  const count = await options.count();
  let targetIndex = -1;
  for (let i = 0; i < count; i++) {
    const text = (await options.nth(i).textContent()) ?? "";
    if (nameRe.test(text)) {
      targetIndex = i;
      break;
    }
  }
  expect(targetIndex, `no option matching ${nameRe} in ${count} candidates`).toBeGreaterThanOrEqual(0);
  // ArrowDown from nothing-active lands on index 0, so targetIndex + 1
  // presses reach the target.
  for (let i = 0; i <= targetIndex; i++) {
    await listbox.page().keyboard.press("ArrowDown");
  }
  await listbox.page().keyboard.press("Enter");
}

test("birth place picker: Pune by click, Los Angeles by keyboard, errors surface", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: false }).fill(password);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByRole("button", { name: /create account/i }).click();

  // Sign-up lands on onboarding.
  await page.waitForURL("**/onboarding", { timeout: 15_000 });

  await page.getByLabel("Birth date").fill("1990-06-15");
  // Default precision is "exact" → a time is required.
  await page.getByLabel("Time", { exact: true }).fill("09:30");
  await page.getByLabel("Time zone at birth").fill("America/New_York");

  const placeInput = page.getByLabel("Birth place");
  const suggestions = page.getByRole("listbox", { name: "Birth place suggestions" });

  // No-match queries are visible, never silent.
  await placeInput.fill("Xyzzyqville");
  await expect(page.getByTestId("birth-place-error")).toContainText(
    /No places matched "Xyzzyqville"/,
    { timeout: 15_000 },
  );

  // Typing "Pune" opens the candidate dropdown with region + country +
  // timezone; picking "Pune, Maharashtra, India" locks the place.
  await placeInput.fill("Pune");
  await suggestions.waitFor({ timeout: 15_000 });
  const pune = page.getByRole("option", { name: "Pune, Maharashtra, India" }).first();
  await expect(pune).toBeVisible();
  await expect(pune).toContainText("Asia/Kolkata");
  await pune.click();

  // The pick locked: canonical name + coordinates show; the provider's
  // IANA zone was adopted into the time-zone field.
  await expect(page.getByTestId("birth-place-picked")).toContainText(
    "Pune, Maharashtra, India",
  );
  await expect(page.getByTestId("birth-place-picked")).toContainText(/-?\d+\.\d+°/);
  await expect(page.getByLabel("Time zone at birth")).toHaveValue("Asia/Kolkata");

  // Los Angeles: keyboard navigation — arrows move the option cursor,
  // Enter picks without submitting the form.
  await placeInput.fill("Los Angeles");
  await suggestions.waitFor({ timeout: 15_000 });
  await keyboardPick(suggestions, /Los Angeles, California, United States/);

  await expect(page.getByTestId("birth-place-picked")).toContainText(
    "Los Angeles, California, United States",
  );
  await expect(page.getByLabel("Time zone at birth")).toHaveValue(
    "America/Los_Angeles",
  );

  // A picked place completes the form.
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL("**/verify", { timeout: 15_000 });
  await expect(page.getByText("Is this you?")).toBeVisible({ timeout: 15_000 });
});
