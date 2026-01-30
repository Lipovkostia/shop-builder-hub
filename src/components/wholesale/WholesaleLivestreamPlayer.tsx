import React, { useEffect, useRef, useState, useMemo } from "react";
import Hls from "hls.js";
import { cn } from "@/lib/utils";
import { WifiOff } from "lucide-react";

interface WholesaleLivestreamPlayerProps {
  streamUrl: string | null;
  className?: string;
}

// Helper to detect stream type
function getStreamType(url: string): "twitch" | "youtube" | "hls" | "unknown" {
  if (!url) return "unknown";
  
  // Twitch patterns: twitch.tv/channel or player.twitch.tv
  if (url.includes("twitch.tv/") || url.includes("twitch.tv")) {
    return "twitch";
  }
  
  // YouTube patterns: youtube.com/watch, youtu.be, youtube.com/live
  if (url.includes("youtube.com/") || url.includes("youtu.be/")) {
    return "youtube";
  }
  
  // HLS stream (.m3u8)
  if (url.includes(".m3u8")) {
    return "hls";
  }
  
  return "unknown";
}

// Extract Twitch channel name from URL
function getTwitchChannel(url: string): string | null {
  try {
    // Handle various Twitch URL formats
    const patterns = [
      /twitch\.tv\/([a-zA-Z0-9_]+)/,
      /player\.twitch\.tv\/\?channel=([a-zA-Z0-9_]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Extract YouTube video ID from URL
function getYouTubeVideoId(url: string): string | null {
  try {
    const patterns = [
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
      /youtu\.be\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/live\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function WholesaleLivestreamPlayer({ streamUrl, className }: WholesaleLivestreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState(false);

  const streamType = useMemo(() => streamUrl ? getStreamType(streamUrl) : "unknown", [streamUrl]);
  const twitchChannel = useMemo(() => streamUrl ? getTwitchChannel(streamUrl) : null, [streamUrl]);
  const youtubeVideoId = useMemo(() => streamUrl ? getYouTubeVideoId(streamUrl) : null, [streamUrl]);

  // HLS player effect
  useEffect(() => {
    // Only use HLS.js for HLS streams
    if (streamType !== "hls") {
      return;
    }

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
  }, [streamUrl, streamType]);

  // Twitch embed
  if (streamType === "twitch" && twitchChannel) {
    return (
      <div className={cn("relative rounded-lg overflow-hidden bg-black", className)}>
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-purple-600 text-white text-xs font-medium px-2 py-1 rounded">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          TWITCH
        </div>
        <iframe
          src={`https://player.twitch.tv/?channel=${twitchChannel}&parent=${window.location.hostname}&muted=true`}
          className="w-full aspect-video"
          allowFullScreen
          allow="autoplay; encrypted-media"
        />
      </div>
    );
  }

  // YouTube embed
  if (streamType === "youtube" && youtubeVideoId) {
    return (
      <div className={cn("relative rounded-lg overflow-hidden bg-black", className)}>
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-red-600 text-white text-xs font-medium px-2 py-1 rounded">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          YOUTUBE
        </div>
        <iframe
          src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=1`}
          className="w-full aspect-video"
          allowFullScreen
          allow="autoplay; encrypted-media"
        />
      </div>
    );
  }

  // Fallback for no stream or error
  if (!streamUrl || error || (streamType === "unknown" && !streamUrl.includes(".m3u8"))) {
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

  // HLS player
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
