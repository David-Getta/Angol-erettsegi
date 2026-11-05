"use client";

import { useTransition } from "react";
import { t } from "@/lib/i18n/hu";
import { setThemeAction } from "@/app/actions";

type Theme = "system" | "light" | "dark";
const order: Theme[] = ["system", "light", "dark"];
const icon: Record<Theme, string> = { system: "◐", light: "☀", dark: "☾" };

export function ThemeSwitch({ theme }: { theme: Theme }) {
  const [, start] = useTransition();
  const next = order[(order.indexOf(theme) + 1) % order.length]!;
  const apply = (th: Theme) => {
    const el = document.documentElement;
    el.dataset.theme = th;
    const dark = th === "dark" || (th === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    el.classList.toggle("dark", dark);
  };
  return (
    <button
      type="button"
      title={`${t.theme.label}: ${t.theme[theme]}`}
      aria-label={`${t.theme.label}: ${t.theme[theme]}`}
      className="rounded-md border border-border bg-surface px-2.5 py-1 text-sm hover:bg-surface-2"
      onClick={() => {
        apply(next);
        start(async () => {
          await setThemeAction(next);
        });
      }}
    >
      {icon[theme]} <span className="hidden sm:inline">{t.theme[theme]}</span>
    </button>
  );
}
