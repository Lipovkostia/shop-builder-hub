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
    <div className="mb-1.5 bg-card rounded-2xl p-5">
      {/* Category title */}
      <h1 className="text-2xl lg:text-3xl font-semibold tracking-normal text-foreground font-sans">
        {category?.name || "Все товары"}
      </h1>
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
