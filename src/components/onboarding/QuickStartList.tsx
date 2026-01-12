import React from "react";
import { ChevronDown, ChevronRight, Play, Check } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useOnboarding } from "@/contexts/OnboardingContext";

interface QuickStartListProps {
  onStepClick?: () => void;
}

export function QuickStartList({ onStepClick }: QuickStartListProps) {
  const { steps, completedSteps, goToStep } = useOnboarding();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleStepClick = (stepId: string) => {
    goToStep(stepId);
    onStepClick?.();
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full p-6 flex items-center justify-between hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Play className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-foreground">Быстрый старт</h3>
              <p className="text-xs text-muted-foreground">
                {completedSteps.length} из {steps.length} выполнено
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {completedSteps.length === steps.length && steps.length > 0 && (
              <span className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                Завершено
              </span>
            )}
            {isOpen ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="border-t border-border">
            {steps.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Шаги онбординга будут добавлены позже
              </div>
            ) : (
              <div className="divide-y divide-border">
                {steps.map((step, index) => {
                  const isCompleted = completedSteps.includes(step.id);
                  
                  return (
                    <button
                      key={step.id}
                      onClick={() => handleStepClick(step.id)}
                      className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${
                        isCompleted 
                          ? 'bg-green-500 text-white' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {isCompleted ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${
                          isCompleted ? 'text-muted-foreground' : 'text-foreground'
                        }`}>
                          {step.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {step.shortDescription}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
