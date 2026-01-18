import { useState, useRef, useEffect } from "react";
import { Check, X, Settings, Lock, Unlock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Product,
  packagingTypeLabels,
  packagingOptions,
  formatPrice,
  calculateSalePrice,
  calculatePackagingPrices,
  unitOptions,
  PackagingType,
} from "./types";

interface InlineProductRowProps {
  product: Product;
  onUpdate: (product: Product) => void;
  onOpenPricingDialog: (product: Product) => void;
  onToggleAutoSync?: (productId: string) => void;
  customPackagingTypes?: string[]; // Custom packaging types from all products
}

export function InlineProductRow({
  product,
  onUpdate,
  onOpenPricingDialog,
  onToggleAutoSync,
  customPackagingTypes = [],
}: InlineProductRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProduct, setEditedProduct] = useState<Product>(product);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedProduct(product);
  }, [product]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    onUpdate(editedProduct);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedProduct(product);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const salePrice = editedProduct.buyPrice
    ? calculateSalePrice(editedProduct.buyPrice, editedProduct.markup)
    : editedProduct.pricePerUnit;

  const packagingPrices = calculatePackagingPrices(
    salePrice,
    editedProduct.unitWeight,
    editedProduct.packagingType,
    editedProduct.customVariantPrices,
    editedProduct.portionPrices
  );

  return (
    <TableRow 
      className={isEditing ? "bg-muted/50" : undefined}
      onDoubleClick={() => setIsEditing(true)}
    >
      {/* Фото */}
      <TableCell>
        <img
          src={product.image}
          alt={product.name}
          className="w-10 h-10 rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => {
            if (product.imageFull) {
              window.open(product.imageFull, "_blank");
            }
          }}
          title={product.imageFull ? "Нажмите для просмотра" : ""}
        />
      </TableCell>

      {/* Название */}
      <TableCell className="font-medium">
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editedProduct.name}
            onChange={(e) => setEditedProduct({ ...editedProduct, name: e.target.value })}
            onKeyDown={handleKeyDown}
            className="h-8"
          />
        ) : (
          <div className="cursor-pointer" onDoubleClick={() => setIsEditing(true)}>
            {product.name}
            {product.description && (
              <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate">
                {product.description}
              </p>
            )}
          </div>
        )}
      </TableCell>

      {/* Источник */}
      <TableCell>
        {product.source === "moysklad" ? (
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
            <ExternalLink className="h-3 w-3 mr-1" />
            МойСклад
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            Локальный
          </Badge>
        )}
      </TableCell>

      {/* Ед. изм. */}
      <TableCell>
        {isEditing ? (
          <Select
            value={editedProduct.unit}
            onValueChange={(value) => setEditedProduct({ ...editedProduct, unit: value })}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="outline" className="text-xs">
            {product.unit}
          </Badge>
        )}
      </TableCell>

      {/* Вид */}
      <TableCell>
        {isEditing ? (
          <Select
            value={editedProduct.packagingType || "piece"}
            onValueChange={(value) => 
              setEditedProduct({ ...editedProduct, packagingType: value as PackagingType })
            }
          >
            <SelectTrigger className="h-8 w-[100px]">
              <SelectValue>
                {packagingTypeLabels[editedProduct.packagingType as PackagingType] || editedProduct.packagingType || "Выбрать"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {packagingOptions.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
              {/* Show custom packaging types from other products */}
              {customPackagingTypes
                .filter(type => !packagingOptions.find(o => o.value === type))
                .map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              {/* Show current value if it's custom and not in any list */}
              {editedProduct.packagingType && 
               !packagingOptions.find(o => o.value === editedProduct.packagingType) &&
               !customPackagingTypes.includes(editedProduct.packagingType) && (
                <SelectItem key={editedProduct.packagingType} value={editedProduct.packagingType}>
                  {editedProduct.packagingType}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        ) : (
          <div>
            <Badge variant="outline" className="text-xs">
              {product.packagingType
                ? (packagingTypeLabels[product.packagingType as PackagingType] || product.packagingType)
                : product.productType === "weight"
                ? "Весовой"
                : "Штучный"}
            </Badge>
            {product.packagingType === "head" && product.unitWeight && (
              <span className="text-xs text-muted-foreground block mt-0.5">
                {product.unitWeight} кг
              </span>
            )}
          </div>
        )}
      </TableCell>

      {/* Себестоимость */}
      <TableCell className="text-muted-foreground text-sm">
        {isEditing ? (
          <Input
            type="number"
            value={editedProduct.buyPrice || ""}
            onChange={(e) =>
              setEditedProduct({ ...editedProduct, buyPrice: parseFloat(e.target.value) || 0 })
            }
            onKeyDown={handleKeyDown}
            className="h-8 w-[90px]"
            placeholder="0"
          />
        ) : product.buyPrice ? (
          formatPrice(product.buyPrice)
        ) : (
          "—"
        )}
      </TableCell>

      {/* Наценка */}
      <TableCell className="text-sm">
        {product.markup ? (
          <span className="text-green-600 dark:text-green-400">
            +{product.markup.value}
            {product.markup.type === "percent" ? "%" : "₽"}
          </span>
        ) : (
          "—"
        )}
      </TableCell>

      {/* Цена */}
      <TableCell className="font-medium">
        {isEditing && (!editedProduct.buyPrice || editedProduct.buyPrice === 0) ? (
          <Input
            type="number"
            value={editedProduct.pricePerUnit || ""}
            onChange={(e) =>
              setEditedProduct({ ...editedProduct, pricePerUnit: parseFloat(e.target.value) || 0 })
            }
            onKeyDown={handleKeyDown}
            className="h-8 w-[90px]"
          />
        ) : (
          `${formatPrice(salePrice)}/${product.unit}`
        )}
      </TableCell>

      {/* Цены за ед. */}
      <TableCell>
        {packagingPrices ? (
          <div className="text-xs space-y-0.5">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Целая:</span>
              <span className="font-medium">{formatPrice(packagingPrices.full)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">½:</span>
              <span className="font-medium">{formatPrice(packagingPrices.half)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">¼:</span>
              <span className="font-medium">{formatPrice(packagingPrices.quarter)}</span>
            </div>
            {packagingPrices.portion && (
              <div className="flex justify-between gap-2 pt-1 border-t border-border/50">
                <span className="text-muted-foreground">Порция:</span>
                <span className="font-medium">{formatPrice(packagingPrices.portion)}</span>
              </div>
            )}
          </div>
        ) : (
          "—"
        )}
      </TableCell>

      {/* Статус */}
      <TableCell>
        <Badge
          variant={product.inStock ? "default" : "secondary"}
          className={`text-xs ${
            product.inStock
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {product.inStock ? "В наличии" : "Нет"}
        </Badge>
      </TableCell>

      {/* Номенклатура (SKU) */}
      <TableCell className="text-sm text-muted-foreground">
        {isEditing ? (
          <Input
            value={editedProduct.sku || ""}
            onChange={(e) => setEditedProduct({ ...editedProduct, sku: e.target.value })}
            onKeyDown={handleKeyDown}
            className="h-8 w-[100px]"
            placeholder="SKU"
          />
        ) : (
          <span className="font-mono text-xs">{product.sku || "—"}</span>
        )}
      </TableCell>

      {/* Синхр. */}
      <TableCell>
        {product.source === "moysklad" && onToggleAutoSync && (
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${product.autoSync ? "text-primary" : "text-muted-foreground"}`}
            onClick={() => onToggleAutoSync(product.id)}
            title={product.autoSync ? "Авто-синхронизация включена" : "Включить авто-синхронизацию"}
          >
            {product.autoSync ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </Button>
        )}
      </TableCell>

      {/* Действия */}
      <TableCell>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={handleSave}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            onClick={() => onOpenPricingDialog(product)}
            title="Настройки ценообразования"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
