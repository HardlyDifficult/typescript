#!/usr/bin/env bash
# Pre-push validation script for the typescript repo.
# Runs: merge with main → fix (lint + format) → build → test
#
# Usage:
#   ./scripts/pre-push.sh          # standalone
#   .git/hooks/pre-push            # as a git hook (installed by setup-hooks.sh)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Pre-push validation (typescript repo) ==="

# Step 1: Merge with origin/main
echo ""
echo "--- Step 1: Syncing with origin/main ---"
git fetch origin
MERGE_OUTPUT=$(git merge origin/main --no-edit 2>&1) || {
  echo "ERROR: Merge with origin/main failed."
  echo "$MERGE_OUTPUT"
  exit 1
}
echo "$MERGE_OUTPUT"
if echo "$MERGE_OUTPUT" | grep -q "Already up to date"; then
  echo "Already up to date with origin/main."
fi

# Step 2: Lint + format autofix
echo ""
echo "--- Step 2: Lint + format autofix (npm run fix) ---"
npm run fix

# Step 3: Build
echo ""
echo "--- Step 3: Build (npm run build) ---"
npm run build

# Step 4: Tests
echo ""
echo "--- Step 4: Tests (npm run test) ---"
npm run test

echo ""
echo "=== All checks passed. Ready to push. ==="
