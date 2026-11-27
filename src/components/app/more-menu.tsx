"use client";

import { Command, Keyboard, Monitor, Moon, MoreHorizontal, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Tip } from "@/components/ui/tooltip";
import { useTheme, type ThemePreference } from "@/lib/app/theme";

/**
 * App-level settings only. Everything to do with a document has one home
 * elsewhere - new and open in the Documents menu, downloads on the Download
 * button, styling in the Design panel - so this menu does not repeat them.
 */
export function MoreMenu({
  modKey,
  showKeyboardHelp,
  onShortcuts,
  onCommandMenu,
}: {
  modKey: string;
  /** Keyboard shortcuts mean nothing on a touch-only device. */
  showKeyboardHelp: boolean;
  onShortcuts: () => void;
  onCommandMenu: () => void;
}) {
  const { preference, setPreference } = useTheme();

  return (
    <Menu>
      <Tip label="More">
        <MenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="More">
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
      </Tip>
      <MenuContent>
        <MenuLabel>Appearance</MenuLabel>
        <MenuRadioGroup
          value={preference}
          onValueChange={(value) => setPreference(value as ThemePreference)}
        >
          <MenuRadioItem value="system" icon={<Monitor />}>
            Match the system
          </MenuRadioItem>
          <MenuRadioItem value="light" icon={<Sun />}>
            Light
          </MenuRadioItem>
          <MenuRadioItem value="dark" icon={<Moon />}>
            Dark
          </MenuRadioItem>
        </MenuRadioGroup>

        {showKeyboardHelp && (
          <>
            <MenuSeparator />
            <MenuItem icon={<Command />} shortcut={`${modKey} K`} onSelect={onCommandMenu}>
              Command menu
            </MenuItem>
            <MenuItem icon={<Keyboard />} shortcut="?" onSelect={onShortcuts}>
              Keyboard shortcuts
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}
