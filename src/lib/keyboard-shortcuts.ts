import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

export type ShortcutAction =
  | { type: "navigate"; to: string }
  | { type: "focus-search" }
  | { type: "toggle-shortcuts" };

export type ShortcutMap = Record<string, ShortcutAction>;

const DEFAULT_SHORTCUTS: ShortcutMap = {
  "g+d": { type: "navigate", to: "/" },
  "g+v": { type: "navigate", to: "/vendors" },
  "g+p": { type: "navigate", to: "/production" },
  "g+s": { type: "navigate", to: "/stock" },
  "g+t": { type: "navigate", to: "/traceability" },
};

/**
 * Global keyboard shortcut hook.
 *
 * - `g + letter` sequences navigate to the matching route.
 * - `/` dispatches a `keyboard:focus-search` custom event on `window`.
 * - `?` dispatches a `keyboard:toggle-shortcuts` custom event on `window`.
 *
 * Consumers listen for those events to focus the search input or open the
 * shortcuts modal without creating a direct coupling.
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout> | undefined;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if the user is typing in an input, textarea, or contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      const editable = (e.target as HTMLElement)?.isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || editable) {
        // Still allow Escape and ? inside inputs
        if (e.key !== "Escape" && e.key !== "?") {
          gPressed = false;
          return;
        }
      }

      // `?` — toggle shortcuts modal (works even in inputs)
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("keyboard:toggle-shortcuts"));
        return;
      }

      // `/` — focus search (unless already in an input)
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("keyboard:focus-search"));
        return;
      }

      // `g + <key>` sequence navigation
      if (e.key === "g" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        gPressed = true;
        gTimeout = setTimeout(() => {
          gPressed = false;
        }, 600);
        return;
      }

      if (gPressed && e.key) {
        gPressed = false;
        if (gTimeout) clearTimeout(gTimeout);

        const shortcut = `g+${e.key.toLowerCase()}`;
        const action = DEFAULT_SHORTCUTS[shortcut];
        if (action?.type === "navigate") {
          e.preventDefault();

          navigate({ to: action.to as any });
        }
        return;
      }

      // Escape — clear g key
      if (e.key === "Escape") {
        gPressed = false;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (gTimeout) clearTimeout(gTimeout);
    };
  }, [navigate]);
}

/** All available shortcuts — used by the shortcuts modal. */
export const ALL_SHORTCUTS: {
  keys: string;
  label: string;
  category: string;
}[] = [
  { keys: "g + d", label: "Dashboard", category: "Navigation" },
  { keys: "g + v", label: "Vendors", category: "Navigation" },
  { keys: "g + p", label: "Production", category: "Navigation" },
  { keys: "g + s", label: "Stock", category: "Navigation" },
  { keys: "g + t", label: "Traceability", category: "Navigation" },
  { keys: "/", label: "Focus search", category: "Actions" },
  { keys: "?", label: "Show shortcuts", category: "Actions" },
];
