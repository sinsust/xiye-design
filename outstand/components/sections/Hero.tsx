import Image from 'next/image';
import Link from 'next/link';

import { hero } from '@/data/hero';
import Reveal from '@/components/motion/Reveal';
import styles from './Hero.module.css';

/**
 * Homepage hero: rating badge, headline, CTA, stat row and a looping
 * client-logo marquee, over a fading pattern with two drifting glow sprites.
 *
 * Server component. Only the headline reveal opts into the client, via Reveal.
 */
export default function Hero() {
  return (
    <section className={styles.hero} id="hero">
      <div className={styles.background} aria-hidden="true">
        <div className={styles.pattern}>
          <Image
            src={hero.background.pattern}
            alt=""
            width={2886}
            height={1458}
            priority
            sizes="100vw"
          />
        </div>
        <div className={styles.fade} />
        <div className={`${styles.light} ${styles.lightLeft}`}>
          <Image src={hero.background.lightLeft} alt="" width={583} height={507} />
        </div>
        <div className={`${styles.light} ${styles.lightRight}`}>
          <Image src={hero.background.lightRight} alt="" width={583} height={507} />
        </div>
      </div>

      <div className={styles.container}>
        <div className={styles.intro}>
          <div className={styles.headingBlock}>
            <div className={styles.badge}>
              <Image
                src={hero.badge.avatarIcon}
                alt=""
                width={24}
                height={24}
                aria-hidden="true"
              />
              <Image
                src={hero.badge.starsIcon}
                alt=""
                width={100}
                height={20}
                aria-hidden="true"
              />
              <span className={styles.badgeText}>{hero.badge.text}</span>
            </div>

            <div className={styles.textContainer}>
              <Reveal as="h1" className={styles.heading} split="word">
                {hero.heading}
              </Reveal>
              <Reveal as="p" className={styles.subheading} delay={0.25}>
                {hero.subheading}
              </Reveal>
            </div>
          </div>

          <div className={styles.ctaBlock}>
            <Link
              href={hero.primaryCta.href}
              className={styles.cta}
              target="_blank"
              rel="noreferrer"
            >
              {hero.primaryCta.label}
            </Link>
            <p className={styles.note}>
              <Image
                src={hero.note.icon}
                alt=""
                width={18}
                height={18}
                aria-hidden="true"
              />
              {hero.note.text}
            </p>
          </div>
        </div>

        <div className={styles.lower}>
          <div className={styles.statsBlock}>
            <div className={styles.rule} aria-hidden="true" />
            <dl className={styles.stats}>
              {hero.stats.map((stat) => (
                <div key={stat.label} className={styles.stat} data-border="true">
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
            <p className={styles.marqueeTitle}>{hero.marquee.title}</p>
            <div className={styles.marqueeViewport}>
              {/* Two identical halves make the -50% loop seamless. */}
              <div className={styles.marqueeTrack}>
                {[...hero.marquee.logos, ...hero.marquee.logos].map((logo, i) => (
                  <Image
                    key={i}
                    src={logo.src}
                    alt={i < hero.marquee.logos.length ? logo.alt : ''}
                    width={135}
                    height={45}
                    aria-hidden={i >= hero.marquee.logos.length}
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
