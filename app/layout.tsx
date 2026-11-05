import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { t } from "@/lib/i18n/hu";
import { AppNav } from "@/components/AppNav";
import { LevelSwitch } from "@/components/LevelSwitch";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { ToastProvider } from "@/components/Toast";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: t.appName, template: `%s · ${t.appName}` },
  description: t.appTagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#15181c" },
  ],
};

const themeScript = `(function(){try{var t=document.documentElement.dataset.theme;var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const s = getSettings();
  return (
    <html lang="hu" data-theme={s.theme} className={s.theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <ToastProvider>
        <AppNav level={s.level} />
        <div className="app-main lg:ml-60">
          <header className="app-topbar sticky top-0 z-20 flex items-center justify-end gap-3 border-b border-border bg-bg/90 px-4 py-2 backdrop-blur lg:px-8">
            <LevelSwitch level={s.level} />
            <ThemeSwitch theme={s.theme} />
          </header>
          <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 lg:px-8">{children}</main>
        </div>
        </ToastProvider>
      </body>
    </html>
  );
}
