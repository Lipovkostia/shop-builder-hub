import React, { useState, useEffect, useCallback } from "react";
import { Clock, Settings, RefreshCw, Check, X, Loader2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface SyncFieldMapping {
  buyPrice: boolean;      // Закупочная цена
  price: boolean;         // Цена продажи
  quantity: boolean;      // Остаток
  name: boolean;          // Название
  description: boolean;   // Описание
  images: boolean;        // Фотографии
  article: boolean;       // Артикул
  unit: boolean;          // Единица измерения
}

export interface SyncSettings {
  enabled: boolean;
  intervalMinutes: number;
  fieldMapping: SyncFieldMapping;
  lastSyncTime?: string;
  nextSyncTime?: string;
}

interface SyncSettingsPanelProps {
  settings: SyncSettings;
  onSettingsChange: (settings: SyncSettings) => void;
  onSyncNow: () => void;
  isSyncing: boolean;
  syncedProductsCount: number;
}

const intervalOptions = [
  { value: 5, label: "Каждые 5 минут" },
  { value: 15, label: "Каждые 15 минут" },
  { value: 30, label: "Каждые 30 минут" },
  { value: 60, label: "Каждый час" },
  { value: 180, label: "Каждые 3 часа" },
  { value: 360, label: "Каждые 6 часов" },
  { value: 720, label: "Каждые 12 часов" },
  { value: 1440, label: "Раз в сутки" },
];

const fieldLabels: Record<keyof SyncFieldMapping, { label: string; description: string }> = {
  buyPrice: { 
    label: "Закупочная цена", 
    description: "Себестоимость товара из МойСклад" 
  },
  price: { 
    label: "Цена продажи", 
    description: "Розничная цена из МойСклад" 
  },
  quantity: { 
    label: "Остаток", 
    description: "Количество на складе" 
  },
  name: { 
    label: "Название", 
    description: "Наименование товара" 
  },
  description: { 
    label: "Описание", 
    description: "Описание товара" 
  },
  images: { 
    label: "Фотографии", 
    description: "Изображения товара (может занять время)" 
  },
  article: { 
    label: "Артикул", 
    description: "Артикул / SKU товара" 
  },
  unit: { 
    label: "Единица измерения", 
    description: "Ед. изм. (кг, шт, л и т.д.)" 
  },
};

export function SyncSettingsPanel({
  settings,
  onSettingsChange,
  onSyncNow,
  isSyncing,
  syncedProductsCount,
}: SyncSettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [countdown, setCountdown] = useState<string>("");

  // Calculate countdown to next sync
  useEffect(() => {
    if (!settings.enabled || !settings.nextSyncTime) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const next = new Date(settings.nextSyncTime!);
      const diff = next.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown("Сейчас...");
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (minutes > 0) {
        setCountdown(`${minutes} мин ${seconds} сек`);
      } else {
        setCountdown(`${seconds} сек`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [settings.enabled, settings.nextSyncTime]);

  const toggleField = (field: keyof SyncFieldMapping) => {
    onSettingsChange({
      ...settings,
      fieldMapping: {
        ...settings.fieldMapping,
        [field]: !settings.fieldMapping[field],
      },
    });
  };

  const toggleEnabled = (enabled: boolean) => {
    const now = new Date();
    const nextSync = new Date(now.getTime() + settings.intervalMinutes * 60000);
    
    onSettingsChange({
      ...settings,
      enabled,
      nextSyncTime: enabled ? nextSync.toISOString() : undefined,
    });
  };

  const handleIntervalChange = (minutes: number) => {
    const now = new Date();
    const nextSync = new Date(now.getTime() + minutes * 60000);
    
    onSettingsChange({
      ...settings,
      intervalMinutes: minutes,
      nextSyncTime: settings.enabled ? nextSync.toISOString() : undefined,
    });
  };

  const enabledFieldsCount = Object.values(settings.fieldMapping).filter(Boolean).length;

  return (
    <Card className="mb-2">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium">Автосинхр.</span>
              {settings.enabled && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 bg-green-500">
                  ВКЛ
                </Badge>
              )}
              {syncedProductsCount > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {syncedProductsCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {settings.enabled && countdown && (
                <span className="text-[10px] text-muted-foreground">{countdown}</span>
              )}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3">
            {/* Enable/Disable and Interval */}
            <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-border">
              <div className="flex items-center gap-1.5">
                <Switch
                  id="sync-enabled"
                  checked={settings.enabled}
                  onCheckedChange={toggleEnabled}
                  className="scale-90"
                />
                <Label htmlFor="sync-enabled" className="text-xs">
                  Вкл
                </Label>
              </div>

              <Select
                value={settings.intervalMinutes.toString()}
                onValueChange={(v) => handleIntervalChange(parseInt(v))}
                disabled={!settings.enabled}
              >
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue placeholder="Интервал" />
                </SelectTrigger>
                <SelectContent>
                  {intervalOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={onSyncNow}
                disabled={isSyncing || syncedProductsCount === 0}
                className="h-7 px-2 text-xs gap-1"
              >
                {isSyncing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Синхр.
              </Button>
            </div>

            {/* Field Mapping */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Settings className="h-3 w-3 text-muted-foreground" />
                <Label className="text-xs font-medium">
                  Поля
                </Label>
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                  {enabledFieldsCount}/{Object.keys(settings.fieldMapping).length}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(Object.keys(fieldLabels) as Array<keyof SyncFieldMapping>).map((field) => {
                  const { label } = fieldLabels[field];
                  const isEnabled = settings.fieldMapping[field];

                  return (
                    <div
                      key={field}
                      className={`px-2 py-1 rounded border transition-colors cursor-pointer flex items-center justify-between gap-1 ${
                        isEnabled
                          ? "bg-primary/10 border-primary/30"
                          : "bg-muted/30 border-border"
                      }`}
                      onClick={() => toggleField(field)}
                    >
                      <span className="text-[10px] truncate">{label}</span>
                      <div
                        className={`w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isEnabled
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isEnabled ? (
                          <Check className="h-2 w-2" />
                        ) : (
                          <X className="h-2 w-2" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-1 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => {
                  onSettingsChange({
                    ...settings,
                    fieldMapping: {
                      buyPrice: true,
                      price: false,
                      quantity: true,
                      name: false,
                      description: false,
                      images: false,
                      article: false,
                      unit: false,
                    },
                  });
                }}
              >
                Цены+остатки
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => {
                  onSettingsChange({
                    ...settings,
                    fieldMapping: {
                      buyPrice: true,
                      price: true,
                      quantity: true,
                      name: true,
                      description: true,
                      images: false,
                      article: true,
                      unit: true,
                    },
                  });
                }}
              >
                Без фото
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => {
                  onSettingsChange({
                    ...settings,
                    fieldMapping: {
                      buyPrice: true,
                      price: true,
                      quantity: true,
                      name: true,
                      description: true,
                      images: true,
                      article: true,
                      unit: true,
                    },
                  });
                }}
              >
                Всё
              </Button>
            </div>

            {/* Last sync info */}
            {settings.lastSyncTime && (
              <div className="text-[10px] text-muted-foreground pt-1.5 border-t border-border">
                Синхр.: {new Date(settings.lastSyncTime).toLocaleString("ru-RU")}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export const defaultSyncSettings: SyncSettings = {
  enabled: false,
  intervalMinutes: 60,
  fieldMapping: {
    buyPrice: true,
    price: false,
    quantity: true,
    name: false,
    description: false,
    images: false,
    article: false,
    unit: false,
  },
};
