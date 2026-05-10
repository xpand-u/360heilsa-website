import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Einkapjalfun from "@/components/Einkapjalfun";
import Coach360 from "@/components/Coach360";
import Podcast from "@/components/Podcast";
import WayOfLife from "@/components/WayOfLife";
import Footer from "@/components/Footer";
import AuthHashRedirect from "@/components/AuthHashRedirect";

export default function Home() {
  return (
    <main>
      <AuthHashRedirect />
      <Nav />
      <Hero />
      <About />
      <Einkapjalfun />
      <Coach360 />
      <Podcast />
      <WayOfLife />
      <Footer />
    </main>
  );
}
