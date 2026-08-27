const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const COOKIES_PATH = path.join(__dirname, 'twitter-cookies.json');
const STORAGE_STATE_PATH = path.join(__dirname, 'twitter-storage-state.json');

async function getBrowserContext(headless = true) {
  const browser = await chromium.launch({
    headless: headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let context;
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    try {
      context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
      return { browser, context };
    } catch (e) {
      console.warn('[Twitter Playwright] Could not load storage state, creating new context:', e.message);
    }
  }

  context = await browser.newContext();
  return { browser, context };
}

async function loginPlaywright(page, username, password, email) {
  console.log(`[Twitter Playwright] Navigating to login flow for @${username}...`);
  await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);

  // 1. Fill Username/Email
  console.log('[Twitter Playwright] Entering username...');
  const usernameInput = page.locator('input[autocomplete="username"], input[name="text"]').first();
  await usernameInput.waitFor({ state: 'visible', timeout: 30000 });
  await usernameInput.fill(username);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // 2. Check if Twitter asks for email or phone verification
  const phoneOrEmailInput = page.locator('input[data-testid="ocfEnterTextTextInput"], input[name="text"]');
  if (await phoneOrEmailInput.isVisible()) {
    console.log('[Twitter Playwright] Entering email verification checkpoint...');
    await phoneOrEmailInput.fill(email || username);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
  }

  // 3. Fill Password
  console.log('[Twitter Playwright] Entering password...');
  const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
  await passwordInput.waitFor({ state: 'visible', timeout: 30000 });
  await passwordInput.fill(password);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);

  // Wait for redirect to home
  await page.waitForURL(/.*x\.com\/(home|explore).*/, { timeout: 30000 });
  console.log('✅ [Twitter Playwright] Login successful!');

  // Save storage state for future headless runs
  await page.context().storageState({ path: STORAGE_STATE_PATH });
  console.log(`[Twitter Playwright] Saved authenticated session to ${STORAGE_STATE_PATH}`);
}

async function postTweetWithPlaywright(tweetText) {
  const username = process.env.TWITTER_USERNAME || env.TWITTER_USERNAME;
  const password = process.env.TWITTER_PASSWORD || env.TWITTER_PASSWORD;
  const email = process.env.TWITTER_EMAIL || env.TWITTER_EMAIL;

  if (!username || !password) {
    throw new Error('Twitter credentials missing in .env.local (TWITTER_USERNAME / TWITTER_PASSWORD).');
  }

  const { browser, context } = await getBrowserContext(true);
  const page = await context.newPage();

  try {
    // Go to home to check if already logged in
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    const isLoginRequired = page.url().includes('login') || page.url().includes('i/flow');
    if (isLoginRequired || !fs.existsSync(STORAGE_STATE_PATH)) {
      await loginPlaywright(page, username, password, email);
    }

    console.log('[Twitter Playwright] Navigating to compose tweet...');
    await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Locate the tweet text editor
    const tweetEditor = page.locator('div[data-testid="tweetTextarea_0"], div[role="textbox"]').first();
    await tweetEditor.waitFor({ state: 'visible', timeout: 20000 });
    await tweetEditor.click();
    await tweetEditor.fill(tweetText);
    await page.waitForTimeout(1500);

    // Click Tweet / Post button
    const postButton = page.locator('button[data-testid="tweetButton"], button[data-testid="tweetButtonInline"]').first();
    await postButton.waitFor({ state: 'visible', timeout: 10000 });
    await postButton.click();

    await page.waitForTimeout(4000);
    console.log('✅ [Twitter Playwright] Tweet successfully published to Twitter/X!');

    // Update saved state
    await context.storageState({ path: STORAGE_STATE_PATH });
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const text = process.argv[2] || 'Choseno civic news feed integration test on Twitter/X.';
  postTweetWithPlaywright(text).catch(err => {
    console.error('❌ [Twitter Playwright Error]:', err.message);
    process.exit(1);
  });
}

module.exports = { postTweetWithPlaywright };
