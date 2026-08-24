# Changelog

## 1.0.0

Initial release — converted from the Framer export into Next.js.

### Added
- Next.js 15 App Router project: TypeScript, Tailwind, CSS Modules
- 7 routes: home, about, services, works, contact, privacy policy, 404
- 52 section components across the included pages
- Self-hosted Inter, Manrope and Rethink Sans (SIL OFL); no Google Fonts requests
- 276 images and SVGs served locally; no Framer CDN dependency
- Design tokens in `styles/tokens.css`, with the original Framer token IDs aliased
- Editable config (`config/site.ts`, `config/navigation.ts`) and data (`data/`)
- `Reveal` motion component reproducing Framer's appear animation
- `sitemap.xml` and `robots.txt`
- Accessibility: skip link, focus-visible rings, dialog semantics and focus
  trapping for the mobile menu, `aria-current`, `prefers-reduced-motion`

### Removed
- Blog: `/blogs`, 12 blog detail pages, the homepage Blogs section, and all
  header/footer links to them
- Framer floating badge and the "Template by Praha" footer credit
- Framer runtime bundle, analytics beacon and edit hooks
- The `website-downloader.com` banner present in the source export
- The private form endpoint from the contact section

### Notes
- Breakpoints match the original exactly: 1320px and 810px
- See "Known differences from the original export" in README.md
