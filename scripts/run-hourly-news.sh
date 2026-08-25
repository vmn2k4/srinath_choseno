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

# 1. Execute Verified RSS News Ingestion Pipeline (Machine Ground Truth & Quote Gatekeeper)
echo "Executing Verified RSS News Pipeline..." >> "$LOG_FILE"
/opt/homebrew/bin/node scripts/rss-verified-pipeline.js --max-hours 6 >> "$LOG_FILE" 2>&1

echo "Hourly run completed at: $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
