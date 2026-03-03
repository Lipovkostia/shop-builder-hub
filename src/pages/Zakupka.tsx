import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Upload, MessageCircle, HelpCircle, CalendarIcon, Send, ChevronLeft, ChevronRight, FileSpreadsheet, X
} from "lucide-react";
import * as XLSX from "xlsx";

// Helper to bypass typed supabase client for new tables
const db = supabase as any;

interface PurchaseItem {
  id?: string;
  row_index: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  total: number | null;
  comment: string | null;
  is_supplier_header: boolean;
}

interface PurchaseQuestion {
  id: string;
  item_id: string;
  item_name: string;
  author_name: string;
  message: string;
  created_at: string;
}

interface PurchaseSession {
  id: string;
  upload_date: string;
  file_name: string;
}

export default function Zakupka() {
  const [session, setSession] = useState<PurchaseSession | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [questions, setQuestions] = useState<PurchaseQuestion[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [askingItemId, setAskingItemId] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState("");
  const [authorName, setAuthorName] = useState(() => localStorage.getItem("zakupka_name") || "");
  const [chatInput, setChatInput] = useState("");
  const [chatAuthor, setChatAuthor] = useState(() => localStorage.getItem("zakupka_name") || "");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSession = useCallback(async (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const { data: sessions } = await db
      .from("purchase_sessions")
      .select("*")
      .eq("upload_date", dateStr)
      .order("created_at", { ascending: false })
      .limit(1);

    if (sessions && sessions.length > 0) {
      const s = sessions[0];
      setSession(s);

      const { data: itemsData } = await db
        .from("purchase_items")
        .select("*")
        .eq("session_id", s.id)
        .order("row_index");

      setItems(itemsData || []);

      const { data: questionsData } = await db
        .from("purchase_questions")
        .select("*")
        .eq("session_id", s.id)
        .order("created_at");

      setQuestions(questionsData || []);
    } else {
      setSession(null);
      setItems([]);
      setQuestions([]);
    }
  }, []);

  useEffect(() => {
    loadSession(selectedDate);
  }, [selectedDate, loadSession]);

  // Realtime for questions
  useEffect(() => {
    if (!session?.id) return;
    const channel = supabase
      .channel(`purchase-questions-${session.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "purchase_questions",
        filter: `session_id=eq.${session.id}`,
      }, (payload: any) => {
        setQuestions(prev => [...prev, payload.new as PurchaseQuestion]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [questions]);

  // Parse Excel
  const parseExcel = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (rows.length === 0) return;

      const dataRows = rows.slice(1).filter((r: any[]) => r.some((c: any) => c !== undefined && c !== null && c !== ""));

      const parseNum = (s: string) => {
        if (!s) return null;
        const cleaned = s.replace(/\s/g, "").replace(",", ".");
        const n = parseFloat(cleaned);
        return isNaN(n) ? null : n;
      };

      const parsedItems: PurchaseItem[] = dataRows.map((row: any[], idx: number) => {
        const cells = row.map((c: any) => (c !== undefined && c !== null ? String(c).trim() : ""));

        // Find the name: look for the first cell with text (not purely numeric)
        // Excel structure: Col A = buy price, Col B = name, Col C = sell price, Col D = qty, Col E = unit, Col F = total, Col G+ = comments
        const isNumericCell = (c: string) => !c || /^\d+([.,]\d+)?$/.test(c.replace(/\s/g, ""));
        
        // Find name - first long text cell (product name), skip short numeric cells
        let nameIdx = -1;
        for (let i = 0; i < Math.min(cells.length, 4); i++) {
          if (cells[i] && !isNumericCell(cells[i])) {
            nameIdx = i;
            break;
          }
        }
        
        const name = nameIdx >= 0 ? cells[nameIdx] : "";
        
        // Supplier header: row has a text name but NO numeric values at all in other cells
        const otherCells = cells.filter((_, i) => i !== nameIdx);
        const hasNumeric = otherCells.some((c: string) => c && /^\d+([.,]\d+)?$/.test(c.replace(/\s/g, "")));

        if (!hasNumeric && name) {
          return {
            row_index: idx,
            name,
            quantity: null,
            unit: null,
            price: null,
            total: null,
            comment: null,
            is_supplier_header: true,
          };
        }

        // Extract numeric columns after the name
        const numericCells: (number | null)[] = [];
        const textCells: { idx: number; val: string }[] = [];
        
        for (let i = 0; i < cells.length; i++) {
          if (i === nameIdx) continue;
          const n = parseNum(cells[i]);
          if (n !== null) {
            numericCells.push(n);
          } else if (cells[i]) {
            textCells.push({ idx: i, val: cells[i] });
          }
        }

        // Typically: buyPrice, sellPrice, quantity, ... or sellPrice, quantity
        // Find unit among text cells (short text like "кг", "шт")
        let unit: string | null = null;
        const commentParts: string[] = [];
        
        for (const tc of textCells) {
          if (!unit && /^(кг|шт|л|уп|пач|бут|бан|кор|блок)\.?$/i.test(tc.val)) {
            unit = tc.val;
          } else {
            commentParts.push(tc.val);
          }
        }
        
        const comment = commentParts.length > 0 ? commentParts.join('; ') : null;

        // Map numeric values: buy_price, sell_price, quantity, total (flexible)
        const buyPrice = numericCells[0] ?? null;
        const sellPrice = numericCells.length >= 3 ? numericCells[1] : numericCells[0];
        const quantity = numericCells.length >= 4 ? numericCells[2] : (numericCells.length >= 3 ? numericCells[1] : numericCells[0]);
        const total = numericCells.length >= 4 ? numericCells[3] : (numericCells.length >= 3 ? numericCells[2] : numericCells[1]) ?? null;

        return {
          row_index: idx,
          name: name || "Без названия",
          quantity,
          unit,
          price: sellPrice,
          total,
          comment,
          is_supplier_header: false,
        };
      });

      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Delete existing session for this date
      const { data: existing } = await db
        .from("purchase_sessions")
        .select("id")
        .eq("upload_date", dateStr);

      if (existing && existing.length > 0) {
        for (const ex of existing) {
          await db.from("purchase_questions").delete().eq("session_id", ex.id);
          await db.from("purchase_items").delete().eq("session_id", ex.id);
        }
        await db.from("purchase_sessions").delete().eq("upload_date", dateStr);
      }

      const { data: newSession, error: sessionError } = await db
        .from("purchase_sessions")
        .insert({ upload_date: dateStr, file_name: file.name })
        .select()
        .single();

      if (sessionError) throw sessionError;

      const itemsToInsert = parsedItems.map((item) => ({
        session_id: newSession.id,
        row_index: item.row_index,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        total: item.total,
        comment: item.comment,
        is_supplier_header: item.is_supplier_header,
      }));

      await db.from("purchase_items").insert(itemsToInsert);

      setSession(newSession);

      const { data: savedItems } = await db
        .from("purchase_items")
        .select("*")
        .eq("session_id", newSession.id)
        .order("row_index");

      setItems(savedItems || []);
      setQuestions([]);
    } catch (err) {
      console.error("Error parsing Excel:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      parseExcel(file);
    }
  }, [parseExcel]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseExcel(file);
  }, [parseExcel]);

  const sendQuestion = useCallback(async (itemId: string, itemName: string) => {
    if (!questionText.trim() || !authorName.trim() || !session?.id) return;
    localStorage.setItem("zakupka_name", authorName);

    await db.from("purchase_questions").insert({
      session_id: session.id,
      item_id: itemId,
      item_name: itemName,
      author_name: authorName,
      message: questionText.trim(),
    });

    setQuestionText("");
    setAskingItemId(null);
  }, [questionText, authorName, session?.id]);

  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || !chatAuthor.trim() || !session?.id) return;
    localStorage.setItem("zakupka_name", chatAuthor);

    await db.from("purchase_questions").insert({
      session_id: session.id,
      item_id: "general",
      item_name: "Общий вопрос",
      author_name: chatAuthor,
      message: chatInput.trim(),
    });

    setChatInput("");
  }, [chatInput, chatAuthor, session?.id]);

  const prevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };
  const nextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold">Закупка</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevDay}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(selectedDate, "d MMMM yyyy", { locale: ru })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={nextDay}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!session && !loading ? (
            <div
              className={cn(
                "flex-1 flex flex-col items-center justify-center border-2 border-dashed m-4 rounded-lg transition-colors cursor-pointer",
                dragging ? "border-primary bg-primary/5" : "border-muted-foreground/20"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Перетащите Excel-файл сюда
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                или нажмите для выбора файла
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          ) : loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              <div className="px-4 py-2 flex items-center justify-between border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{session?.file_name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs"
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Заменить
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">№</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Наименование</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-20">Кол-во</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground w-16">Ед.</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Цена</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Сумма</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const itemQuestions = questions.filter(q => q.item_id === item.id);

                    if (item.is_supplier_header) {
                      return (
                        <tr key={item.id || idx} className="bg-primary/5 border-t-2 border-primary/20">
                          <td colSpan={7} className="px-3 py-2 font-bold text-primary">
                            {item.name}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={item.id || idx} className="border-b hover:bg-muted/30 group">
                        <td className="px-3 py-1.5 text-muted-foreground text-xs">{idx + 1}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-start gap-2">
                            <span className="truncate">{item.name}</span>
                            {item.comment && (
                              <span className="shrink-0 text-xs text-accent-foreground bg-accent px-1.5 py-0.5 rounded max-w-[200px] truncate" title={item.comment}>
                                {item.comment}
                              </span>
                            )}
                            {itemQuestions.length > 0 && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                {itemQuestions.length}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {item.quantity != null ? item.quantity : ""}
                        </td>
                        <td className="px-3 py-1.5 text-center text-muted-foreground text-xs">
                          {item.unit || ""}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {item.price != null ? item.price.toLocaleString("ru-RU") : ""}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                          {item.total != null ? item.total.toLocaleString("ru-RU") : ""}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {askingItemId === item.id ? (
                            <button
                              onClick={() => setAskingItemId(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setAskingItemId(item.id!)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
                            >
                              <HelpCircle className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Inline question form */}
                  {askingItemId && (
                    <tr className="bg-primary/5">
                      <td colSpan={7} className="px-3 py-2">
                        <div className="flex gap-2 items-end max-w-lg">
                          <Input
                            placeholder="Ваше имя"
                            value={authorName}
                            onChange={(e) => setAuthorName(e.target.value)}
                            className="w-32 h-8 text-xs"
                          />
                          <Input
                            placeholder="Ваш вопрос..."
                            value={questionText}
                            onChange={(e) => setQuestionText(e.target.value)}
                            className="flex-1 h-8 text-xs"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const item = items.find(i => i.id === askingItemId);
                                if (item) sendQuestion(item.id!, item.name);
                              }
                            }}
                          />
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              const item = items.find(i => i.id === askingItemId);
                              if (item) sendQuestion(item.id!, item.name);
                            }}
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Q&A Chat */}
        <div className="w-80 border-l flex flex-col bg-card">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Вопросы по закупке
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(selectedDate, "d MMMM yyyy", { locale: ru })}
            </p>
          </div>

          <ScrollArea className="flex-1 p-3">
            {questions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Пока нет вопросов
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((q) => (
                  <div key={q.id} className="text-sm">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-medium text-xs">{q.author_name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(q.created_at), "HH:mm")}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 mb-1">
                          {q.item_name}
                        </Badge>
                        <p className="text-muted-foreground text-xs">{q.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Chat input */}
          {session && (
            <div className="border-t p-3 space-y-2">
              <Input
                placeholder="Ваше имя"
                value={chatAuthor}
                onChange={(e) => setChatAuthor(e.target.value)}
                className="h-7 text-xs"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Написать сообщение..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendChatMessage();
                  }}
                />
                <Button
                  size="sm"
                  className="h-7 px-2"
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || !chatAuthor.trim()}
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
