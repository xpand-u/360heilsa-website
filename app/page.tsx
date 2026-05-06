import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Einkapjalfun from "@/components/Einkapjalfun";
import Coach360 from "@/components/Coach360";
import Podcast from "@/components/Podcast";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <About />
      <Einkapjalfun />
      <Coach360 />
      <Podcast />
      <Footer />
    </main>
  );
}
