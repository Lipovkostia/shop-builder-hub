import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ImagePlus, Loader2, Send, Trash2, X, Download } from "lucide-react";
import { useImagePlayground } from "@/hooks/useImagePlayground";
import { KIE_MODELS, DEFAULT_USD_RUB, formatRub } from "./models";
import { toast } from "sonner";

const AR = ["1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2", "21:9"];

export function PlaygroundChat({ storeId }: { storeId: string }) {
  const { messages, sending, send, uploadAttachment, clearHistory } = useImagePlayground(storeId);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(KIE_MODELS[0].id);
  const [ar, setAr] = useState("1:1");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [usdRub] = useState<number>(() => {
    const s = typeof window !== "undefined" ? Number(localStorage.getItem("kie_usd_rub")) : NaN;
    return Number.isFinite(s) && s > 0 ? s : DEFAULT_USD_RUB;
  });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const selectedModel = KIE_MODELS.find((m) => m.id === model) ?? KIE_MODELS[0];

  useEffect(() => {
    // auto switch to edit-capable model when user adds images and current model is text-only
    if (attachments.length > 0 && !selectedModel.supportsEdit) {
      setModel("google/nano-banana-edit");
    }
  }, [attachments.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  const onPickFiles = async (files: FileList | null) => {
    if (!files) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const u = await uploadAttachment(f);
      if (u) urls.push(u);
    }
    setAttachments((prev) => [...prev, ...urls]);
    setUploading(false);
  };

  const handleSend = async () => {
    if (!prompt.trim() && attachments.length === 0) {
      toast.info("Введите описание или приложите фото");
      return;
    }
    const params = { prompt: prompt.trim(), model, aspect_ratio: ar, image_urls: attachments };
    setPrompt(""); setAttachments([]);
    await send(params);
  };

  const downloadImage = async (url: string) => {
    try {
      const r = await fetch(url);
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `generated_${Date.now()}.png`;
      a.click();
    } catch (e: any) {
      toast.error(e?.message ?? "Не удалось скачать");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card flex flex-col h-[700px]">
      <div className="border-b border-border p-3 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold">AI-чат для генерации</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={clearHistory} disabled={messages.length === 0}>
            <Trash2 className="h-3 w-3" />Очистить
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1" viewportRef={scrollRef as any}>
        <div className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              Опишите что нужно сгенерировать. Можно приложить одно или несколько фото — ИИ их совместит или отредактирует.
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg p-3 space-y-2 ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                {m.content && <div className="text-sm whitespace-pre-wrap">{m.content}</div>}
                {m.image_urls?.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {m.image_urls.map((u, i) => (
                      <div key={i} className="relative group">
                        <img src={u} alt="" className="w-full rounded" />
                        {m.role === "assistant" && (
                          <Button size="sm" variant="secondary"
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition"
                            onClick={() => downloadImage(u)}>
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {m.model && m.role === "assistant" && (
                  <div className="text-[10px] opacity-60">{m.model}</div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3 space-y-2">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((u, i) => (
              <div key={i} className="relative">
                <img src={u} alt="" className="h-16 w-16 rounded object-cover border" />
                <button type="button"
                  onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-2 -right-2 rounded-full bg-destructive text-destructive-foreground p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
              placeholder="Опишите, что сгенерировать..."
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend(); }
              }}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-8 w-56 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIE_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label} · {formatRub(m.priceUsd * usdRub)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ar} onValueChange={setAr}>
                <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{AR.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { onPickFiles(e.target.files); e.target.value = ""; }} />
              <Button size="sm" variant="outline" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImagePlus className="h-3 w-3" />}
                Фото
              </Button>
              <div className="text-[11px] text-muted-foreground ml-auto">
                ~{formatRub(selectedModel.priceUsd * usdRub)} за генерацию
              </div>
            </div>
          </div>
          <Button onClick={handleSend} disabled={sending || uploading}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Отправить
          </Button>
        </div>
      </div>
    </div>
  );
}
