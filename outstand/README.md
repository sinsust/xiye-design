# Outstand — Next.js Template

A dark-themed agency website template, converted from a Framer export into a
clean Next.js App Router project with TypeScript, Tailwind and CSS Modules.

Every measurement, colour, font and breakpoint in this project was read out of
the original export's *computed styles* — not eyeballed from screenshots.

---

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3100.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3100 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |

**Requirements:** Node 18.18+ (developed on Node 24).

---

## Deployment

The whole site prerenders to static HTML — every route is `○ (Static)`. It will
run anywhere that hosts a Next.js app:

- **Vercel** — import the repo, no configuration needed.
- **Netlify / Cloudflare** — use their Next.js adapter.
- **Self-hosted** — `npm run build && npm run start` behind a reverse proxy.

Before going live, set your real domain in `config/site.ts` → `url`. It drives
canonical tags, Open Graph URLs, `sitemap.xml` and `robots.txt`.

---

## Project structure

```
app/
  layout.tsx              Root: <html>/<body>, global metadata
  (site)/                 Pages that share the header + footer
    layout.tsx            Header, <main>, Footer
    page.tsx              Home
    about/ services/ works/ contact/ privacy-policy/
  404-preview/            The 404 design, viewable as a normal route
  not-found.tsx           The real 404 handler
  sitemap.ts  robots.ts

components/
  layout/    Header, MobileMenu, Footer
  motion/    Reveal — scroll/appear animation wrapper
  sections/  Hero (hand-built) + one folder per page
    home/ about/ services/ works/ contact/ privacy-policy/ not-found/
  ui/

config/
  site.ts        Brand, logo, contact details, default SEO
  navigation.ts  Header tabs, "All pages" menu, footer columns, socials

data/
  hero.ts    Homepage hero content
  footer.ts  Footer CTA copy

styles/
  globals.css  Reset, page shell, accessibility, motion
  tokens.css   Colours, fonts, spacing, easing
  fonts.css    Self-hosted @font-face rules

public/assets/
  media/   276 images and SVGs
  fonts/   24 woff2 files
```

### How the sections are organised

Each page's `page.tsx` lists its sections in order — open
`app/(site)/page.tsx` and you can see the whole homepage at a glance, and
reorder, remove or swap any section by editing that list.

The original export contained roughly 3,300 named elements across 40+ sections.
Those were converted mechanically from the captured computed styles into
`components/sections/<page>/<Section>.tsx` plus a matching CSS Module.

They are ordinary, readable React and CSS — edit them directly. Class names come
from the original Framer layer names (`heroContainer`, `benefitsCard`, `tag`),
and identical style blocks are shared rather than repeated.

`components/sections/Hero.tsx` is hand-written as the reference for how to
refactor a generated section into a fully data-driven one: content lives in
`data/hero.ts`, the markup is semantic, and the headline reveal is a component.
Follow that pattern for any section whose content you want to make editable.

---

## Customising

### Site-wide settings
`config/site.ts` — brand name, tagline, production URL, logo, favicon, contact
details, and the primary call-to-action used by the header.

### Navigation
`config/navigation.ts` — header tabs (`mainNav`), the "All pages" dropdown
(`allPagesMenu`), the four footer columns (`footerNav`), and social links.

### Text and images
Hero and footer copy live in `data/hero.ts` and `data/footer.ts`. All other
section copy sits inline in its generated component — search for the phrase and
edit it in place.

Images are plain files under `public/assets/media/`. Replace a file, keep the
name, and every reference updates. To swap one image, change its path in the
component. Keep the original aspect ratio or adjust the `width`/`height` props
alongside it.

### Logo
`config/site.ts` → `logo`. Point `src` at your own file and set `width`/`height`
to its intrinsic size.

### Colours
`styles/tokens.css`. Change `--color-accent` to rebrand the lime highlight
everywhere. Dark surfaces are `--color-ink-*` (950 is the page background,
rising to 500), and neutral text is `--color-mist-*`.

The `--token-*` aliases at the bottom of that file map the original Framer token
IDs onto the semantic names. Leave them; they are what let the generated CSS
resolve without renaming thousands of references.

### Fonts
`styles/tokens.css` → `--font-heading`, `--font-body`, `--font-ui`. The files
themselves are in `public/assets/fonts/`, wired up in `styles/fonts.css`.

The `* Placeholder` faces are metric-matched local fallbacks that keep the layout
stable before the webfont loads — don't delete them.

### Pricing, testimonials, FAQs, team
These live in their generated section components
(`components/sections/home/PricingPlan.tsx`, `Faq.tsx`,
`Testimonials.tsx`, `about/TeamMembers.tsx`, and so on). Each repeated card is a
sibling block — copy one to add an entry, delete one to remove it. To make a set
fully data-driven, extract it into `data/` following `data/hero.ts`.

### Adding or removing a page
Add: create `app/(site)/your-page/page.tsx`, export a `metadata` object, add the
route to `app/sitemap.ts`, and link it from `config/navigation.ts`.

Remove: delete the folder and its entries in `config/navigation.ts` and
`app/sitemap.ts`.

### Animations
`components/motion/Reveal.tsx` reproduces Framer's appear animation — 0.8s,
20px rise, `cubic-bezier(0.44, 0, 0.56, 1)`. Pass `split="word"` to stagger a
headline word by word, or `delay` to offset it.

Marquees and the hero glow are pure CSS keyframes in the relevant module. Timing
tokens are in `styles/tokens.css` (`--duration-appear`, `--duration-hover`,
`--ease-out-framer`).

Everything is wrapped in `prefers-reduced-motion` guards — reduced-motion users
get the final state immediately, never a hidden element.

### SEO
Defaults in `config/site.ts` → `seo`. Per-page titles and descriptions are the
`metadata` export in each `page.tsx`, carried over from the original export.

`app/sitemap.ts` and `app/robots.ts` generate `/sitemap.xml` and `/robots.txt`.
Add an OG image at `public/assets/media/og-default.png` (referenced by
`site.seo.ogImage`) — the original export did not ship one.

### Forms
The contact section is currently presentational markup carried over from the
export. The original posted to a private Framer endpoint, which was removed
rather than reproduced. Wire the fields to your own handler — a route handler
under `app/api/`, or a service like Formspree — before shipping.

---

## Accessibility

Added during conversion, without changing the visual design:

- Semantic landmarks and a "Skip to content" link
- Visible focus rings (`:focus-visible`) — the export had none
- Mobile menu as a labelled dialog with focus trapping, Escape to close, and a
  scroll lock
- `aria-current="page"` on the active nav tab; `aria-expanded` on the dropdown
- Decorative imagery marked `aria-hidden`; icon-only buttons given text labels
- `prefers-reduced-motion` respected throughout

---

## Asset licensing

The three typefaces are all under the **SIL Open Font License 1.1**, which
permits redistribution — including in a template you sell:

| Font | Use |
| --- | --- |
| Rethink Sans | Headings and UI |
| Manrope | Body |
| Inter | Interface details |

Keep the OFL notice with the font files if you redistribute them.

**Imagery is a different matter.** The photographs, logos, avatars and
illustrations under `public/assets/media/` came from the original Framer
template. Confirm you hold redistribution rights for them before selling or
publishing this template — client logos and stock photography in particular are
often licensed for use, not resale. Replace anything you cannot clear.

---

## Known differences from the original export

Verified by measuring both versions at 1440 / 1024 / 390 and comparing rendered
heights. Everything below is either intentional or measured.

**Intentional, per the conversion brief**

- The blog is gone: no `/blogs` routes, no blog detail pages, no homepage Blogs
  section, and no Blogs links in the header or footer. This accounts for the
  entire homepage height difference (−7.5% desktop / −7.6% tablet / −8.4% phone);
  once the removed section and its 180px gap are added back, the homepage lands
  within 0.2% of the original.
- The Framer floating badge and the "Template by Praha" footer credit were both
  removed. A copyright line now occupies the footer's bottom-left slot.
- The `website-downloader.com` banner baked into the export is not reproduced —
  it was injected by the tool that captured the HTML.
- Framer's runtime bundle, analytics beacon and edit hooks are gone. Nothing
  loads from a Framer CDN.

**Measured differences**

| Page | Desktop | Tablet | Phone |
| --- | --- | --- | --- |
| about | −0.4% | −0.6% | −0.0% |
| services | −0.3% | −0.4% | −0.0% |
| works | −0.5% | +1.0% | +0.8% |
| contact | −0.9% | −1.1% | −0.1% |
| privacy-policy | −1.1% | +2.4% | +2.3% |
| 404 | 0.0% | 0.0% | 0.0% |

Residual deltas come from text wrapping at slightly different points, and from decorative layers the Framer runtime
positions with JavaScript. No horizontal overflow at any tested width.

**Not reproduced exactly**

- **Mobile menu.** Framer injects this panel at runtime, so its open state could
  not be captured from the static export. It is rebuilt from the template's own
  design language and given proper dialog semantics. Behaviour matches; exact
  pixel values are a reconstruction.
- **Hero canvas glow.** The export ran a `<canvas>` code component behind the
  hero light sprites. The sprites and their entrance animation are reproduced in
  CSS; the canvas particle effect is not.
- **Contact form.** Presentational only, as described above.
- **Scroll-linked effects.** Framer's scroll-driven transforms are reproduced as
  viewport-triggered reveals rather than continuously scroll-linked motion.

---

## Verification

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Passes, 0 errors |
| ESLint (`--max-warnings 0`) | Passes, 0 warnings |
| Production build | Succeeds, 12/12 routes prerendered static |
| Console / page errors | 0 across all pages and viewports |
| Broken asset requests | 0 |
| Horizontal overflow | None at 1440, 1280, 1024, 834, 768, 430, 390, 375 |
| Framer CDN references | None |

---

## License

Placeholder — add your own license before distributing. See **Asset licensing**
above regarding third-party imagery.
