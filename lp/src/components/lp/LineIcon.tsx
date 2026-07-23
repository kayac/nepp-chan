type Props = {
  size?: number;
  className?: string;
};

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
