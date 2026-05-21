import { AmbientBG } from "@nepp-chan/shared/components/AmbientBG";
import { RootLayout } from "~/components/RootLayout";
import { FinalCTA } from "./FinalCTA";
import { FooterSection } from "./FooterSection";
import { Guide } from "./Guide";
import { Hero } from "./Hero";
import { Knowledge } from "./Knowledge";
import { Line } from "./Line";
import { MediaSection } from "./MediaSection";
import { Nav } from "./Nav";
import { ProfileSection } from "./ProfileSection";
import { Survey } from "./Survey";

export const LpPage = () => (
  <RootLayout>
    <AmbientBG />
    <div className="relative z-[2]">
      <Nav />
      <Hero />

      <section id="features" className="scroll-mt-20 px-7">
        <div className="mx-auto max-w-[1200px]">
          <div className="mx-auto max-w-[720px] pt-16 text-center md:pt-24">
            <div className="inline-block rounded-(--r-pill) bg-(--teal-50) px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-(--brand-hover)">
              Features
            </div>
            <h2 className="mt-4 font-(family-name:--font-display) text-xl font-bold leading-[1.4] text-(--snow-800) sm:text-2xl md:text-3xl lg:text-4xl xl:text-[44px]">
              ねっぷちゃんにできること
            </h2>
            <p className="mt-4 text-[17px] leading-[1.85] text-(--fg-2)">
              村の歴史、お知らせ、地域のお店、役場の手続き——
              <br className="hidden md:inline" />
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
