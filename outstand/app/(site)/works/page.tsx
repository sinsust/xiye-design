import type { Metadata } from 'next';

import ProjectsHero from '@/components/sections/works/ProjectsHero';
import Projects from '@/components/sections/works/Projects';
import Portfolio from '@/components/sections/works/Portfolio';
import Excellence from '@/components/sections/works/Excellence';
import Testimonials from '@/components/sections/works/Testimonials';
import Partners from '@/components/sections/works/Partners';
import ContactUs from '@/components/sections/works/ContactUs';
import ProjectScreens from '@/components/ui/ProjectScreens';

export const metadata: Metadata = {
  title: 'Works',
  description:
    'Discover our latest projects and success stories. Explore our portfolio to see how we deliver outstanding results, innovative solutions, and impactful designs across various industries.',
  alternates: { canonical: '/works' },
  openGraph: {
    title: 'Works',
    description:
      'Discover our latest projects and success stories. Explore our portfolio to see how we deliver outstanding results, innovative solutions, and impactful designs across various industries.',
    url: '/works',
  },
};

export default function WorksPage() {
  return (
    <>
      <ProjectScreens>
        <ProjectsHero />
      </ProjectScreens>
      <div className="pageShell pageShellFlush">
        <ProjectScreens>
          <Projects />
        </ProjectScreens>
        <ProjectScreens>
          <Portfolio />
        </ProjectScreens>
        <Excellence />
        <Testimonials />
        <Partners />
        <ContactUs />
      </div>
    </>
  );
}
