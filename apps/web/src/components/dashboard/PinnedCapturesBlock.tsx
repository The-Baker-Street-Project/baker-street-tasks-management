import { Pin } from "lucide-react";
import { DashboardBlock } from "./DashboardBlock";
import { CaptureRow } from "@/components/shared/CaptureRow";
import type { Capture } from "@/types";

interface PinnedCapturesBlockProps {
  captures: Capture[];
}

export function PinnedCapturesBlock({ captures }: PinnedCapturesBlockProps) {
  return (
    <DashboardBlock
      title="Pinned Captures"
      count={captures.length}
      viewAllHref="/captures?tab=pinned"
      icon={<Pin className="h-4 w-4 text-amber-500" />}
      emptyMessage="No pinned captures"
    >
      {captures.map((capture) => (
        <CaptureRow key={capture.id} capture={capture} compact />
      ))}
    </DashboardBlock>
  );
}
