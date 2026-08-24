import ProjectsHero from './ProjectsHero';
import Projects from './Projects';
import Portfolio from './Portfolio';
import Excellence from './Excellence';
import Testimonials from './Testimonials';
import Partners from './Partners';
import ContactUs from './ContactUs';

export default function WorksSections() {
  return (
    <>
      <ProjectsHero />
      <div className="pageShell pageShellFlush">
        <Projects />
        <Portfolio />
        <Excellence />
        <Testimonials />
        <Partners />
        <ContactUs />
      </div>
    </>
  );
}
