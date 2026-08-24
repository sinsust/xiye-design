'use client';

import { useEffect, useRef } from 'react';
import styles from './ProjectScreens.module.css';

/**
 * Makes the thumbnail strip inside each project card drive the big screen.
 *
 * Each card holds one large screenshot plus a strip of thumbnails of the same
 * project. Selecting a thumbnail swaps it with the large image, so the strip
 * always shows the screens that are not currently enlarged.
 *
 * Implemented as a delegating wrapper rather than by editing the section
 * markup, so regenerating the sections cannot undo it.
 *
 * Note on hit-testing: every image sits under a transparent overlay div, so the
 * click target is never the <img> itself and never contains one. The image has
 * to be found by walking *up* from the target.
 */
export default function ProjectScreens({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const widthOf = (n: Element) => n.getBoundingClientRect().width;

    /** Nearest ancestor of the click target that actually holds an image. */
    const imageFromTarget = (target: EventTarget | null): HTMLImageElement | null => {
      if (!(target instanceof Element)) return null;
      let node: Element | null = target;
      for (let i = 0; i < 5 && node && node !== el; i += 1) {
        const img = node.querySelector('img');
        if (img) return img as HTMLImageElement;
        node = node.parentElement;
      }
      return null;
    };

    /** The card is the nearest ancestor holding a clearly larger image. */
    const cardOf = (img: HTMLImageElement) => {
      const w = widthOf(img);
      let node: HTMLElement | null = img.parentElement;
      for (let i = 0; i < 10 && node && node !== el; i += 1) {
        const bigger = [...node.querySelectorAll('img')].some((o) => widthOf(o) > w * 1.5);
        if (bigger) return node;
        node = node.parentElement;
      }
      return null;
    };

    const select = (thumb: HTMLImageElement) => {
      const card = cardOf(thumb);
      if (!card) return;

      const imgs = [...card.querySelectorAll('img')] as HTMLImageElement[];
      const main = imgs.reduce((a, b) => (widthOf(b) > widthOf(a) ? b : a));
      if (!main || main === thumb || main.src === thumb.src) return;

      const src = main.src;
      const set = main.srcset;
      main.classList.add(styles.swapping);
      thumb.classList.add(styles.swapping);

      window.setTimeout(() => {
        main.src = thumb.src;
        main.srcset = thumb.srcset;
        thumb.src = src;
        thumb.srcset = set;
        main.classList.remove(styles.swapping);
        thumb.classList.remove(styles.swapping);
      }, 130);
    };

    const onClick = (e: Event) => {
      const img = imageFromTarget(e.target);
      if (!img) return;
      const card = cardOf(img);
      if (!card) return; // the large image has no larger sibling, so it is ignored
      select(img);
    };

    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, []);

  return (
    <div ref={root} className={styles.root}>
      {children}
    </div>
  );
}
