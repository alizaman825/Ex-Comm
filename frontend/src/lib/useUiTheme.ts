"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_UI_THEME, UI_THEME_ATTR, type UiTheme } from "./ui-theme";

const subscribe = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: [UI_THEME_ATTR] });
  return () => obs.disconnect();
};
const getSnapshot = (): UiTheme => (document.documentElement.getAttribute(UI_THEME_ATTR) === "cinematic" ? "cinematic" : "classic");

/**
 * Client hook: the live UI theme, reading the same `data-ui-theme` attribute the toggle writes.
 * SSR/first-paint snapshot is `DEFAULT_UI_THEME` (matches the server-rendered HTML and the inline
 * script in layout.tsx), so there is no hydration mismatch; it updates after mount if the visitor's
 * stored choice differs. Kept in its own "use client" file (not ui-theme.ts) because ui-theme.ts's
 * constants are also imported from layout.tsx, a Server Component.
 */
export function useUiTheme(): UiTheme {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_UI_THEME);
}
