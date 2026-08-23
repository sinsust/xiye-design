'use client'

import styles from './works-projects-hero.module.css';

export default function ProjectsHero() {
  return (
      <div className={styles.r0}>
        <div className={styles.background}>
          <div className={styles.r2}>
            <picture>
              <source media="(max-width: 809px)" srcSet="/originkit/outstand/works-projects-hero/uxAzcI3QNmENiDSVZe9GOKaIi0.png" />
              <source media="(max-width: 1319px)" srcSet="/originkit/outstand/works-projects-hero/10Cfmb3rnEOpiQ2NEGppiwWlxg.png" />
              <img className={styles.r3} src="/originkit/outstand/works-projects-hero/fxTkpNuaXAjb2Xn042RQr2TF6Q.png" alt="Hero Background" width={1440} height={726} loading="lazy" decoding="async" />
            </picture>
          </div>
        </div>
      </div>
  );
}

