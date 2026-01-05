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
    <Card className="mb-6">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Автообновление из МойСклад
                    {settings.enabled && (
                      <Badge variant="default" className="text-xs bg-green-500">
                        Активно
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {settings.enabled ? (
                      <>
                        {countdown && `Следующее обновление: ${countdown}`}
                        {!countdown && `Интервал: ${intervalOptions.find(o => o.value === settings.intervalMinutes)?.label}`}
                      </>
                    ) : (
                      "Настройте автоматическую синхронизацию данных"
                    )}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {syncedProductsCount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {syncedProductsCount} товар(ов) с синхр.
                  </Badge>
                )}
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* Enable/Disable and Interval */}
            <div className="flex flex-wrap items-center gap-4 pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Switch
                  id="sync-enabled"
                  checked={settings.enabled}
                  onCheckedChange={toggleEnabled}
                />
                <Label htmlFor="sync-enabled" className="font-medium">
                  Включить автообновление
                </Label>
              </div>

              <Select
                value={settings.intervalMinutes.toString()}
                onValueChange={(v) => handleIntervalChange(parseInt(v))}
                disabled={!settings.enabled}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Интервал" />
                </SelectTrigger>
                <SelectContent>
                  {intervalOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
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
                className="gap-2"
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Синхронизировать сейчас
              </Button>
            </div>

            {/* Field Mapping */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <Label className="font-medium">
                  Какие данные синхронизировать
                </Label>
                <Badge variant="secondary" className="text-xs">
                  {enabledFieldsCount} из {Object.keys(settings.fieldMapping).length}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(Object.keys(fieldLabels) as Array<keyof SyncFieldMapping>).map((field) => {
                  const { label, description } = fieldLabels[field];
                  const isEnabled = settings.fieldMapping[field];

                  return (
                    <div
                      key={field}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        isEnabled
                          ? "bg-primary/5 border-primary/30"
                          : "bg-muted/30 border-border hover:border-muted-foreground/30"
                      }`}
                      onClick={() => toggleField(field)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm flex items-center gap-2">
                            {label}
                            {field === "images" && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                медленно
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {description}
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isEnabled
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isEnabled ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
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
                Только цены и остатки
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
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
                Всё, кроме фото
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
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
              <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                Последняя синхронизация:{" "}
                {new Date(settings.lastSyncTime).toLocaleString("ru-RU")}
              </div>
            )}
          </CardContent>
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
