import type { ComponentProps } from "react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/cn";

const VARIANTS = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
  secondary:
    "border border-border bg-surface text-foreground shadow-sm hover:border-border-strong hover:bg-surface-hover",
  ghost: "text-foreground hover:bg-surface-hover",
  muted: "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
  danger: "text-destructive hover:bg-destructive-soft",
} as const;

const SIZES = {
  xs: "h-7 gap-1.5 rounded-md px-2 text-xs [&_svg]:size-3.5",
  sm: "h-8 gap-1.5 rounded-md px-2.5 text-[13px] [&_svg]:size-4",
  md: "h-9 gap-2 rounded-lg px-3.5 text-sm [&_svg]:size-4",
  lg: "h-11 gap-2 rounded-xl px-5 text-[15px] [&_svg]:size-[18px]",
  icon: "size-9 rounded-lg [&_svg]:size-[18px]",
  "icon-sm": "size-8 rounded-md [&_svg]:size-4",
  "icon-lg": "size-11 rounded-xl [&_svg]:size-5",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium",
    "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150",
    // A press you can feel: the button gives a little under the pointer.
    "active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render the child element (a link, a trigger) with button styling. */
  asChild?: boolean;
};

export function Button({ variant, size, asChild, className, type, ...props }: ButtonProps) {
  if (asChild) {
    return <Slot.Root className={buttonClass(variant, size, className)} {...props} />;
  }
  return (
    <button
      type={type ?? "button"}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  );
}
