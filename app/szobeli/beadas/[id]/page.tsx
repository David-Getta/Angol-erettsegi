import type { Metadata } from "next";
import { SubmissionDetail } from "@/components/grading/SubmissionDetail";
import { t } from "@/lib/i18n/hu";

export const metadata: Metadata = { title: t.speaking.title };

export default async function SpeakingSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubmissionDetail id={id} kind="speaking" />;
}
