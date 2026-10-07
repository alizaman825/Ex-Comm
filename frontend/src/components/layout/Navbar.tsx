"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellRing, ChevronDown, Heart, LayoutGrid, LogOut, Menu, Scale, Settings, X } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth";
import { useUnreadCount } from "@/lib/hooks";
import { Logo } from "./Logo";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";

const PUBLIC_LINKS = [
  { href: "/categories", label: "Categories", icon: LayoutGrid },
  { href: "/compare", label: "Compare", icon: Scale },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function NavLink({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: typeof Bell; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition duration-200",
        active ? "bg-slate-100 text-ink" : "text-slate-600 hover:bg-slate-100 hover:text-ink"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;
  const item = "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-2.5 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-onbrand">{initials(user.name)}</span>
        <span className="hidden max-w-[7rem] truncate text-sm font-medium text-ink lg:block">{user.name.split(" ")[0]}</span>
        <ChevronDown className={clsx("h-4 w-4 text-slate-400 transition", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-3 w-64 animate-fade-up rounded-3xl bg-surface p-2 shadow-lift">
          <div className="border-b border-slate-100 px-3 pb-2.5 pt-2">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <div className="py-1.5">
            <Link role="menuitem" href="/wishlist" className={item} onClick={() => setOpen(false)}>
              <Heart className="h-4 w-4 text-slate-400" aria-hidden /> Wishlist
            </Link>
            <Link role="menuitem" href="/alerts" className={item} onClick={() => setOpen(false)}>
              <BellRing className="h-4 w-4 text-slate-400" aria-hidden /> Price alerts
            </Link>
            <Link role="menuitem" href="/profile" className={item} onClick={() => setOpen(false)}>
              <Settings className="h-4 w-4 text-slate-400" aria-hidden /> Profile &amp; settings
            </Link>
          </div>
          <div className="border-t border-slate-100 pt-1.5">
            <button
              type="button"
              role="menuitem"
              className={clsx(item, "text-rose-600 hover:bg-rose-50")}
              onClick={async () => {
                setOpen(false);
                await logout();
                router.push("/");
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const unread = useUnreadCount();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpenAt, setMobileOpenAt] = useState<string | null>(null);
  const mobileOpen = mobileOpenAt === pathname; // closes automatically after navigating
  const closeMobile = () => setMobileOpenAt(null);

  return (
    <header className="sticky top-3 z-40 px-3 sm:px-4">
      <div className="mx-auto max-w-[78rem] rounded-[28px] bg-surface/75 shadow-card backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)]">
      <div className="flex h-14 items-center gap-3 pl-4 pr-2 lg:gap-5">
        <Logo />

        <div className="mx-2 hidden max-w-md flex-1 md:block">
          <Suspense fallback={<div className="h-10 rounded-full bg-slate-100" />}>
            <SearchBar />
          </Suspense>
        </div>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
          {PUBLIC_LINKS.map((l) => (
            <NavLink key={l.href} {...l} />
          ))}
          {user && (
            <>
              <Link href="/wishlist" className="btn-ghost p-2.5" aria-label="Wishlist" title="Wishlist">
                <Heart className="h-5 w-5" aria-hidden />
              </Link>
              <Link href="/notifications" className="btn-ghost relative p-2.5" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} title="Notifications">
                <Bell className="h-5 w-5" aria-hidden />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-canvas" data-testid="unread-badge">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            </>
          )}
          <ThemeToggle />
          <div className="ml-1 flex items-center gap-1.5">
            {loading ? (
              <div className="skeleton h-9 w-24 rounded-full" />
            ) : user ? (
              <UserMenu />
            ) : (
              <>
                <Link href={`/login${pathname !== "/" && pathname !== "/login" && pathname !== "/register" ? `?next=${encodeURIComponent(pathname)}` : ""}`} className="btn-ghost">
                  Log in
                </Link>
                <Link href="/register" className="btn-primary">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>

        <ThemeToggle className="btn-ghost ml-auto p-2.5 md:hidden" />
        <button
          type="button"
          className="btn-ghost p-2.5 md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpenAt(mobileOpen ? null : pathname)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="animate-fade-up border-t border-slate-200/70 md:hidden">
          <div className="space-y-4 px-4 py-4">
            <Suspense fallback={null}>
              <SearchBar />
            </Suspense>
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {PUBLIC_LINKS.map((l) => (
                <NavLink key={l.href} {...l} onClick={closeMobile} />
              ))}
              {user && (
                <>
                  <NavLink href="/wishlist" label="Wishlist" icon={Heart} onClick={closeMobile} />
                  <NavLink href="/alerts" label="Price alerts" icon={BellRing} onClick={closeMobile} />
                  <NavLink href="/notifications" label={unread ? `Notifications (${unread})` : "Notifications"} icon={Bell} onClick={closeMobile} />
                  <NavLink href="/profile" label="Profile & settings" icon={Settings} onClick={closeMobile} />
                </>
              )}
            </nav>
            {!loading &&
              (user ? (
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={async () => {
                    closeMobile();
                    await logout();
                    router.push("/");
                  }}
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Log out ({user.name.split(" ")[0]})
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/login" className="btn-secondary" onClick={closeMobile}>
                    Log in
                  </Link>
                  <Link href="/register" className="btn-primary" onClick={closeMobile}>
                    Sign up
                  </Link>
                </div>
              ))}
          </div>
        </div>
      )}
      </div>
    </header>
  );
}
