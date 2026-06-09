import { useState } from "react";
import { Check, Plus, MoreVertical, Star, Pencil, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuGroup, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { AvitoAccount } from "@/hooks/useAvitoAccounts";

interface Props {
  accounts: AvitoAccount[];
  activeAccountId: string | null;
  onSelect: (id: string) => void;
  onCreate: (label: string) => Promise<AvitoAccount | null>;
  onRename: (id: string, label: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function AvitoAccountsBar({
  accounts, activeAccountId, onSelect, onCreate, onRename, onSetDefault, onDelete,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [renameTarget, setRenameTarget] = useState<AvitoAccount | null>(null);
  const [renameValue, setRenameValue] = useState("");

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Аккаунты Авито
        </div>
        <Button
          size="sm"
          variant="default"
          className="h-7 gap-1 bg-primary text-primary-foreground"
          onClick={() => { setNewLabel(""); setAddOpen(true); }}
        >
          <Plus className="h-3 w-3" /> Добавить аккаунт
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {accounts.length === 0 && (
          <div className="text-xs text-muted-foreground">Нет аккаунтов. Нажмите «Добавить аккаунт», чтобы подключить первый.</div>
        )}
        {accounts.map((a) => {
          const isActive = a.id === activeAccountId;
          const connected = !!a.avito_user_id;
          const name = a.label || a.profile_name || "Аккаунт";
          return (
            <div
              key={a.id}
              className={`group flex items-center gap-1 rounded-full border pl-3 pr-1 py-1 text-sm transition-colors ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:border-primary/40"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(a.id)}
                className="flex items-center gap-1.5"
              >
                {connected ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                <span className="font-medium">{name}</span>
                {a.is_default && (
                  <Star className={`h-3 w-3 ${isActive ? "fill-current" : "fill-amber-400 text-amber-400"}`} />
                )}
                {a.profile_name && a.label && a.label !== a.profile_name && (
                  <span className={`text-[10px] ${isActive ? "opacity-80" : "text-muted-foreground"}`}>
                    · {a.profile_name}
                  </span>
                )}
                {!connected && (
                  <Badge variant="outline" className="ml-1 h-4 border-amber-400/50 px-1 py-0 text-[9px] text-amber-600">
                    не подключён
                  </Badge>
                )}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={`h-6 w-6 rounded-full ${isActive ? "hover:bg-primary-foreground/20" : ""}`}
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-50 bg-popover">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => { setRenameTarget(a); setRenameValue(a.label || a.profile_name || ""); }}>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Переименовать
                    </DropdownMenuItem>
                    {!a.is_default && (
                      <DropdownMenuItem onSelect={() => onSetDefault(a.id)}>
                        <Star className="mr-2 h-3.5 w-3.5" /> Сделать основным
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => onDelete(a.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Удалить аккаунт
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый аккаунт Авито</DialogTitle>
            <DialogDescription>
              Введите название аккаунта (например, «Магазин 2» или «Москва»). Client ID/Secret вы укажете на вкладке «API подключение».
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Название аккаунта"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button
              onClick={async () => {
                const acc = await onCreate(newLabel || "Новый аккаунт");
                if (acc) setAddOpen(false);
              }}
            >
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать аккаунт</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Отмена</Button>
            <Button
              onClick={async () => {
                if (renameTarget) {
                  await onRename(renameTarget.id, renameValue || renameTarget.profile_name || "Аккаунт");
                  setRenameTarget(null);
                }
              }}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
