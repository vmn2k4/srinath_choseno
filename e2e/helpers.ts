import { Page, expect } from "@playwright/test";

// Fixture accounts — provisioned by sql/seed_e2e_users.sql directly in the dev
// Supabase project (bypasses signup/onboarding UI so specs start from a known state).
// Run the seed script once before the suite: see e2e/README.md.
export const FIXTURE_PASSWORD = "ChosenoE2E123!";

export const FIXTURES = {
  admin: { email: "e2e.admin@choseno.test", label: "E2E Admin" },
  politician1: { email: "e2e.politician1@choseno.test", label: "E2E Politician One" },
  politician2: { email: "e2e.politician2@choseno.test", label: "E2E Politician Two" },
  citizen1: { email: "e2e.citizen1@choseno.test", label: "E2E Citizen One" },
  citizen2: { email: "e2e.citizen2@choseno.test", label: "E2E Citizen Two" },
} as const;

export type FixtureKey = keyof typeof FIXTURES;

/** Logs in as a fixture user via the real /auth form. Leaves the page on /feed. */
export async function loginAs(page: Page, who: FixtureKey) {
  const { email } = FIXTURES[who];
  await page.goto("/auth");
  // The form defaults to the Log In tab already.
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(FIXTURE_PASSWORD);
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.waitForURL("**/feed", { timeout: 15_000 });
}

/** A unique-ish suffix for names/content this run creates, to avoid colliding with
 * leftover data from a previous run (the suite doesn't tear down DB rows it creates). */
export function runTag(): string {
  return `${Date.now().toString(36)}`;
}

/** Waits for a Radix/primitive-style toast or inline success text to appear. Many
 * mutations in this app show inline text rather than a toast — prefer asserting the
 * specific expected text at the call site; this is only for generic "did *something*
 * happen" waits (e.g. after a submit that just clears a form). */
export async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState("networkidle");
}

/** Confirms a ConfirmDialog (used by delete/withdraw/burn actions across the app). */
export async function confirmDialog(page: Page, confirmButtonText: string) {
  await page.getByRole("button", { name: confirmButtonText, exact: true }).last().click();
}

export async function expectVisibleText(page: Page, text: string) {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
}

// Real, pre-imported boundary data confirmed directly against the dev DB (see
// sql/seed_e2e_users.sql's neighbor query notes) — used so the seat-building wizard
// always has real matches instead of guessing at country/boundary-type strings live.
export const KNOWN_BOUNDARY = {
  country: "Canada",
  boundaryType: "Municipal",
  boundaryName: "Vancouver",
  roleTitle: "Councillor",
  // Container path "Browse Different Area" needs to reach the same boundary.
  containerType: "Province",
  containerName: "British Columbia",
};

/**
 * Full admin flow: create a draft election, build one seat (KNOWN_BOUNDARY), then
 * advance the election to "nominations_open" so it's visible to self-nomination
 * search. Caller must already be logged in as admin. Leaves the page on
 * /admin/elections with the new election selected.
 */
export async function adminCreateElectionWithSeat(
  page: Page,
  electionName: string,
  roleTitle: string = KNOWN_BOUNDARY.roleTitle
) {
  await page.goto("/admin/elections");

  // 1. Create the election.
  await page.getByPlaceholder("Election Name (e.g. 2026 Vancouver Municipal)").fill(electionName);
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.locator('input[type="date"]').fill(futureDate);
  await page.getByRole("button", { name: "Create Election", exact: true }).click();

  // 2. Select it in the grid (card is clickable via its name heading). Once
  // selected, the same name also appears in the "Selected Election Detail"
  // heading below, so scope to the grid card specifically (h3) rather than
  // matching any heading with this text.
  await page.locator("h3", { hasText: electionName }).click();
  await expect(page.getByRole("heading", { name: "Build Seats" })).toBeVisible();

  // 3. Country select (the one containing a "Country" placeholder option).
  // Note: Playwright's string `hasText` is a case-insensitive *substring* match, so
  // a plain "Country" would also match the disabled boundary-type select's "Select a
  // country first" placeholder — anchor with a regex for an exact match instead.
  const countrySelect = page.locator("select", { has: page.locator("option", { hasText: /^Country$/ }) });
  await countrySelect.selectOption({ label: KNOWN_BOUNDARY.country });

  // 4. Target boundary type select.
  const targetTypeSelect = page.locator("select", {
    has: page.locator("option", { hasText: /^Select target boundary type\.\.\.$/ }),
  });
  await targetTypeSelect.selectOption({ label: KNOWN_BOUNDARY.boundaryType });
  await page.getByRole("button", { name: "Find Matching Boundaries" }).click();

  // 5. Filter + select the one known boundary. Assert the underlying checkbox
  // actually ends up checked — clicking the label text is usually equivalent,
  // but layout-shift/animation on this page can make the click land before the
  // list settles, so confirm rather than assume.
  await page.getByPlaceholder("Filter by name...").fill(KNOWN_BOUNDARY.boundaryName);
  const boundaryCheckbox = page
    .locator("label", { hasText: KNOWN_BOUNDARY.boundaryName })
    .locator('input[type="checkbox"]');
  await boundaryCheckbox.scrollIntoViewIfNeeded();
  await boundaryCheckbox.check();
  await expect(boundaryCheckbox).toBeChecked();

  // 6. Select the role (custom hidden-checkbox-in-label pattern, same idea).
  const roleCheckbox = page.locator("label", { hasText: roleTitle }).locator('input[type="checkbox"]');
  await roleCheckbox.check({ force: true }); // the input is visually hidden by design (custom pill styling)
  await expect(roleCheckbox).toBeChecked();

  // 7. Create the seat(s) and confirm the success message specifically —
  // the boundary-count paragraph alone is shown in both the success and the
  // empty-selection-error case, so it isn't proof anything was created.
  await page.getByRole("button", { name: "Create Seats for Selected" }).click();
  await expect(page.getByText(/^Created \d+ seat\(s\)\.$/)).toBeVisible({ timeout: 15_000 });

  // 8. Advance draft -> nominations_open so self-nomination search can find it.
  await page.getByRole("button", { name: "Open Nominations", exact: true }).first().click();
  await expect(page.getByText("nominations open", { exact: false }).first()).toBeVisible();
}
