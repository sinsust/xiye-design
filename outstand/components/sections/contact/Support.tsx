import Image from 'next/image';
import Link from 'next/link';
import styles from './Support.module.css';

export default function Support() {
  return (
      <section className={styles.support}>
        <div className={styles.r1}>
          <div className={styles.r2}>
            <div className={styles.dektop}>
              <div className={styles.tag} data-border="true">
                <div className={styles.icon}>
                  <div className={styles.r6}>
                    <Image className={styles.r7} src="/assets/media/HF8M5tPq0nwy3do9DLOgTcr1f2g.svg" alt="Icon" width={20} height={20} />
                  </div>
                </div>
                <div className={styles.text}>
                  <p className={styles.r9}>
                    Support
                  </p>
                </div>
              </div>
              <div className={styles.textContainer}>
                <div className={styles.heading}>
                  <h2 className={styles.r12}>
                    Connect with Our Team
                  </h2>
                </div>
                <div className={styles.paragraph}>
                  <p className={styles.r14}>
                    Whether you&apos;re interested in our services, have a project in mind, or just want to say hello, we&apos;d love to hear from you.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.subContainer}>
          <div className={styles.card} data-border="true">
            <div className={styles.container}>
              <div className={styles.subContainer2}>
                <div className={styles.icon2}>
                  <div className={styles.r20}>
                    <Image className={styles.r21} src="/assets/media/AjRSp79fx1LPv4e4B1KlsLtdEZc.svg" alt="Icon" width={24} height={24} />
                  </div>
                </div>
                <div className={styles.heading2}>
                  <h3 className={styles.r23}>
                    Design & Development
                  </h3>
                </div>
              </div>
              <div className={styles.paragraph2}>
                <p className={styles.r25}>
                  Crafting custom websites tailored to your needs. Contact us for innovative online solutions.
                </p>
              </div>
            </div>
            <div className={styles.r1}>
              <div className={styles.r26}>
                <Link className={styles.hoverArrow} data-border="true" href="/contact#hero">
                  <div className={styles.text2}>
                    <p className={styles.r29}>
                      Get in Touch
                    </p>
                  </div>
                  <div className={styles.iconRight}>
                    <div className={styles.icon}>
                      <div className={styles.r6}>
                        <Image className={styles.r31} src="/assets/media/lJSvGFGPhRLFfxcyPg1nppxYdA.svg" alt="" width={20} height={20} aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
          <div className={styles.card2} data-border="true">
            <div className={styles.container2}>
              <div className={styles.subContainer3}>
                <div className={styles.icon2}>
                  <div className={styles.r20}>
                    <Image className={styles.r35} src="/assets/media/JTpykLKaHYU0B6cgqBPTa5MAoM.svg" alt="Icon" width={25} height={24} />
                  </div>
                </div>
                <div className={styles.heading3}>
                  <h3 className={styles.r37}>
                    Branding & Identity
                  </h3>
                </div>
              </div>
              <div className={styles.paragraph3}>
                <p className={styles.r39}>
                  Create a standout brand identity. Let&apos;s craft your brand story together. Contact us today.
                </p>
              </div>
            </div>
            <div className={styles.r1}>
              <div className={styles.r40}>
                <Link className={styles.hoverArrow2} data-border="true" href="/contact#hero">
                  <div className={styles.text2}>
                    <p className={styles.r29}>
                      Get in Touch
                    </p>
                  </div>
                  <div className={styles.iconRight}>
                    <div className={styles.icon}>
                      <div className={styles.r6}>
                        <Image className={styles.r31} src="/assets/media/lJSvGFGPhRLFfxcyPg1nppxYdA.svg" alt="" width={20} height={20} aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
          <div className={styles.card} data-border="true">
            <div className={styles.container}>
              <div className={styles.subContainer4}>
                <div className={styles.icon2}>
                  <div className={styles.r20}>
                    <Image className={styles.r35} src="/assets/media/2txGmcOBXehPQnYosck02lNP5DM.svg" alt="Icon" width={25} height={24} />
                  </div>
                </div>
                <div className={styles.heading2}>
                  <h3 className={styles.r23}>
                    Digital Marketing
                  </h3>
                </div>
              </div>
              <div className={styles.paragraph2}>
                <p className={styles.r25}>
                  Boost your online presence. Reach your audience with our SEO and digital marketing services.
                </p>
              </div>
            </div>
            <div className={styles.r1}>
              <div className={styles.r26}>
                <Link className={styles.hoverArrow} data-border="true" href="/contact#hero">
                  <div className={styles.text2}>
                    <p className={styles.r29}>
                      Get in Touch
                    </p>
                  </div>
                  <div className={styles.iconRight}>
                    <div className={styles.icon}>
                      <div className={styles.r6}>
                        <Image className={styles.r31} src="/assets/media/lJSvGFGPhRLFfxcyPg1nppxYdA.svg" alt="" width={20} height={20} aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
