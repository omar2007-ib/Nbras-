---
name: nibras-accessibility
description: Review and improve Arabic RTL accessibility, responsive layouts, keyboard use, readability, and reduced-motion support in Nibras.
---
# Nibras Accessibility Skill

## Mandatory checks
- Use `<html lang="ar" dir="rtl">` on Arabic pages and set language metadata correctly.
- Preserve logical reading order; do not fix RTL by visually reversing content that becomes confusing to screen readers.
- Use semantic headings, landmarks, buttons, links, lists, labels, and fieldsets.
- Every input needs a visible label; every interactive element needs a descriptive accessible name.
- Ensure visible keyboard focus, sensible tab order, and keyboard operation without pointer-only controls.
- Target WCAG 2.2 AA contrast: at least 4.5:1 for normal text and 3:1 for large text and meaningful UI boundaries where applicable.
- Never use color alone to show correct answers, errors, progress, or required status.
- Keep tap targets around 44×44 CSS pixels where practical.
- Support zoom, text resizing, and widths 375, 768, 1024, and 1440px without horizontal overflow.
- Respect `prefers-reduced-motion`.
- Use Arabic-friendly line height and avoid clipping punctuation, numbers, math symbols, and mixed Arabic/English labels.

## Test scenarios
- Complete navigation and a practice question with keyboard only.
- Use a screen reader to identify headings, labels, answer options, and validation errors.
- Check Arabic numerals and Latin numerals render consistently in math.
- Check empty, loading, success, error, and disabled states.
- Verify focus returns appropriately after dialogs or form submission.
