import { Slottable } from "@radix-ui/react-slot";
import type { ComponentPropsWithRef } from "react";
import { forwardRef } from "react";

import { Button } from "~/components/ui/Button";
import { cn } from "~/lib/class-merge";

type Props = ComponentPropsWithRef<typeof Button> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
};

export const TooltipIconButton = forwardRef<HTMLButtonElement, Props>(
  ({ children, tooltip, side: _side, className, ...rest }, ref) => (
    <Button
      variant="ghost"
      size="icon"
      {...rest}
      className={cn("aui-button-icon size-6 p-1", className)}
      ref={ref}
      aria-label={tooltip}
    >
      <Slottable>{children}</Slottable>
      <span className="sr-only">{tooltip}</span>
    </Button>
  ),
);

TooltipIconButton.displayName = "TooltipIconButton";
