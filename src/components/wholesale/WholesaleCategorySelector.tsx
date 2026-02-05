import { useState } from "react";
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
import { FolderOpen, Search, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
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

  const filteredCategories = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      cat.product_count &&
      cat.product_count > 0
  );

  const selectedCategoryName = selectedCategory
    ? categories.find((c) => c.id === selectedCategory)?.name
    : "Все товары";

  const selectedCategoryCount = selectedCategory
    ? categories.find((c) => c.id === selectedCategory)?.product_count || 0
    : totalProductsCount;

  const handleSelect = (categoryId: string | null) => {
    onSelectCategory(categoryId);
    setOpen(false);
    setSearchQuery("");
  };

  return (
    <>
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

              {/* Categories */}
              {filteredCategories.map((cat) => (
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
              ))}

              {filteredCategories.length === 0 && searchQuery && (
                <p className="text-center text-muted-foreground py-8">
                  Категории не найдены
                </p>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
