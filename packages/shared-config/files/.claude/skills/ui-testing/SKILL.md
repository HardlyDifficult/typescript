---
name: ui-testing
description: Tests web UI using browser automation, captures and annotates screenshots, documents bugs. Use when testing frontend, running visual checks, or when browser testing or UI issues are mentioned.
---

# UI Testing & Bug Documentation

## Workflow Overview

1. Start dev server (if needed)
2. Navigate and test with browser tools
3. Capture screenshots of issues
4. Annotate screenshots to highlight problems
5. Document findings

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

## Notes

- Always take snapshot before interactions
- Save original screenshots before annotating (annotate a copy)
- Use thick lines (width=4-6) and bright colors (red) for visibility
- Connect related issues with lines to guide the eye
- Keep bug descriptions concise with inline screenshots
