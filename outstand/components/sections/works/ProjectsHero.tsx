import styles from './ProjectsHero.module.css';

export default function ProjectsHero() {
  return (
      <div className={styles.r0}>
        <div className={styles.background}>
          <div className={styles.r2}>
            <picture>
              <source media="(max-width: 809px)" srcSet="/assets/media/uxAzcI3QNmENiDSVZe9GOKaIi0.png" />
              <source media="(max-width: 1319px)" srcSet="/assets/media/10Cfmb3rnEOpiQ2NEGppiwWlxg.png" />
              <img className={styles.r3} src="/assets/media/fxTkpNuaXAjb2Xn042RQr2TF6Q.png" alt="Hero Background" width={1440} height={726} loading="lazy" decoding="async" />
            </picture>
          </div>
        </div>
      </div>
  );
}
