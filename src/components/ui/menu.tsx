"use client";

import type { ComponentProps, ReactNode } from "react";
import { DropdownMenu as M } from "radix-ui";
import { Check, ChevronRight } from "lucide-react";

import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/cn";

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export const MenuGroup = M.Group;
export const MenuSub = M.Sub;
export const MenuRadioGroup = M.RadioGroup;

const CONTENT =
  "z-50 min-w-[232px] overflow-hidden rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-lg outline-none animate-pop-in";

const ITEM =
  "relative flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-[13px] outline-none transition-colors data-[highlighted]:bg-surface-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

export function MenuContent({
  className,
  align = "end",
  sideOffset = 8,
  ...props
}: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(CONTENT, className)}
        {...props}
      />
    </M.Portal>
  );
}

export function MenuItem({
  icon,
  shortcut,
  destructive,
  className,
  children,
  ...props
}: ComponentProps<typeof M.Item> & {
  icon?: ReactNode;
  shortcut?: string;
  destructive?: boolean;
}) {
  return (
    <M.Item
      className={cn(
        ITEM,
        destructive && "text-destructive [&_svg]:text-destructive data-[highlighted]:bg-destructive-soft",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </M.Item>
  );
}

export function MenuRadioItem({
  icon,
  className,
  children,
  ...props
}: ComponentProps<typeof M.RadioItem> & { icon?: ReactNode }) {
  return (
    <M.RadioItem className={cn(ITEM, className)} {...props}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <M.ItemIndicator>
        <Check className="!text-primary" />
      </M.ItemIndicator>
    </M.RadioItem>
  );
}

export function MenuSubTrigger({
  icon,
  className,
  children,
  ...props
}: ComponentProps<typeof M.SubTrigger> & { icon?: ReactNode }) {
  return (
    <M.SubTrigger
      className={cn(ITEM, "data-[state=open]:bg-surface-hover", className)}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ChevronRight />
    </M.SubTrigger>
  );
}

export function MenuSubContent({ className, ...props }: ComponentProps<typeof M.SubContent>) {
  return (
    <M.Portal>
      <M.SubContent
        sideOffset={6}
        collisionPadding={12}
        className={cn(CONTENT, "min-w-[200px]", className)}
        {...props}
      />
    </M.Portal>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof M.Label>) {
  return (
    <M.Label
      className={cn(
        "px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof M.Separator>) {
  return <M.Separator className={cn("-mx-1.5 my-1.5 h-px bg-border", className)} {...props} />;
}
