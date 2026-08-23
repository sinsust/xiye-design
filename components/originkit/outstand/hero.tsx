"use client";

import Reveal from "./reveal";
import styles from "./hero.module.css";

export interface OutstandHeroStat {
  value: string;
  /** Rendered immediately after the value, e.g. the "+" in "50+". */
  suffix?: string;
  label: string;
}

export interface OutstandHeroProps {
  /** Badge shown above the headline (rating / social proof). */
  badge?: {
    text: string;
    starsIcon: string;
    avatarIcon: string;
  };
  heading?: string;
  subheading?: string;
  primaryCta?: { label: string; href: string };
  note?: { text: string; icon: string };
  stats?: OutstandHeroStat[];
  marquee?: {
    title: string;
    /** Logos cycle infinitely; the component duplicates the list itself. */
    logos: { src: string; alt: string }[];
  };
  background?: {
    pattern: string;
    lightLeft: string;
    lightRight: string;
  };
  /** Extra styles forwarded to the root <section> (e.g. CSS variable overrides). */
  style?: React.CSSProperties;
  className?: string;
  /**
   * Compact mode: removes the top padding (designed for use inside preview
   * containers or when there is no fixed header above the hero).
   */
  compact?: boolean;
}

const ASSET_BASE = "/originkit/outstand/hero";

const DEFAULT_BADGE = {
  text: "Rated 4.8 of 5",
  starsIcon: `${ASSET_BASE}/InL2lTTFiMLfaRpROnHZUbLtMKE.svg`,
  avatarIcon: `${ASSET_BASE}/WxkrmjQWjYAfP1IM3c93O6EITAc.svg`,
};

const DEFAULT_NOTE = {
  text: "Available Figma File with Editable Assets",
  icon: `${ASSET_BASE}/Q4pdwonAT329eMKcy1U33qS8WY.svg`,
};

const DEFAULT_STATS: OutstandHeroStat[] = [
  { value: "50", suffix: "+", label: "Projects completed" },
  { value: "16", suffix: "+", label: "Awards Received" },
  { value: "12", suffix: "+", label: "Years of experience" },
  { value: "20", suffix: "+", label: "Team members" },
];

const DEFAULT_MARQUEE = {
  title: "Preferred by top industry professionals",
  logos: [
    { src: `${ASSET_BASE}/NuGqmqFyhLOJdkv3Ya0E0w13WLU.svg`, alt: "Client logo" },
    { src: `${ASSET_BASE}/PxXY0ZbAPNduG77K1nPw4rKpL0.svg`, alt: "Client logo" },
    { src: `${ASSET_BASE}/fuF1KOkpWo5egYAcHSQgYR5K4R4.svg`, alt: "Client logo" },
    { src: `${ASSET_BASE}/u6slmmBj0EoSrOhCVCP1FiHnq3Y.svg`, alt: "Client logo" },
    { src: `${ASSET_BASE}/WkmGdT6X97LVdM5JygTrjsiyklU.svg`, alt: "Client logo" },
    { src: `${ASSET_BASE}/5db7fP9iHNnx9yrqLHhrahtHCpw.svg`, alt: "Client logo" },
  ],
};

const DEFAULT_BACKGROUND = {
  pattern: `${ASSET_BASE}/BtlaHSBVpP1o4SpXdJy2V9cdWF0.png`,
  lightLeft: `${ASSET_BASE}/uYkLP5SiUycWQryE3EWbrjbhiE.svg`,
  lightRight: `${ASSET_BASE}/OEy9gAODlW0zXdPu7Uts9Eeyk.svg`,
};

/**
 * Outstand Hero — dark-themed agency hero section.
 *
 * Features:
 * - Pattern background with drifting glow sprites
 * - Word-by-word headline reveal (framer-motion)
 * - Rating badge + headline + subheading + CTA
 * - 4-column stats row with card borders
 * - Infinite-scrolling client logo marquee
 *
 * Fully responsive: desktop / tablet / phone breakpoints included.
 */
export default function OutstandHero({
  badge = DEFAULT_BADGE,
  heading = "Modern, Cool, and Effective Template for Your Business",
  subheading = "Boost Your Brand with Our Sleek and Cutting-Edge Framer Template",
  primaryCta = { label: "Book a call", href: "https://cal.com" },
  note = DEFAULT_NOTE,
  stats = DEFAULT_STATS,
  marquee = DEFAULT_MARQUEE,
  background = DEFAULT_BACKGROUND,
  style,
  className,
  compact = false,
}: OutstandHeroProps) {
  return (
    <section
      className={`${styles.hero}${compact ? ` ${styles.compact}` : ""}${
        className ? ` ${className}` : ""
      }`}
      id="outstand-hero"
      style={style}
    >
      <div className={styles.background} aria-hidden="true">
        <div className={styles.pattern}>
          <img src={background.pattern} alt="" width={2886} height={1458} />
        </div>
        <div className={styles.fade} />
        <div className={`${styles.light} ${styles.lightLeft}`}>
          <img src={background.lightLeft} alt="" width={583} height={507} />
        </div>
        <div className={`${styles.light} ${styles.lightRight}`}>
          <img src={background.lightRight} alt="" width={583} height={507} />
        </div>
      </div>

      <div className={styles.container}>
        <div className={styles.intro}>
          <div className={styles.headingBlock}>
            <div className={styles.badge}>
              <img src={badge.avatarIcon} alt="" width={24} height={24} aria-hidden="true" />
              <img src={badge.starsIcon} alt="" width={100} height={20} aria-hidden="true" />
              <span className={styles.badgeText}>{badge.text}</span>
            </div>

            <div className={styles.textContainer}>
              <Reveal as="h1" className={styles.heading} split="word">
                {heading}
              </Reveal>
              <Reveal as="p" className={styles.subheading} delay={0.25}>
                {subheading}
              </Reveal>
            </div>
          </div>

          <div className={styles.ctaBlock}>
            <a
              href={primaryCta.href}
              className={styles.cta}
              target="_blank"
              rel="noreferrer"
            >
              {primaryCta.label}
            </a>
            <p className={styles.note}>
              <img src={note.icon} alt="" width={18} height={18} aria-hidden="true" />
              {note.text}
            </p>
          </div>
        </div>

        <div className={styles.lower}>
          <div className={styles.statsBlock}>
            <div className={styles.rule} aria-hidden="true" />
            <dl className={styles.stats}>
              {stats.map((stat) => (
                <div key={stat.label} className={styles.stat}>
                  <dt className="sr-only">{stat.label}</dt>
                  <dd className={styles.statValue}>
                    {stat.value}
                    {stat.suffix}
                  </dd>
                  <p className={styles.statLabel} aria-hidden="true">
                    {stat.label}
                  </p>
                </div>
              ))}
            </dl>
          </div>

          <div className={styles.marquee}>
            <p className={styles.marqueeTitle}>{marquee.title}</p>
            <div className={styles.marqueeViewport}>
              {/* Two identical halves make the -50% loop seamless. */}
              <div className={styles.marqueeTrack}>
                {[...marquee.logos, ...marquee.logos].map((logo, i) => (
                  <img
                    key={i}
                    src={logo.src}
                    alt={i < marquee.logos.length ? logo.alt : ""}
                    width={135}
                    height={45}
                    aria-hidden={i >= marquee.logos.length}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
