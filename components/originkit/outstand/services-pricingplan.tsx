'use client';

import { useState } from 'react';
// next/image stripped
import styles from './services-pricingplan.module.css';

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
                    <img className={styles.r7} src="/originkit/outstand/services-pricingplan/9DTJ5GS139lzKgnpozoPGAy2i0.svg" alt="Icon" width={20} height={20} />
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
                    Outstand&apos;s Service Packages
                  </h2>
                </div>
                <div className={styles.paragraph}>
                  <p className={styles.r14}>
                    Choose the package that best suits your needs. Whether you&apos;re just starting or looking to expand, we have options for everyone.
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
                      <img className={styles.r29} src="/originkit/outstand/services-pricingplan/f0JiZEf5UFSnsTGx0XVn3jcB5s.svg" alt="Design Image" width={52} height={40} />
                    </div>
                  </div>
                  <div className={styles.design2}>
                    <div className={styles.r31}>
                      <img className={styles.r32} src="/originkit/outstand/services-pricingplan/NwxZKIsJvtFCFMFxK2Xgq9pVjAg.svg" alt="Design Image" width={11} height={12} />
                    </div>
                  </div>
                </div>
              </div>
              <div className={styles.container2}>
                <div className={styles.card} data-border="true">
                  <div className={styles.textContainer2}>
                    <div className={styles.heading2}>
                      <h3 className={styles.r37}>
                        Basic Package
                      </h3>
                    </div>
                    <div className={styles.line} />
                    <div className={styles.text3}>
                      <p className={styles.r40}>
                        Ideal for small businesses looking to establish an online presence.
                      </p>
                    </div>
                  </div>
                  <div className={styles.textContainer3}>
                    <div className={styles.number}>
                      <p className={`${styles.r43} ${styles.priceValue}`}>
                        {yearly ? '$2999' : '$299'}
                      </p>
                    </div>
                    <div className={styles.text4}>
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
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Web Designing
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Digital Marketing
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.r55}>
                    <a className={styles.hoverArrow} data-border="true" href="#">
                      <div className={styles.text6}>
                        <p className={styles.r58}>
                          Get Started
                        </p>
                      </div>
                      <div className={styles.iconRight}>
                        <div className={styles.icon}>
                          <div className={styles.r6}>
                            <img className={styles.r60} src="/originkit/outstand/services-pricingplan/lJSvGFGPhRLFfxcyPg1nppxYdA.svg" alt="" width={20} height={20} aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                    </a>
                  </div>
                </div>
                <div className={styles.card2} data-border="true">
                  <div className={styles.textContainer4}>
                    <div className={styles.heading2}>
                      <h3 className={styles.r37}>
                        Standard Package
                      </h3>
                    </div>
                    <div className={styles.line} />
                    <div className={styles.text7}>
                      <p className={styles.r64}>
                        Perfect for businesses looking to expand their digital marketing efforts beyond.
                      </p>
                    </div>
                  </div>
                  <div className={styles.textContainer3}>
                    <div className={styles.number}>
                      <p className={`${styles.r43} ${styles.priceValue}`}>
                        {yearly ? '$4999' : '$499'}
                      </p>
                    </div>
                    <div className={styles.text4}>
                      <p className={styles.r45}>
                        /month
                      </p>
                    </div>
                  </div>
                  <div className={styles.itemsContainer2}>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Web Designing
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Digital Marketing
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            SEO
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            UI Design
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.r55}>
                    <a className={styles.hoverArrow} data-border="true" href="#">
                      <div className={styles.text6}>
                        <p className={styles.r58}>
                          Get Started
                        </p>
                      </div>
                      <div className={styles.iconRight}>
                        <div className={styles.icon}>
                          <div className={styles.r6}>
                            <img className={styles.r60} src="/originkit/outstand/services-pricingplan/lJSvGFGPhRLFfxcyPg1nppxYdA.svg" alt="" width={20} height={20} aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                    </a>
                  </div>
                </div>
                <div className={styles.card3} data-border="true">
                  <div className={styles.textContainer4}>
                    <div className={styles.heading2}>
                      <h3 className={styles.r37}>
                        Premium Package
                      </h3>
                    </div>
                    <div className={styles.line} />
                    <div className={styles.text7}>
                      <p className={styles.r64}>
                        Designed for businesses looking for a comprehensive digital marketing solution.
                      </p>
                    </div>
                  </div>
                  <div className={styles.textContainer3}>
                    <div className={styles.number}>
                      <p className={`${styles.r43} ${styles.priceValue}`}>
                        {yearly ? '$9999' : '$999'}
                      </p>
                    </div>
                    <div className={styles.text4}>
                      <p className={styles.r45}>
                        /month
                      </p>
                    </div>
                  </div>
                  <div className={styles.itemsContainer3}>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Web Designing
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Digital Marketing
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Branding
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            SEO
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Content Strategy
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            UI Design
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.r55}>
                    <a className={styles.hoverArrow} data-border="true" href="#">
                      <div className={styles.text6}>
                        <p className={styles.r58}>
                          Get Started
                        </p>
                      </div>
                      <div className={styles.iconRight}>
                        <div className={styles.icon}>
                          <div className={styles.r6}>
                            <img className={styles.r60} src="/originkit/outstand/services-pricingplan/lJSvGFGPhRLFfxcyPg1nppxYdA.svg" alt="" width={20} height={20} aria-hidden="true" />
                          </div>
                        </div>
                      </div>
                    </a>
                  </div>
                </div>
                <div className={styles.card4} data-border="true">
                  <div className={styles.textContainer5}>
                    <div className={styles.heading2}>
                      <h3 className={styles.r70}>
                        Custom Package
                      </h3>
                    </div>
                    <div className={styles.line} />
                    <div className={styles.text8}>
                      <p className={styles.r72}>
                        Custom package is tailored to meet your specific needs and goals.
                        <br className={styles.r73} />
                        <br className={styles.r73} />
                      </p>
                    </div>
                  </div>
                  <div className={styles.text9}>
                    <p className={styles.r75}>
                      Custom
                    </p>
                  </div>
                  <div className={styles.itemsContainer4}>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Web Designing
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Digital Marketing
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Branding
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            SEO
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Content Strategy
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            UI Design
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            UX Research
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.r47}>
                      <div className={styles.pointer1} data-border="true">
                        <div className={styles.iconWrap}>
                          <div className={styles.icon2}>
                            <div className={styles.r51}>
                              <img className={styles.r52} src="/originkit/outstand/services-pricingplan/EwgbXikcCY3tz44KnCvHTil6Uk.svg" alt="Tick Icon" width={18} height={18} />
                            </div>
                          </div>
                        </div>
                        <div className={styles.text5}>
                          <p className={styles.r54}>
                            Security Features
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={styles.r55}>
                    <a className={styles.iconLeftRight} href="#">
                      <div className={styles.text10}>
                        <p className={styles.r79}>
                          Get Started
                        </p>
                      </div>
                      <div className={styles.iconRight2}>
                        <div className={styles.icon3}>
                          <div className={styles.r82}>
                            <img className={styles.r83} src="/originkit/outstand/services-pricingplan/Z4EozQtdVmroG1HDLS4zKFJeGo.svg" alt="Icon" width={20} height={20} />
                          </div>
                        </div>
                      </div>
                      <div className={styles.shine} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}

