import Link from "next/link";
import { guideFor, type GuideKind } from "@/lib/guides";
import { btn } from "@/components/ui";

/** A link to the guide of a text type / speaking task type / exam part – only if that guide exists. */
export function GuideLink({ type, target, label }: { type: GuideKind; target: string; label: string }) {
  const id = guideFor(type, target);
  if (!id) return null;
  return (
    <Link href={`/utmutatok/${id}`} className={btn.secondary} data-testid="guide-link">
      {label}
    </Link>
  );
}
