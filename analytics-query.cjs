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

function metricNum(row, index) {
  const raw = row?.metricValues?.[index]?.value;
  return raw ? Number(raw) : 0;
}

function dimStr(row, index) {
  return row?.dimensionValues?.[index]?.value || "";
}

function formatGa4Date(raw) {
  if (raw.length !== 8) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

async function getAnalytics() {
  console.log("🔍 Fetching analytics data from GA4...\n");

  try {
    const [
      overviewRes,
      pagesRes,
      eventsRes,
      deviceRes,
      countryRes,
      sourceRes,
      engagementRes,
      userTypeRes,
      landingPageRes,
    ] = await Promise.all([
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "screenPageViews" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
          { name: "newUsers" },
          { name: "conversions" },
        ],
      }),
      // Top pages
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "averageSessionDuration" }, { name: "bounceRate" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 15,
      }),
      // Top events
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: 15,
      }),
      // Devices
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "sessions" }, { name: "bounceRate" }, { name: "averageSessionDuration" }],
      }),
      // Countries
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "country" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "bounceRate" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 15,
      }),
      // Traffic sources
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "firstUserSource" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "newUsers" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 15,
      }),
      // User engagement trends
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [
          { name: "sessions" },
          { name: "activeUsers" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
      // New vs returning users
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "newVsReturning" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "bounceRate" }],
      }),
      // Landing pages
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "landingPage" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "bounceRate" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }).catch(() => ({ rows: [] })),
    ]);

    const overview = overviewRes.rows?.[0];
    const pageViews = metricNum(overview, 2);
    const sessions = metricNum(overview, 0);
    const activeUsers = metricNum(overview, 1);
    const avgDuration = metricNum(overview, 3);
    const bounceRate = Math.round(metricNum(overview, 4) * 100) / 100;
    const newUsers = metricNum(overview, 5);
    const conversions = metricNum(overview, 6);

    return {
      overview: {
        pageViews,
        sessions,
        activeUsers,
        avgDuration,
        bounceRate,
        newUsers,
        conversions,
        avgPagesPerSession: sessions > 0 ? Math.round((pageViews / sessions) * 100) / 100 : 0,
        conversionRate:
          sessions > 0 ? Math.round((conversions / sessions) * 10000) / 100 : 0,
      },
      topPages: (pagesRes.rows || []).slice(0, 15).map((row) => ({
        path: dimStr(row, 0) || "/",
        views: metricNum(row, 0),
        avgDuration: Math.round(metricNum(row, 1)),
        bounceRate: Math.round(metricNum(row, 2) * 100) / 100,
      })),
      topEvents: (eventsRes.rows || []).map((row) => ({
        name: dimStr(row, 0),
        count: metricNum(row, 0),
      })),
      devices: (deviceRes.rows || []).map((row) => ({
        name: dimStr(row, 0) || "unknown",
        sessions: metricNum(row, 0),
        bounceRate: Math.round(metricNum(row, 1) * 100) / 100,
        avgDuration: Math.round(metricNum(row, 2)),
      })),
      topCountries: (countryRes.rows || []).map((row) => ({
        country: dimStr(row, 0) || "Unknown",
        sessions: metricNum(row, 0),
        activeUsers: metricNum(row, 1),
        bounceRate: Math.round(metricNum(row, 2) * 100) / 100,
      })),
      trafficSources: (sourceRes.rows || []).map((row) => ({
        source: dimStr(row, 0) || "direct",
        sessions: metricNum(row, 0),
        activeUsers: metricNum(row, 1),
        newUsers: metricNum(row, 2),
      })),
      dailyTrend: (engagementRes.rows || []).map((row) => ({
        date: formatGa4Date(dimStr(row, 0)),
        sessions: metricNum(row, 0),
        activeUsers: metricNum(row, 1),
        bounceRate: Math.round(metricNum(row, 2) * 100) / 100,
        avgDuration: Math.round(metricNum(row, 3)),
      })),
      newVsReturning: (userTypeRes.rows || []).map((row) => ({
        type: dimStr(row, 0),
        sessions: metricNum(row, 0),
        activeUsers: metricNum(row, 1),
        bounceRate: Math.round(metricNum(row, 2) * 100) / 100,
      })),
      landingPages: (landingPageRes.rows || []).map((row) => ({
        page: dimStr(row, 0),
        sessions: metricNum(row, 0),
        activeUsers: metricNum(row, 1),
        bounceRate: Math.round(metricNum(row, 2) * 100) / 100,
      })),
    };
  } catch (error) {
    console.error("Error fetching analytics:", error);
    process.exit(1);
  }
}

function generateReport(data) {
  const { overview, topPages, topEvents, devices, topCountries, trafficSources, dailyTrend, newVsReturning, landingPages } = data;

  let report = "\n";
  report += "╔════════════════════════════════════════════════════════════════╗\n";
  report += "║          CHOSENO PLATFORM ANALYTICS REPORT (Last 30 Days)      ║\n";
  report += "╚════════════════════════════════════════════════════════════════╝\n\n";

  // OVERVIEW
  report += "📊 OVERVIEW METRICS\n";
  report += "─".repeat(65) + "\n";
  report += `  Sessions:                    ${overview.sessions.toLocaleString()}\n`;
  report += `  Active Users:                ${overview.activeUsers.toLocaleString()}\n`;
  report += `  New Users:                   ${overview.newUsers.toLocaleString()}\n`;
  report += `  Total Page Views:            ${overview.pageViews.toLocaleString()}\n`;
  report += `  Avg Pages per Session:       ${overview.avgPagesPerSession} pages\n`;
  report += `  Avg Session Duration:        ${overview.avgDuration} seconds\n`;
  report += `  Bounce Rate:                 ${overview.bounceRate}%\n`;
  report += `  Conversions:                 ${overview.conversions}\n`;
  report += `  Conversion Rate:             ${overview.conversionRate}%\n\n`;

  // TOP PAGES
  report += "🔥 TOP PERFORMING PAGES\n";
  report += "─".repeat(65) + "\n";
  topPages.slice(0, 8).forEach((page, i) => {
    report += `  ${i + 1}. ${page.path.substring(0, 40).padEnd(40)} | Views: ${page.views} | Bounce: ${page.bounceRate}%\n`;
  });
  report += "\n";

  // UNDERPERFORMING PAGES (High bounce rate, low engagement)
  const underperformers = topPages.filter(p => p.bounceRate > 60 && p.views > 50);
  if (underperformers.length > 0) {
    report += "⚠️  PAGES NEEDING IMPROVEMENT (High Bounce Rate)\n";
    report += "─".repeat(65) + "\n";
    underperformers.slice(0, 5).forEach((page) => {
      report += `  • ${page.path} - Bounce: ${page.bounceRate}% | Avg Duration: ${page.avgDuration}s\n`;
    });
    report += "\n";
  }

  // DEVICES
  report += "📱 DEVICE BREAKDOWN\n";
  report += "─".repeat(65) + "\n";
  devices.forEach((device) => {
    const pct = overview.sessions > 0 ? Math.round((device.sessions / overview.sessions) * 100) : 0;
    report += `  ${device.name.padEnd(12)} | ${device.sessions.toString().padStart(6)} sessions (${pct}%) | Bounce: ${device.bounceRate}%\n`;
  });
  report += "\n";

  // TOP TRAFFIC SOURCES
  report += "🌐 TOP TRAFFIC SOURCES\n";
  report += "─".repeat(65) + "\n";
  trafficSources.slice(0, 8).forEach((source) => {
    const pct = overview.sessions > 0 ? Math.round((source.sessions / overview.sessions) * 100) : 0;
    report += `  ${source.source.padEnd(20)} | ${source.sessions} sessions (${pct}%)\n`;
  });
  report += "\n";

  // TOP COUNTRIES
  report += "🌍 TOP COUNTRIES/REGIONS\n";
  report += "─".repeat(65) + "\n";
  topCountries.slice(0, 8).forEach((country) => {
    report += `  ${country.country.padEnd(20)} | ${country.sessions} sessions | Bounce: ${country.bounceRate}%\n`;
  });
  report += "\n";

  // EVENTS
  if (topEvents.length > 0) {
    report += "🎯 TOP TRACKED EVENTS\n";
    report += "─".repeat(65) + "\n";
    topEvents.slice(0, 8).forEach((event) => {
      report += `  • ${event.name.padEnd(30)} ${event.count.toLocaleString()} times\n`;
    });
    report += "\n";
  }

  // NEW VS RETURNING
  if (newVsReturning.length > 0) {
    report += "👥 NEW VS RETURNING USERS\n";
    report += "─".repeat(65) + "\n";
    newVsReturning.forEach((user) => {
      const pct = overview.sessions > 0 ? Math.round((user.sessions / overview.sessions) * 100) : 0;
      report += `  ${user.type.padEnd(12)} | ${user.sessions} sessions (${pct}%) | Users: ${user.activeUsers}\n`;
    });
    report += "\n";
  }

  // TRENDS
  const validTrend = dailyTrend.filter(d => d.sessions > 0);
  if (validTrend.length > 0) {
    const maxSessions = Math.max(...validTrend.map(d => d.sessions));
    const minSessions = Math.min(...validTrend.map(d => d.sessions));
    const avgSessions = Math.round(validTrend.reduce((s, d) => s + d.sessions, 0) / validTrend.length);

    report += "📈 TRAFFIC TRENDS\n";
    report += "─".repeat(65) + "\n";
    report += `  Peak Day:     ${maxSessions} sessions\n`;
    report += `  Low Day:      ${minSessions} sessions\n`;
    report += `  Daily Avg:    ${avgSessions} sessions\n`;
    report += `  Trend:        ${validTrend[validTrend.length - 1].sessions > avgSessions ? "📈 Increasing" : "📉 Decreasing"}\n\n`;
  }

  return report;
}

async function main() {
  const data = await getAnalytics();
  const report = generateReport(data);
  console.log(report);

  // Save raw data to file for reference
  fs.writeFileSync(
    "./analytics-data.json",
    JSON.stringify(data, null, 2)
  );

  console.log("📊 Raw data saved to analytics-data.json");
}

main().catch(console.error);
