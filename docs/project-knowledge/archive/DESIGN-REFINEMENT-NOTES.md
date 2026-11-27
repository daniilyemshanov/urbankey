# URBAN KEY — original color palette restored

This revision restores the exact original brand palette from the pre-design project source:

- original dark background, card, text, gray, border and gold accent tokens;
- original light-mode palette;
- original component-level colors where the refinement pass had introduced muted beige/olive/brown tones;
- original map marker and button brand colors.

Non-color refinements from the design pass remain where possible: reduced motion distances, gentler hover movement, removal of pulse animation, reduced decorative shadows, and simpler surfaces. No product logic, routes, API behavior, SEO behavior, or data flows were changed in this palette-restoration pass.

The source palette was restored by comparing against `URBANKEY_SEO_IMPLEMENTED_SOURCE.zip`, which predates the design refinement. Production build and browser visual regression were not run in this environment.
