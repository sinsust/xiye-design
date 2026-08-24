/**
 * Site-wide settings.
 *
 * This is the first file to edit when you rebrand the template: name, logo,
 * contact details, social profiles and default SEO all live here.
 */

export interface SiteConfig {
  /** Brand name, used in <title> suffixes and the footer. */
  name: string;
  /** Short tagline shown in the footer under the logo. */
  tagline: string;
  /** Absolute production URL — drives canonical tags, OG urls and the sitemap. */
  url: string;
  /** Default metadata used by the root layout and any page that omits its own. */
  seo: {
    title: string;
    description: string;
    /** Relative path to the Open Graph image under /public. */
    ogImage: string;
    twitterCard: 'summary' | 'summary_large_image';
  };
  logo: {
    src: string;
    /** Intrinsic dimensions of the logo file, so next/image can reserve space. */
    width: number;
    height: number;
    alt: string;
  };
  favicon: string;
  contact: {
    email: string;
    phone: string;
    address: string;
    /** Booking link used by the "Book a call" style buttons. */
    bookingUrl: string;
    /** Google Maps embed URL shown on the contact page. */
    mapEmbedUrl: string;
  };
  /** Primary call-to-action reused by the header and several sections. */
  cta: {
    label: string;
    href: string;
  };
}

export const site: SiteConfig = {
  name: 'Outstand',
  tagline: 'A digital agency crafting brands that stand out.',
  url: 'https://outstand-template.vercel.app',

  seo: {
    title: 'Outstand - Dark-Themed Website Template for Agencies',
    description:
      'Outstand is a sleek, dark-themed website template for agencies. It features a modern design, customizable layout, and integrated forms and testimonials. Perfect for showcasing services and portfolios.',
    ogImage: '/assets/media/og-default.png',
    twitterCard: 'summary_large_image',
  },

  logo: {
    src: '/assets/media/KKswWevWvaoMFDub0uUjHAlCDcE.svg',
    width: 136,
    height: 51,
    alt: 'Outstand',
  },

  favicon: '/assets/media/AOOKi1u965qLECq73L2IK3LcQs.svg',

  contact: {
    email: 'hello@example.com',
    phone: '+1 (555) 000-0000',
    address: '123 Example Street, Suite 100, San Francisco, CA',
    bookingUrl: 'https://cal.com/',
    // Swap the q= coordinates (or use a place name) to move the pin.
    mapEmbedUrl:
      'https://maps.google.com/maps?q=52.37588,4.891295&z=15&output=embed',
  },

  cta: {
    label: 'Contact Us',
    href: '/contact',
  },
};
