import { WifiOff, Wifi } from "lucide-react";
import { useOfflineDetection } from "@/hooks/use-offline";

export function OfflineIndicator() {
  const isOffline = useOfflineDetection();

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2 rounded-md shadow-lg" data-testid="indicator-offline">
      <WifiOff className="w-4 h-4" />
      <span className="text-sm font-medium">Offline Mode</span>
    </div>
  );
}
