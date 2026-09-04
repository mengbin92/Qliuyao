"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { Taiji, Menu, Close } from "./Icon";
import { HistoryFab } from "./HistoryFab";

const NAV = [
  { href: "/", label: "起卦", desc: "Cast" },
  { href: "/index-64", label: "卦典", desc: "I-Ching" },
  { href: "/quantum", label: "量子原理", desc: "Circuit" },
];

const SECONDARY_NAV = [
  { href: "/about", label: "项目背景", desc: "About" },
  { href: "/disclaimer", label: "免责声明", desc: "Notice" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLDetailsElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
    if (moreRef.current) moreRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (open) {
        setOpen(false);
        menuRef.current?.focus();
      }
      if (moreRef.current?.open) {
        moreRef.current.open = false;
        moreRef.current.querySelector("summary")?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) moreRef.current.open = false;
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700/50 bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-5">
        <Link href="/" className="group flex items-center gap-3" aria-label="量子六爻 · 回到首页">
          <span className="grid h-11 w-11 place-items-center rounded-md border border-gold-500/30 bg-gradient-to-br from-cinnabar-700/40 to-cinnabar-800/40 text-gold-200 transition group-hover:border-gold-400/60 group-hover:shadow-glow-gold">
            <Taiji size={22} />
          </span>
          <span>
            <span className="block font-display text-xl font-semibold tracking-wide text-gold-200">
              量子六爻
            </span>
            <span className="hidden text-[11px] tracking-[0.18em] text-ink-300 sm:block">
              QUANTUM · LIUYAO
            </span>
          </span>
        </Link>

        <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative inline-flex min-h-11 items-center rounded-md px-4 py-2 font-display text-sm transition-colors",
                  active
                    ? "text-gold-200"
                    : "text-ink-200 hover:text-gold-200"
                )}
              >
                <span>{n.label}</span>
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-gold-400 to-transparent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <HistoryFab />
          <details ref={moreRef} className="relative hidden md:block">
            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md px-3 text-sm text-ink-300 hover:text-gold-200 [&::-webkit-details-marker]:hidden">更多</summary>
            <nav aria-label="更多导航" className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-lg">
              {SECONDARY_NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined}
                  onClick={() => { if (moreRef.current) moreRef.current.open = false; }}
                  className="flex min-h-11 items-center rounded-md px-3 text-sm text-ink-200 hover:bg-ink-800">{n.label}</Link>
              ))}
            </nav>
          </details>

        <button
          ref={menuRef}
          aria-label={open ? "关闭导航菜单" : "打开导航菜单"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          className="md:hidden grid h-11 w-11 place-items-center rounded-md border border-ink-700 text-gold-200 transition hover:border-gold-500/40"
          onClick={() => setOpen((o) => !o)}
          type="button"
        >
          {open ? <Close size={20} /> : <Menu size={20} />}
        </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-navigation" aria-label="移动导航" className="border-t border-ink-700/50 bg-ink-950/95 px-5 py-3 md:hidden">
          {[...NAV, ...SECONDARY_NAV].map((n) => {
            const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2.5 text-sm",
                  active ? "bg-ink-800/60 text-gold-200" : "text-ink-200"
                )}
              >
                <span className="font-display">{n.label}</span>
                <span className="text-[10px] tracking-[0.12em] text-ink-400">{n.desc}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
