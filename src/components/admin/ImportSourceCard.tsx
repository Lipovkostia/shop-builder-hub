import React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ImportSourceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  badge?: string;
  disabled?: boolean;
}

export function ImportSourceCard({ 
  icon, 
  title, 
  description, 
  onClick, 
  badge, 
  disabled 
}: ImportSourceCardProps) {
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={cn(
        "relative flex flex-col items-center justify-center p-6 bg-card rounded-xl border-2 border-border hover:border-primary/50 transition-all cursor-pointer min-h-[160px]",
        disabled && "opacity-50 cursor-not-allowed hover:border-border"
      )}
    >
      {badge && (
        <Badge 
          variant={badge === "Скоро" ? "secondary" : "default"}
          className="absolute top-2 right-2 text-xs"
        >
          {badge}
        </Badge>
      )}
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-foreground text-center mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground text-center">{description}</p>
    </div>
  );
}
