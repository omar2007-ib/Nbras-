---
name: athar-frontend
description: Build and refine Athar Arabic RTL learning pages using its shared design system, accessible components, and responsive patterns.
---
# Athar Frontend Skill

1. Read `design-system/athar/MASTER.md` before styling.
2. Preserve Arabic content, RTL direction, course names and slogans.
3. Use the shared CSS when possible; avoid divergent per-page tokens.
4. Keep surfaces calm and readable: warm white, soft pink, sage, gold accents, charcoal text.
5. Ensure normal text contrast >= 4.5:1; gold backgrounds use dark text, never white.
6. Provide persistent labels, semantic headings, visible focus, clear validation and live status announcements.
7. Use 44px minimum touch targets and verify wrapping at 375px, 768px, 1024px, and 1440px.
8. Respect reduced-motion preferences. Avoid emoji as the only meaning-bearing icon.
9. Never claim placeholder content or localStorage is cloud-synced.
10. Run `python scripts/check_site.py` after edits and review the diff.
