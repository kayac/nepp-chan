import { MailIcon } from "lucide-react";

export const FooterSection = () => (
  <footer className="border-t border-(--paper-200) bg-(--paper-100)/40 px-7 pb-10 pt-16">
    <div className="mx-auto grid max-w-[1100px] gap-10 md:grid-cols-3">
      <div>
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center overflow-hidden rounded-full bg-(--teal-50)">
            <img
              src="/mascot/expr-wave-smile.png"
              alt=""
              className="size-10 object-contain"
            />
          </span>
          <div>
            <div className="font-(family-name:--font-display) font-bold text-(--snow-800)">
              ねっぷちゃん
            </div>
            <div className="text-[11px] text-(--fg-3)">音威子府村 AI副村長</div>
          </div>
        </div>
        <p className="mt-4 text-[13px] leading-[1.85] text-(--fg-2)">
          北海道中川郡音威子府村
          <br />
          開発：面白法人カヤック
        </p>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-(--brand)">
          ねっぷちゃん
        </h4>
        <ul className="mt-3 flex flex-col gap-2 text-[13px]">
          <li>
            <a
              href="/"
              className="text-(--fg-2) transition-colors hover:text-(--brand)"
            >
              Web版で話す
            </a>
          </li>
          <li>
            <a
              href="#line"
              className="text-(--fg-2) transition-colors hover:text-(--brand)"
            >
              LINEで友達追加
            </a>
          </li>
          <li>
            <a
              href="#press"
              className="text-(--fg-2) transition-colors hover:text-(--brand)"
            >
              メディア掲載
            </a>
          </li>
        </ul>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-(--brand)">
          お問い合わせ
        </h4>
        <ul className="mt-3 flex flex-col gap-2 text-[13px]">
          <li>
            {/* TODO: 実在するメールアドレスに差し替え。リファレンス由来のモック値 */}
            <a
              href="mailto:nepp-chan@kayac.com"
              className="inline-flex items-center gap-1.5 text-(--fg-2) transition-colors hover:text-(--brand)"
            >
              <MailIcon className="size-3" aria-hidden="true" />{" "}
              nepp-chan@kayac.com
            </a>
          </li>
          <li>
            <a
              href="https://www.vill.otoineppu.hokkaido.jp/"
              target="_blank"
              rel="noopener"
              className="text-(--fg-2) transition-colors hover:text-(--brand)"
            >
              音威子府村 公式サイト
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div className="mx-auto mt-10 max-w-[1100px] border-t border-(--paper-200) pt-6 text-center text-xs text-(--fg-3)">
      © 2026 音威子府村 / 面白法人カヤック — Neppu-chan Project
    </div>
  </footer>
);
