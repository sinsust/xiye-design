import Image from 'next/image';
import styles from './Hero.module.css';
import { site } from '@/config/site';

export default function Hero() {
  return (
      <section className={styles.hero}>
        <div className={styles.backgroundImage}>
          <div className={`${styles.rightGlow} ${styles.onlyDesktop}`}>
            <div className={styles.glowRight}>
              <div className={styles.r4}>
                <Image className={styles.r5} src="/assets/media/Ye871Roffo1IPleHJDtrcgAXwE.svg" alt="Hero Background" width={514} height={794} />
              </div>
            </div>
          </div>
          <div className={`${styles.leftGlow} ${styles.onlyDesktop}`}>
            <div className={styles.glowLeft}>
              <div className={styles.r8}>
                <Image className={styles.r9} src="/assets/media/kpI19fmpWxfXzUah3eWNNPC7TRY.svg" alt="Hero Background" width={514} height={794} />
              </div>
            </div>
          </div>
          <div className={`${styles.background} ${styles.onlyTablet}`}>
            <div className={styles.r11}>
              <Image className={styles.r12} src="/assets/media/10Cfmb3rnEOpiQ2NEGppiwWlxg.png" alt="Hero Background" width={1024} height={759} />
            </div>
          </div>
          <div className={`${styles.background2} ${styles.onlyPhone}`}>
            <div className={styles.r14}>
              <Image className={styles.r15} src="/assets/media/uxAzcI3QNmENiDSVZe9GOKaIi0.png" alt="Hero Background" width={390} height={600} />
            </div>
          </div>
        </div>
        <div className={styles.container}>
          <div className={styles.r17}>
            <div className={styles.r18}>
              <div className={styles.dektop}>
                <div className={styles.tag} data-border="true">
                  <div className={styles.icon}>
                    <div className={styles.r22}>
                      <Image className={styles.r23} src="/assets/media/HWcNm843vIM43vGfOMwHLTEe1g4.svg" alt="Icon" width={20} height={20} />
                    </div>
                  </div>
                  <div className={styles.text}>
                    <p className={styles.r25}>
                      Contact Us
                    </p>
                  </div>
                </div>
                <div className={styles.textContainer}>
                  <div className={styles.heading}>
                    <h2 className={styles.r28}>
                      We’d Love to Hear from You
                    </h2>
                  </div>
                  <div className={styles.paragraph}>
                    <p className={styles.r30}>
                      Feel free to reach out to us if you want to work together, or just want to simply have a chat.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.subContainer}>
            <div className={styles.container2} data-border="true">
              <form className={styles.r33}>
                <div className={styles.container3}>
                  <label className={styles.r35}>
                    <div className={styles.r36}>
                      <input className={styles.r37} type="text" name="Name" placeholder="Name" required />
                    </div>
                  </label>
                  <label className={styles.r35}>
                    <div className={styles.r36}>
                      <input className={styles.r37} type="email" name="Email" placeholder="E-mail" required />
                    </div>
                  </label>
                  <label className={styles.r38}>
                    <div className={styles.r39}>
                      <textarea className={styles.r40} name="Message" placeholder="Tell us about your project." required />
                    </div>
                  </label>
                </div>
                <div className={styles.r17}>
                  <div className={styles.r41}>
                    <button className={styles.default}>
                      <div className={styles.r43}>
                        <p className={styles.r44}>
                          Send a Message
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </form>
              <div className={styles.r45}>
                <div className={styles.r46}>
                  <iframe
                    className={styles.r47}
                    src={site.contact.mapEmbedUrl}
                    title="Our location on Google Maps"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </div>
            <div className={styles.container4}>
              <div className={styles.card} data-border="true">
                <div className={styles.subContainer2}>
                  <div className={styles.image}>
                    <div className={styles.r52}>
                      <Image className={styles.r53} src="/assets/media/9LsDWkYbCJk2SVOzd0uMZz7vy9Y.png" alt="Flag" width={270} height={148} />
                    </div>
                  </div>
                  <div className={styles.text2}>
                    <h3 className={styles.r55}>
                      Canada Office
                    </h3>
                  </div>
                </div>
                <div className={styles.subContainer3} data-border="true">
                  <div className={styles.container5}>
                    <div className={styles.iconContainer} data-border="true">
                      <div className={styles.icon2}>
                        <div className={styles.r22}>
                          <Image className={styles.r60} src="/assets/media/BpGNZUwZB4zbfVqnfUTdzKBkiys.svg" alt="Icon" width={20} height={20} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.text3}>
                      <p className={styles.r62}>
                        <a className={styles.r63} href="mailto:Contact@Oustand.co.in" target="_blank" rel="noreferrer">
                          Contact@Oustand.co.in
                        </a>
                      </p>
                    </div>
                  </div>
                  <div className={styles.container5}>
                    <div className={styles.iconContainer} data-border="true">
                      <div className={styles.icon2}>
                        <div className={styles.r22}>
                          <Image className={styles.r60} src="/assets/media/jQ6Eg1qjHCZZfRHMXiKzl6QUQ.svg" alt="Icon" width={20} height={20} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.text3}>
                      <p className={styles.r62}>
                        +634-34598484
                      </p>
                    </div>
                  </div>
                  <div className={styles.container5}>
                    <div className={styles.iconContainer} data-border="true">
                      <div className={styles.icon2}>
                        <div className={styles.r22}>
                          <Image className={styles.r60} src="/assets/media/GATgFNt2br0fr9FKQPvsBuf5lHI.svg" alt="Icon" width={20} height={20} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.text3}>
                      <p className={styles.r62}>
                        Maple Street, Toronto.
                      </p>
                    </div>
                  </div>
                  <div className={styles.container6}>
                    <div className={styles.iconContainer} data-border="true">
                      <div className={styles.icon2}>
                        <div className={styles.r22}>
                          <Image className={styles.r60} src="/assets/media/9OzCvAuO5LtZCTxMHScGyFJlQx0.svg" alt="Icon" width={20} height={20} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.text4}>
                      <p className={styles.r62}>
                        9:00 AM - 6:00 PM EST
                      </p>
                      <p className={styles.r62}>
                        Sunday Closed
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.card2} data-border="true">
                <div className={styles.subContainer4}>
                  <div className={styles.image2}>
                    <div className={styles.r52}>
                      <Image className={styles.r53} src="/assets/media/P2PmLnNOvS5qq9GHik2nheUitOA.png" alt="Flag" width={270} height={148} />
                    </div>
                  </div>
                  <div className={styles.text5}>
                    <h3 className={styles.r70}>
                      USA Office
                    </h3>
                  </div>
                </div>
                <div className={styles.subContainer5} data-border="true">
                  <div className={styles.container7}>
                    <div className={styles.iconContainer} data-border="true">
                      <div className={styles.icon2}>
                        <div className={styles.r22}>
                          <Image className={styles.r60} src="/assets/media/BpGNZUwZB4zbfVqnfUTdzKBkiys.svg" alt="Icon" width={20} height={20} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.text6}>
                      <p className={styles.r74}>
                        <a className={styles.r63} href="mailto:Contact@Oustand.co.in" target="_blank" rel="noreferrer">
                          Contact@Oustand.co.in
                        </a>
                      </p>
                    </div>
                  </div>
                  <div className={styles.container7}>
                    <div className={styles.iconContainer} data-border="true">
                      <div className={styles.icon2}>
                        <div className={styles.r22}>
                          <Image className={styles.r60} src="/assets/media/jQ6Eg1qjHCZZfRHMXiKzl6QUQ.svg" alt="Icon" width={20} height={20} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.text6}>
                      <p className={styles.r74}>
                        +634-34598484
                      </p>
                    </div>
                  </div>
                  <div className={styles.container7}>
                    <div className={styles.iconContainer} data-border="true">
                      <div className={styles.icon2}>
                        <div className={styles.r22}>
                          <Image className={styles.r60} src="/assets/media/GATgFNt2br0fr9FKQPvsBuf5lHI.svg" alt="Icon" width={20} height={20} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.text6}>
                      <p className={styles.r74}>
                        BC01 Downtown, NY.
                      </p>
                    </div>
                  </div>
                  <div className={styles.container8}>
                    <div className={styles.iconContainer} data-border="true">
                      <div className={styles.icon2}>
                        <div className={styles.r22}>
                          <Image className={styles.r60} src="/assets/media/9OzCvAuO5LtZCTxMHScGyFJlQx0.svg" alt="Icon" width={20} height={20} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.text7}>
                      <p className={styles.r74}>
                        9:00 AM - 6:00 PM EST
                      </p>
                      <p className={styles.r74}>
                        Sunday Closed
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.card} data-border="true">
                <div className={styles.subContainer2}>
                  <div className={styles.image2}>
                    <div className={styles.r52}>
                      <Image className={styles.r53} src="/assets/media/aazmfRYtsKaJ4BJgVCMi7KZQHtA.png" alt="Flag" width={266} height={148} />
                    </div>
                  </div>
                  <div className={styles.text2}>
                    <h3 className={styles.r55}>
                      India Office
                    </h3>
                  </div>
                </div>
                <div className={styles.subContainer3} data-border="true">
                  <div className={styles.container5}>
                    <div className={styles.iconContainer} data-border="true">
                      <div className={styles.icon2}>
                        <div className={styles.r22}>
                          <Image className={styles.r60} src="/assets/media/BpGNZUwZB4zbfVqnfUTdzKBkiys.svg" alt="Icon" width={20} height={20} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.text3}>
                      <p className={styles.r62}>
                        <a className={styles.r63} href="mailto:pragadesh37v@gmail.com" target="_blank" rel="noreferrer">
                          Contact@Oustand.co.in
                        </a>
                      </p>
                    </div>
                  </div>
                  <div className={styles.container5}>
                    <div className={styles.iconContainer} data-border="true">
                      <div className={styles.icon2}>
                        <div className={styles.r22}>
                          <Image className={styles.r60} src="/assets/media/jQ6Eg1qjHCZZfRHMXiKzl6QUQ.svg" alt="Icon" width={20} height={20} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.text3}>
                      <p className={styles.r62}>
                        +634-34598484
                      </p>
                    </div>
                  </div>
                  <div className={styles.container5}>
                    <div className={styles.iconContainer} data-border="true">
                      <div className={styles.icon2}>
                        <div className={styles.r22}>
                          <Image className={styles.r60} src="/assets/media/GATgFNt2br0fr9FKQPvsBuf5lHI.svg" alt="Icon" width={20} height={20} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.text3}>
                      <p className={styles.r62}>
                        Groove Road, Mumbai.
                      </p>
                    </div>
                  </div>
                  <div className={styles.container6}>
                    <div className={styles.iconContainer} data-border="true">
                      <div className={styles.icon2}>
                        <div className={styles.r22}>
                          <Image className={styles.r60} src="/assets/media/9OzCvAuO5LtZCTxMHScGyFJlQx0.svg" alt="Icon" width={20} height={20} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.text4}>
                      <p className={styles.r62}>
                        9:00 AM - 6:00 PM EST
                      </p>
                      <p className={styles.r62}>
                        Sunday Closed
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
