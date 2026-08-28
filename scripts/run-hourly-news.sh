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
# No --max-hours: the pipeline auto-computes the exact lookback from time-
# since-last-published (scripts/get-last-publish-window.js). On a normal
# hourly cadence that's ~1h every time; if a run is ever missed (sleep,
# network blip), it self-expands to cover the gap instead of guessing at a
# fixed margin. Falls back to 4h internally if the lookup itself fails.
echo "Executing Verified RSS News Pipeline..." >> "$LOG_FILE"
/opt/homebrew/bin/node scripts/rss-verified-pipeline.js >> "$LOG_FILE" 2>&1

echo "Hourly run completed at: $(date)" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
