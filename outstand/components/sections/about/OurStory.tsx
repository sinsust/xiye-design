import Image from 'next/image';
import styles from './OurStory.module.css';

export default function OurStory() {
  return (
      <section className={styles.ourStory}>
        <div className={styles.r1}>
          <div className={styles.r2}>
            <div className={styles.dektop}>
              <div className={styles.tag} data-border="true">
                <div className={styles.icon}>
                  <div className={styles.r6}>
                    <Image className={styles.r7} src="/assets/media/nHQWAkLjayQoAbLHLxTToqw5Yc.svg" alt="Icon" width={21} height={20} />
                  </div>
                </div>
                <div className={styles.text}>
                  <p className={styles.r9}>
                    Our Story
                  </p>
                </div>
              </div>
              <div className={styles.textContainer}>
                <div className={styles.heading}>
                  <h2 className={styles.r12}>
                    Over The Years
                  </h2>
                </div>
                <div className={styles.paragraph}>
                  <p className={styles.r14}>
                    Oustand has evolved from a small, ambitious team to a globally recognized agency redefining digital experiences.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.container}>
          <div className={styles.subContainer}>
            <div className={styles.container2}>
              <div className={styles.card} data-border="true">
                <div className={styles.number}>
                  <p className={styles.r20}>
                    2002
                  </p>
                </div>
                <div className={styles.container3}>
                  <div className={styles.heading2}>
                    <h3 className={styles.r23}>
                      Founded
                    </h3>
                  </div>
                  <div className={styles.text2}>
                    <p className={styles.r25}>
                      Oustand was founded in 2002 with a vision to revolutionize the digital marketing industry. What started as a small team with a big dream has grown into a dynamic agency.
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles.card2} data-border="true">
                <div className={styles.number2}>
                  <p className={styles.r28}>
                    2012
                  </p>
                </div>
                <div className={styles.container4}>
                  <div className={styles.heading3}>
                    <h3 className={styles.r31}>
                      12K+ Client Served
                    </h3>
                  </div>
                  <div className={styles.text3}>
                    <p className={styles.r33}>
                      In 2012, we reached a significant milestone, serving 12K+ clients worldwide. This achievement is a testament to our dedication and our clients&apos; trust in us.
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles.card} data-border="true">
                <div className={styles.number}>
                  <p className={styles.r20}>
                    2022
                  </p>
                </div>
                <div className={styles.container3}>
                  <div className={styles.heading2}>
                    <h3 className={styles.r23}>
                      20+ Years of Experience
                    </h3>
                  </div>
                  <div className={styles.text2}>
                    <p className={styles.r25}>
                      In 2022, we celebrated 20 years of delivering exceptional results for our clients. We are grateful for the opportunities and look forward to many more years of success.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.line} />
              <div className={styles.circle} />
              <div className={styles.line2} />
              <div className={styles.circle} />
              <div className={styles.line2} />
              <div className={styles.circle} />
              <div className={styles.line} />
            </div>
          </div>
        </div>
      </section>
  );
}
