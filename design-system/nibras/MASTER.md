# أثَر — Master Design System

## Product context
Arabic-first RTL learning platform for Saudi Qudrat preparation. Priorities: clarity, trust, focused study, readable questions, and low-friction practice on iPad/mobile and desktop.

## Visual direction
- Style: Soft UI Evolution; calm, premium, light, friendly but academically credible.
- Pattern: Hero-led homepage with clear primary CTA, course cards, practice entry points, and trust-building explanatory content.
- Keep the visual system consistent across homepage, course pages, practice, study planner, resources, authentication, admin prototype, and MCQ builder.
- Avoid spa-specific copy, booking patterns, neon, dark-mode-first visuals, harsh animation, and emoji used as decorative icons.

## Color tokens
- Primary brand purple: `#5B21B6` — wordmark, primary actions, and key emphasis.
- Accent lavender: `#C4B5FD` — secondary emphasis, selected surfaces, and supporting highlights.
- Soft surface: `#F3EEFF`; page background: `#FCFAFF`.
- Main text: `#2D2340`; secondary text: `#5B5470`.
- White surface: `#FFFFFF`; borders: `#E9DFFF`.
- Success: `#047857`; error: `#991B1B`.
- Keep normal text contrast at or above 4.5:1. Do not use lavender as small text on white; use the primary purple for readable text.

## Typography
- Brand wordmark and branded display text: the actual licensed Jazeel webfont. Do not substitute another display font or claim Jazeel is available when its licensed webfont asset is absent.
- Arabic body and interface copy: IBM Plex Sans Arabic; this is a body font, not a replacement for the Jazeel wordmark.
- Base body size at least 16px; line-height around 1.7–1.85.
- Headings use a clear scale and tight hierarchy; avoid long lines on desktop.
- English technical labels such as MCQ may use the body sans-serif family.

## Layout and components
- RTL is mandatory: `<html lang="ar" dir="rtl">`.
- Content width: approximately 1100–1180px; mobile gutters 4–5%.
- Use 8px spacing rhythm and consistent radii: 10px fields/buttons, 14–20px cards.
- Cards use white surfaces, subtle borders, low-opacity soft shadows.
- Hero sections use white and very light lavender surfaces with restrained purple accents, not dark gradients.
- Navigation: light header, charcoal links, visible hover and active state.
- Forms: persistent visible labels, inline status messages, clear required fields, keyboard-friendly order.
- Buttons and touch controls: minimum 44px height; clickable cursor; visible hover/focus/disabled states.
- Use simple inline SVG icons with accessible labels for meaningful icons; decorative SVG should be aria-hidden.
- Prefer concise labels over decorative emoji.

## Accessibility and motion
- Keyboard focus: visible 3px outline with offset.
- Target text contrast ratio >= 4.5:1 for normal text; don't rely on color alone for correct answers or status.
- Respect `prefers-reduced-motion: reduce`; keep transitions subtle and purposeful.
- Support 375px, 768px, 1024px, and 1440px widths; prevent horizontal overflow and clipping of Arabic labels.
- Every form field must have a visible label. Every button/link needs a clear name and purpose.

## Page-specific guidance
- Homepage: one clear primary CTA, course cards, study benefits, planner, FAQ.
- Courses/resources: distinguish available content from placeholders; don't imply a file or lesson exists unless it does.
- Practice/MCQ: prioritize legibility, clear option states, obvious feedback, and an uncluttered question layout.
- Admin/auth: don't imply security or backend persistence unless it is actually configured and tested.
- MCQ builder: show category and difficulty as chips; correct answer uses sage plus a check/text indicator, never color alone.

## QA checklist
- [ ] Test layout at 375, 768, 1024, 1440px.
- [ ] Confirm all Arabic pages remain RTL and labels don't clip.
- [ ] Verify text contrast >= 4.5:1.
- [ ] Test keyboard navigation and visible focus.
- [ ] Check reduced-motion behavior.
- [ ] Confirm buttons/inputs meet 44px touch target.
- [ ] Confirm forms provide clear feedback.
- [ ] Check navigation links and no accidental broken routes.
- [ ] Don't claim localStorage data is synced across devices.
