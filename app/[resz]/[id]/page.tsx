import type { Metadata } from "next";
import { resolvePart } from "../parts";
import { ObjectiveTaskPage } from "@/components/ObjectiveTaskPage";
import { WrittenTask } from "@/components/parts/WrittenTask";
import { OralTask } from "@/components/parts/OralTask";
import type { ObjectiveSection } from "@/lib/content/schema";

type Props = { params: Promise<{ resz: string; id: string }>; searchParams: Promise<{ mode?: string; parent?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { resz } = await params;
  return { title: resolvePart(resz).name };
}

export default async function TaskPage({ params, searchParams }: Props) {
  const { resz, id } = await params;
  const sp = await searchParams;
  const part = resolvePart(resz);
  if (part.kind === "written") return <WrittenTask part={part} id={id} sp={sp} />;
  if (part.kind === "oral") return <OralTask part={part} id={id} />;
  return <ObjectiveTaskPage id={id} section={part.id as ObjectiveSection} base={`/${part.slug}`} mode={sp.mode === "exam" ? "exam" : "practice"} />;
}
