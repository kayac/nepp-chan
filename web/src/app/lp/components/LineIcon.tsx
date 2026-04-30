type Props = {
  size?: number;
  className?: string;
};

/** LINE 公式ロゴ（PNG 版）。lucide-react に該当アイコンが無いため独自に保持 */
export const LineIcon = ({ size = 16, className }: Props) => (
  <img
    src="/lp/icon_line.png"
    alt=""
    width={size}
    height={size}
    aria-hidden="true"
    className={className}
  />
);
