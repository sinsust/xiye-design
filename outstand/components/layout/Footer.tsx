import Image from 'next/image';
import Link from 'next/link';

import { site } from '@/config/site';
import { footerNav } from '@/config/navigation';
import { footerCta } from '@/data/footer';
import styles from './Footer.module.css';

/**
 * Site footer: a CTA block beside four link columns, over a thin bottom bar.
 *
 * Server component — nothing here needs client-side state.
 */
export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container} data-border="true">
        <div className={styles.upper}>
          <div className={styles.ctaBlock}>
            <p className={styles.eyebrow}>{footerCta.eyebrow}</p>

            <h2 className={styles.headline}>
              {footerCta.headline.map((part, i) =>
                part.accent ? (
                  <em key={i}>{part.text}</em>
                ) : (
                  <span key={i}>{part.text}</span>
                )
              )}
            </h2>

            <Link href={footerCta.button.href} className={styles.ctaButton}>
              {footerCta.button.label}
            </Link>
          </div>

          <div className={styles.columns}>
            {footerNav.map((col) => (
              <div
                key={col.title}
                className={`${styles.column} ${
                  col.title === 'Pages' ? styles.columnPages : ''
                }`}
              >
                <h3 className={styles.columnTitle}>{col.title}</h3>
                <ul className={styles.columnList}>
                  {col.links.map((link) => (
                    <li key={`${col.title}-${link.href}-${link.label}`}>
                      <Link href={link.href} className={styles.columnLink}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <Link href="/#hero" className={styles.backToTop}>
            Back to top
            <span className={styles.arrowContainer}>
              <Image
                src="/assets/media/h29DxyfSDDNyTy6EiLnetnpzs.svg"
                alt=""
                width={18}
                height={18}
                aria-hidden="true"
              />
            </span>
          </Link>
        </div>
      </div>
    </footer>
  );
}
