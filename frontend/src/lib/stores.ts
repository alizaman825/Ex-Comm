import type { Platform, PlatformStatus } from "./types";
import { PLATFORM_LABEL } from "./format";

/** Plain-language reason a store could not be read, from the error code the API reports. */
export function reasonText(status: Pick<PlatformStatus, "code" | "error">): string {
  switch (status.code) {
    case "TIMEOUT":
      return "took too long to answer";
    case "BLOCKED":
      return "refused the request (it may be blocking automated access)";
    case "CIRCUIT_OPEN":
      return "is paused for a few minutes after repeated failures (Refresh from stores tries again)";
    case "BUDGET":
      return "was still working when the time limit was reached";
    case "HTTP":
      return "answered with an error";
    case "PARSE":
      return "returned a page we could not read";
    default: {
      const detail = status.error ? `: ${status.error.slice(0, 80)}` : "";
      return `could not be reached${detail}`;
    }
  }
}

export interface StoreProblem {
  platform: Platform;
  label: string;
  text: string;
}

/** The stores that did not answer, each with its reason. Empty when every store answered. */
export function storeProblems(platformStatus: Partial<Record<Platform, PlatformStatus>> | undefined): StoreProblem[] {
  return (Object.entries(platformStatus ?? {}) as [Platform, PlatformStatus][])
    .filter(([, s]) => s.status !== "success" || (s.code === "BUDGET" && !s.relevant))
    .map(([platform, s]) => ({ platform, label: PLATFORM_LABEL[platform], text: reasonText(s) }));
}

/** One sentence for a toast, e.g. "Daraz took too long to answer; PriceOye is paused ...". */
export function problemsSentence(problems: StoreProblem[]): string {
  return problems.map((p) => `${p.label} ${p.text}`).join("; ");
}
