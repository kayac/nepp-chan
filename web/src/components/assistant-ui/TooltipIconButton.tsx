import { Slottable } from "@radix-ui/react-slot";
import type { ComponentPropsWithRef } from "react";
import { forwardRef } from "react";

import { Button } from "~/components/ui/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/Tooltip";
import { cn } from "~/lib/class-merge";

type Props = ComponentPropsWithRef<typeof Button> & {
  tooltip: string;
  side?: "top" | "bottom" | "left" | "right";
};

export const TooltipIconButton = forwardRef<HTMLButtonElement, Props>(
  ({ children, tooltip, side = "bottom", className, ...rest }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          {...rest}
          className={cn("aui-button-icon size-6 p-1", className)}
          ref={ref}
        >
          <Slottable>{children}</Slottable>
          <span className="sr-only">{tooltip}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  ),
);

TooltipIconButton.displayName = "TooltipIconButton";
