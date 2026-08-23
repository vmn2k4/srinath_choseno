# Choseno Autonomous Hourly News Daemon Guide

This document explains the autonomous background news collection and ingestion pipeline for Choseno, which runs **every hour 24/7 on macOS** even when the Antigravity IDE/app is closed.

---

## 1. Overview & Architecture

The daemon executes the 3-track news collection directive across all levels of government (Municipal, State/Provincial, and Federal):

```
┌─────────────────────────────────────────────────────────────┐
│               macOS Launchd System Daemon                   │
│             (com.choseno.masternews.plist)                  │
│                     Fires Every 1 Hour                      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 scripts/run-hourly-news.sh                  │
├─────────────────────────────────────────────────────────────┤
│ 1. scripts/get-last-publish-window.js                       │
│    - Calculates elapsed hours since latest published row    │
│                                                             │
│ 2. scripts/fetch-trending-topics.js --max-hours 6           │
│    - Scans Google Trends, Google News, and CBC Wire RSS     │
│                                                             │
│ 3. scripts/insert-news-batch.js                             │
│    - Ingests verified stories into Supabase                 │
│    - Auto-triggers admin_sync_news_article_tags() (walls)   │
│    - Auto-triggers admin_sync_news_article_boundaries()     │
│    - Updates batch-ranked-news.csv                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Quick Command Reference

### Check Status & View Live Logs
To see if the daemon is currently active:
```bash
launchctl list | grep choseno
```
*(If active, it returns a PID and label `com.choseno.masternews`)*

To watch the live execution log in real time:
```bash
tail -f scripts/hourly-cron.log
```

---

### How to Stop the Daemon
To stop the daemon and disable automated hourly runs:
```bash
launchctl unload ~/Library/LaunchAgents/com.choseno.masternews.plist
```

---

### How to Start / Restart the Daemon
To start or restart the daemon:
```bash
# Unload first if previously running
launchctl unload ~/Library/LaunchAgents/com.choseno.masternews.plist 2>/dev/null || true

# Load and start daemon
launchctl load ~/Library/LaunchAgents/com.choseno.masternews.plist
```

---

### How to Trigger a Manual Run Instantly
To execute the news ingestion pipeline immediately without waiting for the next hour:
```bash
./scripts/run-hourly-news.sh
```

---

## 3. Key Files & Locations

| File | Path | Description |
| :--- | :--- | :--- |
| **Launchd Service Config** | `~/Library/LaunchAgents/com.choseno.masternews.plist` | macOS background daemon configuration (Interval: 3600s). |
| **Runner Script** | [`scripts/run-hourly-news.sh`](file:///Users/vmn2k4/Coding/Choseno/scripts/run-hourly-news.sh) | Shell script executed every hour by macOS. |
| **Execution Logs** | [`scripts/hourly-cron.log`](file:///Users/vmn2k4/Coding/Choseno/scripts/hourly-cron.log) | Combined output and error log of hourly runs. |
| **Lookback Script** | [`scripts/get-last-publish-window.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/get-last-publish-window.js) | Computes `lastPublishedAt` and `lookbackHours`. |
| **Trending Fetcher** | [`scripts/fetch-trending-topics.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/fetch-trending-topics.js) | Scans RSS feeds for emerging political trends. |
| **Ingestion Engine** | [`scripts/insert-news-batch.js`](file:///Users/vmn2k4/Coding/Choseno/scripts/insert-news-batch.js) | Inserts articles, syncs politician walls, and updates CSV ranking. |
| **Ranked Distribution** | [`batch-ranked-news.csv`](file:///Users/vmn2k4/Coding/Choseno/batch-ranked-news.csv) | Top 100 ranked stories for social distribution. |
| **Agent Prompt** | [`.agents/master-news-agent.md`](file:///Users/vmn2k4/Coding/Choseno/.agents/master-news-agent.md) | Agent persona and guidelines inside Antigravity. |
