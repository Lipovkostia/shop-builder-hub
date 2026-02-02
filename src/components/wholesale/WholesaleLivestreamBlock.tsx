import React from "react";
import { WholesaleLivestreamPlayer } from "./WholesaleLivestreamPlayer";
import { WholesaleLivestreamChat } from "./WholesaleLivestreamChat";
import { WholesaleViewerNotification } from "./WholesaleViewerNotification";
import { useLivestreamChat } from "@/hooks/useLivestreamChat";
import { cn } from "@/lib/utils";
import { Radio } from "lucide-react";

interface WholesaleLivestreamBlockProps {
  storeId: string;
  streamUrl: string | null;
  streamTitle?: string | null;
  className?: string;
}

export function WholesaleLivestreamBlock({ 
  storeId, 
  streamUrl, 
  streamTitle,
  className 
}: WholesaleLivestreamBlockProps) {
  const { viewersCount } = useLivestreamChat(storeId);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with viewer notification */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-destructive animate-pulse" />
          <span className="text-xs font-medium text-destructive uppercase tracking-wider">
            Live
          </span>
        </div>
        <WholesaleViewerNotification viewersCount={viewersCount} />
      </div>
      
      {/* Video player */}
      <WholesaleLivestreamPlayer streamUrl={streamUrl} />
      
      {/* Stream title */}
      {streamTitle && (
        <p className="text-sm font-medium text-foreground line-clamp-2">
          {streamTitle}
        </p>
      )}
      
      {/* Chat */}
      <WholesaleLivestreamChat storeId={storeId} />
    </div>
  );
}
