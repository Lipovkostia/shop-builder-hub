import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, MapPin, MoreVertical, Pencil, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AvitoCityTab } from "@/hooks/useAvitoCityTabs";

interface Props {
  tabs: AvitoCityTab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onCreate: (input: {
    name: string;
    city?: string;
    address?: string;
    markupPercent?: number;
    sourceTabId?: string | null;
  }) => Promise<any>;
  onUpdate: (id: string, patch: Partial<AvitoCityTab>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function AvitoCityTabsBar({ tabs, activeTabId, onSelect, onCreate, onUpdate, onDelete }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTab, setEditTab] = useState<AvitoCityTab | null>(null);
  const [busy, setBusy] = useState(false);

  // create form
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [markup, setMarkup] = useState<string>("30");

  const openCreate = () => {
    setName("");
    setCity("");
    setAddress("");
    setMarkup("30");
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!name.trim() && !city.trim()) return;
    setBusy(true);
    try {
      await onCreate({
        name: (name.trim() || city.trim()),
        city: city.trim() || name.trim(),
        address: address.trim(),
        markupPercent: Number(markup) || 0,
        sourceTabId: activeTabId, // дублируем из активной
      });
      setCreateOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-3 flex-wrap rounded-lg border border-primary/30 bg-primary/5 p-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary/80 px-2">
          Города
        </span>
        {tabs.map((t) => (
          <div
            key={t.id}
            className={cn(
              "group relative flex items-center rounded-md transition-colors",
              t.id === activeTabId
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background hover:bg-muted border border-border",
            )}
          >
            <button
              onClick={() => onSelect(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium"
            >
              <MapPin className="h-3.5 w-3.5" />
              {t.name}
              {t.markup_percent > 0 && (
                <span className="text-xs opacity-80">+{t.markup_percent}%</span>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-1.5 py-1.5 opacity-60 group-hover:opacity-100">
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => setEditTab(t)}>
                    <Pencil className="h-4 w-4 mr-2" /> Редактировать
                  </DropdownMenuItem>
                  {!t.is_default && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => onDelete(t.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Удалить
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        <Button
          size="sm"
          onClick={openCreate}
          className="ml-auto gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Новая вкладка-город
        </Button>
      </div>


      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая вкладка-город</DialogTitle>
            <DialogDescription>
              Все карточки из текущей вкладки будут продублированы сюда: цены × (1+наценка),
              названия и описания слегка изменены для обхода фильтра дублей Avito. Карточки
              независимы друг от друга.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Название вкладки</Label>
              <Input
                placeholder="Укажите город, например: Санкт-Петербург"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label>Город (для Авито)</Label>
              <Input
                placeholder="Санкт-Петербург"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <Label>Адрес (необязательно)</Label>
              <Input
                placeholder="Невский проспект, 1"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <Label>Наценка, %</Label>
              <Input
                type="number"
                value={markup}
                onChange={(e) => setMarkup(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Применится к ценам всех скопированных карточек.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={busy || (!name.trim() && !city.trim())}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Создать и скопировать карточки
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <EditTabDialog tab={editTab} onClose={() => setEditTab(null)} onSave={onUpdate} />
    </>
  );
}

function EditTabDialog({
  tab,
  onClose,
  onSave,
}: {
  tab: AvitoCityTab | null;
  onClose: () => void;
  onSave: (id: string, patch: Partial<AvitoCityTab>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [markup, setMarkup] = useState("0");

  // sync when tab changes
  useState(() => {
    if (tab) {
      setName(tab.name);
      setCity(tab.city || "");
      setAddress(tab.address || "");
      setMarkup(String(tab.markup_percent));
    }
  });

  if (!tab) return null;

  return (
    <Dialog open={!!tab} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Настройки вкладки</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Название</Label>
            <Input defaultValue={tab.name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Город</Label>
            <Input defaultValue={tab.city || ""} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <Label>Адрес</Label>
            <Input defaultValue={tab.address || ""} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <Label>Наценка, %</Label>
            <Input
              type="number"
              defaultValue={String(tab.markup_percent)}
              onChange={(e) => setMarkup(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Изменение наценки не пересчитывает уже сохранённые цены карточек.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            onClick={async () => {
              await onSave(tab.id, {
                name: name || tab.name,
                city: city || null,
                address: address || null,
                markup_percent: Number(markup) || 0,
              });
              onClose();
            }}
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
