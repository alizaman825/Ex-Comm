"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, KeyRound, LogOut, Mail, UserRound } from "lucide-react";
import clsx from "clsx";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { validateName, validateNewPassword } from "@/lib/validation";
import type { User } from "@/lib/types";
import { Button, Field, PageHeader } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { PasswordField } from "@/components/auth/PasswordField";
import { useToast } from "@/components/ui/Toast";

function Section({ icon: Icon, title, description, children, tone }: { icon: typeof UserRound; title: string; description: string; children: React.ReactNode; tone?: "danger" }) {
  return (
    <section className={clsx("card card-pad", tone === "danger" && "border-rose-200")} aria-labelledby={`sec-${title}`}>
      <div className="flex items-start gap-4">
        <span className={clsx("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl", tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-600")}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`sec-${title}`} className="t-h2">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

function ProfileForm({ user }: { user: User }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [emailAlerts, setEmailAlerts] = useState(user.emailAlerts);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== user.name || emailAlerts !== user.emailAlerts;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problem = validateName(name);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const res = await api<{ user: User }>("/users/me", { method: "PATCH", body: { name: name.trim(), emailAlerts } });
      setUser(res.user);
      toast.success("Profile saved");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Full name" name="name" value={name} onChange={(e) => setName(e.target.value)} error={error} autoComplete="name" />
      <Field label="Email" name="email" value={user.email} readOnly disabled hint="Your email is your login and cannot be changed." />
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300">
        <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
        <span>
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
            <Mail className="h-4 w-4 text-slate-400" aria-hidden /> Email me when a price alert is reached
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">In-app notifications are always on. Email works when the server has email configured.</span>
        </span>
      </label>
      <div className="flex items-center gap-4">
        <Button type="submit" loading={saving} disabled={!dirty}>
          Save changes
        </Button>
        <span className="text-xs text-slate-400">Member since {formatDate(user.createdAt)}</span>
      </div>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = {
      current: current ? undefined : "Enter your current password",
      next: validateNewPassword(next) ?? (next === current ? "Choose a different password from the current one" : undefined),
      confirm: confirm === next ? undefined : "Passwords do not match",
    };
    setErrors(found);
    if (found.current || found.next || found.confirm) return;
    setSaving(true);
    try {
      await api("/users/me/password", { method: "PATCH", body: { currentPassword: current, newPassword: next } });
      toast.success("Password changed");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && /current password/i.test(err.message)) setErrors({ current: "Current password is incorrect" });
      else setErrors({ next: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <PasswordField label="Current password" name="currentPassword" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current} />
      <PasswordField label="New password" name="newPassword" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={errors.next} hint="At least 8 characters." />
      <PasswordField label="Confirm new password" name="confirmPassword" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
      <Button type="submit" loading={saving}>
        Change password
      </Button>
    </form>
  );
}

function DeleteAccount() {
  const router = useRouter();
  const { logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setPassword("");
    setError(undefined);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!password) return setError("Enter your password to confirm");
    setBusy(true);
    try {
      await api("/users/me", { method: "DELETE", body: { password } });
      await logout().catch(() => undefined); // the session is already gone server-side
      toast.success("Your account has been deleted");
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? "Password is incorrect" : errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      {open && (
        <Modal open onClose={close} title="Delete your account?" description="This permanently deletes your account, wishlist, price alerts and notifications. It cannot be undone.">
          <form onSubmit={submit} noValidate className="space-y-4">
            <PasswordField label="Confirm with your password" name="deletePassword" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} autoFocus />
            <div className="flex gap-3">
              <Button type="submit" variant="danger" className="flex-1" loading={busy}>
                Permanently delete
              </Button>
              <Button variant="secondary" onClick={close} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function ProfileView() {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;
  return (
    <div className="page max-w-3xl">
      <PageHeader
        title="Profile & settings"
        description={`Signed in as ${user.email}`}
        actions={
          <Button
            variant="secondary"
            onClick={async () => {
              await logout();
              router.push("/");
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden /> Log out
          </Button>
        }
      />
      <div className="space-y-6">
        <Section icon={UserRound} title="Profile" description="Your name and notification preferences.">
          <ProfileForm key={user.id} user={user} />
        </Section>
        <Section icon={KeyRound} title="Password" description="Use a long, unique password.">
          <PasswordForm />
        </Section>
        <Section icon={AlertTriangle} title="Delete account" description="Permanently remove your account and everything saved in it." tone="danger">
          <DeleteAccount />
        </Section>
      </div>
    </div>
  );
}
