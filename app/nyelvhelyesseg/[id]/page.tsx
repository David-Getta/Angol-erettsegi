import type { Metadata } from "next";
import { ObjectiveTaskPage } from "@/components/ObjectiveTaskPage";
import { t } from "@/lib/i18n/hu";

export const metadata: Metadata = { title: t.languageUse.title };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { id } = await params;
  const { mode } = await searchParams;
  return <ObjectiveTaskPage id={id} section="language-use" base="/nyelvhelyesseg" mode={mode === "exam" ? "exam" : "practice"} />;
}
