/**
 * Navigation.
 *
 * `mainNav` drives the desktop header tabs and the mobile menu.
 * `allPagesMenu` is the "All pages" dropdown in the desktop header.
 * `footerNav` drives the four link columns in the footer.
 *
 * The original template shipped a Blogs page; it was excluded from this
 * conversion, so no Blogs entries appear here or anywhere else.
 */

export interface NavLink {
  label: string;
  href: string;
  /** External links open in a new tab and get rel="noreferrer". */
  external?: boolean;
}

export interface NavColumn {
  title: string;
  links: NavLink[];
}

/** Header tabs, in order, left to right. */
export const mainNav: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Works', href: '/works' },
];

/** Contents of the "All pages" dropdown in the desktop header. */
export const allPagesMenu: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Works', href: '/works' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: '404', href: '/404-preview' },
];

/** Footer link columns, in order, left to right. */
export const footerNav: NavColumn[] = [
  {
    title: 'Pages',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Services', href: '/services' },
      { label: 'Works', href: '/works' },
      { label: 'Contact', href: '/contact' },
      { label: '404', href: '/404-preview' },
      { label: 'Privacy Policy', href: '/privacy-policy' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Why Us', href: '/#why-us' },
      { label: 'Expertise', href: '/#expertise' },
      { label: 'Benefits', href: '/#benefits' },
      { label: 'Features', href: '/#features' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    title: 'Info',
    links: [
      { label: 'Values', href: '/#values' },
      { label: 'FAQ’s', href: '/#faq' },
      { label: 'Testimonials', href: '/#testimonials' },
    ],
  },
  {
    title: 'Other',
    links: [
      { label: 'Services', href: '/services#services' },
      { label: 'Careers', href: '/about#careers' },
      { label: 'Payment', href: '/services#payment' },
      { label: 'Our Story', href: '/about#our-story' },
      { label: 'Our Culture', href: '/about#our-culture' },
      { label: 'Our Team', href: '/about#our-team' },
    ],
  },
];

/** Social profiles, used by the footer and the contact page. */
export const socialLinks: NavLink[] = [
  { label: 'X', href: 'https://x.com/', external: true },
  { label: 'Instagram', href: 'https://www.instagram.com/', external: true },
  { label: 'Facebook', href: 'https://www.facebook.com/', external: true },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/', external: true },
];
