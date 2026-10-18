---
name: athar-qa
description: Validate Athar static pages, navigation, Arabic RTL semantics, MCQ authoring behavior, and release readiness.
---
# Athar QA Skill

## Every change
- Run `python scripts/check_site.py`.
- Verify every internal href/src resolves and fragment links target an existing ID.
- Confirm HTML pages have Arabic language, RTL direction, viewport metadata, and meaningful page titles.
- Check images for alt attributes, forms for associated labels, and interactive elements for accessible names.
- Check keyboard focus visibility, reduced-motion support, and responsive wrapping.
- Test navigation to courses, practice, MCQ builder, study plan, resources, auth, and admin pages.

## MCQ builder manual regression
1. Add a question with four options and a correct answer.
2. Reload the page and confirm the question persists in the same browser.
3. Search and filter by category/difficulty.
4. Export JSON and CSV; import valid JSON; reject malformed JSON.
5. Delete one question and test clear-all confirmation.
6. Confirm the interface does not imply that localStorage syncs across devices.

## Reporting
Separate static checks from browser/manual tests. Never state that tests passed unless they were actually run.
