'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './Faq.module.css';

export default function Faq() {
  const [faqOpen, setFaqOpen] = useState<string | null>(null);

  return (
      <section className={styles.faqS}>
        <div className={styles.r1}>
          <div className={styles.r2}>
            <div className={styles.dektop}>
              <div className={styles.tag} data-border="true">
                <div className={styles.icon}>
                  <div className={styles.r6}>
                    <Image className={styles.r7} src="/assets/media/n806fLLfwVbcz99FKpeYvQPlYU.svg" alt="Icon" width={21} height={20} />
                  </div>
                </div>
                <div className={styles.text}>
                  <p className={styles.r9}>
                    FAQ’s
                  </p>
                </div>
              </div>
              <div className={styles.textContainer}>
                <div className={styles.heading}>
                  <h2 className={styles.r12}>
                    Questions? We Have Answers
                  </h2>
                </div>
                <div className={styles.paragraph}>
                  <p className={styles.r14}>
                    Still you have any questions? Contact our Team via support@Oustand.digital.com
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.subContainer}>
          <div className={styles.r1}>
            <div className={styles.r16}>
              <div className={styles.big} data-border="true">
                <div className={styles.subContainer2} data-border="true">
                  <div className={styles.heading2}>
                    <p className={styles.r20}>
                      Design & Development Questions
                    </p>
                  </div>
                </div>
                <div className={styles.container}>
                  <div className={styles.r22}>
                    <div className={styles.bigClosed}>
                      <div className={styles.container2}>
                        <div
                          className={`${styles.question} ${styles.faqRow}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={faqOpen === 'What is your process for starting a new project?'}
                          onClick={() => setFaqOpen(faqOpen === 'What is your process for starting a new project?' ? null : 'What is your process for starting a new project?')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setFaqOpen(faqOpen === 'What is your process for starting a new project?' ? null : 'What is your process for starting a new project?');
                            }
                          }}
                        >
                          <div className={styles.r26}>
                            <h3 className={styles.r27}>
                              What is your process for starting a new project?
                            </h3>
                          </div>
                          <div className={styles.iconContainer}>
                            <div className={`${styles.plusIcon} ${faqOpen === 'What is your process for starting a new project?' ? styles.faqIconOpen : ''}`}>
                              <div className={styles.r30}>
                                <Image className={styles.r31} src="/assets/media/leohuAtxHXf3P9ABFpoZKAm5U.svg" alt="Plus Icon" width={24} height={24} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {faqOpen === 'What is your process for starting a new project?' && (
                          <p className={styles.faqAnswer}>
                            {'Our process typically begins with an initial consultation to understand your needs and goals. We then move on to the research and concept phase, followed by design development, feedback, revisions, and finally, the delivery of the completed design.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.line} />
                  <div className={styles.r33}>
                    <div className={styles.bigClosed2}>
                      <div className={styles.container3}>
                        <div
                          className={`${styles.question2} ${styles.faqRow}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={faqOpen === 'What file formats will I receive for the final designs?'}
                          onClick={() => setFaqOpen(faqOpen === 'What file formats will I receive for the final designs?' ? null : 'What file formats will I receive for the final designs?')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setFaqOpen(faqOpen === 'What file formats will I receive for the final designs?' ? null : 'What file formats will I receive for the final designs?');
                            }
                          }}
                        >
                          <div className={styles.r37}>
                            <h3 className={styles.r38}>
                              What file formats will I receive for the final designs?
                            </h3>
                          </div>
                          <div className={styles.iconContainer}>
                            <div className={`${styles.plusIcon} ${faqOpen === 'What file formats will I receive for the final designs?' ? styles.faqIconOpen : ''}`}>
                              <div className={styles.r30}>
                                <Image className={styles.r31} src="/assets/media/leohuAtxHXf3P9ABFpoZKAm5U.svg" alt="Plus Icon" width={24} height={24} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {faqOpen === 'What file formats will I receive for the final designs?' && (
                          <p className={styles.faqAnswer}>
                            {'We deliver final designs in a range of formats suitable for both digital and print use. Common formats include JPEG, PNG, PDF, and vector files such as AI or EPS.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.line} />
                  <div className={styles.r33}>
                    <div className={styles.bigClosed2}>
                      <div className={styles.container3}>
                        <div
                          className={`${styles.question2} ${styles.faqRow}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={faqOpen === 'What web development technologies do you specialize in?'}
                          onClick={() => setFaqOpen(faqOpen === 'What web development technologies do you specialize in?' ? null : 'What web development technologies do you specialize in?')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setFaqOpen(faqOpen === 'What web development technologies do you specialize in?' ? null : 'What web development technologies do you specialize in?');
                            }
                          }}
                        >
                          <div className={styles.r37}>
                            <h3 className={styles.r38}>
                              What web development technologies do you specialize in?
                            </h3>
                          </div>
                          <div className={styles.iconContainer}>
                            <div className={`${styles.plusIcon} ${faqOpen === 'What web development technologies do you specialize in?' ? styles.faqIconOpen : ''}`}>
                              <div className={styles.r30}>
                                <Image className={styles.r31} src="/assets/media/leohuAtxHXf3P9ABFpoZKAm5U.svg" alt="Plus Icon" width={24} height={24} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {faqOpen === 'What web development technologies do you specialize in?' && (
                          <p className={styles.faqAnswer}>
                            {'We specialize in HTML, CSS, JavaScript, React, Angular, Node.js, and Python/Django. We also work with WordPress and Drupal.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.line} />
                  <div className={styles.r22}>
                    <div className={styles.bigClosed}>
                      <div className={styles.container2}>
                        <div
                          className={`${styles.question} ${styles.faqRow}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={faqOpen === 'Do you offer custom web development solutions?'}
                          onClick={() => setFaqOpen(faqOpen === 'Do you offer custom web development solutions?' ? null : 'Do you offer custom web development solutions?')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setFaqOpen(faqOpen === 'Do you offer custom web development solutions?' ? null : 'Do you offer custom web development solutions?');
                            }
                          }}
                        >
                          <div className={styles.r26}>
                            <h3 className={styles.r27}>
                              Do you offer custom web development solutions?
                            </h3>
                          </div>
                          <div className={styles.iconContainer}>
                            <div className={`${styles.plusIcon} ${faqOpen === 'Do you offer custom web development solutions?' ? styles.faqIconOpen : ''}`}>
                              <div className={styles.r30}>
                                <Image className={styles.r31} src="/assets/media/leohuAtxHXf3P9ABFpoZKAm5U.svg" alt="Plus Icon" width={24} height={24} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {faqOpen === 'Do you offer custom web development solutions?' && (
                          <p className={styles.faqAnswer}>
                            {'Yes, we offer tailored web development solutions to meet your specific needs and requirements.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.line} />
                  <div className={styles.r33}>
                    <div className={styles.bigClosed2}>
                      <div className={styles.container3}>
                        <div
                          className={`${styles.question2} ${styles.faqRow}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={faqOpen === 'Can you explain your approach to responsive design.'}
                          onClick={() => setFaqOpen(faqOpen === 'Can you explain your approach to responsive design.' ? null : 'Can you explain your approach to responsive design.')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setFaqOpen(faqOpen === 'Can you explain your approach to responsive design.' ? null : 'Can you explain your approach to responsive design.');
                            }
                          }}
                        >
                          <div className={styles.r37}>
                            <h3 className={styles.r38}>
                              Can you explain your approach to responsive design.
                            </h3>
                          </div>
                          <div className={styles.iconContainer}>
                            <div className={`${styles.plusIcon} ${faqOpen === 'Can you explain your approach to responsive design.' ? styles.faqIconOpen : ''}`}>
                              <div className={styles.r30}>
                                <Image className={styles.r31} src="/assets/media/leohuAtxHXf3P9ABFpoZKAm5U.svg" alt="Plus Icon" width={24} height={24} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {faqOpen === 'Can you explain your approach to responsive design.' && (
                          <p className={styles.faqAnswer}>
                            {'We design websites to ensure they provide an optimal viewing experience across all devices. This includes flexible layouts, media queries, and scalable images to adapt to different screen sizes.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.r1}>
            <div className={styles.r39}>
              <div className={styles.big2} data-border="true">
                <div className={styles.subContainer2} data-border="true">
                  <div className={styles.heading2}>
                    <p className={styles.r20}>
                      Marketing Service Questions
                    </p>
                  </div>
                </div>
                <div className={styles.container4}>
                  <div className={styles.r33}>
                    <div className={styles.bigClosed2}>
                      <div className={styles.container3}>
                        <div
                          className={`${styles.question2} ${styles.faqRow}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={faqOpen === 'What digital marketing channels do you specialize in?'}
                          onClick={() => setFaqOpen(faqOpen === 'What digital marketing channels do you specialize in?' ? null : 'What digital marketing channels do you specialize in?')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setFaqOpen(faqOpen === 'What digital marketing channels do you specialize in?' ? null : 'What digital marketing channels do you specialize in?');
                            }
                          }}
                        >
                          <div className={styles.r37}>
                            <h3 className={styles.r38}>
                              What digital marketing channels do you specialize in?
                            </h3>
                          </div>
                          <div className={styles.iconContainer}>
                            <div className={`${styles.plusIcon} ${faqOpen === 'What digital marketing channels do you specialize in?' ? styles.faqIconOpen : ''}`}>
                              <div className={styles.r30}>
                                <Image className={styles.r31} src="/assets/media/leohuAtxHXf3P9ABFpoZKAm5U.svg" alt="Plus Icon" width={24} height={24} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {faqOpen === 'What digital marketing channels do you specialize in?' && (
                          <p className={styles.faqAnswer}>
                            {'We specialize in SEO, PPC, social media marketing, email marketing, and content marketing.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.line} />
                  <div className={styles.r33}>
                    <div className={styles.bigClosed2}>
                      <div className={styles.container3}>
                        <div
                          className={`${styles.question2} ${styles.faqRow}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={faqOpen === 'Do you offer any customized digital marketing packages?'}
                          onClick={() => setFaqOpen(faqOpen === 'Do you offer any customized digital marketing packages?' ? null : 'Do you offer any customized digital marketing packages?')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setFaqOpen(faqOpen === 'Do you offer any customized digital marketing packages?' ? null : 'Do you offer any customized digital marketing packages?');
                            }
                          }}
                        >
                          <div className={styles.r37}>
                            <h3 className={styles.r38}>
                              Do you offer any customized digital marketing packages?
                            </h3>
                          </div>
                          <div className={styles.iconContainer}>
                            <div className={`${styles.plusIcon} ${faqOpen === 'Do you offer any customized digital marketing packages?' ? styles.faqIconOpen : ''}`}>
                              <div className={styles.r30}>
                                <Image className={styles.r31} src="/assets/media/leohuAtxHXf3P9ABFpoZKAm5U.svg" alt="Plus Icon" width={24} height={24} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {faqOpen === 'Do you offer any customized digital marketing packages?' && (
                          <p className={styles.faqAnswer}>
                            {'Yes, we offer customized digital marketing packages tailored to your business goals and budget.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.line} />
                  <div className={styles.r33}>
                    <div className={styles.bigClosed2}>
                      <div className={styles.container3}>
                        <div
                          className={`${styles.question2} ${styles.faqRow}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={faqOpen === 'How do you measure the success of your digital marketing campaigns?'}
                          onClick={() => setFaqOpen(faqOpen === 'How do you measure the success of your digital marketing campaigns?' ? null : 'How do you measure the success of your digital marketing campaigns?')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setFaqOpen(faqOpen === 'How do you measure the success of your digital marketing campaigns?' ? null : 'How do you measure the success of your digital marketing campaigns?');
                            }
                          }}
                        >
                          <div className={styles.r37}>
                            <h3 className={styles.r38}>
                              How do you measure the success of your digital marketing campaigns?
                            </h3>
                          </div>
                          <div className={styles.iconContainer}>
                            <div className={`${styles.plusIcon} ${faqOpen === 'How do you measure the success of your digital marketing campaigns?' ? styles.faqIconOpen : ''}`}>
                              <div className={styles.r30}>
                                <Image className={styles.r31} src="/assets/media/leohuAtxHXf3P9ABFpoZKAm5U.svg" alt="Plus Icon" width={24} height={24} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {faqOpen === 'How do you measure the success of your digital marketing campaigns?' && (
                          <p className={styles.faqAnswer}>
                            {'We measure success using key performance indicators (KPIs) such as website traffic, conversion rates, engagement metrics, and ROI.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.line} />
                  <div className={styles.r33}>
                    <div className={styles.bigClosed2}>
                      <div className={styles.container3}>
                        <div
                          className={`${styles.question2} ${styles.faqRow}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={faqOpen === 'How will you help me build and engage my audience on social media platforms?'}
                          onClick={() => setFaqOpen(faqOpen === 'How will you help me build and engage my audience on social media platforms?' ? null : 'How will you help me build and engage my audience on social media platforms?')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setFaqOpen(faqOpen === 'How will you help me build and engage my audience on social media platforms?' ? null : 'How will you help me build and engage my audience on social media platforms?');
                            }
                          }}
                        >
                          <div className={styles.r42}>
                            <h3 className={styles.r43}>
                              How will you help me build and engage my audience on social media platforms?
                            </h3>
                          </div>
                          <div className={styles.iconContainer}>
                            <div className={`${styles.plusIcon} ${faqOpen === 'How will you help me build and engage my audience on social media platforms?' ? styles.faqIconOpen : ''}`}>
                              <div className={styles.r30}>
                                <Image className={styles.r31} src="/assets/media/leohuAtxHXf3P9ABFpoZKAm5U.svg" alt="Plus Icon" width={24} height={24} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {faqOpen === 'How will you help me build and engage my audience on social media platforms?' && (
                          <p className={styles.faqAnswer}>
                            {'We will create strategic content, utilize targeted advertising, engage with followers, and analyze metrics to optimize your social media presence and foster audience interaction.'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.line} />
                  <div className={styles.r33}>
                    <div className={styles.bigClosed2}>
                      <div className={styles.container3}>
                        <div
                          className={`${styles.question2} ${styles.faqRow}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={faqOpen === 'Can you provide examples of successful digital marketing campaigns?'}
                          onClick={() => setFaqOpen(faqOpen === 'Can you provide examples of successful digital marketing campaigns?' ? null : 'Can you provide examples of successful digital marketing campaigns?')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setFaqOpen(faqOpen === 'Can you provide examples of successful digital marketing campaigns?' ? null : 'Can you provide examples of successful digital marketing campaigns?');
                            }
                          }}
                        >
                          <div className={styles.r37}>
                            <h3 className={styles.r38}>
                              Can you provide examples of successful digital marketing campaigns?
                            </h3>
                          </div>
                          <div className={styles.iconContainer}>
                            <div className={`${styles.plusIcon} ${faqOpen === 'Can you provide examples of successful digital marketing campaigns?' ? styles.faqIconOpen : ''}`}>
                              <div className={styles.r30}>
                                <Image className={styles.r31} src="/assets/media/leohuAtxHXf3P9ABFpoZKAm5U.svg" alt="Plus Icon" width={24} height={24} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {faqOpen === 'Can you provide examples of successful digital marketing campaigns?' && (
                          <p className={styles.faqAnswer}>
                            {'Certainly! Examples include viral social media campaigns that increased brand awareness, targeted PPC campaigns that boosted conversions, and SEO strategies that significantly improved organic search rankings.'}
                          </p>
                        )}
                      </div>
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
