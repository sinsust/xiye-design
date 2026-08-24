import Image from 'next/image';
import styles from './Content.module.css';

export default function Content() {
  return (
      <section className={styles.main}>
        <div className={styles.r1}>
          <div className={styles.background}>
            <div className={styles.r3}>
              <picture>
                <source media="(max-width: 809px)" srcSet="/assets/media/uxAzcI3QNmENiDSVZe9GOKaIi0.png" />
                <source media="(max-width: 1319px)" srcSet="/assets/media/wOjky7G3ggdUU3ZD2OnncXU9A8.png" />
                <img className={styles.r4} src="/assets/media/lE2RV4iTSTCJH3TNr5bnJkEOa8.png" alt="Hero Background" width={1440} height={1269} loading="lazy" decoding="async" />
              </picture>
            </div>
          </div>
        </div>
        <div className={styles.privacyPolicy}>
          <div className={styles.subContainer}>
            <div className={styles.container}>
              <div className={styles.subContainer2} data-border="true">
                <div className={styles.text}>
                  <p className={styles.r10}>
                    Privacy Policy
                  </p>
                </div>
              </div>
              <div className={styles.textContainer}>
                <div className={styles.heading}>
                  <h2 className={styles.r13}>
                    Our Privacy Policy
                  </h2>
                </div>
                <div className={styles.paragraph}>
                  <p className={styles.r15}>
                    Learn how we handle your personal information and ensure your privacy and data security on our platform.
                  </p>
                </div>
              </div>
            </div>
            <div className={styles.container2} data-border="true">
              <div className={styles.icon}>
                <div className={styles.r18}>
                  <Image className={styles.r19} src="/assets/media/yG8AFadFqhY2Dgkb8ijRb3zrxyQ.svg" alt="Icon" width={21} height={20} />
                </div>
              </div>
              <div className={styles.text2}>
                <p className={styles.r21}>
                  Last Updated on June, 24, 2024
                </p>
              </div>
            </div>
          </div>
          <div className={styles.subContainer3} data-border="true">
            <div className={styles.textContainer2} data-border="true">
              <div className={styles.heading2}>
                <h3 className={styles.r25}>
                  Information We Collect
                </h3>
              </div>
              <div className={styles.paragraph2}>
                <p className={styles.r27}>
                  We may collect personal information from you when you visit our website, register for an account, or interact with our services. This information may include your name, email address, contact details, and any other information you voluntarily provide to us.
                </p>
              </div>
            </div>
            <div className={styles.textContainer3} data-border="true">
              <div className={styles.textContainer4}>
                <div className={styles.heading2}>
                  <h3 className={styles.r25}>
                    How We Use Your Information
                  </h3>
                </div>
                <div className={styles.paragraph3}>
                  <p className={styles.r31}>
                    We may use the information we collect from you for various purposes, including:
                  </p>
                </div>
              </div>
              <div className={styles.paragraph4}>
                <ol className={styles.r33}>
                  <li className={styles.r34}>
                    <p className={styles.r35}>
                      Providing and improving our products and services
                    </p>
                  </li>
                  <li className={styles.r34}>
                    <p className={styles.r35}>
                      Personalizing your experience on our website
                    </p>
                  </li>
                  <li className={styles.r36}>
                    <p className={styles.r37}>
                      Communicating with you about your account and any updates or promotions
                    </p>
                  </li>
                  <li className={styles.r38}>
                    <p className={styles.r39}>
                      Analyzing website traffic and user behavior to enhance our offerings
                    </p>
                  </li>
                </ol>
              </div>
            </div>
            <div className={styles.textContainer5} data-border="true">
              <div className={styles.heading2}>
                <h3 className={styles.r25}>
                  Data Security
                </h3>
              </div>
              <div className={styles.paragraph4}>
                <p className={styles.r41}>
                  We take data security seriously and employ industry-standard measures to protect your personal information from unauthorized access, disclosure, alteration, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
                </p>
              </div>
            </div>
            <div className={styles.textContainer6} data-border="true">
              <div className={styles.heading2}>
                <h3 className={styles.r25}>
                  Third-Party Disclosure
                </h3>
              </div>
              <div className={styles.paragraph5}>
                <p className={styles.r44}>
                  We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as required by law or as necessary to provide our services. We may share your information with trusted third-party service providers who assist us in operating our website, conducting our business, or servicing you, provided that they agree to keep your information confidential.
                </p>
              </div>
            </div>
            <div className={styles.textContainer7} data-border="true">
              <div className={styles.heading2}>
                <h3 className={styles.r25}>
                  Cookies
                </h3>
              </div>
              <div className={styles.paragraph6}>
                <p className={styles.r47}>
                  Our website may use cookies to enhance your browsing experience and collect information about how you interact with our site. You can adjust your browser settings to refuse cookies or alert you when cookies are being sent, but some features of the site may not function properly without cookies.
                </p>
              </div>
            </div>
            <div className={styles.textContainer8} data-border="true">
              <div className={styles.heading3}>
                <h3 className={styles.r50}>
                  Changes to this Privacy Policy
                </h3>
              </div>
              <div className={styles.paragraph2}>
                <p className={styles.r27}>
                  We reserve the right to update or change this Privacy Policy at any time. Any changes will be posted on this page, and the effective date will be updated accordingly. We encourage you to review this Privacy Policy periodically for any updates.
                </p>
              </div>
            </div>
            <div className={styles.textContainer9} data-border="true">
              <div className={styles.heading2}>
                <h3 className={styles.r25}>
                  Contact Us
                </h3>
              </div>
              <div className={styles.paragraph7}>
                <p className={styles.r53}>
                  If you have any questions or concerns about our Privacy Policy or the handling of your personal information, please contact us at
                  <a className={styles.r54} href="mailto:pragadesh37v@gmail.com" target="_blank" rel="noreferrer">
                    <span className={styles.r55}>
                      hello@oustand.com
                    </span>
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
  );
}
