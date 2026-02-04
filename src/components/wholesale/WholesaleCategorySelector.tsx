import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FolderOpen, Search, Check, ChevronDown, ChevronRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildCategoryTree, filterTreeWithProducts, getDirectChildren, CategoryTree } from "@/lib/categoryUtils";
import { CategoryManagementDialog } from "./CategoryManagementDialog";

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order?: number | null;
  product_count?: number;
  slug?: string;
  image_url?: string | null;
}

interface WholesaleCategorySelectorProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  totalProductsCount: number;
  // Category management props (optional - only for admin)
  onCreateCategory?: (name: string, parentId?: string | null) => Promise<Category | null>;
  onUpdateCategory?: (id: string, name: string) => Promise<boolean>;
  onDeleteCategory?: (id: string) => Promise<boolean>;
  onUpdateOrder?: (orderedIds: string[]) => Promise<void>;
  isAdmin?: boolean;
}

export function WholesaleCategorySelector({
  categories,
  selectedCategory,
  onSelectCategory,
  totalProductsCount,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onUpdateOrder,
  isAdmin = false,
}: WholesaleCategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [managementOpen, setManagementOpen] = useState(false);

  const canManage = isAdmin && onCreateCategory && onUpdateCategory && onDeleteCategory && onUpdateOrder;

  // Build category tree - include ALL categories, then filter by totalProductCount
  const categoryTree = useMemo(() => {
    // Build tree from ALL categories (not pre-filtered)
    const tree = buildCategoryTree(categories.map(c => ({
      ...c,
      slug: c.slug || '',
      image_url: c.image_url || null,
    })));
    // Filter keeps categories where totalProductCount > 0 (includes children's products)
    return filterTreeWithProducts(tree);
  }, [categories]);

  // Get subcategories of selected category for chips display
  const subcategories = useMemo(() => {
    if (!selectedCategory) return [];
    return categories.filter(c => c.parent_id === selectedCategory && c.product_count && c.product_count > 0);
  }, [categories, selectedCategory]);

  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      cat.product_count &&
      cat.product_count > 0
  );

  const selectedCategoryData = selectedCategory
    ? categories.find((c) => c.id === selectedCategory)
    : null;

  const selectedCategoryName = selectedCategoryData?.name || "Все товары";

  const selectedCategoryCount = selectedCategoryData?.product_count || totalProductsCount;

  const handleSelect = (categoryId: string | null) => {
    onSelectCategory(categoryId);
    setOpen(false);
    setSearchQuery("");
  };

  const toggleExpanded = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Recursive category renderer for the sheet
  const renderCategory = (cat: CategoryTree, depth: number = 0) => {
    const hasChildren = cat.children.length > 0;
    const isExpanded = expandedCategories.includes(cat.id);
    const isSelected = selectedCategory === cat.id;
    const isRootCategory = depth === 0;

    return (
      <div key={cat.id}>
        <button
          onClick={(e) => {
            // For parent categories with children, clicking toggles expansion
            if (hasChildren && !isExpanded) {
              toggleExpanded(cat.id, e);
            } else {
              handleSelect(cat.id);
            }
          }}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted",
            isRootCategory && "border-b border-border/50"
          )}
          style={{ paddingLeft: 16 + depth * 16 }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {isSelected && <Check className="h-4 w-4 shrink-0" />}
            <span
              className={cn(
                "truncate",
                isRootCategory ? "font-bold text-foreground" : "font-medium",
                !isSelected && "ml-7"
              )}
            >
              {cat.name}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant={isSelected ? "secondary" : "outline"}
              className="shrink-0"
            >
              {cat.totalProductCount}
            </Badge>
            {hasChildren && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpanded(cat.id, e);
                }}
                className={cn(
                  "p-1 rounded hover:bg-black/10 transition-colors",
                  isSelected && "hover:bg-white/20"
                )}
              >
                {isExpanded 
                  ? <ChevronDown className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />
                }
              </span>
            )}
          </div>
        </button>

        {/* Children - subcategories */}
        {hasChildren && isExpanded && (
          <div className="ml-4 border-l-2 border-primary/20 bg-muted/30">
            {cat.children.map(child => renderCategory(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Compact trigger button */}
      <Button
        variant="outline"
        className="w-full justify-between h-11 px-4"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{selectedCategoryName}</span>
          <Badge variant="secondary" className="shrink-0">
            {selectedCategoryCount}
          </Badge>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>

      {/* Subcategories chips */}
      {subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {subcategories.map(sub => (
            <Button
              key={sub.id}
              variant={selectedCategory === sub.id ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectCategory(sub.id)}
              className="h-8"
            >
              {sub.name}
              <Badge 
                variant="secondary" 
                className="ml-1.5 h-5 px-1.5 text-[10px]"
              >
                {sub.product_count}
              </Badge>
            </Button>
          ))}
        </div>
      )}

      {/* Category selection sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl flex flex-col">
          <SheetHeader className="pb-4 shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle>Выберите категорию</SheetTitle>
              {canManage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    setManagementOpen(true);
                  }}
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Управление
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Search */}
          <div className="relative mb-4 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск категории..."
              className="pl-10"
            />
          </div>

          {/* Categories list - flex-1 takes remaining space and enables scroll */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-1 pr-4 pb-8">
              {/* All products option */}
              {(!searchQuery || "все товары".includes(searchQuery.toLowerCase())) && (
                <button
                  onClick={() => handleSelect(null)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors",
                    !selectedCategory
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {!selectedCategory && <Check className="h-4 w-4" />}
                    <span className={cn("font-medium", !selectedCategory && "ml-0")}>
                      Все товары
                    </span>
                  </div>
                  <Badge
                    variant={!selectedCategory ? "secondary" : "outline"}
                    className="shrink-0"
                  >
                    {totalProductsCount}
                  </Badge>
                </button>
              )}

              {/* Categories tree or flat search results */}
              {searchQuery ? (
                // Flat search results
                filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelect(cat.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors",
                      selectedCategory === cat.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {selectedCategory === cat.id && <Check className="h-4 w-4" />}
                      <span
                        className={cn(
                          "font-medium",
                          selectedCategory !== cat.id && "ml-7"
                        )}
                      >
                        {cat.name}
                      </span>
                    </div>
                    <Badge
                      variant={selectedCategory === cat.id ? "secondary" : "outline"}
                      className="shrink-0"
                    >
                      {cat.product_count}
                    </Badge>
                  </button>
                ))
              ) : (
                // Tree view
                categoryTree.map(cat => renderCategory(cat, 0))
              )}

              {filteredCategories.length === 0 && searchQuery && (
                <p className="text-center text-muted-foreground py-8">
                  Категории не найдены
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Category management dialog */}
      {canManage && (
        <CategoryManagementDialog
          open={managementOpen}
          onOpenChange={setManagementOpen}
          categories={categories}
          onCreateCategory={onCreateCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
          onUpdateOrder={onUpdateOrder}
        />
      )}
    </div>
  );
}
