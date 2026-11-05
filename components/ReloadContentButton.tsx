"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n/hu";
import { reloadContentAction } from "@/app/actions";
import { useToast } from "./Toast";
import { btn } from "./ui";

export function ReloadContentButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button
      type="button"
      className={btn.secondary}
      disabled={pending}
      data-testid="reload-content"
      onClick={() =>
        start(async () => {
          const r = await reloadContentAction();
          toast(t.common.reloaded(r.inserted, r.updated) + (r.failed.length ? ` ⚠ ${r.failed.length} hibás fájl` : ""));
          router.refresh();
        })
      }
    >
      ↻ {t.common.reloadContent}
    </button>
  );
}
