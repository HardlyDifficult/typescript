#!/usr/bin/env bash
# Installs the pre-push git hook for the typescript repo.
# Run once after cloning: ./scripts/setup-hooks.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
PRE_PUSH_HOOK="$HOOKS_DIR/pre-push"
PRE_PUSH_SCRIPT="$REPO_ROOT/scripts/pre-push.sh"

if [ ! -d "$HOOKS_DIR" ]; then
  echo "ERROR: $HOOKS_DIR does not exist. Are you in a git repository?"
  exit 1
fi

# Make the pre-push script executable
chmod +x "$PRE_PUSH_SCRIPT"

# Symlink (or overwrite) the hook
ln -sf "$PRE_PUSH_SCRIPT" "$PRE_PUSH_HOOK"
chmod +x "$PRE_PUSH_HOOK"

echo "Installed pre-push hook -> $PRE_PUSH_HOOK"
echo "Run './scripts/pre-push.sh' any time to validate manually."
