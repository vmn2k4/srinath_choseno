const { BetaAnalyticsDataClient } = require("@google-analytics/data");
const fs = require("fs");

const PROPERTY_ID = "548881471";
const CLIENT_EMAIL = "choseno-ga4-reader@chosenoprod.iam.gserviceaccount.com";
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC8sRMSZBBlez1n
vPEhPLDkKH/+hzUxuHyqeOpRbFS269wYgI2y/92Dddt5CgHhOcxGd4z258/QJ6he
sN4cgEPI4nppspcAIRy8ud3Xka+TGcu+mdygwAIu2XrBI2OSpc7SJ4p0SQvEF9mQ
uUUGXwAROP1xWfrJ6aCx/pbVMMZbYuzYBoGwQTvuySWx+Em50o+KPCIjyz4RNIo5
+bmQ9jKOPNbVwSEVsRiPxWA+6Rdg8/XoAku/OFMMF0ib+ot3ryqvo+t4rn3pFb2A
GSt8p6OnM/f6nZaAG5WgVps82umHtZ8/OGp2n/qUC4MF5LLXAMIsLDnyRK4gHm1S
YFdaTNB9AgMBAAECggEABUJAIFKWnGVvZC1BYSZCXdF9I7hb9KtKGiwth6BnygNP
yoUGrfbwkwHdYIW1YLQOK+aYEKeMRKZeTGlMf2nZuccKF1kJWVES7nWVp7ThOk3N
Pl4mZnqDdQ/NmoVkeIlTdsrwUmZYxBnQD/cB4/gQ1eoLMjYKRcdTmbJZPM7TsGdI
lCd38CAIozRV+RMM3nvgOqimr+9Y++VwoY0y5P6KPe6GUkhPMZVMU/VSy+dxIDzN
44QlZdN0q23hpHozD96C4FhEa3H5GaZi9YtWTm7xvOVtP4n3L+U8vy1IK4PLzjZd
2/TqGU1W8uVRi1JrTD6UgfNSDu+WbVCzNcMx/KcCBwKBgQD1d0sVj7UYxeeShSnC
PWCt3x42jkpFlzSLWAja2Lla+p//wcFo2vMmW9Gehpn+KBSrLczM+6AiXHZmtoBT
gllY2nM3W7JQyodSKO+OAIygw2CsXAN34QuBKfKpWvFThHf7D7r5FweYuKjjcm99
hJKBSivfxQfaLV96Eo8HByuiewKBgQDEyg4IdgxYhtyBG2x/AHCpChdat8SJ22vG
HpVal8zSdvufQHsh/ouAW6p88LCBMd/Dx5bY9cq30LLh/HxQwb8dVBV5xwM/doH/
/RGrQKSfiiu3IEn8uO7FtIv7TTVv42aOxBcMkaP68otHHbrHw9YTZaJx092t6KL8
J5VcZlUDZwKBgHQ3v/f8a1zITqTjoWrSzpRj4BUqd2XNelZDHyYmmFPH97sKzHzN
tXPC41NwHTblWSvW6nFe7Wl3Z6On4sgnHhBglU5vftSbn0g6E3mjLvHqrznL8uRu
S5ki+D5QzZOiU4At6XOIANPBEk1l3/2IqCjIqk8vJVGaS+srIEbOkU1DAoGBAIgZ
Kd1mLyGmm6fa3I11M3VlGkPOZmnlS8MocajG5YwFZ/56rO4UykwKmX1xRNEFOjl/
tu70BrBb8OtkIGIFrPROq8+d+LwSbNQrJOYoffIssBEljqXvDIvFUy6I9lUck1hX
e41gyGUNC5AymnQAF/UwTEmm+mCFTPtRMPZHe7IvAoGBAMecsRpiavNqjSZ0N7ZN
xlj/tuFpKh1SLCifPYYiVY9MQTTpkYFC85xFbaEPNpib2gnib1YBZK7EeLKi5PB+
Q/MNNSyFyF0j1Lp8Hhj46/qduAc2z/Wz3VBe6SSlvXw53UUlbNvYbq6cMCpYz5g4
y8sF4WRs/aqY3tDTMg0Dd34r
-----END PRIVATE KEY-----`;

const client = new BetaAnalyticsDataClient({
  credentials: { client_email: CLIENT_EMAIL, private_key: PRIVATE_KEY },
});

const property = `properties/${PROPERTY_ID}`;

async function checkData() {
  console.log("🔍 Checking GA4 property configuration...\n");

  try {
    // Test with 90 days
    const res = await client.runReport({
      property,
      dateRanges: [{ startDate: "90daysAgo", endDate: "today" }],
      metrics: [{ name: "sessions" }, { name: "activeUsers" }],
    });

    const sessions = res.rows?.[0]?.metricValues?.[0]?.value || "0";
    const users = res.rows?.[0]?.metricValues?.[1]?.value || "0";

    console.log("✓ GA4 Property Connected Successfully!");
    console.log(`  Sessions (last 90 days): ${sessions}`);
    console.log(`  Active Users (last 90 days): ${users}`);

    if (sessions === "0" && users === "0") {
      console.log("\n⚠️  NO DATA FOUND IN GA4");
      console.log("\nPossible reasons:");
      console.log("  1. GA4 tracking script is only enabled in production");
      console.log("  2. Production site has not launched or has minimal traffic");
      console.log("  3. GA4 property was recently created (data takes 24-48 hours to appear)");
      console.log("  4. Service account has access but no events have been recorded");
    }
  } catch (error) {
    console.error("❌ GA4 API Error:", error.message);
  }
}

checkData();
