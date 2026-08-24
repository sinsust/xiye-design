import Image from 'next/image';
import Link from 'next/link';
import styles from './ServicesOverview.module.css';

export default function ServicesOverview() {
  return (
      <section className={styles.servicesOverview}>
        <div className={styles.r1}>
          <div className={styles.r2}>
            <div className={styles.dektop}>
              <div className={styles.tag} data-border="true">
                <div className={styles.icon}>
                  <div className={styles.r6}>
                    <Image className={styles.r7} src="/assets/media/mTtmYC1N1XY1BvndJqnJoEo3s.svg" alt="Icon" width={20} height={20} />
                  </div>
                </div>
                <div className={styles.text}>
                  <p className={styles.r9}>
                    Service Overview
                  </p>
                </div>
              </div>
              <div className={styles.textContainer}>
                <div className={styles.heading}>
                  <h2 className={styles.r12}>
                    Our Services Overview
                  </h2>
                </div>
                <div className={styles.paragraph}>
                  <p className={styles.r14}>
                    Explore our comprehensive services in digital marketing, web design and development, and branding & identity, tailored to elevate your online presence and brand identity.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.subContainer}>
          <div className={styles.container} data-border="true">
            <div className={styles.card} data-border="true">
              <div className={styles.container2}>
                <div className={styles.subContainer2}>
                  <div className={styles.icon2}>
                    <div className={styles.r21}>
                      <Image className={styles.r22} src="/assets/media/AjRSp79fx1LPv4e4B1KlsLtdEZc.svg" alt="Icon" width={24} height={24} />
                    </div>
                  </div>
                  <div className={styles.heading2}>
                    <h3 className={styles.r24}>
                      Design & Development
                    </h3>
                  </div>
                </div>
                <div className={styles.paragraph2}>
                  <p className={styles.r26}>
                    Crafting custom websites tailored to your needs. Contact us for innovative online solutions.
                  </p>
                </div>
              </div>
              <div className={styles.r1}>
                <div className={styles.r27}>
                  <Link className={styles.hoverArrow} data-border="true" href="/contact">
                    <div className={styles.text2}>
                      <p className={styles.r30}>
                        Book a Call
                      </p>
                    </div>
                    <div className={styles.iconRight}>
                      <div className={styles.icon}>
                        <div className={styles.r6}>
                          <Image className={styles.r32} src="/assets/media/lJSvGFGPhRLFfxcyPg1nppxYdA.svg" alt="" width={20} height={20} aria-hidden="true" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
            <div className={styles.subContainer3}>
              <div className={styles.container3}>
                <div className={styles.card2}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r38} src="/assets/media/nTYAqEXN9C0me62zMoI2ff2yOTE.svg" alt="Icon" width={20} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text3}>
                    <p className={styles.r40}>
                      Custom Web Design
                    </p>
                  </div>
                </div>
                <div className={styles.line} data-border="true" />
                <div className={styles.card3}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r43} src="/assets/media/gNOSDtyGW0RDasLw0wjZhN4zIZ0.svg" alt="Icon" width={21} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text4}>
                    <p className={styles.r45}>
                      Web Development
                    </p>
                  </div>
                </div>
                <div className={styles.line} data-border="true" />
                <div className={styles.card4}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r43} src="/assets/media/zDempxsSq60mkq0dMapR6P5EzBo.svg" alt="Icon" width={21} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text5}>
                    <p className={styles.r48}>
                      UX Design
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles.line2} data-border="true" />
              <div className={styles.container4}>
                <div className={styles.card2}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r38} src="/assets/media/SCJ6J98oOFdoHymkYICgdZkM7E.svg" alt="Icon" width={20} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text3}>
                    <p className={styles.r40}>
                      Web Analytics
                    </p>
                  </div>
                </div>
                <div className={styles.line} data-border="true" />
                <div className={styles.card3}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r43} src="/assets/media/ydIz3M4mCTEOuLxZxwJ7lovZtTY.svg" alt="Icon" width={21} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text4}>
                    <p className={styles.r45}>
                      App Development
                    </p>
                  </div>
                </div>
                <div className={styles.line} data-border="true" />
                <div className={styles.card3}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r43} src="/assets/media/4gDtrSrlMvO59cIL21ZTNMgdtgU.svg" alt="Icon" width={21} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text4}>
                    <p className={styles.r45}>
                      CMS Development
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.container5} data-border="true">
            <div className={styles.card} data-border="true">
              <div className={styles.container2}>
                <div className={styles.subContainer2}>
                  <div className={styles.icon2}>
                    <div className={styles.r21}>
                      <Image className={styles.r52} src="/assets/media/JTpykLKaHYU0B6cgqBPTa5MAoM.svg" alt="Icon" width={25} height={24} />
                    </div>
                  </div>
                  <div className={styles.heading2}>
                    <h3 className={styles.r24}>
                      Branding & Identity
                    </h3>
                  </div>
                </div>
                <div className={styles.paragraph2}>
                  <p className={styles.r26}>
                    Create a standout brand identity. Let&apos;s craft your brand story together. Contact us today.
                  </p>
                </div>
              </div>
              <div className={styles.r1}>
                <div className={styles.r27}>
                  <Link className={styles.hoverArrow} data-border="true" href="/contact">
                    <div className={styles.text2}>
                      <p className={styles.r30}>
                        Book a Call
                      </p>
                    </div>
                    <div className={styles.iconRight}>
                      <div className={styles.icon}>
                        <div className={styles.r6}>
                          <Image className={styles.r32} src="/assets/media/lJSvGFGPhRLFfxcyPg1nppxYdA.svg" alt="" width={20} height={20} aria-hidden="true" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
            <div className={styles.subContainer4}>
              <div className={styles.container3}>
                <div className={styles.card5}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r38} src="/assets/media/1mlx3cOqytkIBWGvs9YPljlTbE.svg" alt="Icon" width={20} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text6}>
                    <p className={styles.r56}>
                      Logo Design
                    </p>
                  </div>
                </div>
                <div className={styles.line} data-border="true" />
                <div className={styles.card3}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r43} src="/assets/media/EfgJ0MlDOhBAjKx26zL2ZdGTzE.svg" alt="Icon" width={21} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text4}>
                    <p className={styles.r45}>
                      Brand Strategy
                    </p>
                  </div>
                </div>
                <div className={styles.line} data-border="true" />
                <div className={styles.card3}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r43} src="/assets/media/4HblmCmoovr4TKp3Yb5QovOsQ.svg" alt="Icon" width={21} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text4}>
                    <p className={styles.r45}>
                      Visual Identity
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles.line3} data-border="true" />
              <div className={styles.container3}>
                <div className={styles.card5}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r38} src="/assets/media/p0ol2SMUR0ygmKZajUIarElaU.svg" alt="Icon" width={20} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text6}>
                    <p className={styles.r56}>
                      Print Design
                    </p>
                  </div>
                </div>
                <div className={styles.line} data-border="true" />
                <div className={styles.card3}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r43} src="/assets/media/Jalmjnw0Y0kdnIoOOsfJqkXuzs.svg" alt="Icon" width={21} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text4}>
                    <p className={styles.r45}>
                      Digital Branding
                    </p>
                  </div>
                </div>
                <div className={styles.line} data-border="true" />
                <div className={styles.card3}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r43} src="/assets/media/toNbV6YSTqyjxMcAyanPIWdgHqA.svg" alt="Icon" width={21} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text4}>
                    <p className={styles.r45}>
                      Brand Guidelines
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.container} data-border="true">
            <div className={styles.card} data-border="true">
              <div className={styles.container2}>
                <div className={styles.subContainer5}>
                  <div className={styles.icon2}>
                    <div className={styles.r21}>
                      <Image className={styles.r52} src="/assets/media/2txGmcOBXehPQnYosck02lNP5DM.svg" alt="Icon" width={25} height={24} />
                    </div>
                  </div>
                  <div className={styles.heading2}>
                    <h3 className={styles.r24}>
                      Digital Marketing
                    </h3>
                  </div>
                </div>
                <div className={styles.paragraph2}>
                  <p className={styles.r26}>
                    Boost your online presence. Reach your audience with our SEO and digital marketing services.
                  </p>
                </div>
              </div>
              <div className={styles.r1}>
                <div className={styles.r27}>
                  <Link className={styles.hoverArrow} data-border="true" href="/contact">
                    <div className={styles.text2}>
                      <p className={styles.r30}>
                        Book a Call
                      </p>
                    </div>
                    <div className={styles.iconRight}>
                      <div className={styles.icon}>
                        <div className={styles.r6}>
                          <Image className={styles.r32} src="/assets/media/lJSvGFGPhRLFfxcyPg1nppxYdA.svg" alt="" width={20} height={20} aria-hidden="true" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
            <div className={styles.subContainer3}>
              <div className={styles.container3}>
                <div className={styles.card5}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r38} src="/assets/media/pCjwKabrD3muBobibi2oESUUKO4.svg" alt="Icon" width={20} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text6}>
                    <p className={styles.r56}>
                      SEO
                    </p>
                  </div>
                </div>
                <div className={styles.line} data-border="true" />
                <div className={styles.card3}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r43} src="/assets/media/D0xEkdihOgMmSjwFfL52dIB1ik.svg" alt="Icon" width={21} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text4}>
                    <p className={styles.r45}>
                      Content Marketing
                    </p>
                  </div>
                </div>
                <div className={styles.line} data-border="true" />
                <div className={styles.card3}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r43} src="/assets/media/nVqPug6KxPO0ME4U541eGGNr57Q.svg" alt="Icon" width={21} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text4}>
                    <p className={styles.r45}>
                      Media Marketing
                    </p>
                  </div>
                </div>
              </div>
              <div className={styles.line2} data-border="true" />
              <div className={styles.container4}>
                <div className={styles.card2}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r38} src="/assets/media/12T3vhvPRSodqGltEzSPIjNJw.svg" alt="Icon" width={20} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text3}>
                    <p className={styles.r40}>
                      Email Marketing
                    </p>
                  </div>
                </div>
                <div className={styles.line} data-border="true" />
                <div className={styles.card3}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r43} src="/assets/media/g2iFX2xv6lpLxWoTs83959PV14.svg" alt="Icon" width={21} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text4}>
                    <p className={styles.r45}>
                      Influencer Marketing
                    </p>
                  </div>
                </div>
                <div className={styles.line} data-border="true" />
                <div className={styles.card3}>
                  <div className={styles.iconContainer} data-border="true">
                    <div className={styles.icon3}>
                      <div className={styles.r6}>
                        <Image className={styles.r43} src="/assets/media/iC8hhEfX11Ow6AxT84wI21As0.svg" alt="Icon" width={21} height={20} />
                      </div>
                    </div>
                  </div>
                  <div className={styles.text4}>
                    <p className={styles.r45}>
                      Analytics & Reporting
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
