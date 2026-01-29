import React, { useState, useEffect } from "react";
import { Sparkles, RotateCcw, Eye, ExternalLink, Loader2, Search, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useProductSeo } from "@/hooks/useProductSeo";
import type { StoreProduct } from "@/hooks/useStoreProducts";
import { cn } from "@/lib/utils";

interface ProductSeoPanelProps {
  product: StoreProduct & {
    seo_title?: string | null;
    seo_description?: string | null;
    seo_keywords?: string[] | null;
    seo_schema?: object | null;
    seo_noindex?: boolean;
    seo_generated_at?: string | null;
  };
  storeId: string | null;
  storeName?: string;
  subdomain?: string;
  onUpdate?: () => void;
}

export function ProductSeoPanel({ product, storeId, storeName, subdomain, onUpdate }: ProductSeoPanelProps) {
  const { generating, saving, generateSeo, updateSeo, resetSeo } = useProductSeo(storeId, storeName);

  // Local state for form fields
  const [seoTitle, setSeoTitle] = useState(product.seo_title || "");
  const [seoDescription, setSeoDescription] = useState(product.seo_description || "");
  const [seoKeywords, setSeoKeywords] = useState<string[]>(product.seo_keywords || []);
  const [noindex, setNoindex] = useState(product.seo_noindex || false);
  const [newKeyword, setNewKeyword] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Sync with product data
  useEffect(() => {
    setSeoTitle(product.seo_title || "");
    setSeoDescription(product.seo_description || "");
    setSeoKeywords(product.seo_keywords || []);
    setNoindex(product.seo_noindex || false);
  }, [product]);

  const handleGenerateSeo = async () => {
    const success = await generateSeo(product.id);
    if (success && onUpdate) {
      onUpdate();
    }
  };

  const handleSave = async () => {
    const success = await updateSeo(product.id, {
      seo_title: seoTitle || null,
      seo_description: seoDescription || null,
      seo_keywords: seoKeywords.length > 0 ? seoKeywords : null,
      seo_noindex: noindex,
    });
    if (success && onUpdate) {
      onUpdate();
    }
  };

  const handleReset = async () => {
    const success = await resetSeo(product.id);
    if (success) {
      setSeoTitle("");
      setSeoDescription("");
      setSeoKeywords([]);
      setNoindex(false);
      if (onUpdate) onUpdate();
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !seoKeywords.includes(newKeyword.trim())) {
      setSeoKeywords([...seoKeywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    setSeoKeywords(seoKeywords.filter(k => k !== keyword));
  };

  const titleLength = seoTitle.length;
  const descriptionLength = seoDescription.length;
  const titleOptimal = titleLength >= 50 && titleLength <= 70;
  const descriptionOptimal = descriptionLength >= 140 && descriptionLength <= 160;

  const productUrl = subdomain ? `/wholesale/${subdomain}/product/${product.slug}` : `#`;

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">SEO-оптимизация</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateSeo}
            disabled={generating || saving}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1" />
            )}
            Заполнить с ИИ
          </Button>
        </div>
      </div>

      {product.seo_generated_at && (
        <p className="text-xs text-muted-foreground">
          Сгенерировано: {new Date(product.seo_generated_at).toLocaleDateString("ru-RU")}
        </p>
      )}

      {/* SEO Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">SEO-заголовок</Label>
      <span className={cn(
            "text-xs",
            titleOptimal ? "text-emerald-600 dark:text-emerald-400" : titleLength > 70 ? "text-destructive" : "text-muted-foreground"
          )}>
            {titleLength}/70
          </span>
        </div>
        <Input
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
          placeholder="Заголовок страницы для поисковиков"
          className="text-sm"
        />
      </div>

      {/* SEO Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Meta Description</Label>
          <span className={cn(
            "text-xs",
            descriptionOptimal ? "text-emerald-600 dark:text-emerald-400" : descriptionLength > 160 ? "text-destructive" : "text-muted-foreground"
          )}>
            {descriptionLength}/160
          </span>
        </div>
        <Textarea
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          placeholder="Краткое описание для поисковой выдачи"
          className="text-sm resize-none"
          rows={2}
        />
      </div>

      {/* Keywords */}
      <div className="space-y-1.5">
        <Label className="text-xs">Ключевые слова</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {seoKeywords.map((keyword) => (
            <Badge
              key={keyword}
              variant="secondary"
              className="text-xs cursor-pointer hover:bg-destructive/20"
              onClick={() => removeKeyword(keyword)}
            >
              {keyword} ×
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Добавить ключевое слово"
            className="text-sm flex-1"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
          />
          <Button variant="outline" size="sm" onClick={addKeyword}>
            +
          </Button>
        </div>
      </div>

      {/* URL Slug */}
      <div className="space-y-1.5">
        <Label className="text-xs">URL товара</Label>
        <div className="flex items-center gap-2">
          <Input
            value={productUrl}
            readOnly
            className="text-sm font-mono bg-muted/50 flex-1"
          />
          {subdomain && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(productUrl, "_blank")}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Noindex toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <Label className="text-xs">Исключить из индексации</Label>
          <p className="text-xs text-muted-foreground">Добавить noindex тег</p>
        </div>
        <Switch checked={noindex} onCheckedChange={setNoindex} />
      </div>

      {/* Google Preview */}
      <div className="space-y-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className="text-xs p-0 h-auto"
        >
          <Eye className="h-3 w-3 mr-1" />
          {showPreview ? "Скрыть предпросмотр" : "Предпросмотр в Google"}
        </Button>
        
        {showPreview && (
          <div className="p-3 bg-background rounded border space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              <span className="truncate">{subdomain || "example"}.store.com › product › {product.slug}</span>
            </div>
            <h4 className="text-primary text-sm font-medium hover:underline cursor-pointer truncate">
              {seoTitle || product.name}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {seoDescription || product.description || "Описание товара..."}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          Сохранить SEO
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={saving}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Сбросить
        </Button>
      </div>
    </div>
  );
}
