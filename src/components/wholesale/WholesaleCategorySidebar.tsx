import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SidebarCategory {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  product_count?: number;
  parent_id?: string | null;
  children?: SidebarCategory[];
}

interface WholesaleCategorySidebarProps {
  categories: SidebarCategory[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  totalProductsCount: number;
  medieval?: boolean;
}

const med = {
  text: "#e8d5b0",
  textSelected: "#f5d678",
  textMuted: "#8a7a60",
  hover: "#c9a96e",
  font: "'Georgia', serif",
};

function buildTree(categories: SidebarCategory[]): SidebarCategory[] {
  const map = new Map<string, SidebarCategory>();
  const roots: SidebarCategory[] = [];

  categories.forEach((c) => map.set(c.id, { ...c, children: [] }));

  categories.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function CategoryNode({
  category,
  selectedCategory,
  onSelectCategory,
  depth = 0,
  medieval,
}: {
  category: SidebarCategory;
  selectedCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  depth?: number;
  medieval?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = category.children && category.children.length > 0;
  const isSelected = selectedCategory === category.id;

  return (
    <div>
      <button
        onClick={() => {
          onSelectCategory(category.id);
          if (hasChildren) setOpen((o) => !o);
        }}
        className={cn(
          "w-full flex items-center gap-1 py-1.5 text-sm transition-colors",
          !medieval && (isSelected ? "text-primary font-semibold" : "text-foreground hover:text-primary"),
        )}
        style={{
          paddingLeft: `${depth * 16 + 4}px`,
          ...(medieval ? {
            fontFamily: med.font,
            color: isSelected ? med.textSelected : med.text,
            fontWeight: isSelected ? 600 : 400,
            textShadow: isSelected ? "0 0 8px rgba(245, 214, 120, 0.3)" : "none",
          } : {}),
        }}
        onMouseEnter={medieval && !isSelected ? (e) => { (e.currentTarget as HTMLElement).style.color = med.hover; } : undefined}
        onMouseLeave={medieval && !isSelected ? (e) => { (e.currentTarget as HTMLElement).style.color = med.text; } : undefined}
      >
        {hasChildren ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" style={medieval ? { color: med.textMuted } : {}} />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" style={medieval ? { color: med.textMuted } : {}} />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="truncate text-left flex-1">{category.name}</span>
      </button>
      {hasChildren && open && (
        <div>
          {category.children!.map((child) => (
            <CategoryNode
              key={child.id}
              category={child}
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
              depth={depth + 1}
              medieval={medieval}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function WholesaleCategorySidebar({
  categories,
  selectedCategory,
  onSelectCategory,
  totalProductsCount,
  medieval,
}: WholesaleCategorySidebarProps) {
  const tree = buildTree(categories as SidebarCategory[]);

  return (
    <nav className="text-sm">
      <button
        onClick={() => onSelectCategory(null)}
        className={cn(
          "w-full text-left py-1.5 px-1 font-medium transition-colors",
          !medieval && (!selectedCategory ? "text-primary font-semibold" : "text-foreground hover:text-primary"),
        )}
        style={medieval ? {
          fontFamily: med.font,
          color: !selectedCategory ? med.textSelected : med.text,
          fontWeight: !selectedCategory ? 600 : 500,
          textShadow: !selectedCategory ? "0 0 8px rgba(245, 214, 120, 0.3)" : "none",
        } : {}}
      >
        Товары и услуги
      </button>
      <div className="mt-1">
        {tree.map((cat) => (
          <CategoryNode
            key={cat.id}
            category={cat}
            selectedCategory={selectedCategory}
            onSelectCategory={onSelectCategory}
            medieval={medieval}
          />
        ))}
      </div>
    </nav>
  );
}
