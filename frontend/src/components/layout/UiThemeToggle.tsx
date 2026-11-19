"use client";

import { useSyncExternalStore } from "react";
import { Sparkles, Square } from "lucide-react";
import { DEFAULT_UI_THEME, UI_THEME_ATTR, UI_THEME_STORAGE_KEY, type UiTheme } from "@/lib/ui-theme";

const subscribe = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: [UI_THEME_ATTR] });
  return () => obs.disconnect();
};
const getTheme = (): UiTheme => (document.documentElement.getAttribute(UI_THEME_ATTR) === "cinematic" ? "cinematic" : "classic");

/**
 * Lets any visitor flip between the classic look and the cinematic glass redesign, live, without a
 * redeploy. The choice is saved in localStorage and wins over NEXT_PUBLIC_UI_THEME (which only sets
 * the default for visitors who have not chosen for themselves).
 */
export function UiThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => DEFAULT_UI_THEME);
  const cinematic = theme === "cinematic";

  function toggle() {
    const next: UiTheme = cinematic ? "classic" : "cinematic";
    document.documentElement.setAttribute(UI_THEME_ATTR, next);
    try {
      localStorage.setItem(UI_THEME_STORAGE_KEY, next);
    } catch {
      /* private mode: the choice just is not remembered */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={cinematic}
      aria-label={cinematic ? "Switch to classic look" : "Switch to cinematic look"}
      title={cinematic ? "Classic look" : "Cinematic look"}
      className={className ?? "btn-ghost p-2.5"}
    >
      {cinematic ? <Sparkles className="h-[18px] w-[18px]" aria-hidden /> : <Square className="h-[18px] w-[18px]" aria-hidden />}
    </button>
  );
}
