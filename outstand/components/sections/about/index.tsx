import Hero from './Hero';
import OurStory from './OurStory';
import Features from './Features';
import TeamMembers from './TeamMembers';
import OurCulture from './OurCulture';
import Excellence from './Excellence';
import Testimonials from './Testimonials';
import Careers from './Careers';
import CallToAction from './CallToAction';

export default function AboutSections() {
  return (
    <>
      <Hero />
      <div className="pageShell pageShellFlush">
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
