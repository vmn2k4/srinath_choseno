import { test, expect } from "@playwright/test";
import { loginAs, runTag, adminCreateElectionWithSeat, KNOWN_BOUNDARY } from "./helpers";

/**
 * Flow B — admin-added ("unregistered") candidate, later claimed by its real owner.
 * Covers requested feature #2. Independent of Flow A (creates its own election/seat)
 * so the two spec files can run in any order.
 */

test("admin adds an unregistered candidate; a different politician claims it; admin approves", async ({
  browser,
}) => {
  const tag = runTag();
  const electionName = `E2E Claim Election ${tag}`;
  const stubName = `E2E Stub Candidate ${tag}`;

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const pol2Ctx = await browser.newContext();
  const politician2 = await pol2Ctx.newPage();

  let seatUrl = "";

  await test.step("Admin creates an election + seat, then adds an unregistered candidate directly", async () => {
    await loginAs(admin, "admin");
    await adminCreateElectionWithSeat(admin, electionName);

    const seatLink = admin
      .getByRole("link", { name: `${KNOWN_BOUNDARY.roleTitle} — ${KNOWN_BOUNDARY.boundaryName}` })
      .first();
    const href = await seatLink.getAttribute("href");
    expect(href).toBeTruthy();
    seatUrl = href as string;

    await admin.goto(seatUrl);
    await admin.getByRole("button", { name: "Add Candidate Directly" }).click();
    await admin.getByPlaceholder("Candidate full name *").fill(stubName);
    await admin.getByRole("button", { name: "Save Candidate", exact: true }).click();

    // Form collapses back to the "Add Candidate Directly" trigger button on success.
    await expect(admin.getByRole("button", { name: "Add Candidate Directly" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(admin.getByText(stubName)).toBeVisible();
  });

  await test.step("#2 A different politician finds the stub and submits a claim request", async () => {
    await loginAs(politician2, "politician2");
    await politician2.goto(seatUrl);

    // Only one candidate exists on this fresh seat, so it's auto-selected — but
    // click its switcher pill defensively in case that ever changes.
    const switcherPill = politician2.getByRole("button", { name: stubName });
    if (await switcherPill.isVisible().catch(() => false)) {
      await switcherPill.click();
    }

    await expect(politician2.getByText("Listed by verified election administrator.")).toBeVisible({
      timeout: 15_000,
    });
    await politician2.getByRole("button", { name: "This is me — Claim Candidacy" }).click();

    await politician2.getByPlaceholder("Contact Email").fill(`e2e.politician2.${tag}@choseno.test`);
    await politician2.getByPlaceholder("Social Media / Proof Link").fill("https://example.com/proof");
    await politician2
      .getByPlaceholder("Why are you claiming this candidacy?")
      .fill(`E2E claim ${tag}: this is my official campaign stub, added by the seat admin.`);
    await politician2.getByRole("button", { name: "Submit Claim Request" }).click();

    await expect(politician2.getByText("Claim request submitted for review.")).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step("Admin approves the pending claim request", async () => {
    await admin.goto(seatUrl);
    const claimRow = admin.locator("div", { hasText: stubName }).last();
    await expect(claimRow.getByRole("button", { name: "Approve" })).toBeVisible({ timeout: 15_000 });
    await claimRow.getByRole("button", { name: "Approve" }).click();
    await expect(claimRow.getByRole("button", { name: "Approve" })).not.toBeVisible({ timeout: 15_000 });
  });

  await test.step("Claimant now owns the candidacy (appears in My Candidacies, editable)", async () => {
    await politician2.goto("/politician/elections");
    const myCandidacyRow = politician2.locator("div", { hasText: stubName }).last();
    await expect(myCandidacyRow.getByRole("button", { name: "Edit Application" })).toBeVisible({
      timeout: 15_000,
    });
  });

  await adminCtx.close();
  await pol2Ctx.close();
});
