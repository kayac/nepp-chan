import { AmbientBG } from "~/components/AmbientBG";
import { RootLayout } from "~/components/RootLayout";
import { FinalCTA } from "./components/FinalCTA";
import { FooterSection } from "./components/FooterSection";
import { Guide } from "./components/Guide";
import { Hero } from "./components/Hero";
import { Knowledge } from "./components/Knowledge";
import { Line } from "./components/Line";
import { MediaSection } from "./components/MediaSection";
import { Nav } from "./components/Nav";
import { ProfileSection } from "./components/ProfileSection";
import { Survey } from "./components/Survey";

export const LpPage = () => (
  <RootLayout>
    <AmbientBG />
    <div className="relative z-[2]">
      <Nav />
      <Hero />

      <section id="features" className="scroll-mt-20 px-7">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-[720px] pt-16 text-center md:pt-24">
            <div className="inline-block rounded-(--r-pill) bg-(--teal-50) px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-(--brand)">
              Features
            </div>
            <h2 className="mt-4 font-(family-name:--font-display) text-xl font-bold leading-[1.4] text-(--snow-800) sm:text-2xl md:text-3xl lg:text-4xl xl:text-[44px]">
              ねっぷちゃんにできること
            </h2>
            <p className="mt-4 text-[17px] leading-[1.85] text-(--fg-2)">
              村の歴史、お知らせ、地域のお店、役場の手続き——
              <br />
              音威子府のことなら、なんでもお話しできます。
            </p>
          </div>
          <Knowledge />
          <Guide />
          <Line />
          <Survey />
        </div>
      </section>

      <MediaSection />
      <ProfileSection />
      <FinalCTA />
      <FooterSection />
    </div>
  </RootLayout>
);
