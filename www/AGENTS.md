# AGENTS

## Purpose
This repository is a lightweight static frontend for Durga Sarees, built with plain HTML, CSS, and JavaScript.

## Key files
- `index.html`: single-page app markup, login screen, search, cart, product detail slide, modals, and WhatsApp share actions.
- `app.js`: app state, localStorage, login flow, product loading, filtering, cart behavior, and UI interactions.
- `style.css`: mobile-first styling, fixed bottom nav / controls, modal layout, and responsive card/grid rules.

## What AI agents should know
- There is no build tool or package manager; changes are deployed by editing files directly.
- `app.js` depends on a backend endpoint configured via `BACKEND_API_URL`. Do not remove or rename that constant without confirming the backend integration.
- UI event wiring is done via inline attributes in `index.html` and DOM queries in `app.js`; keep the current element IDs and modal IDs intact when refactoring.
- The app is designed for mobile-first behavior with fixed bottom controls, a slide-out detail panel, and a floating WhatsApp action button.
- Avoid introducing new dependencies unless the user explicitly asks for a modernization or migration.

## Recommended agent behavior
- Preserve existing app semantics when editing stateful code in `app.js`.
- Prefer small, targeted fixes over broad rewrites in this small repo.
- If asked to add features, update both `index.html` and `app.js` together to keep markup and script behavior aligned.
- Do not assume a backend schema beyond the existing `getProducts` call and token-based login flow.

## Notes for Gemini / code agents
- Focus on code correctness, DOM consistency, and safe refactoring.
- Use the current app structure as the primary source of truth.
- If a backend URL is required, instruct the user to replace the placeholder in `app.js`.
