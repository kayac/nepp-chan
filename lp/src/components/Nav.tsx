import { WEB_URL } from "~/constants/urls";

const LINKS = [
  { href: "#chat", label: "話しかける" },
  { href: "#features", label: "機能" },
  { href: "#press", label: "メディア" },
  { href: "#profile", label: "プロフィール" },
];

export const Nav = () => (
  <nav className="sticky top-0 z-50 border-b border-(--paper-200) bg-[rgba(254,253,251,0.85)] [backdrop-filter:saturate(160%)_blur(10px)]">
    <div className="mx-auto flex max-w-[1200px] items-center gap-2 px-4 py-3 sm:gap-4 sm:px-7 sm:py-3.5">
      <div className="flex items-center gap-2 font-(family-name:--font-display) text-lg font-bold text-(--snow-800) sm:gap-2.5">
        <img
          className="block h-9 w-auto sm:h-[52px]"
          src="/logo-neppu.png"
          alt="ねっぷちゃん"
        />
        <span className="rounded-(--r-pill) bg-(--teal-50) px-2 py-0.5 text-[10px] font-medium tracking-[0.04em] text-(--brand) sm:text-[11px]">
          BETA
        </span>
      </div>

      <div className="ml-auto hidden items-center gap-[22px] text-sm md:flex">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="font-medium text-(--fg-2) transition-colors duration-200 hover:text-(--brand)"
          >
            {link.label}
          </a>
        ))}
      </div>

      <a
        href={WEB_URL}
        className="ml-auto rounded-(--r-pill) bg-(--brand) px-3 py-1.5 text-xs font-semibold text-white shadow-(--shadow-sm) transition-all duration-200 hover:-translate-y-px hover:bg-(--brand-hover) hover:shadow-(--shadow-brand) sm:px-4 sm:py-2 sm:text-sm md:ml-0"
      >
        いますぐ話す
      </a>
    </div>
  </nav>
);
