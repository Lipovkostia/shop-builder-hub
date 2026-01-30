import React from "react";
import { WholesaleLivestreamPlayer } from "./WholesaleLivestreamPlayer";
import { WholesaleLivestreamChat } from "./WholesaleLivestreamChat";
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
  return (
    <div className={cn("space-y-3", className)}>
      {/* Video player */}
      <WholesaleLivestreamPlayer streamUrl={streamUrl} />
      
      {/* Stream title */}
      {streamTitle && (
        <div className="flex items-start gap-2">
          <Radio className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-foreground line-clamp-2">
            {streamTitle}
          </p>
        </div>
      )}
      
      {/* Chat */}
      <WholesaleLivestreamChat storeId={storeId} />
    </div>
  );
}
