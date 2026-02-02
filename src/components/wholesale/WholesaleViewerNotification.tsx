import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface WholesaleViewerNotificationProps {
  viewersCount: number;
  className?: string;
}

export function WholesaleViewerNotification({ 
  viewersCount, 
  className 
}: WholesaleViewerNotificationProps) {
  const [showNotification, setShowNotification] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [newViewersQueue, setNewViewersQueue] = useState<number>(0);
  const prevCountRef = useRef<number>(viewersCount);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    // Create a simple bell sound using Web Audio API
    audioRef.current = new Audio();
    // Using a data URL for a simple bell sound (base64 encoded short bell wav)
    audioRef.current.src = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleC4BELI+ztqtbTAFOJjS1KhsDwBJptrYoWcgEVWaz9OpbSQOVqDR06dmIRFVmM/TqW0kDlWf0NOnZiERVJjP06ltJQ5Un9DUp2YhEVSYz9OpbSUOVJ/Q1KdmIRFUmM/TqW0lDlSf0NSnZiERVJjP06ltJQ5Un9DUp2YhEVSYz9OpbSUOVJ/Q1KdmIQ==";
    audioRef.current.volume = 0.3;
    
    return () => {
      if (audioRef.current) {
        audioRef.current = null;
      }
    };
  }, []);

  // Play bell sound
  const playBellSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Autoplay might be blocked, that's ok
      });
    }
  }, []);

  // Detect new viewers
  useEffect(() => {
    if (prevCountRef.current < viewersCount) {
      const newViewers = viewersCount - prevCountRef.current;
      setNewViewersQueue(prev => prev + newViewers);
      
      // Trigger notification
      setShowNotification(true);
      setIsRinging(true);
      playBellSound();
      
      // Stop ringing animation after 1 second
      const ringTimeout = setTimeout(() => {
        setIsRinging(false);
      }, 1000);
      
      // Hide notification badge after 3 seconds
      const hideTimeout = setTimeout(() => {
        setShowNotification(false);
        setNewViewersQueue(0);
      }, 3000);
      
      return () => {
        clearTimeout(ringTimeout);
        clearTimeout(hideTimeout);
      };
    }
    prevCountRef.current = viewersCount;
  }, [viewersCount, playBellSound]);

  return (
    <div className={cn("relative inline-flex items-center gap-2", className)}>
      {/* Bell icon */}
      <div className="relative">
        <Bell 
          className={cn(
            "h-5 w-5 text-muted-foreground transition-all",
            isRinging && "text-primary animate-[ring_0.3s_ease-in-out_3]"
          )}
          style={{
            transformOrigin: "top center"
          }}
        />
        
        {/* New viewer badge */}
        {showNotification && newViewersQueue > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-bounce">
            +{newViewersQueue}
          </span>
        )}
      </div>
      
      {/* Viewer count */}
      <span className="text-sm font-medium">
        {viewersCount}
      </span>
    </div>
  );
}
