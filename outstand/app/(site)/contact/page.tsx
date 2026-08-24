import type { Metadata } from 'next';

import Hero from '@/components/sections/contact/Hero';
import Support from '@/components/sections/contact/Support';
import DigitalPresence from '@/components/sections/contact/DigitalPresence';
import Faq from '@/components/sections/contact/Faq';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with us for inquiries, support, or collaboration. Find our contact details, send us a message, and we will be happy to assist you.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact Us',
    description:
      'Get in touch with us for inquiries, support, or collaboration. Find our contact details, send us a message, and we will be happy to assist you.',
    url: '/contact',
  },
};

export default function ContactPage() {
  return (
    <>
      <Hero />
      <div className="pageShell">
        <Support />
        <DigitalPresence />
        <Faq />
      </div>
    </>
  );
}
