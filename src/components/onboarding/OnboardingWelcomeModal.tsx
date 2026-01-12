import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Tag, Link2, Sparkles } from "lucide-react";
import { useOnboardingSafe } from "@/contexts/OnboardingContext";

const WELCOME_MODAL_KEY = "seller_onboarding_welcome_shown";

export function OnboardingWelcomeModal() {
  const [open, setOpen] = useState(false);
  const onboarding = useOnboardingSafe();

  useEffect(() => {
    // Show modal only if not shown before
    const wasShown = localStorage.getItem(WELCOME_MODAL_KEY) === 'true';
    
    if (!wasShown) {
      // Small delay to let the page render first
      const timer = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleStart = () => {
    localStorage.setItem(WELCOME_MODAL_KEY, 'true');
    setOpen(false);
    // Start the first onboarding step if context is available
    onboarding?.startOnboarding();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleStart();
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Добро пожаловать в ваш магазин!
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="text-center">
            <p className="text-muted-foreground text-sm">
              Главная идея сервиса проста:
            </p>
            <p className="text-lg font-semibold text-primary mt-2">
              ✨ Каждый тип покупателей видит свои цены
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Рестораны — одни цены</p>
                <p className="text-xs text-muted-foreground">Например, наценка 25%</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Tag className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Оптовики — другие цены</p>
                <p className="text-xs text-muted-foreground">Например, наценка 15%</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Link2 className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Делитесь ссылками на прайс-листы</p>
                <p className="text-xs text-muted-foreground">Покупатель заходит и видит только свои цены</p>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground bg-primary/5 rounded-lg p-3">
            <p>Вы сможете менять цены и статусы товаров</p>
            <p>оперативно для любого типа покупателей</p>
          </div>
        </div>

        <Button onClick={handleStart} className="w-full gap-2">
          Начать работу
          <span className="text-lg">→</span>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
