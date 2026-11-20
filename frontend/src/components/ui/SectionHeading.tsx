import type { ReactNode } from "react";
import clsx from "clsx";

/**
 * The site's one shared "numbered section" heading treatment: a big orange outlined numeral beside
 * a large, bold title — the same visual weight as the hero's "01" and the product page's
 * "03 — Price history" heading. Used so every numbered section (home page 02-05, product page 02-03)
 * reads at the same size/weight instead of some sections drifting to a small all-caps label style.
 */
export function SectionHeading({
  number,
  children,
  action,
  className,
}: {
  number: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mb-3 flex items-center justify-between gap-3 sm:mb-4", className)}>
      <h2 className="heading-numeral t-h2">
        <span className="t-numeral pointer-events-none select-none" aria-hidden="true">
          {number}
        </span>
        {children}
      </h2>
      {action}
    </div>
  );
}
