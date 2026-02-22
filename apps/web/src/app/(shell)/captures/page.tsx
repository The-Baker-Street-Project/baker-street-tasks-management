import { getCaptures } from "@/lib/api/captures";
import { CapturesPageClient } from "./captures-page-client";

export default async function CapturesPage() {
  const captures = await getCaptures();

  return <CapturesPageClient initialCaptures={captures} />;
}
