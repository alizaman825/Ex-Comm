/**
 * The "UI theme" feature flag: `classic` is the old look, `cinematic` is the glass/atmosphere
 * redesign — the default, as of 2026-11-19.
 *
 * Default comes from the NEXT_PUBLIC_UI_THEME env var (read at build time, baked into the bundle):
 * unset or "cinematic" -> cinematic; "classic" -> classic. Any visitor can override that default for
 * themselves with the in-app toggle in the navbar (UiThemeToggle), which stores its choice in
 * localStorage ("excomm-ui-theme") and is applied before first paint by an inline script in
 * layout.tsx, the same way the dark-mode toggle works.
 *
 * To roll back to the old look for everyone: set NEXT_PUBLIC_UI_THEME=classic on Vercel and
 * redeploy. No code change needed.
 */
export type UiTheme = "classic" | "cinematic";

export const UI_THEME_STORAGE_KEY = "excomm-ui-theme";
export const UI_THEME_ATTR = "data-ui-theme";

export const DEFAULT_UI_THEME: UiTheme = process.env.NEXT_PUBLIC_UI_THEME === "classic" ? "classic" : "cinematic";

export function isUiTheme(value: unknown): value is UiTheme {
  return value === "classic" || value === "cinematic";
}
