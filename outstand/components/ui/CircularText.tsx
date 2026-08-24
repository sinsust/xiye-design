import styles from './CircularText.module.css';

interface CircularTextProps {
  /** Full ring of text. Repeat the phrase yourself to control the spacing. */
  text: string;
  /** Seconds for one full revolution. */
  duration?: number;
  /** Anticlockwise when true. */
  reverse?: boolean;
  fontSize?: number;
  className?: string;
}

/**
 * Text set on a circular path, revolving continuously.
 *
 * The original drove the rotation from JavaScript, re-rendering the SVG
 * transform on every frame. A CSS animation produces the same result without
 * the runtime, and honours prefers-reduced-motion.
 *
 * The path and viewBox are carried over from the export so the glyph spacing
 * around the ring is identical.
 */
export default function CircularText({
  text,
  duration = 20,
  reverse = false,
  fontSize = 16,
  className,
}: CircularTextProps) {
  // Unique per instance so multiple rings on one page don't share a path id.
  const id = `circular-path-${text.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}`;

  return (
    <svg
      className={`${styles.ring} ${reverse ? styles.reverse : ''} ${className ?? ''}`}
      style={{ animationDuration: `${duration}s` }}
      viewBox="0 0 100 100"
      overflow="visible"
      aria-hidden="true"
      focusable="false"
    >
      <path
        id={id}
        d="M 0 50 L 0 50 A 1 1 0 0 1 100 50 L 100 50 L 100 50 A 1 1 0 0 1 0 50 L 0 50"
        strokeWidth="none"
        fill="transparent"
      />
      <text>
        <textPath
          href={`#${id}`}
          startOffset="0"
          dominantBaseline="hanging"
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: `${fontSize}px`,
            fontWeight: 400,
            fill: 'currentColor',
          }}
        >
          {text}
        </textPath>
      </text>
    </svg>
  );
}
