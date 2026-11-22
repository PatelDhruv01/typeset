"use client";

import {
  BookOpen,
  ClipboardPaste,
  Command,
  Download,
  FileCode2,
  FilePlus2,
  FileText,
  FolderOpen,
  Keyboard,
  Monitor,
  Moon,
  MoreHorizontal,
  Sun,
  SunMoon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "@/components/ui/menu";
import { Tip } from "@/components/ui/tooltip";
import { useTheme, type ThemePreference } from "@/lib/app/theme";
import { SAMPLES } from "@/lib/samples";

export type MoreMenuActions = {
  onNew: () => void;
  onOpenFile: () => void;
  onPaste: () => void;
  onSample: (id: string) => void;
  onPdf: () => void;
  onHtml: () => void;
  onMarkdown: () => void;
  onShortcuts: () => void;
  onCommandMenu: () => void;
};

export function MoreMenu({
  modKey,
  showExports,
  showKeyboardHelp,
  ...actions
}: MoreMenuActions & {
  modKey: string;
  /** Phones have no split Download button, so the formats live here. */
  showExports: boolean;
  /** Keyboard shortcuts mean nothing on a touch-only device. */
  showKeyboardHelp: boolean;
}) {
  const { preference, setPreference } = useTheme();

  return (
    <Menu>
      <Tip label="More">
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
      </Tip>
      <MenuContent>
        <MenuItem icon={<FilePlus2 />} onSelect={actions.onNew}>
          New document
        </MenuItem>
        <MenuItem
          icon={<FolderOpen />}
          shortcut={showKeyboardHelp ? `${modKey} O` : undefined}
          onSelect={actions.onOpenFile}
        >
          Open file…
        </MenuItem>
        <MenuItem icon={<ClipboardPaste />} onSelect={actions.onPaste}>
          Paste from clipboard
        </MenuItem>
        <MenuSub>
          <MenuSubTrigger icon={<BookOpen />}>Samples</MenuSubTrigger>
          <MenuSubContent>
            {SAMPLES.map((sample) => (
              <MenuItem key={sample.id} onSelect={() => actions.onSample(sample.id)}>
                {sample.name}
              </MenuItem>
            ))}
          </MenuSubContent>
        </MenuSub>

        {showExports && (
          <>
            <MenuSeparator />
            <MenuItem icon={<Download />} onSelect={actions.onPdf}>
              Download PDF
            </MenuItem>
            <MenuItem icon={<FileCode2 />} onSelect={actions.onHtml}>
              Download web page (HTML)
            </MenuItem>
            <MenuItem icon={<FileText />} onSelect={actions.onMarkdown}>
              Download Markdown
            </MenuItem>
          </>
        )}

        <MenuSeparator />
        <MenuSub>
          <MenuSubTrigger icon={<SunMoon />}>Appearance</MenuSubTrigger>
          <MenuSubContent>
            <MenuRadioGroup
              value={preference}
              onValueChange={(value) => setPreference(value as ThemePreference)}
            >
              <MenuRadioItem value="system" icon={<Monitor />}>
                System
              </MenuRadioItem>
              <MenuRadioItem value="light" icon={<Sun />}>
                Light
              </MenuRadioItem>
              <MenuRadioItem value="dark" icon={<Moon />}>
                Dark
              </MenuRadioItem>
            </MenuRadioGroup>
          </MenuSubContent>
        </MenuSub>

        {showKeyboardHelp && (
          <>
            <MenuItem icon={<Command />} shortcut={`${modKey} K`} onSelect={actions.onCommandMenu}>
              Command menu
            </MenuItem>
            <MenuItem icon={<Keyboard />} shortcut="?" onSelect={actions.onShortcuts}>
              Keyboard shortcuts
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}
