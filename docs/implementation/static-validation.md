# Static deployment validation

Run locally with Python 3.12 or let GitHub Actions run it on pushes and pull requests:

```bash
python scripts/validate_static_site.py
```

The check runs the same static build used by Netlify, verifies that public pages are Arabic RTL and include the shared Athar stylesheet and brand mark, checks local file references, and fails if the unprotected admin prototype enters `dist/`.

Known limitation: a legacy `/productos-badge.js` reference is treated as a warning because it is not present in this repository and appears to be an injected optional script. Remove the reference from pages if it is not required; do not add a guessed third-party script to make the check pass.

Passing this check is only a static build/reference check. It does not prove that authentication, database policies, uploads, email delivery, or deployed routes work in a live environment.
