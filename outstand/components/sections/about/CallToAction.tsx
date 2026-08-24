import Image from 'next/image';
import Link from 'next/link';
import styles from './CallToAction.module.css';
import CircularText from '@/components/ui/CircularText';

export default function CallToAction() {
  return (
      <section className={styles.cta}>
        <div className={styles.textContainer}>
          <div className={styles.heading}>
            <h2 className={styles.r3}>
              Let’s Make It Happen
            </h2>
          </div>
          <div className={styles.paragraph}>
            <p className={styles.r5}>
              Explore exciting career opportunities and become part of our innovative and dynamic team.
            </p>
          </div>
        </div>
        <div className={styles.subContainer}>
          <div className={styles.r7}>
            <div className={styles.image}>
              <div className={`${styles.r9} ${styles.onlyDesktop}`}>
                <Image className={styles.r10} src="/assets/media/4RA92Pn5ckVyToXzkJW5ObsWcM.png" alt="Team Image" width={408} height={300} />
              </div>
              <div className={`${styles.abstractDesign} ${styles.onlyDesktop}`}>
                <div className={styles.r12}>
                  <Image className={styles.r13} src="/assets/media/CbkbIY4r7GwPXVvVFJTlm14Yhw.svg" alt="Design Image" width={33} height={33} />
                </div>
              </div>
              <div className={`${styles.r14} ${styles.onlyTablet}`}>
                <Image className={styles.r15} src="/assets/media/4RA92Pn5ckVyToXzkJW5ObsWcM.png" alt="Team Image" width={408} height={300} />
              </div>
              <div className={`${styles.abstractDesign2} ${styles.onlyTablet}`}>
                <div className={styles.r17}>
                  <Image className={styles.r18} src="/assets/media/CbkbIY4r7GwPXVvVFJTlm14Yhw.svg" alt="Design Image" width={33} height={33} />
                </div>
              </div>
              <div className={`${styles.r19} ${styles.onlyPhone}`}>
                <Image className={styles.r20} src="/assets/media/4RA92Pn5ckVyToXzkJW5ObsWcM.png" alt="Team Image" width={408} height={300} />
              </div>
            </div>
          </div>
          <div className={styles.container}>
            <div className={styles.r7}>
              <div className={styles.image2}>
                <div className={styles.r23}>
                  <Image className={styles.r24} src="/assets/media/Hh6vA2RTASHh9G5WxJFqxnOy1k.png" alt="Team Image" width={408} height={270} />
                </div>
              </div>
            </div>
            <div className={styles.r7}>
              <div className={styles.image2}>
                <div className={styles.r23}>
                  <Image className={styles.r24} src="/assets/media/qrb0Tv34hyNwVQamXe45TVmq5ik.png" alt="Team Image" width={408} height={270} />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.r7}>
            <div className={styles.image3}>
              <div className={styles.r26}>
                <Image className={styles.r27} src="/assets/media/4OiEW7Lfitfwu09s706dngI7PA.png" alt="Team Image" width={204} height={350} />
              </div>
              <Link className={styles.circleWrap} href="/about#careers">
                <div className={styles.r29}>
                  <div className={styles.big}>
                    <div className={styles.ellipse1}>
                      <div className={styles.icon}>
                        <div className={styles.r33}>
                          <Image className={styles.r34} src="/assets/media/GGSt9jIKgyDtefZ2WG68CDExE44.svg" alt="Icon" width={40} height={40} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.r35}>
                      <div className={styles.r36}>
                        <CircularText className={styles.r37} text="Join Now | Join Now | Join Now | Join Now" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
          <div className={styles.container}>
            <div className={styles.r7}>
              <div className={styles.image4}>
                <div className={`${styles.r39} ${styles.onlyDesktop}`}>
                  <Image className={styles.r40} src="/assets/media/R3VD1iGXMpYhBOiBqfOE73Lc8g.png" alt="Team Image" width={408} height={270} />
                </div>
                <div className={`${styles.abstractDesign3} ${styles.onlyDesktop}`}>
                  <div className={styles.r42}>
                    <Image className={styles.r43} src="/assets/media/9zataYu20xsrpQa8GIF7hDj4UbM.svg" alt="Design Image" width={45} height={44} />
                  </div>
                </div>
                <div className={`${styles.r44} ${styles.onlyTablet}`}>
                  <Image className={styles.r45} src="/assets/media/R3VD1iGXMpYhBOiBqfOE73Lc8g.png" alt="Team Image" width={408} height={270} />
                </div>
                <div className={`${styles.abstractDesign4} ${styles.onlyTablet}`}>
                  <div className={styles.r47}>
                    <Image className={styles.r48} src="/assets/media/9zataYu20xsrpQa8GIF7hDj4UbM.svg" alt="Design Image" width={45} height={44} />
                  </div>
                </div>
                <div className={`${styles.r49} ${styles.onlyPhone}`}>
                  <Image className={styles.r50} src="/assets/media/R3VD1iGXMpYhBOiBqfOE73Lc8g.png" alt="Team Image" width={408} height={270} />
                </div>
              </div>
            </div>
            <div className={styles.r7}>
              <div className={styles.image2}>
                <div className={styles.r23}>
                  <Image className={styles.r24} src="/assets/media/V3J90rHIKc4nzv04jrTpNTvLUKs.png" alt="Team Image" width={408} height={270} />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.r7}>
            <div className={styles.image5}>
              <div className={`${styles.r9} ${styles.onlyDesktop}`}>
                <Image className={styles.r10} src="/assets/media/jcv5R35hf7F7LHLQcvTvz65M0mU.png" alt="Team Image" width={408} height={300} />
              </div>
              <div className={`${styles.abstractDesign5} ${styles.onlyDesktop}`}>
                <div className={styles.r53}>
                  <Image className={styles.r54} src="/assets/media/Nb6dW40OdkepW6fD1s1E4SngK8.svg" alt="Design Image" width={41} height={40} />
                </div>
              </div>
              <div className={`${styles.r14} ${styles.onlyTablet}`}>
                <Image className={styles.r15} src="/assets/media/jcv5R35hf7F7LHLQcvTvz65M0mU.png" alt="Team Image" width={408} height={300} />
              </div>
              <div className={`${styles.abstractDesign6} ${styles.onlyTablet}`}>
                <div className={styles.r56}>
                  <Image className={styles.r57} src="/assets/media/Nb6dW40OdkepW6fD1s1E4SngK8.svg" alt="Design Image" width={41} height={40} />
                </div>
              </div>
              <div className={`${styles.r58} ${styles.onlyPhone}`}>
                <Image className={styles.r59} src="/assets/media/jcv5R35hf7F7LHLQcvTvz65M0mU.png" alt="Team Image" width={408} height={300} />
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
