import Image from 'next/image';
import styles from './AboutSection.module.css';

export default function AboutSection() {
  return (
      <section className={styles.aboutSection}>
        <div className={styles.r1}>
          <div className={styles.r2}>
            <div className={styles.dektop}>
              <div className={styles.tag} data-border="true">
                <div className={styles.icon}>
                  <div className={styles.r6}>
                    <Image className={styles.r7} src="/assets/media/kXzKnSo8AYBBiRWPv9cmra68Z38.svg" alt="Icon" width={20} height={20} />
                  </div>
                </div>
                <div className={styles.text}>
                  <p className={styles.r9}>
                    About us
                  </p>
                </div>
              </div>
              <div className={styles.textContainer}>
                <div className={styles.heading}>
                  <h2 className={styles.r12}>
                    About Outstand Digital agency
                  </h2>
                </div>
                <div className={styles.paragraph}>
                  <p className={styles.r14}>
                    At Oustand, we are more than just a digital agency - we are your partners in success, dedicated to empowering businesses to thrive in the digital age.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.subContainer}>
          <div className={styles.container}>
            <div className={styles.r1}>
              <div className={styles.image}>
                <div className={styles.r18}>
                  <Image className={styles.r19} src="/assets/media/cLYzyomAKkuIY6hVgkscLfTmpQ.jpg" alt="About Us Image" width={545} height={363} />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.container2}>
            <div className={styles.subContainer2}>
              <div className={styles.card}>
                <div className={styles.textContainer2}>
                  <div className={styles.heading2}>
                    <h3 className={styles.r25}>
                      5+
                    </h3>
                  </div>
                  <div className={styles.text2}>
                    <h4 className={styles.r27}>
                      Years of Experience
                    </h4>
                  </div>
                </div>
                <div className={styles.line} />
                <div className={styles.paragraph2}>
                  <p className={styles.r30}>
                    Agency pro Digital Agency: 5+ years of experience, deep industry knowledge, meeting your evolving digital needs.
                  </p>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.textContainer2}>
                  <div className={styles.heading2}>
                    <h3 className={styles.r25}>
                      500+
                    </h3>
                  </div>
                  <div className={styles.text2}>
                    <h4 className={styles.r27}>
                      Projects Completed
                    </h4>
                  </div>
                </div>
                <div className={styles.line} />
                <div className={styles.paragraph2}>
                  <p className={styles.r30}>
                    With 500+ projects, we consistently exceed expectations, proven track record in diverse industries.
                  </p>
                </div>
              </div>
            </div>
            <div className={styles.subContainer2}>
              <div className={styles.card}>
                <div className={styles.textContainer2}>
                  <div className={styles.heading2}>
                    <h3 className={styles.r25}>
                      95%
                    </h3>
                  </div>
                  <div className={styles.text2}>
                    <h4 className={styles.r27}>
                      Client satisfaction Rate
                    </h4>
                  </div>
                </div>
                <div className={styles.line} />
                <div className={styles.paragraph2}>
                  <p className={styles.r30}>
                    With a 95%+ satisfaction rate, we excel in communication, and exceeding expectations.
                  </p>
                </div>
              </div>
              <div className={styles.card}>
                <div className={styles.textContainer2}>
                  <div className={styles.heading2}>
                    <h3 className={styles.r25}>
                      40+
                    </h3>
                  </div>
                  <div className={styles.text2}>
                    <h4 className={styles.r27}>
                      Team Members
                    </h4>
                  </div>
                </div>
                <div className={styles.line} />
                <div className={styles.paragraph2}>
                  <p className={styles.r30}>
                    With a team of over 40 dedicated professionals, we excel in collaboration, innovation.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
