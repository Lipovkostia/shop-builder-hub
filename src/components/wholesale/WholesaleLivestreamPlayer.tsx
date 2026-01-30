import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { cn } from "@/lib/utils";
import { Video, WifiOff } from "lucide-react";

interface WholesaleLivestreamPlayerProps {
  streamUrl: string | null;
  className?: string;
}

export function WholesaleLivestreamPlayer({ streamUrl, className }: WholesaleLivestreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) {
      setError(true);
      setIsLive(false);
      return;
    }

    setError(false);

    // Check if native HLS is supported (Safari)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", () => {
        setIsLive(true);
        video.play().catch(() => {});
      });
      video.addEventListener("error", () => {
        setError(true);
        setIsLive(false);
      });
    } else if (Hls.isSupported()) {
      // Use hls.js for other browsers
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLive(true);
        video.play().catch(() => {});
      });
      
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setError(true);
          setIsLive(false);
          
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Try to recover from network error
            setTimeout(() => {
              hls.startLoad();
            }, 3000);
          }
        }
      });
    } else {
      setError(true);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl]);

  if (!streamUrl || error) {
    return (
      <div className={cn(
        "aspect-video bg-muted rounded-lg flex flex-col items-center justify-center text-muted-foreground",
        className
      )}>
        <WifiOff className="h-8 w-8 mb-2" />
        <span className="text-sm">Трансляция недоступна</span>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-lg overflow-hidden bg-black", className)}>
      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-red-600 text-white text-xs font-medium px-2 py-1 rounded">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          LIVE
        </div>
      )}
      
      <video
        ref={videoRef}
        className="w-full aspect-video object-cover"
        muted
        playsInline
        controls
      />
    </div>
  );
}
