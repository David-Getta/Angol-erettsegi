"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startMockAction } from "@/app/actions-mock";
import type { MockKind } from "@/lib/mock";
import { t } from "@/lib/i18n/hu";
import { btn } from "../ui";

export function StartMockButton({ kind, label, base }: { kind: MockKind; label: string; base: string }) {
  const [pending, start] = useTransition();
  const [missing, setMissing] = useState<string[]>([]);
  const router = useRouter();
  return (
    <div>
      <button
        type="button"
        className={btn.primary}
        disabled={pending}
        data-testid={`start-${kind}`}
        onClick={() =>
          start(async () => {
            const r = await startMockAction(kind);
            if (r.ok) router.push(`${base}/${r.id}`);
            else setMissing(r.missing.map((m) => `${t.mock.notEnough(m.name)} (${m.have}/${m.need})`));
          })
        }
      >
        ▶ {label}
      </button>
      {missing.length > 0 && (
        <ul className="mt-2 text-sm text-bad">
          {missing.map((m) => (
            <li key={m}>✗ {m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
