"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellRing, ChevronDown, Heart, LogOut, Search, Settings, X } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth";
import { useUnreadCount } from "@/lib/hooks";
import { Logo } from "./Logo";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/categories", label: "Categories" },
  { href: "/compare", label: "Compare" },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} onClick={onClick} aria-current={active ? "page" : undefined} className="nav-chip text-[13px] font-semibold">
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
  const item = "flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-full bg-white py-1 pl-1 pr-3 text-[12.5px] font-bold text-[#0b0812]"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0b0812] text-[10px] font-semibold text-white">{initials(user.name)}</span>
        <span className="hidden max-w-[7rem] truncate lg:block">{user.name.split(" ")[0]}</span>
        <ChevronDown className={clsx("h-3.5 w-3.5 text-slate-400 transition", open && "rotate-180")} aria-hidden />
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

/**
 * The site's only navbar now (no classic/cinematic dual path — see STATUS.md). A literal port of
 * the approved concept board's nav pill:
 *  - Desktop (Main-Desktop.dc.html): wordmark, centered Home/Categories/Compare links, a small
 *    glass search box, and a white "Sign in" pill (or the signed-in user's chip).
 *  - Mobile (Main.dc.html): wordmark plus exactly two round glass buttons — search and the
 *    moon/theme toggle. No hamburger: the board's mobile nav carries nothing else, by design.
 *    Tapping search opens a second floating glass panel below the pill with the full search box
 *    and the secondary links, so signed-in actions (wishlist, alerts, profile, log out) stay
 *    reachable without adding to the pill itself.
 */
export function Navbar() {
  const { user, loading, logout } = useAuth();
  const unread = useUnreadCount();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpenAt, setMobileOpenAt] = useState<string | null>(null);
  const mobileOpen = mobileOpenAt === pathname;
  const closeMobile = () => setMobileOpenAt(null);

  return (
    <header className="sticky top-3 z-40 px-3 sm:px-4">
      <div className="nav-pill-cine mx-auto flex max-w-[85rem] items-center justify-between gap-3 md:gap-6">
        <Logo className="nav-wordmark shrink-0" />

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          <NavLink href="/" label="Home" />
          {LINKS.map((l) => (
            <NavLink key={l.href} {...l} />
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <div className="nav-search-cine w-[160px] lg:w-[220px]">
            <Suspense fallback={<div className="h-9 rounded-full bg-white/10" />}>
              <SearchBar />
            </Suspense>
          </div>

          {user && (
            <>
              <Link href="/wishlist" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.12] text-white/85 transition hover:bg-white/20" aria-label="Wishlist" title="Wishlist">
                <Heart className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.12] text-white/85 transition hover:bg-white/20"
                aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
                title="Notifications"
              >
                <Bell className="h-4 w-4" aria-hidden />
                {unread > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white" data-testid="unread-badge">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
            </>
          )}

          <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.12] text-white/85 transition hover:bg-white/20" />

          {loading ? (
            <div className="skeleton h-9 w-20 rounded-full" />
          ) : user ? (
            <UserMenu />
          ) : (
            <Link
              href={`/login${pathname !== "/" && pathname !== "/login" && pathname !== "/register" ? `?next=${encodeURIComponent(pathname)}` : ""}`}
              className="rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-[#0b0812]"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile: exactly two round glass buttons, as the board's mobile nav shows. */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            aria-label="Search"
            onClick={() => setMobileOpenAt(mobileOpen ? null : pathname)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.14] text-white/85"
          >
            {mobileOpen ? <X className="h-3.5 w-3.5" aria-hidden /> : <Search className="h-3.5 w-3.5" aria-hidden />}
          </button>
          <ThemeToggle className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#0b0812]" />
        </div>
      </div>

      {/* A second, separate floating glass panel below the pill — the mobile search + the
          account links the pill itself has no room for. */}
      {mobileOpen && (
        <div className="mobile-panel-cine animate-fade-up mx-auto mt-3 max-w-[78rem] md:hidden">
          <div className="space-y-4 p-4">
            <Suspense fallback={null}>
              <SearchBar autoFocus />
            </Suspense>
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              <NavLink href="/" label="Home" onClick={closeMobile} />
              {LINKS.map((l) => (
                <NavLink key={l.href} {...l} onClick={closeMobile} />
              ))}
              {user && (
                <>
                  <NavLink href="/wishlist" label="Wishlist" onClick={closeMobile} />
                  <NavLink href="/alerts" label="Price alerts" onClick={closeMobile} />
                  <NavLink href="/notifications" label={unread ? `Notifications (${unread})` : "Notifications"} onClick={closeMobile} />
                  <NavLink href="/profile" label="Profile & settings" onClick={closeMobile} />
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
    </header>
  );
}
