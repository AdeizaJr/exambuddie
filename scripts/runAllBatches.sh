#!/bin/bash
# scripts/runAllBatches.sh
# Runs genBatch.js for every offset until all questions are covered.
# Each call is an independent node process — avoids the nohup session issue.
#
# Usage:
#   bash scripts/runAllBatches.sh geography 10
#   bash scripts/runAllBatches.sh accounts 10

cd "$(dirname "$0")/.."

SUBJECT="${1:-geography}"
BATCH="${2:-10}"

echo "Starting batch run for subject: $SUBJECT (batch size: $BATCH)"
echo "Log: /tmp/${SUBJECT}_batch.log"
echo ""

OFFSET=0
TOTAL=999999

while [ "$OFFSET" -lt "$TOTAL" ]; do
  RESULT=$(node scripts/genBatch.js "$SUBJECT" "$OFFSET" "$BATCH" 2>&1) || true
  echo "$RESULT"

  # Parse TOTAL from output
  NEW_TOTAL=$(echo "$RESULT" | grep "^TOTAL=" | cut -d= -f2)
  if [ -n "$NEW_TOTAL" ]; then
    TOTAL="$NEW_TOTAL"
  fi

  # Parse next offset
  NEXT=$(echo "$RESULT" | grep "^NEXT_OFFSET=" | cut -d= -f2)
  if [ -z "$NEXT" ]; then
    echo "No NEXT_OFFSET — retrying offset $OFFSET after 60s (rate limit backoff)..."
    sleep 60
    continue
  fi

  OFFSET="$NEXT"
  sleep 15  # Pause between batches to avoid rate limiting
done

echo ""
echo "Done! Subject: $SUBJECT complete."
