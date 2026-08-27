const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const STORAGE_STATE_PATH = path.join(__dirname, 'twitter-storage-state.json');
const COOKIES_PATH = path.join(__dirname, 'twitter-cookies.json');

async function loginWithBrowser() {
  console.log('======================================================');
  console.log('CHOSENO TWITTER/X ONE-TIME BROWSER AUTHENTICATION');
  console.log('======================================================');
  console.log('Launching browser. Please log into your Twitter/X account in the opened window...\n');

  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://x.com/i/flow/login');

  console.log('Waiting for successful login to x.com/home...');
  
  // Wait until user reaches home page or feed
  await page.waitForURL(/.*x\.com\/(home|explore).*/, { timeout: 300000 });

  console.log('✅ Login detected! Saving authenticated browser session state...');
  await context.storageState({ path: STORAGE_STATE_PATH });

  const cookies = await context.cookies();
  const cookieStrings = cookies
    .filter(c => c.domain.includes('x.com') || c.domain.includes('twitter.com'))
    .map(c => `${c.name}=${c.value}; Domain=${c.domain}; Path=${c.path}`);
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookieStrings, null, 2));

  console.log(`✅ Session permanently saved to:`);
  console.log(`   - ${STORAGE_STATE_PATH}`);
  console.log(`   - ${COOKIES_PATH}`);
  console.log('\nAll future news pipeline runs will now post autonomously without requiring login!');

  await browser.close();
}

if (require.main === module) {
  loginWithBrowser().catch(err => {
    console.error('Login helper error:', err.message);
  });
}
