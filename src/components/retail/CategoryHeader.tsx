import { ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { RetailCategory } from "@/hooks/useRetailStore";

interface CategoryHeaderProps {
  category: RetailCategory | null;
  productCount: number;
}

export function CategoryHeader({ category, productCount }: CategoryHeaderProps) {
  const { subdomain } = useParams();

  return (
    <div className="mb-8">
      {/* Category title */}
      <h1 className="text-3xl lg:text-4xl font-light tracking-tight text-foreground font-serif">
        {category?.name || "Все товары"}
      </h1>

      {/* Separator line */}
      <div className="mt-6 h-px bg-border" />
    </div>
  );
}

function getProductWord(count: number): string {
  const lastTwo = count % 100;
  const lastOne = count % 10;
  
  if (lastTwo >= 11 && lastTwo <= 14) return "товаров";
  if (lastOne === 1) return "товар";
  if (lastOne >= 2 && lastOne <= 4) return "товара";
  return "товаров";
}
