"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { t } from "@/lib/i18n/hu";
import type { Level } from "@/lib/content/schema";

type NavItem = { href: string; label: string; icon: string };

const groups: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: t.nav.dashboard, icon: "⌂" },
      { href: "/szintfelmero", label: t.nav.diagnostic, icon: "◎" },
    ],
  },
  {
    title: t.nav.groupPractice,
    items: [
      { href: "/olvasas", label: t.nav.reading, icon: "📖" },
      { href: "/nyelvhelyesseg", label: t.nav.languageUse, icon: "✎" },
      { href: "/hallas", label: t.nav.listening, icon: "🎧" },
      { href: "/iras", label: t.nav.writing, icon: "✍" },
      { href: "/szobeli", label: t.nav.speaking, icon: "🗣" },
      { href: "/szokincs", label: t.nav.vocabulary, icon: "🗂" },
      { href: "/hibanaplo", label: t.nav.errorLog, icon: "⚑" },
      { href: "/szabalytar", label: t.nav.lessons, icon: "§" },
      { href: "/kifejezesek", label: t.nav.phrases, icon: "❝" },
    ],
  },
  {
    title: t.nav.groupExam,
    items: [
      { href: "/probaerettsegi", label: t.nav.mock, icon: "⏱" },
      { href: "/vizsga", label: t.nav.examInfo, icon: "ⓘ" },
      { href: "/hivatalos", label: t.nav.official, icon: "🏛" },
      { href: "/statisztika", label: t.nav.stats, icon: "📈" },
    ],
  },
  {
    title: t.nav.groupTools,
    items: [
      { href: "/parancsok", label: t.nav.commands, icon: "⌘" },
      { href: "/beallitasok", label: t.nav.settings, icon: "⚙" },
    ],
  },
];

export function AppNav({ level }: { level: Level }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <button
        type="button"
        className="app-nav fixed left-3 top-2 z-40 rounded-md border border-border bg-surface px-3 py-1.5 text-sm lg:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="app-nav"
      >
        ☰ {t.nav.menu}
      </button>
      {open && <div className="app-nav fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
      <nav
        id="app-nav"
        className={`app-nav fixed inset-y-0 left-0 z-40 w-60 overflow-y-auto border-r border-border bg-surface px-3 py-4 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href="/" className="mb-4 block px-2" onClick={() => setOpen(false)}>
          <div className="text-lg font-semibold">{t.appName}</div>
          <div className="text-xs text-muted">
            {t.level[level]} · {t.appTagline}
          </div>
        </Link>
        {groups.map((g, i) => (
          <div key={i} className="mb-3">
            {g.title && <div className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted">{g.title}</div>}
            <ul>
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                      isActive(it.href) ? "bg-accent-soft font-medium text-fg" : "text-fg/85 hover:bg-surface-2"
                    }`}
                  >
                    <span className="w-5 text-center" aria-hidden>
                      {it.icon}
                    </span>
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
