'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './PricingPlan.module.css';

export default function PricingPlan() {
  const [yearly, setYearly] = useState(false);

  return (
      <section className={styles.pricingPlan}>
        <div className={styles.r1}>
          <div className={styles.r2}>
            <div className={styles.dektop}>
              <div className={styles.tag} data-border="true">
                <div className={styles.icon}>
                  <div className={styles.r6}>
                    <Image className={styles.r7} src="/assets/media/FFqNUcSsgkVR6pPcSidAiBgL8.svg" alt="Icon" width={20} height={20} />
                  </div>
                </div>
                <div className={styles.text}>
                  <p className={styles.r9}>
                    Pricing plans
                  </p>
                </div>
              </div>
              <div className={styles.textContainer}>
                <div className={styles.heading}>
                  <h2 className={styles.r12}>
                    Unlock Your Digital Potential with Oustand&apos;s Pricing Plans
                  </h2>
                </div>
                <div className={styles.paragraph}>
                  <p className={styles.r14}>
                    Embark on your digital journey with Oustand&apos;s range of pricing plans designed to meet your needs and propel your business forward.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.r1}>
          <div className={styles.r15}>
            <div className={styles.desktopMonthly}>
              <div className={styles.container} data-yearly={yearly}>
                <div className={styles.monthly} onClick={() => setYearly(false)}>
                  <p className={styles.r19}>
                    Monthly
                  </p>
                </div>
                <div
                  className={styles.toggle}
                  data-border="true"
                  role="switch"
                  aria-checked={yearly}
                  aria-label="Bill yearly"
                  tabIndex={0}
                  onClick={() => setYearly((v) => !v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setYearly((v) => !v);
                    }
                  }}
                >
                  <div className={styles.ellipse2} />
                </div>
                <div className={styles.yearly} onClick={() => setYearly(true)}>
                  <p className={styles.r23}>
                    Yearly
                  </p>
                </div>
                <div className={styles.abstractDesign}>
                  <div className={styles.text2}>
                    <p className={styles.r26}>
                      ( Save 20% )
                    </p>
                  </div>
                  <div className={styles.design}>
                    <div className={styles.r28}>
                      <Image className={styles.r29} src="/assets/media/f0JiZEf5UFSnsTGx0XVn3jcB5s.svg" alt="Design Image" width={52} height={40} />
                    </div>
                  </div>
                  <div className={styles.design2}>
                    <div className={styles.r31}>
                      <Image className={styles.r32} src="/assets/media/NwxZKIsJvtFCFMFxK2Xgq9pVjAg.svg" alt="Design Image" width={11} height={12} />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.container2}>
                <div className={styles.card} data-border="true">
                  <div className={styles.textContainer2}>
                    <div className={styles.heading2}>
                      <h3 className={styles.r37}>
                        Starter plan
                      </h3>
                    </div>
                    <div className={styles.line} />
                    <div className={styles.paragraph2}>
                      <p className={styles.r40}>
                        The Starter Plan is perfect for businesses looking to build a professional website
                      </p>
                    </div>
                  </div>
                  <div className={styles.textContainer3}>
                    <div className={styles.number}>
                      <p className={`${styles.r43} ${styles.priceValue}`}>
                        {yearly ? '$4999' : '$499'}
                      </p>
                    </div>
                    <div className={styles.text3}>
                      <p className={styles.r45}>
                        /month
                      </p>
                    </div>
                  </div>
                  <div className={styles.itemsContainer}>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <Image className={styles.r52} src="/assets/media/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text4}>
                          <p className={styles.r54}>
                            Professionally Designed Website
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <Image className={styles.r52} src="/assets/media/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text4}>
                          <p className={styles.r54}>
                            Basic SEO Optimization
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <Image className={styles.r52} src="/assets/media/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text4}>
                          <p className={styles.r54}>
                            Social Media Setup (3 Platforms)
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <Image className={styles.r52} src="/assets/media/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text4}>
                          <p className={styles.r54}>
                            Monthly Performance Reports
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.r55}>
                    <Link className={styles.hoverArrow} data-border="true" href="/contact">
                      <div className={styles.text5}>
                        <p className={styles.r58}>
                          Get Started
                        </p>
                      </div>
                      <div className={styles.iconRight}>
                        <div className={styles.icon}>
                          <div className={styles.r6}>
                            <Image className={styles.r60} src="/assets/media/lJSvGFGPhRLFfxcyPg1nppxYdA.svg" alt="" width={20} height={20} aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
                <div className={styles.card2} data-border="true">
                  <div className={styles.textContainer4}>
                    <div className={styles.container3}>
                      <div className={styles.heading3}>
                        <h3 className={styles.r65}>
                          Growth Plan
                        </h3>
                      </div>
                      <div className={styles.frame856} data-border="true">
                        <div className={styles.icon3}>
                          <div className={styles.r6}>
                            <Image className={styles.r68} src="/assets/media/ydUiyw6aFLrc1G7eEVXiBsr8u0.svg" alt="Icon" width={21} height={21} />
                          </div>
                        </div>
                        <div className={styles.popular}>
                          <p className={styles.r70}>
                            Popular
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.line2} />
                    <div className={styles.paragraph3}>
                      <p className={styles.r73}>
                        The Growth Plan is designed to accelerate your online growth with all the features.
                      </p>
                    </div>
                  </div>
                  <div className={styles.textContainer3}>
                    <div className={styles.number}>
                      <p className={`${styles.r43} ${styles.priceValue}`}>
                        {yearly ? '$9999' : '$999'}
                      </p>
                    </div>
                    <div className={styles.text3}>
                      <p className={styles.r45}>
                        /month
                      </p>
                    </div>
                  </div>
                  <div className={styles.itemsContainer2}>
                    <div className={styles.r75}>
                      <div className={styles.pointer12} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <Image className={styles.r52} src="/assets/media/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text6}>
                          <p className={styles.r78}>
                            Custom Website Design & Development
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r79}>
                      <div className={styles.pointer13} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <Image className={styles.r52} src="/assets/media/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text7}>
                          <p className={styles.r82}>
                            Advanced SEO Strategy
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r75}>
                      <div className={styles.pointer12} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <Image className={styles.r52} src="/assets/media/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text6}>
                          <p className={styles.r78}>
                            Social Media Management (5 Platforms)
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r79}>
                      <div className={styles.pointer13} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <Image className={styles.r52} src="/assets/media/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text7}>
                          <p className={styles.r82}>
                            Monthly Strategy Sessions
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.r83}>
                    <Link className={styles.iconLeftRight} href="/contact">
                      <div className={styles.text8}>
                        <p className={styles.r86}>
                          Accelerate Growth
                        </p>
                      </div>
                      <div className={styles.iconRight2}>
                        <div className={styles.icon4}>
                          <div className={styles.r89}>
                            <Image className={styles.r90} src="/assets/media/Z4EozQtdVmroG1HDLS4zKFJeGo.svg" alt="Icon" width={20} height={20} />
                          </div>
                        </div>
                      </div>
                      <div className={styles.shine} />
                    </Link>
                  </div>
                </div>
                <div className={styles.card3} data-border="true">
                  <div className={styles.textContainer5}>
                    <div className={styles.heading4}>
                      <h3 className={styles.r95}>
                        Enterprise Plan
                      </h3>
                    </div>
                    <div className={styles.line3}>
                      <div className={styles.r97}>
                        <svg className={styles.r98} />
                      </div>
                    </div>
                    <div className={styles.paragraph2}>
                      <p className={styles.r40}>
                        For enterprises with complex digital needs, our Enterprise Plan offers bespoke
                      </p>
                    </div>
                  </div>
                  <div className={styles.text9}>
                    <p className={styles.r100}>
                      Custom pricing
                    </p>
                  </div>
                  <div className={styles.itemsContainer}>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <Image className={styles.r52} src="/assets/media/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text4}>
                          <p className={styles.r54}>
                            Tailored Solutions for Enterprises
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <Image className={styles.r52} src="/assets/media/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text4}>
                          <p className={styles.r54}>
                            Advanced SEO & SEM Strategies
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <Image className={styles.r52} src="/assets/media/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text4}>
                          <p className={styles.r54}>
                            Dedicated Social Media Manager
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <Image className={styles.r52} src="/assets/media/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text4}>
                          <p className={styles.r54}>
                            Scalable Solutions for Future Growth
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.r55}>
                    <Link className={styles.hoverArrow} data-border="true" href="/contact">
                      <div className={styles.text10}>
                        <p className={styles.r102}>
                          Request Custom Quote
                        </p>
                      </div>
                      <div className={styles.iconRight}>
                        <div className={styles.icon}>
                          <div className={styles.r6}>
                            <Image className={styles.r60} src="/assets/media/lJSvGFGPhRLFfxcyPg1nppxYdA.svg" alt="" width={20} height={20} aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
