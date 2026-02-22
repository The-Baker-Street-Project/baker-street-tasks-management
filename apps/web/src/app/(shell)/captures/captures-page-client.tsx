"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { useQueryState } from "nuqs";
import { CaptureFilterTabs } from "@/components/captures/CaptureFilterTabs";
import { CaptureList } from "@/components/captures/CaptureList";
import { CaptureDetail } from "@/components/captures/CaptureDetail";
import { CaptureCreateDialog } from "@/components/captures/CaptureCreateDialog";
import { getCaptures, getCapture } from "@/lib/api/captures";
import type { Capture, Context } from "@/types";
import type { CaptureTab } from "@/components/captures/CaptureFilterTabs";

const VALID_CONTEXTS = ["Home", "Work"] as const;

interface CapturesPageClientProps {
  initialCaptures: Capture[];
}

export function CapturesPageClient({
  initialCaptures,
}: CapturesPageClientProps) {
  const [captures, setCaptures] = useState<Capture[]>(initialCaptures);
  const [selectedCapture, setSelectedCapture] = useState<Capture | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCaptureId] = useQueryState("captureId");
  const [activeTab] = useQueryState("tab", {
    defaultValue: "recent" as CaptureTab,
  });
  const [contextParam] = useQueryState("context");
  const [isPending, startTransition] = useTransition();

  const refreshCaptures = useCallback(() => {
    startTransition(async () => {
      try {
        const context = contextParam && VALID_CONTEXTS.includes(contextParam as typeof VALID_CONTEXTS[number])
          ? (contextParam as Context)
          : undefined;
        const updated = await getCaptures({
          tab: (activeTab as CaptureTab) ?? "recent",
          context: context ?? undefined,
        });
        setCaptures(updated);
      } catch {
        // silently fail
      }
    });
  }, [activeTab, contextParam]);

  const handleCaptureSelect = useCallback(
    async (captureId: string | null) => {
      if (!captureId) {
        setSelectedCapture(null);
        return;
      }
      try {
        const capture = await getCapture(captureId);
        setSelectedCapture(capture);
      } catch {
        setSelectedCapture(null);
      }
    },
    []
  );

  useEffect(() => {
    refreshCaptures();
  }, [activeTab, contextParam, refreshCaptures]);

  const currentCapture =
    selectedCaptureId && selectedCapture?.id === selectedCaptureId
      ? selectedCapture
      : null;

  if (selectedCaptureId && !currentCapture && !isPending) {
    handleCaptureSelect(selectedCaptureId);
  }

  return (
    <div className="flex h-full flex-col">
      {/* Filter tabs */}
      <CaptureFilterTabs />

      <div className="flex flex-1 min-h-0">
        {/* List */}
        <div className="flex-1 min-w-0">
          <CaptureList
            captures={captures}
            isLoading={isPending}
            onCreateClick={() => setShowCreateDialog(true)}
          />
        </div>

        {/* Detail - hidden when no capture selected, hidden on mobile */}
        {currentCapture && (
          <div className="hidden md:block">
            <CaptureDetail
              capture={currentCapture}
              onClose={() => {
                setSelectedCapture(null);
              }}
              onRefresh={() => {
                refreshCaptures();
                if (selectedCaptureId) {
                  handleCaptureSelect(selectedCaptureId);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Create dialog */}
      <CaptureCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={refreshCaptures}
      />
    </div>
  );
}
