import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle, Loader2, type LucideIcon } from "lucide-react";
import clsx from "clsx";

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};
const SIZE: Record<Size, string> = { sm: "btn-sm", md: "", lg: "btn-lg" };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className, children, type = "button", ...rest },
  ref
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={clsx(VARIANT[variant], SIZE[size], className)} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ---------- Field (label + input + error) ---------- */
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, error, hint, trailing, id, className, ...rest }, ref) {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  return (
    <div>
      <label htmlFor={fieldId} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={clsx("input", error && "input-error", trailing ? "pr-11" : undefined, className)}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</div>}
      </div>
      {error ? (
        <p id={`${fieldId}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("skeleton", className)} />;
}

/* ---------- Spinner ---------- */
export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={clsx("inline-flex items-center gap-2 text-slate-500", className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span className="text-sm">{label}</span>
    </span>
  );
}

/* ---------- Empty and error states ---------- */
interface StateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: StateProps) {
  return (
    <div className={clsx("card flex animate-fade-up flex-col items-center px-6 py-16 text-center", className)} data-state="empty">
      {Icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-onyellow animate-pop-in">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      )}
      <h3 className="t-h3">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this. Check your connection and try again.",
  onRetry,
  className,
}: {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={clsx("card flex animate-fade-up flex-col items-center px-6 py-16 text-center", className)} role="alert" data-state="error">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600 animate-pop-in">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="t-h3">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-slate-500">{description}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="t-h1">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-slate-500 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}
