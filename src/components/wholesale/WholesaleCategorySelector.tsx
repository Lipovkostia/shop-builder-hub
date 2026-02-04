import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FolderOpen, Search, Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildCategoryTree, filterTreeWithProducts, getDirectChildren, CategoryTree } from "@/lib/categoryUtils";

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  product_count?: number;
}

interface WholesaleCategorySelectorProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  totalProductsCount: number;
}

export function WholesaleCategorySelector({
  categories,
  selectedCategory,
  onSelectCategory,
  totalProductsCount,
}: WholesaleCategorySelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  // Build category tree
  const categoryTree = useMemo(() => {
    const withProducts = categories.filter(cat => cat.product_count && cat.product_count > 0);
    const tree = buildCategoryTree(withProducts.map(c => ({
      ...c,
      slug: '',
      image_url: null,
    })));
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

    return (
      <div key={cat.id}>
        <button
          onClick={() => handleSelect(cat.id)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors",
            isSelected
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted"
          )}
          style={{ paddingLeft: 16 + depth * 16 }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {isSelected && <Check className="h-4 w-4 shrink-0" />}
            <span
              className={cn(
                "font-medium truncate",
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
                onClick={(e) => toggleExpanded(cat.id, e)}
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

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-l-2 border-muted ml-6">
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
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle>Выберите категорию</SheetTitle>
          </SheetHeader>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск категории..."
              className="pl-10"
            />
          </div>

          {/* Categories list */}
          <ScrollArea className="h-[calc(70vh-160px)]">
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
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
