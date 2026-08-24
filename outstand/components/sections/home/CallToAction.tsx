import Image from 'next/image';
import styles from './CallToAction.module.css';

export default function CallToAction() {
  return (
      <section className={styles.cta}>
        <div className={styles.gridBackground}>
          <div className={styles.r2}>
            <Image className={styles.r3} src="/assets/media/4SAlNHIJd9GDzf13Xv4iLEo8n0E.svg" alt="Grid Brackground" width={401} height={240} />
          </div>
        </div>
        <div className={styles.background}>
          <div className={styles.r5}>
            <Image className={styles.r6} src="/assets/media/en9RJpvjmXeAp7DV5alyMEoP0l4.svg" alt="Light Ray" width={653} height={427} />
          </div>
        </div>
        <div className={styles.r7}>
          <div className={styles.image}>
            <div className={styles.r9}>
              <Image className={styles.r10} src="/assets/media/TYHRg6pmh1VzLy12V4ICVKxCA8.png" alt="Background Design" width={1186} height={377} />
            </div>
          </div>
        </div>
        <div className={styles.r7}>
          <div className={styles.image2}>
            <div className={styles.r9}>
              <Image className={styles.r12} src="/assets/media/tQU4xScfjJDKXXZILpcpxgz8jo.png" alt="Background Design" width={1186} height={377} />
            </div>
          </div>
        </div>
        <div className={styles.subContainer}>
          <div className={styles.container}>
            <div className={styles.container2} data-border="true">
              <div className={styles.icon}>
                <div className={styles.r17}>
                  <Image className={styles.r18} src="/assets/media/yzy40kaDjKJu1eJE8ulSCjo.svg" alt="Icon" width={20} height={20} />
                </div>
              </div>
              <div className={styles.text}>
                <p className={styles.r20}>
                  Elevate Your Business
                </p>
              </div>
            </div>
            <div className={styles.textContainer}>
              <div className={styles.heading}>
                <h2 className={styles.r23}>
                  Let’s Work Together
                </h2>
              </div>
              <div className={styles.paragraph}>
                <p className={styles.r25}>
                  Unlock peak performance with Oustand. Insider tips, updates & announcements. Dominate the field, stay informed.
                </p>
              </div>
            </div>
          </div>
          <div className={styles.tabsContainer}>
            <div className={styles.container3} data-border="true">
              <div className={styles.icon}>
                <div className={styles.r17}>
                  <Image className={styles.r28} src="/assets/media/Uyjp1jp3vIV4AePx5eG9LMOEiVg.svg" alt="Icon" width={21} height={20} />
                </div>
              </div>
              <div className={styles.text2}>
                <p className={styles.r30}>
                  Design & Development
                </p>
              </div>
            </div>
            <div className={styles.container4} data-border="true">
              <div className={styles.icon}>
                <div className={styles.r17}>
                  <Image className={styles.r28} src="/assets/media/dXVSIi1E6INhWLtAoEaLc39yA.svg" alt="Icon" width={21} height={20} />
                </div>
              </div>
              <div className={styles.text3}>
                <p className={styles.r33}>
                  Digital Marketing
                </p>
              </div>
            </div>
            <div className={styles.container5} data-border="true">
              <div className={styles.icon}>
                <div className={styles.r17}>
                  <Image className={styles.r28} src="/assets/media/xLHdWVejeZw8YrICKnTOlBu5EpQ.svg" alt="Icon" width={21} height={20} />
                </div>
              </div>
              <div className={styles.text4}>
                <p className={styles.r36}>
                  Branding & Identity
                </p>
              </div>
            </div>
          </div>
        </div>
        <form className={styles.r37}>
          <label className={styles.r38}>
            <div className={styles.r39}>
              <input className={styles.r40} type="email" name="Email" placeholder="Enter your email" required />
            </div>
          </label>
          <div className={styles.r7}>
            <div className={styles.r41}>
              <button className={styles.default}>
                <div className={styles.r43}>
                  <p className={styles.r44}>
                    Subscribe
                  </p>
                </div>
              </button>
            </div>
          </div>
        </form>
      </section>
  );
}
