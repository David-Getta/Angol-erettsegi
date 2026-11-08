"use client";

import { useState } from "react";
import { t } from "@/lib/i18n/hu";
import { btn } from "./ui";

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall back below */
  }
  // Fallback for http on the local network (no secure context)
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function CopyButton({
  text,
  label = t.common.copy,
  variant = "small",
  getText,
  testId,
}: {
  text?: string;
  label?: string;
  variant?: keyof typeof btn;
  getText?: () => Promise<string> | string;
  testId?: string;
}) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button
      type="button"
      data-testid={testId}
      className={btn[variant]}
      onClick={async () => {
        const value = getText ? await getText() : text ?? "";
        const ok = await copyText(value);
        setState(ok ? "ok" : "fail");
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "ok" ? `✓ ${t.common.copied}` : state === "fail" ? "✗" : `⧉ ${label}`}
    </button>
  );
}
