---
name: ui-testing
description: Tests web UI using browser automation, captures and annotates screenshots, documents bugs. Use when testing frontend, running visual checks, or when browser testing or UI issues are mentioned.
---

# UI Testing & Bug Documentation

## Workflow Overview

1. Start dev server (if needed)
2. Test API endpoints first (catch backend issues before browser testing)
3. Navigate and test with browser tools
4. Capture screenshots of issues
5. Annotate screenshots to highlight problems
6. Document findings

## API-First Testing

Before browser testing, verify API endpoints with `curl`. This catches backend errors (DB schema mismatches, timeouts, wrong table names) faster than clicking through the UI.

**Pattern:**

```bash
# 1. Check what API routes exist
find src/app/api -name "route.ts" | sort

# 2. Test each endpoint with curl
curl -s "http://localhost:3000/api/endpoint" | jq .

# 3. Check for common issues
# - HTTP 500 with SQL errors (wrong table/column names)
# - Timeouts (>30s responses indicate missing pagination/caching)
# - Empty responses with no error (missing data vs broken query)
```

**Common backend issues:**

| Issue | Symptom | Root Cause |
| ----- | ------- | ---------- |
| Wrong table name | `relation "X" does not exist` | Query uses old/incorrect table name |
| Missing column | `column X does not exist` | Query assumes column exists on wrong table |
| Timeout | No response after 30s+ | Missing pagination, large data set, slow upstream API |
| Empty response | `{"data":[]}` with 200 status | No data, or broken query silently returns nothing |

## Browser Testing

Use browser automation tools for testing:

```
browser_navigate → browser_snapshot → browser_click/type → browser_screenshot
```

**Key capabilities:**
- Navigate to URLs
- Get page structure and element references
- Click elements and fill forms
- Take screenshots

**Testing pattern:**
1. Navigate to page
2. Take snapshot to understand structure
3. Verify expected elements exist
4. Interact with elements
5. Screenshot any issues found

### Per-Page Checklist

- [ ] Page loads without errors (check browser console)
- [ ] Data displays correctly (not empty, not mock/static data)
- [ ] No spinners stuck indefinitely
- [ ] Empty states have explanatory messages

## Screenshot Annotation

Use Python/Pillow to annotate screenshots:

```python
from PIL import Image, ImageDraw

img = Image.open("screenshot.jpeg")
draw = ImageDraw.Draw(img)

# Draw circles around issues (x1, y1, x2, y2)
draw.ellipse([780, 455, 910, 522], outline='red', width=6)

# Draw connecting lines between related issues
draw.line([910, 510, 1100, 740], fill='red', width=4)

img.save("annotated.jpeg", quality=90)
```

**Finding element positions:**
- Read the image to view it visually
- Use pixel sampling to find exact coordinates:

```python
from PIL import Image
img = Image.open("screenshot.jpeg")
# Sample specific coordinates
r, g, b = img.getpixel((x, y))[:3]
```

## Bug Documentation Template

```markdown
Brief description of the bug.

![Screenshot](path/to/screenshot.png)

**Expected:** What should happen
**Actual:** What actually happens (reference annotations if present)

**Why this is a bug:**
Explanation of the impact/UX issue.

**Priority: Low/Medium/High**
Brief justification for priority level.
```

## Bug Reporting Strategy

When testing uncovers multiple issues across many pages, use the **Investigation Pattern**:

1. **Test all pages first** — gather the full picture before creating issues
2. **Create a parent issue** — summarize scope (e.g., "UI testing — broken pages")
3. **Create one subtask per affected page** — even if a page has multiple problems
4. **Each subtask includes:**
   - Root cause analysis (SQL error, timeout, missing data, static mock data)
   - Affected API routes and source files
   - Proposed fix with specific code changes
5. **Priority guide:** Default to Normal. Use Low for cosmetic/empty-state issues.

## Quick Reference

| Task | Tool/Method |
|------|-------------|
| Navigate to page | `browser_navigate` |
| Get element refs | `browser_snapshot` |
| Click element | `browser_click` with ref |
| Take screenshot | `browser_screenshot` |
| Annotate image | Python/Pillow |

## Notes

- Always take snapshot before interactions
- Save original screenshots before annotating (annotate a copy)
- Use thick lines (width=4-6) and bright colors (red) for visibility
- Connect related issues with lines to guide the eye
- Keep bug descriptions concise with inline screenshots
- Test against production-scale data when possible — issues hidden on small datasets often surface with larger ones
