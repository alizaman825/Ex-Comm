// Client-side form validation. The API validates again; these checks give instant feedback.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+[.][^\s@]{2,}$/;

export function validateEmail(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Enter your email address";
  if (!EMAIL_RE.test(v)) return "Enter a valid email address";
  return undefined;
}

export function validateName(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Enter your name";
  if (v.length < 2) return "Name must be at least 2 characters";
  if (v.length > 80) return "Name must be 80 characters or fewer";
  return undefined;
}

export function validateNewPassword(value: string): string | undefined {
  if (!value) return "Choose a password";
  if (value.length < 8) return "Password must be at least 8 characters";
  if (value.length > 128) return "Password must be 128 characters or fewer";
  return undefined;
}

export type Strength = { score: 0 | 1 | 2 | 3; label: "Too short" | "Weak" | "Good" | "Strong" };

/** Informational only (the server just requires 8+ characters). */
export function passwordStrength(value: string): Strength {
  if (value.length < 8) return { score: 0, label: "Too short" };
  let points = 0;
  if (value.length >= 12) points += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) points += 1;
  if (/[0-9]/.test(value)) points += 1;
  if (/[^A-Za-z0-9]/.test(value)) points += 1;
  if (points <= 1) return { score: 1, label: "Weak" };
  if (points === 2) return { score: 2, label: "Good" };
  return { score: 3, label: "Strong" };
}
