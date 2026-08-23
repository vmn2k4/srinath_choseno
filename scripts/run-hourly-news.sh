#!/bin/bash
# Autonomous Hourly News Ingestion Runner for Choseno
# Runs via macOS Launchd Daemon even when Antigravity is closed.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
PROJECT_DIR="/Users/vmn2k4/Coding/Choseno"
LOG_FILE="$PROJECT_DIR/scripts/hourly-cron.log"

echo "========================================================" >> "$LOG_FILE"
echo "Starting Hourly News Pipeline: $(date)" >> "$LOG_FILE"
echo "========================================================" >> "$LOG_FILE"

cd "$PROJECT_DIR" || exit 1

# 1. Fetch dynamic lookback window
echo "Checking last publish window..." >> "$LOG_FILE"
/opt/homebrew/bin/node scripts/get-last-publish-window.js >> "$LOG_FILE" 2>&1

# 2. Fetch trending topics and RSS wire signals (6-hour window)
echo "Fetching trending topics and wire feeds..." >> "$LOG_FILE"
/opt/homebrew/bin/node scripts/fetch-trending-topics.js --max-hours 6 >> "$LOG_FILE" 2>&1

# 3. Execute batch ingestion & auto-sync tags / boundaries
echo "Executing batch ingestion into Supabase..." >> "$LOG_FILE"
/opt/homebrew/bin/node scripts/insert-news-batch.js >> "$LOG_FILE" 2>&1

echo "Hourly run completed at: $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
