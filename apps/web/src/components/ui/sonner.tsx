"use client";

import { Toaster } from "@/components/ui/toast";

// Re-export the Toaster for sonner compatibility
// In production, replace with actual sonner integration
function SonnerToaster() {
  return <Toaster />;
}

export { SonnerToaster as Toaster };
