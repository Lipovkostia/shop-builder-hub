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
    <div className="mb-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
        <Link 
          to={`/retail/${subdomain}`} 
          className="hover:text-foreground transition-colors"
        >
          Каталог
        </Link>
        {category && (
          <>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">{category.name}</span>
          </>
        )}
      </nav>

      {/* Category title */}
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
          {category?.name || "Все товары"}
        </h1>
        <span className="text-sm text-muted-foreground flex-shrink-0">
          {productCount} {getProductWord(productCount)}
        </span>
      </div>

      {/* Separator line */}
      <div className="mt-4 h-px bg-border" />
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
