# blocks-lander-03

Static implementation of the "Your Autonomous Work Copilot" hero section,
built from a Figma design. No build step, no dependencies — open `index.html`.

- **Pixel-exact at 1440×1029**, the design frame width. Below that the section is
  responsive: the card row wraps 3-up → 2-up → 1-up, and scales as a unit on
  narrow viewports (each card's contents are absolutely positioned against a
  fixed box, so the cards keep their design size rather than being resized).
- `assets/dot-matrix.js` — animated WebGL2 halftone layer on each card. It's a
  vanilla port of a React/`ogl` component; the shaders are unchanged. Palettes
  are sampled from each card's own artwork.

Run the script's self-checks (colour parsing + the UI→shader mappings) by
loading the page with `?selftest` and watching the console.

## Local

```
python3 -m http.server 4403
```
