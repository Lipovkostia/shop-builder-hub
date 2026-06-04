import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, Users, Phone, AtSign, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTelegramSubscribers } from "@/hooks/useTelegramSubscribers";
import { toast } from "sonner";

interface Props {
  storeId: string | null;
}

export function TelegramSubscribersList({ storeId }: Props) {
  const { items, loading, reload } = useTelegramSubscribers(storeId);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((it) =>
      [it.username, it.first_name, it.last_name, it.phone, String(it.chat_id)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s)),
    );
  }, [items, q]);

  const withPhone = items.filter((i) => i.phone).length;

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Скопировано");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Подписчики бота</div>
            <div className="text-xs text-muted-foreground">
              Всего: {items.length} · с номером: {withPhone}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Обновить
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени, нику или номеру"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? "Пока никто не запускал бота. Как только кто-то напишет /start — он появится здесь."
            : "Никого не найдено по запросу."}
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {filtered.map((s) => {
            const name = [s.first_name, s.last_name].filter(Boolean).join(" ") || "—";
            return (
              <div key={s.chat_id} className="p-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{name}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                    {s.username && (
                      <span className="inline-flex items-center gap-1">
                        <AtSign className="h-3 w-3" />
                        {s.username}
                      </span>
                    )}
                    <span>chat_id: {s.chat_id}</span>
                    <span>
                      первый вход:{" "}
                      {new Date(s.joined_at).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.phone ? (
                    <button
                      onClick={() => copy(s.phone!)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2.5 py-1.5 text-sm font-medium hover:bg-emerald-100"
                      title="Скопировать"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {s.phone}
                      <Copy className="h-3 w-3 opacity-60" />
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">нет номера</span>
                  )}
                  {s.username && (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={`https://t.me/${s.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Написать
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
