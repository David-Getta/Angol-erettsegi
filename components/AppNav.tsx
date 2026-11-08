"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { t } from "@/lib/i18n/hu";
import type { Level } from "@/lib/content/schema";

export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { title?: string; items: NavItem[] };
export type NavSubject = { id: string; name: string; icon: string };

/** Side navigation: the current subject's parts come from its config (the layout builds the groups on the server). */
export function AppNav({ level, subject, groups }: { level: Level; subject: NavSubject; groups: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/kezdolap" ? pathname === "/kezdolap" : pathname.startsWith(href));

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
        data-testid="app-nav"
        className={`app-nav fixed inset-y-0 left-0 z-40 w-60 overflow-y-auto border-r border-border bg-surface px-3 py-4 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href="/kezdolap" className="mb-1 block px-2" onClick={() => setOpen(false)}>
          <div className="text-lg font-semibold">
            <span aria-hidden>{subject.icon}</span> {subject.name}
          </div>
          <div className="text-xs text-muted">
            {t.level[level]} · {t.appTagline}
          </div>
        </Link>
        <Link href="/" className="mb-4 block px-2 text-xs text-accent hover:underline" onClick={() => setOpen(false)} data-testid="switch-subject">
          ⇄ {t.subjects.switch}
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
