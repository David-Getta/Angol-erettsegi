import type { Metadata } from "next";
import { resolvePart } from "./parts";
import { ObjectiveList } from "@/components/parts/ObjectiveList";
import { WrittenList } from "@/components/parts/WrittenList";
import { OralList } from "@/components/parts/OralList";
import { parseOrigin } from "@/lib/tasks";

type Props = { params: Promise<{ resz: string }>; searchParams: Promise<{ foglalt?: string; tema?: string; forras?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { resz } = await params;
  return { title: resolvePart(resz).name };
}

/** List page of one exam part of the current subject (the slug comes from the subject's structure.json). */
export default async function PartPage({ params, searchParams }: Props) {
  const { resz } = await params;
  const sp = await searchParams;
  const part = resolvePart(resz);
  const origin = parseOrigin(sp.forras);
  if (part.kind === "written") return <WrittenList part={part} origin={origin} />;
  if (part.kind === "oral") return <OralList part={part} tema={sp.tema} origin={origin} />;
  return <ObjectiveList part={part} showReserved={!!sp.foglalt} origin={origin} />;
}
