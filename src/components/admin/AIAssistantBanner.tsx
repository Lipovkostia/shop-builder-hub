import { useState, useEffect } from "react";
import { Sparkles, Mic, X } from "lucide-react";
import { AIAssistantPanel } from "./AIAssistantPanel";
import { useAuth } from "@/hooks/useAuth";

interface AIAssistantBannerProps {
  storeId: string | null;
}

export function AIAssistantBanner({ storeId }: AIAssistantBannerProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (!user?.id) return false;
    return localStorage.getItem(`ai_banner_dismissed_${user.id}`) === 'true';
  });

  useEffect(() => {
    if (user?.id) {
      setIsDismissed(localStorage.getItem(`ai_banner_dismissed_${user.id}`) === 'true');
    }
  }, [user?.id]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (user?.id) {
      localStorage.setItem(`ai_banner_dismissed_${user.id}`, 'true');
    }
  };

  if (isDismissed) return null;

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 text-white">
        {/* Animated background shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        
        {/* Close button */}
        <button
         onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>
        
        {/* Content */}
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/10 transition-colors"
        >
          {/* Icon with glow */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-white/30 rounded-full blur-md animate-pulse" />
            <div className="relative w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          
          {/* Text */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              AI Помощник
              <span className="px-1.5 py-0.5 text-[10px] bg-white/20 rounded-full font-normal">
                Новинка
              </span>
            </h3>
            <p className="text-xs text-white/80 mt-0.5">
              Управляйте товарами голосом или текстом. Скажите «скрой колбасу» — и готово!
            </p>
          </div>
          
          {/* Mic icon */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <Mic className="w-4 h-4" />
            </div>
          </div>
        </button>
      </div>

      {/* AI Assistant Panel */}
      <AIAssistantPanel
        open={isOpen}
        onOpenChange={setIsOpen}
        storeId={storeId}
      />
    </>
  );
}
