import Image from 'next/image';
import styles from './OurCulture.module.css';

export default function OurCulture() {
  return (
      <section className={styles.container}>
        <div className={styles.r1}>
          <div className={styles.r2}>
            <div className={styles.dektop}>
              <div className={styles.tag} data-border="true">
                <div className={styles.icon}>
                  <div className={styles.r6}>
                    <Image className={styles.r7} src="/assets/media/6k6txB4lPzOUCSkGFkVFMcgWM.svg" alt="Icon" width={21} height={20} />
                  </div>
                </div>
                <div className={styles.text}>
                  <p className={styles.r9}>
                    Our Culture
                  </p>
                </div>
              </div>
              <div className={styles.textContainer}>
                <div className={styles.heading}>
                  <h2 className={styles.r12}>
                    Our Culture, Empowering Excellence
                  </h2>
                </div>
                <div className={styles.paragraph}>
                  <p className={styles.r14}>
                    Experience a culture that values innovation, collaboration, and diversity. We empower our team to excel, fostering a dynamic environment where creativity thrives.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.subContainer}>
          <div className={styles.r1}>
            <div className={styles.image}>
              <div className={styles.r17}>
                <Image className={styles.r18} src="/assets/media/OCS2Ox5LMu9TtQeC47uk6aFIS7w.png" alt="Our Culture Image" width={435} height={532} />
              </div>
            </div>
          </div>
          <div className={styles.container2}>
            <div className={styles.subContainer2}>
              <div className={styles.card}>
                <div className={styles.r1}>
                  <div className={styles.icon2}>
                    <div className={styles.r23}>
                      <Image className={styles.r24} src="/assets/media/5Pg2xBESngkXyyRoWs1FuSczzfY.svg" alt="Icon" width={28} height={28} />
                    </div>
                  </div>
                </div>
                <div className={styles.textContainer2}>
                  <div className={styles.heading2}>
                    <h3 className={styles.r27}>
                      Diversity & Inclusion
                    </h3>
                  </div>
                  <div className={styles.paragraph2}>
                    <p className={styles.r29}>
                      Fostering innovation, collaboration, and diversity to empower our team members.
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles.line} data-border="true" />
              <div className={styles.card2}>
                <div className={styles.r1}>
                  <div className={styles.icon2}>
                    <div className={styles.r23}>
                      <Image className={styles.r24} src="/assets/media/Sm1SNKYiZ3Ij7jgxK0UgLJXHg.svg" alt="Icon" width={28} height={28} />
                    </div>
                  </div>
                </div>
                <div className={styles.textContainer3}>
                  <div className={styles.heading2}>
                    <h3 className={styles.r27}>
                      Work-Life Balance
                    </h3>
                  </div>
                  <div className={styles.paragraph3}>
                    <p className={styles.r34}>
                      We prioritize work-life balance, offering flexibility to ensure our team members are happy and healthy.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.line2} data-border="true" />
            <div className={styles.subContainer2}>
              <div className={styles.card2}>
                <div className={styles.r1}>
                  <div className={styles.icon2}>
                    <div className={styles.r23}>
                      <Image className={styles.r24} src="/assets/media/2OVkMdemouSMWKOLPKlsY1EVQg.svg" alt="Icon" width={28} height={28} />
                    </div>
                  </div>
                </div>
                <div className={styles.textContainer3}>
                  <div className={styles.heading2}>
                    <h3 className={styles.r27}>
                      Empowerment
                    </h3>
                  </div>
                  <div className={styles.paragraph3}>
                    <p className={styles.r34}>
                      We empower our team members to take ownership of their work and support them in their journey.
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles.line} data-border="true" />
              <div className={styles.card2}>
                <div className={styles.r1}>
                  <div className={styles.icon2}>
                    <div className={styles.r23}>
                      <Image className={styles.r24} src="/assets/media/wWMvWk1dkHCOuBiKnpba5bsOQQ.svg" alt="Icon" width={28} height={28} />
                    </div>
                  </div>
                </div>
                <div className={styles.textContainer3}>
                  <div className={styles.heading2}>
                    <h3 className={styles.r27}>
                      Teamwork
                    </h3>
                  </div>
                  <div className={styles.paragraph3}>
                    <p className={styles.r34}>
                      We emphasize teamwork and open communication, believing that great work is achieved together.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
