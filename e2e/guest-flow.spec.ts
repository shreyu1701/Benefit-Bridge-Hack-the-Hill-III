import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { diffFacts } from "../lib/profile/merge";
import { emptyProfile, type Profile } from "../lib/profile/schema";

/**
 * Guest → onboarding → typed input → confirm → results, with a WCAG 2.2 AA
 * axe scan on every page. Only Gemini is faked (a fixed extraction); matching
 * is the real deterministic rules engine over the real seed program data.
 */

async function expectAccessible(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations.map((v) => `${label}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`)).toEqual([]);
}

const question = (page: Page, name: string | RegExp) => page.getByRole("radiogroup", { name });

test("guest can go from the landing page to cited results", async ({ page }) => {
  // What the person "says" on the describe step (what Gemini would extract).
  const said: Profile = {
    ...emptyProfile(),
    city: "Toronto",
    has_partner: false,
    children_ages: [2, 4],
    employment_status: "employed",
    family_income_band: "15k_25k", // disagrees with the profile → a conflict to resolve
  };

  // 1. Landing
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectAccessible(page, "landing");
  await page.getByRole("link", { name: "Get started" }).first().click();

  // 2. Entry: continue as guest (Auth0 is off in this run)
  await expect(page).toHaveURL(/\/start$/);
  await expectAccessible(page, "start");
  await page.getByRole("link", { name: /Continue as guest/ }).click();

  // 3. Onboarding, five screens
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("Step 1 of 5")).toBeVisible();
  await page.getByLabel("Which province or territory do you live in?").selectOption("ON");
  await page.getByLabel("Which city do you live in?").fill("Toronto");
  await expectAccessible(page, "onboarding 1");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 2 of 5")).toBeVisible();
  await page.getByLabel("How old are you?").fill("29");
  await page.getByLabel("What is your status in Canada?").selectOption("citizen");
  await page.getByLabel("How many years have you lived in Canada?").fill("29");
  await expectAccessible(page, "onboarding 2");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 3 of 5")).toBeVisible();
  await question(page, "Do you have a spouse or common-law partner?").getByRole("radio", { name: "No", exact: true }).click();
  await question(page, "Do you have children? How old are they?").getByRole("radio", { name: "Yes", exact: true }).click();
  await page.getByLabel(/Each child's age/).fill("2, 4");
  await page.getByLabel("How many people live in your household, including you?").fill("3");
  await expectAccessible(page, "onboarding 3");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 4 of 5")).toBeVisible();
  await page.getByLabel(/About how much does your family earn/).selectOption("25k_35k");
  await question(page, "Do you work right now?").getByRole("radio", { name: "Employed", exact: true }).click();
  await question(page, "Are you a student?").getByRole("radio", { name: "Not a student", exact: true }).click();
  await expectAccessible(page, "onboarding 4");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 5 of 5")).toBeVisible();
  await question(page, "Did you file a tax return last year?").getByRole("radio", { name: "Yes", exact: true }).click();
  await question(page, /Do you have dental insurance/).getByRole("radio", { name: "No", exact: true }).click();
  await question(page, "Do you have a disability?").getByRole("radio", { name: "Prefer not to say", exact: true }).click();
  await expectAccessible(page, "onboarding 5");
  await page.getByRole("button", { name: "Save and continue" }).click();

  // 4. Describe (typed). Gemini is replaced by a fixed extraction; the diff is the real function.
  await expect(page).toHaveURL(/\/describe$/);
  await page.route("**/api/extract", async (route) => {
    const body = route.request().postDataJSON() as { text: string; profile: Profile };
    expect(body.text).toContain("single mom");
    expect(body.profile.province).toBe("ON"); // the guest profile is sent along
    await route.fulfill({
      json: {
        detected_language: "en",
        facts: said,
        evidence: [],
        sensitive_data_ignored: false,
        rejected_values: [],
        diff: diffFacts(body.profile, said),
      },
    });
  });
  await expectAccessible(page, "describe");
  await page.getByLabel("Tell us about your situation").fill("I'm a single mom in Toronto with two kids, 2 and 4. I work part-time and make about $20,000.");
  await page.getByRole("button", { name: "Find my benefits" }).click();

  // 5. Confirm: sources are labelled, the conflict is asked about
  await expect(page).toHaveURL(/\/confirm$/);
  await expect(page.getByText("From your profile").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Which is right?" })).toBeVisible();
  await expectAccessible(page, "confirm");
  await page.getByRole("button", { name: /Keep my profile/ }).click();
  await expect(page.getByRole("heading", { name: "Which is right?" })).toBeHidden();
  await page.getByRole("button", { name: "Find my benefits" }).click();

  // 6. Results, grouped by level, with confidence and a cited source
  await expect(page).toHaveURL(/\/results$/);
  const federal = page.getByRole("region", { name: "Federal (Government of Canada)" });
  const ccb = federal.getByRole("article", { name: "Canada Child Benefit (CCB)" });
  await expect(ccb).toBeVisible();
  await expect(ccb.getByText("Likely eligible")).toBeVisible();
  await expect(ccb.getByRole("link", { name: /Official page/ })).toHaveAttribute("href", /^https:\/\/www\.canada\.ca\//);
  await expect(page.getByRole("main").getByText(/^This is not legal or financial advice/)).toBeVisible();
  await expectAccessible(page, "results");
});

test("dark theme follows the device and passes the same accessibility scan", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  for (const path of ["/", "/start", "/onboarding", "/describe", "/account"]) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expectAccessible(page, `dark ${path}`);
  }
  // The toggle overrides the device setting (desktop layout shows it in the header).
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("group", { name: "Theme" }).getByRole("button", { name: "Light" }).click();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  await expectAccessible(page, "light via toggle");
});
