'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ElementType, ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  /** Element to render. Defaults to a div. */
  as?: ElementType;
  className?: string;
  /** Seconds to wait before the animation starts. */
  delay?: number;
  /**
   * 'word' staggers the reveal one word at a time, matching the export's
   * split headline. Anything else fades the whole block in as one piece.
   */
  split?: 'word' | 'none';
  /** Fraction of the element that must be visible before it triggers. */
  amount?: number;
}

/**
 * Scroll-reveal wrapper reproducing Framer's default appear animation:
 * a 0.8s rise from 20px with a cubic-bezier(0.44, 0, 0.56, 1) curve.
 *
 * Word splitting happens here rather than in the content files, so copy in
 * data/ stays plain readable text. Respects prefers-reduced-motion — reduced
 * users get the final state immediately, never a hidden element.
 */
export default function Reveal({
  children,
  as = 'div',
  className,
  delay = 0,
  split = 'none',
  amount = 0.3,
}: RevealProps) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as as keyof typeof motion] as typeof motion.div;

  const ease = [0.44, 0, 0.56, 1] as const;

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  if (split === 'word' && typeof children === 'string') {
    const words = children.split(' ');
    return (
      <MotionTag
        className={className}
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, amount }}
        transition={{ staggerChildren: 0.035, delayChildren: delay }}
      >
        {words.map((word, i) => (
          <motion.span
            key={`${word}-${i}`}
            style={{ display: 'inline-block', willChange: 'transform, opacity' }}
            variants={{
              hidden: { opacity: 0, y: 20 },
              shown: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.8, ease }}
          >
            {word}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        ))}
      </MotionTag>
    );
  }

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.8, ease, delay }}
    >
      {children}
    </MotionTag>
  );
}
