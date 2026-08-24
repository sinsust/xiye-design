'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { site } from '@/config/site';
import { allPagesMenu, mainNav } from '@/config/navigation';
import MobileMenu from './MobileMenu';
import styles from './Header.module.css';

/**
 * Fixed pill-shaped header.
 *
 * The export shipped three separate <nav> elements — one per breakpoint —
 * and hid two of them with CSS. This renders a single nav and lets the
 * stylesheet swap the tabs for a hamburger, which keeps the DOM smaller and
 * avoids duplicate landmarks for screen readers.
 */
export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close the "All pages" dropdown on outside click or Escape.
  useEffect(() => {
    if (!pagesOpen) return;

    const onPointerDown = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setPagesOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPagesOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pagesOpen]);

  // Route changes should always dismiss both menus.
  useEffect(() => {
    setMenuOpen(false);
    setPagesOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <div className={styles.wrap}>
        <nav className={styles.nav} aria-label="Main">
          <div className={styles.bar} data-border="true">
            <Link href="/" className={styles.logo} aria-label={`${site.name} — home`}>
              <Image
                src={site.logo.src}
                alt={site.logo.alt}
                width={site.logo.width}
                height={site.logo.height}
                priority
              />
            </Link>

            <div className={styles.tabs}>
              {mainNav.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`${styles.tab} ${isActive(link.href) ? styles.tabActive : ''}`}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                  data-border={isActive(link.href) ? 'true' : undefined}
                >
                  {link.label}
                </Link>
              ))}

              <div className={styles.dropdown} ref={dropdownRef}>
                <button
                  type="button"
                  className={styles.dropdownTrigger}
                  aria-expanded={pagesOpen}
                  aria-haspopup="true"
                  onClick={() => setPagesOpen((v) => !v)}
                >
                  All pages
                  <svg
                    className={styles.chevron}
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>

                {pagesOpen && (
                  <ul className={styles.dropdownMenu}>
                    {allPagesMenu.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} className={styles.dropdownItem}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <Link href={site.cta.href} className={styles.cta}>
              {site.cta.label}
              <span className={styles.ctaShine} aria-hidden="true" />
            </Link>

            <button
              type="button"
              className={styles.burger}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen(true)}
            >
              <span className="sr-only">Open menu</span>
              <Image
                src="/assets/media/tIEQjQ5QDx1TzUHLSEdkAOUig.svg"
                alt=""
                width={24}
                height={24}
                aria-hidden="true"
              />
            </button>
          </div>
        </nav>
      </div>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
