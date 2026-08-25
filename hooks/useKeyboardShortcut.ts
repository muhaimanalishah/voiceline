import { useEffect } from "react";

export interface ShortcutOptions {
  allowInInputs?: boolean;
}

/**
 * Custom hook to cleanly attach keyboard shortcut listeners.
 */
export function useKeyboardShortcut(
  keyCombo: string,
  handler: (e: KeyboardEvent) => void,
  options: ShortcutOptions = {}
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (isInput && !options.allowInInputs) {
        return;
      }

      const combo = keyCombo.toLowerCase();
      const isMetaOrCtrl = e.metaKey || e.ctrlKey;
      const isAlt = e.altKey;
      const key = e.key.toLowerCase();

      let matched = false;

      if (combo === "escape" || combo === "esc") {
        matched = e.key === "Escape";
      } else if (combo === "cmd+k" || combo === "ctrl+k") {
        matched = isMetaOrCtrl && key === "k";
      } else if (combo === "alt+n") {
        matched = isAlt && key === "n";
      } else if (combo === "alt+c") {
        matched = isAlt && key === "c";
      } else if (combo === "ctrl+s" || combo === "cmd+s") {
        matched = isMetaOrCtrl && key === "s";
      } else if (combo === "?") {
        matched = e.key === "?";
      } else if (combo === "/") {
        matched = e.key === "/";
      }

      if (matched) {
        e.preventDefault();
        handler(e);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyCombo, handler, options.allowInInputs]);
}
