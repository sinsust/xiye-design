'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { site } from '@/config/site';
import { allPagesMenu } from '@/config/navigation';
import styles from './MobileMenu.module.css';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Full-screen menu for tablet and phone.
 *
 * In the export this panel is injected at runtime by the Framer bundle, so its
 * open state could not be captured from the static HTML. It is rebuilt here
 * from the template's own design language — the same pill container, translucent
 * ink surface and accent CTA used by the header — and is documented as a known
 * difference in the README.
 *
 * Behaviour added over the original: focus is trapped while open, Escape closes,
 * and background scrolling is locked.
 */
export default function MobileMenu({ open, onClose }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.dataset.menuOpen = open ? 'true' : 'false';
    return () => {
      delete document.body.dataset.menuOpen;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (!focusables?.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div
      className={`${styles.root} ${open ? styles.open : ''}`}
      aria-hidden={!open}
      inert={!open}
    >
      <div className={styles.scrim} onClick={onClose} />

      <div
        id="mobile-menu"
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <div className={styles.panelHead}>
          <Link href="/" className={styles.logo} onClick={onClose}>
            <Image
              src={site.logo.src}
              alt={site.logo.alt}
              width={site.logo.width}
              height={site.logo.height}
            />
          </Link>

          <button
            type="button"
            ref={closeRef}
            className={styles.close}
            onClick={onClose}
          >
            <span className="sr-only">Close menu</span>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <nav className={styles.links} aria-label="Mobile">
          {allPagesMenu.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.link}
              onClick={onClose}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link href={site.cta.href} className={styles.cta} onClick={onClose}>
          {site.cta.label}
        </Link>
      </div>
    </div>
  );
}
