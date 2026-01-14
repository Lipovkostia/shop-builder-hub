import { useState } from "react";
import { Sparkles, Mic, X } from "lucide-react";
import { CustomerAIAssistantPanel } from "./CustomerAIAssistantPanel";
import { useCustomerAIAssistant, FoundItem } from "@/hooks/useCustomerAIAssistant";
import { Order } from "@/hooks/useOrders";

interface CustomerAIAssistantBannerProps {
  catalogId: string | null;
  orders?: Order[];
  onAddToCart: (items: FoundItem[]) => void;
}

export function CustomerAIAssistantBanner({ 
  catalogId, 
  orders = [],
  onAddToCart 
}: CustomerAIAssistantBannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Hoist the hook here so state persists when panel closes
  const assistant = useCustomerAIAssistant(catalogId);
  
  const hasItems = assistant.itemCount > 0;

  if (isDismissed) return null;

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 text-white">
        {/* Animated background shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        
        {/* Close button */}
        <button
          onClick={() => setIsDismissed(true)}
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
            {/* Badge with item count */}
            {hasItems && (
              <div className="absolute -top-1 -right-1 bg-white text-primary text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-sm">
                {assistant.itemCount}
              </div>
            )}
          </div>
          
          {/* Text */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              Умный заказ
              {hasItems ? (
                <span className="px-1.5 py-0.5 text-[10px] bg-white/20 rounded-full font-normal">
                  {assistant.itemCount} товар{assistant.itemCount === 1 ? '' : assistant.itemCount < 5 ? 'а' : 'ов'}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-[10px] bg-white/20 rounded-full font-normal">
                  Новинка — протестируйте!
                </span>
              )}
            </h3>
            <p className="text-xs text-white/80 mt-0.5">
              {hasItems 
                ? "Нажмите чтобы продолжить формирование заказа"
                : "Скажите голосом или напишите «сёмга 2 кг, форель полкило» — AI соберёт заказ"
              }
            </p>
          </div>
          
          {/* Mic icon */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full bg-white/20 flex items-center justify-center ${!hasItems ? 'animate-pulse' : ''}`}>
              <Mic className="w-4 h-4" />
            </div>
          </div>
        </button>
      </div>

      {/* AI Assistant Panel */}
      <CustomerAIAssistantPanel
        open={isOpen}
        onOpenChange={setIsOpen}
        assistant={assistant}
        orders={orders}
        onAddToCart={onAddToCart}
      />
    </>
  );
}
