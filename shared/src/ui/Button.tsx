import { cn } from "@nepp-chan/shared/lib/class-merge";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-(--r-md) font-medium text-sm",
    "outline-none transition-colors duration-200 ease-out",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-(--brand) text-(--paper-0)",
          "hover:bg-(--brand-hover)",
          "focus-visible:ring-2 focus-visible:ring-(--teal-500) focus-visible:ring-offset-2",
        ].join(" "),
        destructive: [
          "bg-(--danger) text-white",
          "hover:bg-red-700",
          "focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2",
        ].join(" "),
        outline: [
          "border border-(--border-1) bg-(--bg-raised)",
          "text-(--fg-2)",
          "hover:bg-(--bg-sunken) hover:border-(--border-2)",
          "focus-visible:ring-2 focus-visible:ring-(--teal-500) focus-visible:ring-offset-2",
        ].join(" "),
        secondary: [
          "bg-(--bg-sunken) text-(--fg-2)",
          "hover:bg-(--paper-200)",
          "focus-visible:ring-2 focus-visible:ring-(--paper-200) focus-visible:ring-offset-2",
        ].join(" "),
        ghost: [
          "text-(--fg-3)",
          "hover:bg-(--bg-sunken) hover:text-(--fg-2)",
          "focus-visible:ring-2 focus-visible:ring-(--teal-500)/50",
          "active:bg-(--paper-200)/60",
        ].join(" "),
        link: [
          "text-(--brand) underline-offset-4",
          "hover:underline hover:text-(--brand-hover)",
        ].join(" "),
      },
      size: {
        default: "h-10 px-5 py-2 has-[>svg]:px-4",
        sm: "h-8 gap-1.5 rounded-(--r-sm) px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 rounded-(--r-md) px-6 has-[>svg]:px-5",
        icon: "size-9 rounded-(--r-md)",
        "icon-xs": "size-6 p-1 rounded-(--r-sm)",
        "icon-sm": "size-7 rounded-(--r-sm)",
        "icon-lg": "size-10 rounded-(--r-md)",
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
