import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "~/lib/class-merge";

const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-xl font-medium text-sm",
    "outline-none transition-all duration-200 ease-out",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-(--color-accent) text-white",
          "hover:bg-(--color-accent-hover) hover:scale-[1.02]",
          "focus-visible:ring-2 focus-visible:ring-(--color-accent-light) focus-visible:ring-offset-2",
          "active:scale-[0.98]",
        ].join(" "),
        destructive: [
          "bg-(--color-danger) text-white",
          "hover:bg-red-700 hover:scale-[1.02]",
          "focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2",
          "active:scale-[0.98]",
        ].join(" "),
        outline: [
          "border border-(--color-border) bg-(--color-surface)",
          "text-(--color-text-secondary)",
          "hover:bg-(--color-surface-hover) hover:border-(--color-border-subtle)",
          "focus-visible:ring-2 focus-visible:ring-(--color-accent-light) focus-visible:ring-offset-2",
          "active:scale-[0.98]",
        ].join(" "),
        secondary: [
          "bg-(--color-surface-hover) text-(--color-text-secondary)",
          "hover:bg-stone-200",
          "focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2",
          "active:scale-[0.98]",
        ].join(" "),
        ghost: [
          "text-(--color-text-muted)",
          "hover:bg-(--color-surface-hover) hover:text-(--color-text-secondary)",
          "focus-visible:ring-2 focus-visible:ring-(--color-accent-light)/50",
          "active:bg-stone-200/80",
        ].join(" "),
        link: [
          "text-(--color-accent) underline-offset-4",
          "hover:underline hover:text-(--color-accent-hover)",
        ].join(" "),
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        sm: "h-8 gap-1.5 rounded-lg px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-5",
        icon: "size-9 rounded-xl",
        "icon-sm": "size-7 rounded-lg",
        "icon-lg": "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type Props = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = ({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: Props) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
};

export { buttonVariants };
