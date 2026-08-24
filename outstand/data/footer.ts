/**
 * Footer call-to-action copy.
 *
 * The headline is split into parts so you can pick out phrases in the brand
 * accent colour without touching JSX — set `accent: true` on any part.
 */

export interface HeadlinePart {
  text: string;
  accent?: boolean;
}

export interface FooterCta {
  eyebrow: string;
  headline: HeadlinePart[];
  button: { label: string; href: string };
}

export const footerCta: FooterCta = {
  eyebrow: 'What are you waiting for?',
  headline: [
    { text: 'Get a ' },
    { text: 'stunning website designed', accent: true },
    { text: ' and ' },
    { text: 'online', accent: true },
    { text: ' within the next 10 days.' },
  ],
  button: {
    label: 'Get In Touch',
    href: '/contact',
  },
};
