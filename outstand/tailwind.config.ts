import type { Config } from 'tailwindcss';

/**
 * Breakpoints mirror the original Framer export exactly:
 *   Desktop  >= 1320px
 *   Tablet   810px - 1319px
 *   Phone    <= 809px
 *
 * Tailwind's default screens are intentionally replaced so that utility
 * classes never disagree with the hand-written CSS in styles/ and the
 * component CSS Modules.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './config/**/*.{ts,tsx}',
    './data/**/*.{ts,tsx}',
  ],
  theme: {
    screens: {
      tablet: '810px',
      desktop: '1320px',
    },
    extend: {
      colors: {
        // Mapped to the CSS custom properties defined in styles/tokens.css
        ink: {
          950: 'var(--color-ink-950)',
          900: 'var(--color-ink-900)',
          850: 'var(--color-ink-850)',
          800: 'var(--color-ink-800)',
          700: 'var(--color-ink-700)',
          600: 'var(--color-ink-600)',
          500: 'var(--color-ink-500)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          soft: 'var(--color-accent-soft)',
          muted: 'var(--color-accent-muted)',
          tint: 'var(--color-accent-tint)',
        },
        mist: {
          100: 'var(--color-mist-100)',
          200: 'var(--color-mist-200)',
          300: 'var(--color-mist-300)',
          400: 'var(--color-mist-400)',
          500: 'var(--color-mist-500)',
          600: 'var(--color-mist-600)',
        },
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
        ui: 'var(--font-ui)',
      },
      maxWidth: {
        shell: 'var(--shell-max-width)',
      },
    },
  },
  plugins: [],
};

export default config;
