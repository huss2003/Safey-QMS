import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { ALL_SHORTCUTS } from "@/lib/keyboard-shortcuts";

/**
 * Keyboard shortcuts help modal.
 * Opens in response to the `keyboard:toggle-shortcuts` custom event
 * dispatched by `useKeyboardShortcuts`.
 */
export function ShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onToggle() {
      setOpen((prev) => !prev);
    }
    window.addEventListener("keyboard:toggle-shortcuts", onToggle);
    return () => window.removeEventListener("keyboard:toggle-shortcuts", onToggle);
  }, []);

  const categories = ALL_SHORTCUTS.reduce<Record<string, typeof ALL_SHORTCUTS>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search shortcuts…" />
      <CommandList>
        <CommandEmpty>No shortcuts found.</CommandEmpty>
        {Object.entries(categories).map(([category, shortcuts]) => (
          <CommandGroup key={category} heading={category}>
            {shortcuts.map((s) => (
              <CommandItem key={s.keys} disabled>
                <span>{s.label}</span>
                <CommandShortcut>{s.keys}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
