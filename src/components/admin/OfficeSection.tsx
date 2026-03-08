import React, { useState, useCallback, useRef, useEffect } from "react";
import { Bot, Users, Settings, ChevronRight, Plus, Trash2, GripVertical, Edit2, X, Check, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAvitoBots, AvitoBot } from "@/hooks/useAvitoBot";

interface OfficeSectionProps {
  storeId: string | null;
  onNavigateToBot?: (botId: string) => void;
}

// ===== PIXEL OFFICE TYPES =====
type FurnitureType = "desk" | "chair" | "bookshelf" | "plant" | "fire_extinguisher" | "cooler" | "sofa" | "table_round" | "cabinet" | "printer" | "whiteboard" | "lamp";

interface FurnitureItem {
  id: string;
  type: FurnitureType;
  x: number;
  y: number;
  botId?: string; // If a bot is seated here
}

interface OfficeZone {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

interface OfficeState {
  furniture: FurnitureItem[];
  zones: OfficeZone[];
}

const GRID_SIZE = 40;
const OFFICE_W = 20; // grid cells
const OFFICE_H = 14;

const ZONE_COLORS = [
  "rgba(59,130,246,0.12)",
  "rgba(16,185,129,0.12)",
  "rgba(245,158,11,0.12)",
  "rgba(168,85,247,0.12)",
  "rgba(239,68,68,0.12)",
  "rgba(236,72,153,0.12)",
];

const FURNITURE_CATALOG: { type: FurnitureType; label: string; emoji: string; w: number; h: number }[] = [
  { type: "desk", label: "Рабочий стол", emoji: "🖥️", w: 2, h: 1 },
  { type: "chair", label: "Кресло", emoji: "💺", w: 1, h: 1 },
  { type: "bookshelf", label: "Книжная полка", emoji: "📚", w: 1, h: 2 },
  { type: "plant", label: "Растение", emoji: "🌿", w: 1, h: 1 },
  { type: "fire_extinguisher", label: "Огнетушитель", emoji: "🧯", w: 1, h: 1 },
  { type: "cooler", label: "Кулер", emoji: "🚰", w: 1, h: 1 },
  { type: "sofa", label: "Диван", emoji: "🛋️", w: 2, h: 1 },
  { type: "table_round", label: "Круглый стол", emoji: "☕", w: 1, h: 1 },
  { type: "cabinet", label: "Шкаф", emoji: "🗄️", w: 1, h: 2 },
  { type: "printer", label: "Принтер", emoji: "🖨️", w: 1, h: 1 },
  { type: "whiteboard", label: "Доска", emoji: "📋", w: 2, h: 1 },
  { type: "lamp", label: "Лампа", emoji: "💡", w: 1, h: 1 },
];

function getFurnitureSize(type: FurnitureType): { w: number; h: number } {
  return FURNITURE_CATALOG.find(f => f.type === type) || { w: 1, h: 1 };
}

function getFurnitureEmoji(type: FurnitureType): string {
  return FURNITURE_CATALOG.find(f => f.type === type)?.emoji || "📦";
}

// ===== PIXEL FURNITURE RENDERER =====
function PixelFurniture({ type, size, isSeated, botName }: { type: FurnitureType; size: { w: number; h: number }; isSeated?: boolean; botName?: string }) {
  const w = size.w * GRID_SIZE;
  const h = size.h * GRID_SIZE;

  return (
    <div className="relative" style={{ width: w, height: h }}>
      {/* Pixel-art style furniture */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center text-lg select-none",
        "border-2 rounded-sm",
        isSeated ? "border-primary/40 bg-primary/10" : "border-border/60 bg-card/80"
      )} style={{ imageRendering: "pixelated" }}>
        <span style={{ fontSize: Math.min(w, h) * 0.5 }}>{getFurnitureEmoji(type)}</span>
      </div>
      {isSeated && botName && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded-full font-medium z-10 shadow-sm">
          🤖 {botName}
        </div>
      )}
    </div>
  );
}

// ===== WALL DECORATIONS =====
function OfficeWalls() {
  const wallW = OFFICE_W * GRID_SIZE;
  const wallH = OFFICE_H * GRID_SIZE;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ width: wallW, height: wallH }}>
      {/* Floor */}
      <div className="absolute inset-0" style={{
        background: `
          repeating-conic-gradient(hsl(var(--muted)) 0% 25%, hsl(var(--muted)/0.5) 0% 50%) 0 0 / ${GRID_SIZE}px ${GRID_SIZE}px`,
        opacity: 0.3,
        imageRendering: "pixelated",
      }} />

      {/* Walls */}
      <div className="absolute top-0 left-0 right-0 h-3 bg-foreground/20 rounded-t-lg" />
      <div className="absolute bottom-0 left-0 right-0 h-3 bg-foreground/20 rounded-b-lg" />
      <div className="absolute top-0 left-0 bottom-0 w-3 bg-foreground/20 rounded-l-lg" />
      <div className="absolute top-0 right-0 bottom-0 w-3 bg-foreground/20 rounded-r-lg" />

      {/* Windows (top wall) */}
      {[3, 7, 11, 15].map(x => (
        <div key={`win-${x}`} className="absolute top-0" style={{ left: x * GRID_SIZE, width: GRID_SIZE * 2, height: 3 }}>
          <div className="w-full h-full bg-sky-300/60 border-b-2 border-sky-400/40" style={{ imageRendering: "pixelated" }} />
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] opacity-40">🪟</div>
        </div>
      ))}

      {/* Door */}
      <div className="absolute bottom-0" style={{ left: 9 * GRID_SIZE, width: GRID_SIZE * 2, height: 3 }}>
        <div className="w-full h-full bg-amber-600/40 border-t-2 border-amber-700/40" />
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-sm">🚪</div>
      </div>
    </div>
  );
}

// ===== STORAGE KEY =====
function getStorageKey(storeId: string) {
  return `office_layout_${storeId}`;
}

function loadOfficeState(storeId: string): OfficeState {
  try {
    const saved = localStorage.getItem(getStorageKey(storeId));
    if (saved) return JSON.parse(saved);
  } catch {}
  // Default layout
  return {
    furniture: [
      { id: "d1", type: "desk", x: 2, y: 2 },
      { id: "c1", type: "chair", x: 3, y: 3 },
      { id: "d2", type: "desk", x: 6, y: 2 },
      { id: "c2", type: "chair", x: 7, y: 3 },
      { id: "d3", type: "desk", x: 10, y: 2 },
      { id: "c3", type: "chair", x: 11, y: 3 },
      { id: "bs1", type: "bookshelf", x: 0, y: 1 },
      { id: "bs2", type: "bookshelf", x: 0, y: 4 },
      { id: "fe1", type: "fire_extinguisher", x: 19, y: 0 },
      { id: "fe2", type: "fire_extinguisher", x: 0, y: 13 },
      { id: "pl1", type: "plant", x: 14, y: 0 },
      { id: "pl2", type: "plant", x: 18, y: 0 },
      { id: "sf1", type: "sofa", x: 15, y: 10 },
      { id: "rt1", type: "table_round", x: 17, y: 10 },
      { id: "cl1", type: "cooler", x: 19, y: 6 },
      { id: "wb1", type: "whiteboard", x: 5, y: 7 },
      { id: "cb1", type: "cabinet", x: 19, y: 1 },
      { id: "pr1", type: "printer", x: 14, y: 5 },
      { id: "lm1", type: "lamp", x: 2, y: 6 },
      { id: "d4", type: "desk", x: 2, y: 8 },
      { id: "c4", type: "chair", x: 3, y: 9 },
      { id: "d5", type: "desk", x: 6, y: 8 },
      { id: "c5", type: "chair", x: 7, y: 9 },
      { id: "pl3", type: "plant", x: 10, y: 10 },
      { id: "lm2", type: "lamp", x: 12, y: 8 },
    ],
    zones: [
      { id: "z1", name: "Отдел продаж", x: 1, y: 1, w: 8, h: 5, color: ZONE_COLORS[0] },
      { id: "z2", name: "Разработка", x: 1, y: 7, w: 8, h: 5, color: ZONE_COLORS[1] },
      { id: "z3", name: "Зона отдыха", x: 14, y: 9, w: 5, h: 4, color: ZONE_COLORS[2] },
    ],
  };
}

function saveOfficeState(storeId: string, state: OfficeState) {
  localStorage.setItem(getStorageKey(storeId), JSON.stringify(state));
}

// ===== MAIN COMPONENT =====
export function OfficeSection({ storeId, onNavigateToBot }: OfficeSectionProps) {
  const { bots, loading } = useAvitoBots(storeId);
  const [officeState, setOfficeState] = useState<OfficeState>(() => loadOfficeState(storeId || "default"));
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [selectedFurniture, setSelectedFurniture] = useState<string | null>(null);
  const [addingType, setAddingType] = useState<FurnitureType | null>(null);
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [zoneNameInput, setZoneNameInput] = useState("");
  const [addingZone, setAddingZone] = useState(false);
  const [zoneStart, setZoneStart] = useState<{ x: number; y: number } | null>(null);
  const [assignDialog, setAssignDialog] = useState<string | null>(null);
  const [selectedBotForAssign, setSelectedBotForAssign] = useState<string>("");
  const canvasRef = useRef<HTMLDivElement>(null);

  // Save on change
  useEffect(() => {
    if (storeId) saveOfficeState(storeId, officeState);
  }, [officeState, storeId]);

  const updateFurniture = useCallback((id: string, updates: Partial<FurnitureItem>) => {
    setOfficeState(prev => ({
      ...prev,
      furniture: prev.furniture.map(f => f.id === id ? { ...f, ...updates } : f),
    }));
  }, []);

  const addFurniture = useCallback((type: FurnitureType, x: number, y: number) => {
    const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    setOfficeState(prev => ({
      ...prev,
      furniture: [...prev.furniture, { id, type, x, y }],
    }));
    setAddingType(null);
  }, []);

  const removeFurniture = useCallback((id: string) => {
    setOfficeState(prev => ({
      ...prev,
      furniture: prev.furniture.filter(f => f.id !== id),
    }));
    setSelectedFurniture(null);
  }, []);

  const addZone = useCallback((x: number, y: number, w: number, h: number) => {
    const id = `z_${Date.now()}`;
    setOfficeState(prev => ({
      ...prev,
      zones: [...prev.zones, { id, name: "Новая зона", x, y, w, h, color: ZONE_COLORS[prev.zones.length % ZONE_COLORS.length] }],
    }));
  }, []);

  const removeZone = useCallback((id: string) => {
    setOfficeState(prev => ({
      ...prev,
      zones: prev.zones.filter(z => z.id !== id),
    }));
  }, []);

  const renameZone = useCallback((id: string, name: string) => {
    setOfficeState(prev => ({
      ...prev,
      zones: prev.zones.map(z => z.id === id ? { ...z, name } : z),
    }));
  }, []);

  const assignBot = useCallback((furnitureId: string, botId: string | undefined) => {
    updateFurniture(furnitureId, { botId });
    setAssignDialog(null);
    setSelectedBotForAssign("");
  }, [updateFurniture]);

  // Grid click handler
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const gx = Math.floor((e.clientX - rect.left) / GRID_SIZE);
    const gy = Math.floor((e.clientY - rect.top) / GRID_SIZE);

    if (addingType) {
      addFurniture(addingType, gx, gy);
      return;
    }

    if (addingZone) {
      if (!zoneStart) {
        setZoneStart({ x: gx, y: gy });
      } else {
        const x = Math.min(zoneStart.x, gx);
        const y = Math.min(zoneStart.y, gy);
        const w = Math.max(Math.abs(gx - zoneStart.x), 1);
        const h = Math.max(Math.abs(gy - zoneStart.y), 1);
        addZone(x, y, w, h);
        setZoneStart(null);
        setAddingZone(false);
      }
      return;
    }

    setSelectedFurniture(null);
  }, [addingType, addingZone, zoneStart, addFurniture, addZone]);

  // Drag handlers
  const handleDragStart = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const item = officeState.furniture.find(f => f.id === id);
    if (!item) return;
    setDragging({
      id,
      offsetX: e.clientX - rect.left - item.x * GRID_SIZE,
      offsetY: e.clientY - rect.top - item.y * GRID_SIZE,
    });
  }, [officeState.furniture]);

  const handleDragMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const gx = Math.max(0, Math.min(OFFICE_W - 1, Math.floor((e.clientX - rect.left - dragging.offsetX + GRID_SIZE / 2) / GRID_SIZE)));
    const gy = Math.max(0, Math.min(OFFICE_H - 1, Math.floor((e.clientY - rect.top - dragging.offsetY + GRID_SIZE / 2) / GRID_SIZE)));
    updateFurniture(dragging.id, { x: gx, y: gy });
  }, [dragging, updateFurniture]);

  const handleDragEnd = useCallback(() => {
    setDragging(null);
  }, []);

  const getBotForFurniture = (f: FurnitureItem) => bots.find(b => b.id === f.botId);

  const getBotSummary = (bot: AvitoBot): string => {
    const pc = (bot as any).personality_config || {};
    const ic = (bot as any).instructions_config || {};
    return ic.main_goal || pc.character_traits || "Робот-ассистент";
  };

  const getBotRole = (bot: AvitoBot): string => {
    const pc = (bot as any).personality_config || {};
    return pc.bot_name ? `${pc.bot_name}` : bot.name;
  };

  // Bots not placed in office
  const placedBotIds = new Set(officeState.furniture.filter(f => f.botId).map(f => f.botId!));
  const unplacedBots = bots.filter(b => !placedBotIds.has(b.id));

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* LEFT: Office Canvas */}
      <div className="flex-1 flex flex-col gap-3">
        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-muted-foreground">Мебель:</span>
          {FURNITURE_CATALOG.map(f => (
            <Button
              key={f.type}
              size="sm"
              variant={addingType === f.type ? "default" : "outline"}
              className="text-xs h-8 gap-1"
              onClick={() => setAddingType(addingType === f.type ? null : f.type)}
            >
              <span>{f.emoji}</span>
              <span className="hidden sm:inline">{f.label}</span>
            </Button>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            size="sm"
            variant={addingZone ? "default" : "outline"}
            className="text-xs h-8 gap-1"
            onClick={() => { setAddingZone(!addingZone); setZoneStart(null); }}
          >
            <Plus className="h-3 w-3" /> Зона
          </Button>
          {addingType && (
            <Badge variant="secondary" className="text-xs animate-pulse">
              Кликните на карту, чтобы разместить {FURNITURE_CATALOG.find(f => f.type === addingType)?.label}
            </Badge>
          )}
          {addingZone && (
            <Badge variant="secondary" className="text-xs animate-pulse">
              {zoneStart ? "Кликните для второго угла зоны" : "Кликните для первого угла зоны"}
            </Badge>
          )}
        </div>

        {/* Canvas */}
        <div className="relative border-2 border-border rounded-xl overflow-auto bg-muted/30 shadow-inner" style={{ minHeight: OFFICE_H * GRID_SIZE + 20 }}>
          <div
            ref={canvasRef}
            className={cn("relative", dragging ? "cursor-grabbing" : addingType ? "cursor-crosshair" : "cursor-default")}
            style={{ width: OFFICE_W * GRID_SIZE, height: OFFICE_H * GRID_SIZE, margin: "10px" }}
            onClick={handleCanvasClick}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
          >
            <OfficeWalls />

            {/* Zones */}
            {officeState.zones.map(zone => (
              <div
                key={zone.id}
                className="absolute rounded-md border border-dashed border-foreground/20 group"
                style={{
                  left: zone.x * GRID_SIZE,
                  top: zone.y * GRID_SIZE,
                  width: zone.w * GRID_SIZE,
                  height: zone.h * GRID_SIZE,
                  background: zone.color,
                  zIndex: 1,
                }}
              >
                {editingZone === zone.id ? (
                  <div className="absolute top-0 left-0 flex items-center gap-1 p-0.5 z-20" onClick={e => e.stopPropagation()}>
                    <Input
                      className="h-5 text-[10px] w-24 bg-background"
                      value={zoneNameInput}
                      onChange={e => setZoneNameInput(e.target.value)}
                      autoFocus
                      onKeyDown={e => { if (e.key === "Enter") { renameZone(zone.id, zoneNameInput); setEditingZone(null); } }}
                    />
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { renameZone(zone.id, zoneNameInput); setEditingZone(null); }}>
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="absolute top-0.5 left-1 text-[10px] font-semibold text-foreground/50 cursor-pointer hover:text-foreground/80 flex items-center gap-1 z-20"
                    onClick={e => { e.stopPropagation(); setEditingZone(zone.id); setZoneNameInput(zone.name); }}
                  >
                    {zone.name}
                    <Edit2 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                <button
                  className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive z-20"
                  onClick={e => { e.stopPropagation(); removeZone(zone.id); }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Grid overlay (subtle) */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: `linear-gradient(hsl(var(--border)/0.15) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)/0.15) 1px, transparent 1px)`,
              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
              zIndex: 2,
            }} />

            {/* Furniture */}
            {officeState.furniture.map(f => {
              const size = getFurnitureSize(f.type);
              const bot = getBotForFurniture(f);
              const isSelected = selectedFurniture === f.id;

              return (
                <div
                  key={f.id}
                  className={cn(
                    "absolute transition-shadow z-10",
                    isSelected && "ring-2 ring-primary rounded-sm",
                    dragging?.id === f.id ? "z-30 scale-105" : "z-10",
                    f.botId && "cursor-pointer",
                  )}
                  style={{
                    left: f.x * GRID_SIZE,
                    top: f.y * GRID_SIZE,
                    zIndex: dragging?.id === f.id ? 30 : 10,
                  }}
                  onMouseDown={(e) => handleDragStart(f.id, e)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFurniture(f.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (bot && onNavigateToBot) {
                      onNavigateToBot(bot.id);
                    } else if (f.type === "desk" || f.type === "chair") {
                      setAssignDialog(f.id);
                    }
                  }}
                >
                  <PixelFurniture type={f.type} size={size} isSeated={!!bot} botName={bot ? getBotRole(bot) : undefined} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected furniture actions */}
        {selectedFurniture && (
          <div className="flex items-center gap-2 p-2 bg-card border border-border rounded-lg text-sm">
            <span className="text-muted-foreground">Выбрано:</span>
            <Badge variant="outline">{getFurnitureEmoji(officeState.furniture.find(f => f.id === selectedFurniture)?.type || "desk")} {FURNITURE_CATALOG.find(f => f.type === officeState.furniture.find(ff => ff.id === selectedFurniture)?.type)?.label}</Badge>
            {(officeState.furniture.find(f => f.id === selectedFurniture)?.type === "desk" || officeState.furniture.find(f => f.id === selectedFurniture)?.type === "chair") && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAssignDialog(selectedFurniture)}>
                <Users className="h-3 w-3" /> Посадить сотрудника
              </Button>
            )}
            {officeState.furniture.find(f => f.id === selectedFurniture)?.botId && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                const bot = getBotForFurniture(officeState.furniture.find(f => f.id === selectedFurniture)!);
                if (bot && onNavigateToBot) onNavigateToBot(bot.id);
              }}>
                <Settings className="h-3 w-3" /> Настройки робота
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive gap-1 ml-auto" onClick={() => removeFurniture(selectedFurniture)}>
              <Trash2 className="h-3 w-3" /> Удалить
            </Button>
          </div>
        )}
      </div>

      {/* RIGHT: Bot Employee Cards */}
      <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Сотрудники ({bots.length})
        </h3>
        <ScrollArea className="h-[calc(100vh-260px)]">
          <div className="space-y-3 pr-2">
            {loading ? (
              <div className="text-sm text-muted-foreground animate-pulse p-4 text-center">Загрузка...</div>
            ) : bots.length === 0 ? (
              <Card className="p-6 text-center">
                <Bot className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Нет сотрудников. Создайте робота в разделе «Авитобот».</p>
              </Card>
            ) : (
              bots.map(bot => {
                const isPlaced = placedBotIds.has(bot.id);
                const pc = (bot as any).personality_config || {};
                const ic = (bot as any).instructions_config || {};

                return (
                  <Card
                    key={bot.id}
                    className={cn(
                      "hover:shadow-md transition-all cursor-pointer group",
                      isPlaced && "border-primary/30 bg-primary/5"
                    )}
                    onClick={() => onNavigateToBot?.(bot.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0",
                          bot.is_active ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"
                        )} style={{ imageRendering: "pixelated" }}>
                          🤖
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm truncate">{pc.bot_name || bot.name}</span>
                            <Badge variant={bot.is_active ? "default" : "secondary"} className="text-[10px] h-4">
                              {bot.is_active ? "Активен" : "Выкл"}
                            </Badge>
                          </div>
                          {pc.character_traits && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                              Характер: {pc.character_traits}
                            </p>
                          )}
                          {ic.main_goal && (
                            <p className="text-[11px] text-muted-foreground line-clamp-1">
                              🎯 {ic.main_goal}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Badge variant="outline" className="text-[10px] h-4">
                              {bot.mode === "smart" ? "🐱 Умный" : "💻 Про"}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] h-4">
                              {bot.ai_model?.split("/").pop()}
                            </Badge>
                            {isPlaced && (
                              <Badge variant="secondary" className="text-[10px] h-4 bg-primary/10 text-primary">
                                📍 В офисе
                              </Badge>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Assign Bot Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Посадить сотрудника</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedBotForAssign} onValueChange={setSelectedBotForAssign}>
              <SelectTrigger><SelectValue placeholder="Выберите робота" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Убрать сотрудника</SelectItem>
                {bots.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    🤖 {(b as any).personality_config?.bot_name || b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>Отмена</Button>
            <Button onClick={() => {
              if (assignDialog) {
                assignBot(assignDialog, selectedBotForAssign === "none" ? undefined : selectedBotForAssign);
              }
            }}>
              Применить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
