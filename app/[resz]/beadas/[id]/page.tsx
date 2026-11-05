import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolvePart } from "../../parts";
import { SubmissionDetail } from "@/components/grading/SubmissionDetail";

type Props = { params: Promise<{ resz: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { resz } = await params;
  return { title: resolvePart(resz).name };
}

/** A written or oral submission with its grading. */
export default async function SubmissionPage({ params }: Props) {
  const { resz, id } = await params;
  const part = resolvePart(resz);
  if (part.kind === "objective") notFound();
  return <SubmissionDetail id={id} kind={part.kind === "written" ? "writing" : "speaking"} base={`/${part.slug}`} partName={part.name} />;
}
