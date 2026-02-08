---
name: browser-automation
description: Headless browser automation for testing and debugging using agent-browser. Navigate pages, inspect content, take screenshots.
---

# Browser Automation with agent-browser

Headless browser CLI for AI agents. See [agent-browser](https://github.com/vercel-labs/agent-browser).

## Quick Reference

```bash
agent-browser open <url>                    # Navigate to URL
agent-browser wait --load networkidle       # Wait for page load
agent-browser snapshot                      # Get accessibility tree (DOM structure)
agent-browser snapshot -i                   # Interactive elements only (with @refs)
agent-browser get text <selector>           # Get element text
agent-browser get html <selector>           # Get element HTML
agent-browser click <selector>              # Click element (or use @ref)
agent-browser fill <selector> <text>        # Fill input field
agent-browser screenshot /tmp/shot.png      # Take screenshot
agent-browser eval "js expression"          # Run JavaScript
agent-browser close                         # Close browser (always do this)
```

## Debugging Missing Content

```bash
agent-browser open "http://localhost:3000/page"
agent-browser wait --load networkidle
agent-browser snapshot          # Shows DOM structure - empty elements visible
agent-browser get text "main"   # Shows rendered text only
agent-browser close
```

- `snapshot` reveals empty containers that `get text` masks
- If agent-browser struggles with large pages, fall back to `curl -s URL | grep`

## Interactive Elements

```bash
agent-browser snapshot -i   # Returns @refs: @e1, @e2, etc.
agent-browser click @e3     # Click by ref
agent-browser fill @e4 "search term"
```

## Screenshots for PRs

Store in a `screenshots` branch to keep images out of main:

```bash
agent-browser open "http://localhost:3000/page"
agent-browser wait --load networkidle
agent-browser eval "document.querySelector('#section').scrollIntoView({block: 'center'})"
sleep 1
agent-browser screenshot /tmp/feature.png
agent-browser close

git checkout screenshots || git checkout -b screenshots origin/main
mkdir -p screenshots/pr-XXX
cp /tmp/feature.png screenshots/pr-XXX/
git add screenshots/ && git commit -m "Screenshots for PR #XXX" && git push origin screenshots
git checkout your-feature-branch
```

Reference in PR:
```markdown
![Description](https://github.com/owner/repo/blob/screenshots/screenshots/pr-XXX/feature.png?raw=true)
```

## Troubleshooting

- **Browser won't start**: `agent-browser install --with-deps`
- **Element not found**: Use `agent-browser snapshot` to see what's on the page
- **Timeouts/accumulation**: Always close between sessions. Check: `ps aux | grep agent-browser | wc -l`
- **Sequential only**: Don't batch multiple opens without closing between each
