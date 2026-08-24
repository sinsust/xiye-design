import type { Metadata } from 'next';

import Hero from '@/components/sections/services/Hero';
import Expertise from '@/components/sections/services/Expertise';
import ServicesOverview from '@/components/sections/services/ServicesOverview';
import Services from '@/components/sections/services/Services';
import PricingPlan from '@/components/sections/services/PricingPlan';
import Comparison from '@/components/sections/services/Comparison';
import KeyFeatures from '@/components/sections/services/KeyFeatures';
import Payment from '@/components/sections/services/Payment';
import Benefits from '@/components/sections/services/Benefits';
import Faq from '@/components/sections/services/Faq';
import Process from '@/components/sections/services/Process';

export const metadata: Metadata = {
  title: 'Explore Our Services',
  description:
    'Explore our services in design and development for stunning websites, branding to elevate your identity, and digital marketing to boost your online presence and drive growth.',
  alternates: { canonical: '/services' },
  openGraph: {
    title: 'Explore Our Services',
    description:
      'Explore our services in design and development for stunning websites, branding to elevate your identity, and digital marketing to boost your online presence and drive growth.',
    url: '/services',
  },
};

export default function ServicesPage() {
  return (
    <>
      <Hero />
      <div className="pageShell">
        <Expertise />
        {/* Hidden on phones: this section only lays out correctly above 810px. */}
        <div className="hidePhone">
          <ServicesOverview />
        </div>
        <Services />
        <PricingPlan />
        <Comparison />
        <KeyFeatures />
        <Payment />
        <Benefits />
        <Faq />
        <Process />
      </div>
    </>
  );
}
