"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CaptureDetail } from "@/components/captures/CaptureDetail";
import { getCapture } from "@/lib/api/captures";
import type { Capture } from "@/types";

interface CaptureDetailMobileClientProps {
  initialCapture: Capture;
}

export function CaptureDetailMobileClient({
  initialCapture,
}: CaptureDetailMobileClientProps) {
  const router = useRouter();
  const [capture, setCapture] = useState(initialCapture);

  const handleRefresh = useCallback(async () => {
    try {
      const updated = await getCapture(capture.id);
      if (updated) {
        setCapture(updated);
      }
    } catch {
      // Server action not yet implemented
    }
  }, [capture.id]);

  return (
    <div className="flex h-full flex-col">
      {/* Mobile back header */}
      <div className="flex items-center gap-2 border-b px-4 py-2 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/captures")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">Back to Captures</span>
      </div>

      {/* Capture detail rendered full-width on mobile */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full [&>div]:w-full [&>div]:border-l-0">
          <CaptureDetail
            capture={capture}
            onClose={() => router.push("/captures")}
            onRefresh={handleRefresh}
          />
        </div>
      </div>
    </div>
  );
}
