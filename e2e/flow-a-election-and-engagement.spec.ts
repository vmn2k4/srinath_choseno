import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  loginAs,
  runTag,
  adminCreateElectionWithSeat,
  KNOWN_BOUNDARY,
  confirmDialog,
} from "./helpers";

/**
 * Flow A — election lifecycle + candidate/citizen engagement.
 *
 * One continuous story across four actors (admin, politician1, citizen1, citizen2),
 * each driving their own browser context, covering:
 *   #8  Admin creates election, politician nominates, voter supports
 *   #1  Candidate files for nomination (self-service)
 *   #3  Candidate posts a status/campaign statement video
 *   #4  Candidate wall exists once a candidacy is filed
 *   #5  Citizen posts on the candidate wall
 *   #6  Citizen posts on the community wall (Feed)
 *   #7  Citizen comments on a wall post, and "likes" (Supports) the candidate;
 *       also likes a Feed post via the vote bar
 *   #9  Election admin self-nomination + site-admin acceptance
 *
 * Flow B (separate spec) covers #2: admin-added candidate + claim.
 */

test("election lifecycle: create -> nominate -> engage -> seat-admin approval", async ({ browser }) => {
  const tag = runTag();
  const electionName = `E2E Election ${tag}`;
  const videoPath = path.join(__dirname, "fixtures", "statement.mp4");
  const photoPath = path.join(__dirname, "fixtures", "photo.jpg");

  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  const pol1Ctx = await browser.newContext();
  const politician1 = await pol1Ctx.newPage();
  const cit1Ctx = await browser.newContext();
  const citizen1 = await cit1Ctx.newPage();
  const cit2Ctx = await browser.newContext();
  const citizen2 = await cit2Ctx.newPage();

  let seatUrl = "";
  let candidacyUrl = "";

  await test.step("#8a Admin creates an election and builds a seat", async () => {
    await loginAs(admin, "admin");
    await adminCreateElectionWithSeat(admin, electionName);
    // The newly-created seat card's link text is "{role title} — {boundary name}"
    // (opens in a new tab) — read its href instead of following the popup, so we
    // can reuse the URL across every actor's context.
    const seatLink = admin
      .getByRole("link", { name: `${KNOWN_BOUNDARY.roleTitle} — ${KNOWN_BOUNDARY.boundaryName}` })
      .first();
    await expect(seatLink).toBeVisible();
    const href = await seatLink.getAttribute("href");
    expect(href).toBeTruthy();
    seatUrl = href as string;
  });

  await test.step("#1 Politician self-nominates for the seat (no local boundary membership -> Browse Different Area)", async () => {
    await loginAs(politician1, "politician1");
    await politician1.goto("/politician/elections");

    await politician1.getByRole("button", { name: "Browse Different Area" }).click();
    const browsePanel = politician1.getByText("Browse Seats in Another Jurisdiction");
    await expect(browsePanel).toBeVisible();

    const countrySelect = politician1.locator("select", {
      has: politician1.locator("option", { hasText: "Select Country..." }),
    });
    await countrySelect.selectOption({ label: KNOWN_BOUNDARY.country });

    const regionTypeSelect = politician1.locator("select", {
      has: politician1.locator("option", { hasText: "Select Region Type..." }),
    });
    await regionTypeSelect.selectOption({ label: KNOWN_BOUNDARY.containerType });

    const regionSelect = politician1.locator("select", {
      has: politician1.locator("option", { hasText: "Select Region..." }),
    });
    await regionSelect.selectOption({ label: KNOWN_BOUNDARY.containerName });

    await politician1.getByRole("button", { name: "Find Open Seats" }).click();

    const seatRow = politician1
      .locator("div", { hasText: new RegExp(`${KNOWN_BOUNDARY.roleTitle}.*\\(${KNOWN_BOUNDARY.boundaryName}\\)`) })
      .filter({ has: politician1.getByRole("button", { name: "Apply to Run" }) })
      .first();
    await expect(seatRow).toBeVisible({ timeout: 15_000 });
    await seatRow.getByRole("button", { name: "Apply to Run" }).click();

    await politician1.waitForURL("**/apply/**", { timeout: 15_000 });
    candidacyUrl = politician1.url();
  });

  await test.step("#3 Candidate fills platform statement + uploads a campaign statement video, submits", async () => {
    await politician1.getByPlaceholder(
      "Share your primary platform goals, vision, and reasons for running..."
    ).fill(`E2E platform statement ${tag}: local infrastructure and transparent budgets.`);
    // Autosaves onBlur.
    await politician1.getByPlaceholder(
      "Share your primary platform goals, vision, and reasons for running..."
    ).blur();

    await politician1.getByRole("button", { name: "Record Intro Video" }).click();
    await politician1.locator('input[type="file"][accept="video/*"]').first().setInputFiles(videoPath);
    await politician1.getByRole("button", { name: "Upload & Attach" }).click();
    // Uploading text disappears once the upload resolves and the recorder collapses
    // back to the "Re-record Intro Video" state.
    await expect(politician1.getByRole("button", { name: "Re-record Intro Video" })).toBeVisible({
      timeout: 30_000,
    });

    await politician1.getByRole("button", { name: "Submit Application" }).click();
    await expect(politician1.getByText("Application submitted successfully")).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step("#4 Candidate wall exists at the candidacy URL", async () => {
    await politician1.goto(candidacyUrl);
    await expect(politician1.getByText(KNOWN_BOUNDARY.roleTitle, { exact: false }).first()).toBeVisible();
  });

  await test.step("#5 + #7 Citizen posts on the candidate wall, comments, and supports (likes) the candidate", async () => {
    await loginAs(citizen1, "citizen1");
    await citizen1.goto(candidacyUrl);

    const wallMessage = `E2E citizen question ${tag}: what is your plan for local transit?`;
    await citizen1
      .getByPlaceholder("Ask the candidate a question or leave a message...")
      .fill(wallMessage);
    await citizen1.getByRole("button", { name: "Post to Wall" }).click();
    await expect(citizen1.getByText(wallMessage)).toBeVisible({ timeout: 15_000 });

    // Scope to the specific PostCard (rendered via the shared `Card` primitive,
    // recognizable by its `elevation-2` class) so the comment composer sibling
    // is in scope too — a plain `div:has-text()` match would land on the inner
    // content wrapper only, which does *not* contain the composer (a sibling).
    const commentText = `E2E comment ${tag}`;
    const postCard = citizen1.locator(".elevation-2", { hasText: wallMessage }).first();
    await postCard.getByPlaceholder("Write an anonymous comment...").fill(commentText);
    await postCard.getByPlaceholder("Write an anonymous comment...").press("Enter");
    await expect(citizen1.getByText(commentText)).toBeVisible({ timeout: 15_000 });

    const supportButton = citizen1.getByRole("button", { name: /^Support$/ }).first();
    await supportButton.click();
    await expect(supportButton).toHaveText("1", { timeout: 10_000 });
  });

  await test.step("#6 + #7 Citizen posts on the community wall (Feed) with a photo, and likes it", async () => {
    await citizen1.goto("/feed");
    const feedMessage = `E2E feed post ${tag}: new bike lane proposal downtown.`;
    await citizen1.getByPlaceholder("What's happening in your constituency?").fill(feedMessage);

    const fileInput = citizen1.locator('input[type="file"][accept="image/*"]').first();
    await fileInput.setInputFiles(photoPath);

    await citizen1.getByRole("button", { name: "Post to Feed" }).click();
    await expect(citizen1.getByText(feedMessage)).toBeVisible({ timeout: 15_000 });

    const feedPostCard = citizen1.locator(".elevation-2", { hasText: feedMessage }).first();
    await feedPostCard.locator("button:has(svg.lucide-thumbs-up)").click();
    await expect(feedPostCard.locator("button:has(svg.lucide-thumbs-up)")).toContainText("1", {
      timeout: 10_000,
    });
  });

  const adminMotivation = `E2E motivation ${tag}: I want to help keep candidate info accurate.`;

  await test.step("#9a Second citizen self-nominates as election administrator for the seat", async () => {
    await loginAs(citizen2, "citizen2");
    await citizen2.goto(seatUrl);

    await citizen2.getByRole("button", { name: "Volunteer to Administer This Seat" }).click();
    await citizen2
      .getByPlaceholder("Tell us about yourself and why you're interested...")
      .fill(adminMotivation);
    await citizen2.getByPlaceholder("Contact email *").fill(`e2e.seatadmin.${tag}@choseno.test`);
    await citizen2.getByRole("button", { name: "Submit Application", exact: true }).click();

    await expect(
      citizen2.getByText("Your application to administer this seat is under review.")
    ).toBeVisible({ timeout: 15_000 });
  });

  await test.step("#9b Site admin approves the election-admin application", async () => {
    await admin.goto("/admin/election-admins");
    // Row text is unique via the motivation string set above; `.last()` picks the
    // innermost div containing both that text and the Approve button (the outer
    // page/list wrappers also technically "contain" the text so `.first()` would
    // grab something far too broad).
    const appCard = admin.locator("div", { hasText: adminMotivation }).last();
    await expect(appCard).toBeVisible({ timeout: 15_000 });
    await appCard.getByRole("button", { name: "Approve" }).click();
    await expect(appCard).not.toBeVisible({ timeout: 15_000 });
  });

  await test.step("#9c Second citizen sees themself as the approved seat administrator", async () => {
    await citizen2.goto(seatUrl);
    await expect(
      citizen2.getByText("You are the approved Administrator for this seat.")
    ).toBeVisible({ timeout: 15_000 });
  });

  await adminCtx.close();
  await pol1Ctx.close();
  await cit1Ctx.close();
  await cit2Ctx.close();
});
