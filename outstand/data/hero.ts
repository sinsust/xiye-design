/**
 * Homepage hero content.
 *
 * In the export the headline was split into one <span> per character to drive
 * Framer's text-reveal animation. Here it stays a plain string — the Reveal
 * component does the splitting at render time, so you edit normal sentences.
 */

export interface HeroStat {
  value: string;
  /** Rendered immediately after the value, e.g. the "+" in "50+". */
  suffix?: string;
  label: string;
}

export interface HeroContent {
  badge: {
    text: string;
    starsIcon: string;
    avatarIcon: string;
  };
  heading: string;
  subheading: string;
  primaryCta: { label: string; href: string };
  note: { text: string; icon: string };
  stats: HeroStat[];
  marquee: {
    title: string;
    /** Logos cycle infinitely; the component duplicates the list itself. */
    logos: { src: string; alt: string }[];
  };
  background: {
    pattern: string;
    lightLeft: string;
    lightRight: string;
  };
}

export const hero: HeroContent = {
  badge: {
    text: 'Rated 4.8 of 5',
    starsIcon: '/assets/media/InL2lTTFiMLfaRpROnHZUbLtMKE.svg',
    avatarIcon: '/assets/media/WxkrmjQWjYAfP1IM3c93O6EITAc.svg',
  },

  heading: 'Modern, Cool, and Effective Template for Your Business',
  subheading:
    'Boost Your Brand with Our Sleek and Cutting-Edge Framer Template',

  primaryCta: { label: 'Book a call', href: 'https://cal.com' },

  note: {
    text: 'Available Figma File with Editable Assets',
    icon: '/assets/media/Q4pdwonAT329eMKcy1U33qS8WY.svg',
  },

  stats: [
    { value: '50', suffix: '+', label: 'Projects completed' },
    { value: '16', suffix: '+', label: 'Awards Received' },
    { value: '12', suffix: '+', label: 'Years of experience' },
    { value: '20', suffix: '+', label: 'Team members' },
  ],

  marquee: {
    title: 'Preferred by top industry professionals',
    logos: [
      { src: '/assets/media/NuGqmqFyhLOJdkv3Ya0E0w13WLU.svg', alt: 'Client logo' },
      { src: '/assets/media/PxXY0ZbAPNduG77K1nPw4rKpL0.svg', alt: 'Client logo' },
      { src: '/assets/media/fuF1KOkpWo5egYAcHSQgYR5K4R4.svg', alt: 'Client logo' },
      { src: '/assets/media/u6slmmBj0EoSrOhCVCP1FiHnq3Y.svg', alt: 'Client logo' },
      { src: '/assets/media/WkmGdT6X97LVdM5JygTrjsiyklU.svg', alt: 'Client logo' },
      { src: '/assets/media/5db7fP9iHNnx9yrqLHhrahtHCpw.svg', alt: 'Client logo' },
    ],
  },

  background: {
    pattern: '/assets/media/BtlaHSBVpP1o4SpXdJy2V9cdWF0.png',
    lightLeft: '/assets/media/uYkLP5SiUycWQryE3EWbrjbhiE.svg',
    lightRight: '/assets/media/OEy9gAODlW0zXdPu7Uts9Eeyk.svg',
  },
};
