import { getCapture } from "@/lib/api/captures";
import { notFound } from "next/navigation";
import { CaptureDetailMobileClient } from "./capture-detail-mobile-client";

interface CaptureDetailPageProps {
  params: Promise<{ captureId: string }>;
}

export default async function CaptureDetailPage({
  params,
}: CaptureDetailPageProps) {
  const { captureId } = await params;
  const capture = await getCapture(captureId);

  if (!capture) {
    notFound();
  }

  return <CaptureDetailMobileClient initialCapture={capture} />;
}
