import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

/**
 * Layout for the main site pages.
 *
 * The 404 lives outside this group because the original export renders it with
 * no header and no footer — a bare, full-viewport screen.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
