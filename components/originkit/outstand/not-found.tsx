'use client'

// next/image stripped
import styles from './not-found.module.css';

export default function Content() {
  return (
      <section className={styles.main}>
        <div className={styles.r1}>
          <div className={styles.background}>
            <div className={styles.r3}>
              <picture>
                <source media="(max-width: 809px)" srcSet="/originkit/outstand/not-found/uxAzcI3QNmENiDSVZe9GOKaIi0.png" />
                <source media="(max-width: 1319px)" srcSet="/originkit/outstand/not-found/1KZ1FhNE3PMJ9jMtYOs1LxxA6k.png" />
                <img className={styles.r4} src="/originkit/outstand/not-found/fxTkpNuaXAjb2Xn042RQr2TF6Q.png" alt="Hero Background" width={1440} height={726} loading="lazy" decoding="async" />
              </picture>
            </div>
          </div>
        </div>
        <div className={styles.container}>
          <div className={styles.subContainer} data-border="true">
            <div className={styles.icon}>
              <div className={styles.r8}>
                <img className={styles.r9} src="/originkit/outstand/not-found/9JbQup0JpXX2kHBRAM0xthpNZo.svg" alt="Icon" width={21} height={21} />
              </div>
            </div>
            <div className={styles.text}>
              <p className={styles.r11}>
                Page Not Found
              </p>
            </div>
          </div>
          <div className={styles.r1}>
            <div className={styles.text2}>
              <p className={styles.r13}>
                404
              </p>
            </div>
          </div>
          <div className={styles.paragraph}>
            <h3 className={styles.r15}>
              We can’t seem to find the page you are looking for !
            </h3>
          </div>
          <div className={styles.r1}>
            <div className={styles.r16}>
              <a className={styles.iconLeftRight} href="#">
                <div className={styles.text3}>
                  <p className={styles.r19}>
                    Back to Home
                  </p>
                </div>
                <div className={styles.iconRight}>
                  <div className={styles.icon2}>
                    <div className={styles.r22}>
                      <img className={styles.r23} src="/originkit/outstand/not-found/Z4EozQtdVmroG1HDLS4zKFJeGo.svg" alt="Icon" width={20} height={20} />
                    </div>
                  </div>
                </div>
                <div className={styles.shine} />
              </a>
            </div>
          </div>
        </div>
      </section>
  );
}

