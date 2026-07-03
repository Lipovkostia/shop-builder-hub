import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Upload, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { UPLOAD_PRESETS, validateUpload } from "@/lib/uploadValidation";
import UploadHint from "@/components/admin/UploadHint";

interface Partner {
  id: string;
  name: string;
  url: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function RetailPartnersManager() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("landing_retail_partners")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) toast({ title: "Ошибка загрузки", description: error.message, variant: "destructive" });
    setPartners((data || []) as Partner[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addNew = async () => {
    const maxOrder = partners.reduce((m, p) => Math.max(m, p.sort_order), -1);
    const { data, error } = await (supabase as any)
      .from("landing_retail_partners")
      .insert({ name: "Новый партнёр", url: "https://", sort_order: maxOrder + 1, is_active: true })
      .select()
      .single();
    if (error) { toast({ title: "Не удалось создать", description: error.message, variant: "destructive" }); return; }
    setPartners((p) => [...p, data as Partner]);
  };

  const update = async (id: string, patch: Partial<Partner>) => {
    setPartners((arr) => arr.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const { error } = await (supabase as any).from("landing_retail_partners").update(patch).eq("id", id);
    if (error) toast({ title: "Не сохранено", description: error.message, variant: "destructive" });
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить партнёра?")) return;
    const { error } = await (supabase as any).from("landing_retail_partners").delete().eq("id", id);
    if (error) { toast({ title: "Не удалось удалить", description: error.message, variant: "destructive" }); return; }
    setPartners((arr) => arr.filter((p) => p.id !== id));
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = partners.findIndex((p) => p.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= partners.length) return;
    const a = partners[idx], b = partners[swap];
    const next = [...partners];
    next[idx] = { ...b, sort_order: a.sort_order };
    next[swap] = { ...a, sort_order: b.sort_order };
    setPartners(next);
    await Promise.all([
      (supabase as any).from("landing_retail_partners").update({ sort_order: a.sort_order }).eq("id", b.id),
      (supabase as any).from("landing_retail_partners").update({ sort_order: b.sort_order }).eq("id", a.id),
    ]);
  };

  const uploadImage = async (id: string, file: File) => {
    const check = validateUpload(file, UPLOAD_PRESETS.heroSideBlock);
    if (!check.ok) {
      toast({ title: "Файл не подходит", description: check.error, variant: "destructive" });
      return;
    }
    setUploadingId(id);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `partners/${id}-${Date.now()}.${ext}`;
      const { error: upErr } = await (supabase as any).storage.from("landing-slides").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = (supabase as any).storage.from("landing-slides").getPublicUrl(path);
      await update(id, { image_url: pub.publicUrl });
    } catch (e: any) {
      toast({ title: "Не удалось загрузить", description: e.message, variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Партнёры розницы</CardTitle>
          <CardDescription>«Где купить в розницу» — баннеры со ссылками в правом блоке главной.</CardDescription>
        </div>
        <Button onClick={addNew} size="sm" className="gap-2"><Plus className="h-4 w-4" />Добавить</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : partners.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Пока нет партнёров. Нажмите «Добавить», чтобы создать первого.</p>
        ) : (
          <div className="space-y-3">
            {partners.map((p, idx) => (
              <div key={p.id} className="border border-border rounded-xl p-4 grid gap-3 sm:grid-cols-[120px_1fr_auto] items-start">
                <div className="space-y-2">
                  <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden border border-border flex items-center justify-center">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-muted-foreground">нет фото</span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    ref={(el) => (fileInputs.current[p.id] = el)}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(p.id, f); e.target.value = ""; }}
                  />
                  <Button size="sm" variant="outline" className="w-full gap-2" disabled={uploadingId === p.id} onClick={() => fileInputs.current[p.id]?.click()}>
                    {uploadingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Фото
                  </Button>
                </div>
                <div className="space-y-2 min-w-0">
                  <div>
                    <Label className="text-xs">Название</Label>
                    <Input value={p.name} onChange={(e) => setPartners((arr) => arr.map((x) => x.id === p.id ? { ...x, name: e.target.value } : x))} onBlur={(e) => update(p.id, { name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Ссылка</Label>
                    <Input value={p.url} placeholder="https://example.com" onChange={(e) => setPartners((arr) => arr.map((x) => x.id === p.id ? { ...x, url: e.target.value } : x))} onBlur={(e) => update(p.id, { url: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={p.is_active} onCheckedChange={(v) => update(p.id, { is_active: v })} />
                    <span className="text-xs text-muted-foreground">{p.is_active ? "Показывается" : "Скрыт"}</span>
                  </div>
                </div>
                <div className="flex sm:flex-col gap-1">
                  <Button size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(p.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" disabled={idx === partners.length - 1} onClick={() => move(p.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
