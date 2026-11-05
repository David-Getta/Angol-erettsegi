"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Settings } from "@/lib/settings";
import { t } from "@/lib/i18n/hu";
import { saveSettingsAction, importDataAction, backupAction } from "@/app/actions";
import { Card, btn, formatDate } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { englishVoices, speak } from "@/components/speech";

const CARD_TYPES = ["en-hu", "hu-en", "cloze", "collocation"] as const;

export function SettingsForm({
  settings,
  totals,
  backups,
  language = true,
}: {
  settings: Settings;
  /** Foreign-language subject: card type labels and voice settings refer to English. */
  language?: boolean;
  totals: Record<"kozep" | "emelt", number>;
  backups: { name: string; size: number; at: string }[];
}) {
  const [s, setS] = useState(settings);
  const [pending, start] = useTransition();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = () => setVoices(englishVoices());
    load();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", load);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
    }
  }, []);

  const save = () =>
    start(async () => {
      const r = await saveSettingsAction(s);
      if (r.ok) {
        toast(t.settings.savedOk);
        router.refresh();
      } else toast(r.error);
    });

  const total = totals[s.level];
  const field = "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2";

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={t.settings.level}>
        <div className="flex gap-2">
          {(["kozep", "emelt"] as const).map((l) => (
            <button key={l} type="button" onClick={() => setS({ ...s, level: l })} className={s.level === l ? btn.primary : btn.secondary}>
              {t.level[l]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{t.settings.levelHint}</p>
        <label className="mt-4 block text-sm font-medium">
          {t.settings.examDate}
          <input type="date" value={s.examDate} onChange={(e) => setS({ ...s, examDate: e.target.value })} className={field} />
          <span className="text-xs font-normal text-muted">{t.settings.examDateHint}</span>
        </label>
        <label className="mt-4 block text-sm font-medium">
          {t.settings.targetPct}: {s.targetPct}%
          <input
            type="range"
            min={20}
            max={100}
            step={1}
            value={s.targetPct}
            onChange={(e) => setS({ ...s, targetPct: Number(e.target.value) })}
            className="mt-1 w-full accent-[var(--accent)]"
          />
          <span className="text-xs font-normal text-muted">{t.settings.targetHint(Math.round((s.targetPct / 100) * total), total)}</span>
        </label>
      </Card>

      <Card title={t.nav.vocabulary}>
        <label className="block text-sm font-medium">
          {t.settings.dailyNew}
          <input type="number" min={0} max={200} value={s.dailyNewCards} onChange={(e) => setS({ ...s, dailyNewCards: Number(e.target.value) })} className={field} />
        </label>
        <label className="mt-3 block text-sm font-medium">
          {t.settings.dailyMax}
          <input type="number" min={10} max={1000} value={s.dailyMaxReviews} onChange={(e) => setS({ ...s, dailyMaxReviews: Number(e.target.value) })} className={field} />
        </label>
        <fieldset className="mt-3 text-sm">
          <legend className="font-medium">{t.settings.cardTypes}</legend>
          {CARD_TYPES.map((ct) => (
            <label key={ct} className="mr-4 mt-1 inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={s.cardTypes.includes(ct)}
                onChange={(e) =>
                  setS({ ...s, cardTypes: e.target.checked ? [...s.cardTypes, ct] : s.cardTypes.filter((x) => x !== ct).length ? s.cardTypes.filter((x) => x !== ct) : s.cardTypes })
                }
              />
              {(language ? t.vocab.types : t.vocab.typesGeneric)[ct]}
            </label>
          ))}
        </fieldset>
      </Card>

      <Card title={t.settings.tts}>
        <label className="block text-sm font-medium">
          {t.settings.ttsRate}: {s.ttsRate.toFixed(2)}×
          <input type="range" min={0.5} max={1.5} step={0.05} value={s.ttsRate} onChange={(e) => setS({ ...s, ttsRate: Number(e.target.value) })} className="mt-1 w-full accent-[var(--accent)]" />
        </label>
        {(["ttsVoiceFemale", "ttsVoiceMale"] as const).map((k) => (
          <label key={k} className="mt-3 block text-sm font-medium">
            {k === "ttsVoiceFemale" ? t.settings.voiceFemale : t.settings.voiceMale}
            <div className="flex gap-2">
              <select value={s[k] ?? ""} onChange={(e) => setS({ ...s, [k]: e.target.value || null })} className={field}>
                <option value="">{t.settings.voiceAuto}</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`${btn.secondary} mt-1`}
                onClick={() => speak("Hello! This is how I sound when I read the listening tasks.", { rate: s.ttsRate, voiceURI: s[k], gender: k === "ttsVoiceFemale" ? "female" : "male" })}
              >
                ▶ {t.settings.testVoice}
              </button>
            </div>
          </label>
        ))}
      </Card>

      <Card title={t.settings.theme}>
        <div className="flex gap-2">
          {(["system", "light", "dark"] as const).map((th) => (
            <button key={th} type="button" onClick={() => setS({ ...s, theme: th })} className={s.theme === th ? btn.primary : btn.secondary}>
              {t.theme[th]}
            </button>
          ))}
        </div>
      </Card>

      <div className="lg:col-span-2">
        <button type="button" className={btn.primary} onClick={save} disabled={pending} data-testid="save-settings">
          {t.common.save}
        </button>
      </div>

      <Card title={t.settings.data} className="lg:col-span-2">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <a href="/api/export" className={btn.secondary} download>
              ⇩ {t.settings.export}
            </a>
            <p className="mt-1 text-xs text-muted">{t.settings.exportHint}</p>
          </div>
          <div>
            <button type="button" className={btn.secondary} onClick={() => fileRef.current?.click()}>
              ⇧ {t.settings.import}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f || !window.confirm(t.settings.importConfirm)) return;
                const r = await importDataAction(await f.text());
                toast(r.ok ? t.settings.importDone : r.error);
                router.refresh();
              }}
            />
            <p className="mt-1 text-xs text-muted">{t.settings.importHint}</p>
          </div>
          <div>
            <button
              type="button"
              className={btn.secondary}
              onClick={() =>
                start(async () => {
                  const f = await backupAction();
                  toast(t.settings.backupDone(f));
                  router.refresh();
                })
              }
            >
              🗄 {t.settings.backup}
            </button>
            <p className="mt-1 text-xs text-muted">{t.settings.backupHint}</p>
            {backups.length > 0 && (
              <ul className="mt-2 text-xs text-muted">
                {backups.slice(0, 5).map((b) => (
                  <li key={b.name}>
                    {b.name} · {(b.size / 1024).toFixed(0)} kB · {formatDate(b.at)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
