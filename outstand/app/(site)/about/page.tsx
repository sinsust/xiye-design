import type { Metadata } from 'next';

import Hero from '@/components/sections/about/Hero';
import OurStory from '@/components/sections/about/OurStory';
import Features from '@/components/sections/about/Features';
import TeamMembers from '@/components/sections/about/TeamMembers';
import OurCulture from '@/components/sections/about/OurCulture';
import Excellence from '@/components/sections/about/Excellence';
import Testimonials from '@/components/sections/about/Testimonials';
import Careers from '@/components/sections/about/Careers';
import CallToAction from '@/components/sections/about/CallToAction';

export const metadata: Metadata = {
  title: 'About Us - Meet the Team',
  description:
    'Learn about our goal-oriented, highly qualified team dedicated to delivering exceptional results. Discover our mission, values, and the expertise that drives us.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About Us - Meet the Team',
    description:
      'Learn about our goal-oriented, highly qualified team dedicated to delivering exceptional results. Discover our mission, values, and the expertise that drives us.',
    url: '/about',
  },
};

export default function AboutPage() {
  return (
    <>
      <Hero />
      <div className="pageShell pageShellTightTop">
        <OurStory />
        <Features />
        <TeamMembers />
        <OurCulture />
        <Excellence />
        <Testimonials />
        <Careers />
        <CallToAction />
      </div>
    </>
  );
}
