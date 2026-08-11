import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto("http://localhost:3000/officeholder-claim/test-token");
await page.waitForLoadState("networkidle");
if (!(await page.getByRole("heading", { name: "Sign in to claim this wall" }).isVisible())) {
  throw new Error("Claim page did not render its unauthenticated state");
}
if (!(await page.getByRole("button", { name: "Sign in or sign up" }).isVisible())) {
  throw new Error("Claim page sign-in action is missing");
}

await page.goto("http://localhost:3000/admin/office-holders");
await page.waitForLoadState("networkidle");
if (!page.url().includes("/auth") && !(await page.getByText("Office Holders").isVisible())) {
  throw new Error("Admin officeholder route did not render or protect itself");
}

await browser.close();
console.log("officeholder claim UI smoke test passed");
