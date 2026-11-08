"use client";

import { btn } from "@/components/ui";
import { t } from "@/lib/i18n/hu";

/** Prints the current page (the print stylesheet hides navigation and controls). */
export function PrintButton() {
  return (
    <button type="button" className={btn.ghost} onClick={() => window.print()}>
      🖨 {t.common.print}
    </button>
  );
}
