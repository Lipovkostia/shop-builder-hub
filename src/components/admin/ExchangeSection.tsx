import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, TrendingUp, TrendingDown, History, ShoppingCart, BarChart3, Send } from "lucide-react";
import { useExchange } from "@/hooks/useExchange";
import { ExchangeCreateDialog } from "@/components/admin/ExchangeCreateDialog";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format, subDays } from "date-fns";

interface ExchangeSectionProps {
  storeId: string | null;
}

// ── Test data ──────────────────────────────────────────────────────

interface DemoProduct {
  id: string;
  name: string;
  category: string;
  retailPrice: number;
  wholesalePrice: number;
  change: number; // percent
}

const DEMO_PRODUCTS: DemoProduct[] = [
  { id: "1", name: "Пармезан 24 мес.", category: "Сыры", retailPrice: 2890, wholesalePrice: 2100, change: 2.4 },
  { id: "2", name: "Грана Падано", category: "Сыры", retailPrice: 1890, wholesalePrice: 1400, change: -1.2 },
  { id: "3", name: "Хамон Серрано", category: "Мясо", retailPrice: 3490, wholesalePrice: 2800, change: 0.8 },
  { id: "4", name: "Моцарелла буф.", category: "Сыры", retailPrice: 690, wholesalePrice: 420, change: 3.1 },
  { id: "5", name: "Горгонзола DOP", category: "Сыры", retailPrice: 1590, wholesalePrice: 1100, change: -0.5 },
  { id: "6", name: "Прошутто Крудо", category: "Мясо", retailPrice: 4200, wholesalePrice: 3400, change: 1.7 },
  { id: "7", name: "Бри де Мо", category: "Сыры", retailPrice: 1290, wholesalePrice: 890, change: -2.3 },
  { id: "8", name: "Чоризо", category: "Мясо", retailPrice: 890, wholesalePrice: 620, change: 0.3 },
  { id: "9", name: "Камамбер", category: "Сыры", retailPrice: 990, wholesalePrice: 680, change: 1.1 },
  { id: "10", name: "Брезаола", category: "Мясо", retailPrice: 3890, wholesalePrice: 3100, change: -0.9 },
];

interface DemoOrderBookItem {
  id: string;
  productName: string;
  offersCount: number;
  minPrice: number;
  maxPrice: number;
}

const DEMO_ORDER_BOOK: DemoOrderBookItem[] = [
  { id: "b1", productName: "Пармезан 24 мес.", offersCount: 3, minPrice: 2100, maxPrice: 2500 },
  { id: "b2", productName: "Грана Падано", offersCount: 1, minPrice: 1600, maxPrice: 1600 },
  { id: "b3", productName: "Хамон Серрано", offersCount: 5, minPrice: 2900, maxPrice: 3200 },
  { id: "b4", productName: "Моцарелла буф.", offersCount: 2, minPrice: 380, maxPrice: 450 },
  { id: "b5", productName: "Прошутто Крудо", offersCount: 4, minPrice: 3200, maxPrice: 3600 },
  { id: "b6", productName: "Горгонзола DOP", offersCount: 0, minPrice: 0, maxPrice: 0 },
  { id: "b7", productName: "Бри де Мо", offersCount: 2, minPrice: 850, maxPrice: 920 },
];

interface DemoHistoryItem {
  id: string;
  date: string;
  type: "sent" | "closed";
  product: string;
  price?: number;
}

const DEMO_HISTORY: DemoHistoryItem[] = [
  { id: "h1", date: "2026-02-10", type: "sent", product: "Пармезан 24 мес.", price: 2200 },
  { id: "h2", date: "2026-02-09", type: "closed", product: "Хамон Серрано" },
  { id: "h3", date: "2026-02-08", type: "sent", product: "Моцарелла буф.", price: 410 },
  { id: "h4", date: "2026-02-06", type: "closed", product: "Грана Падано" },
  { id: "h5", date: "2026-02-04", type: "sent", product: "Бри де Мо", price: 870 },
];

type Period = "1W" | "1M" | "3M";

function generatePriceHistory(product: DemoProduct, days: number) {
  const data = [];
  for (let i = days; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const rVariance = (Math.random() - 0.5) * product.retailPrice * 0.08;
    const wVariance = (Math.random() - 0.5) * product.wholesalePrice * 0.08;
    data.push({
      date: format(date, "dd.MM"),
      retail: Math.round(product.retailPrice + rVariance),
      wholesale: Math.round(product.wholesalePrice + wVariance),
    });
  }
  return data;
}

const periodDays: Record<Period, number> = { "1W": 7, "1M": 30, "3M": 90 };

// ── Component ──────────────────────────────────────────────────────

export function ExchangeSection({ storeId }: ExchangeSectionProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<DemoProduct>(DEMO_PRODUCTS[0]);
  const [period, setPeriod] = useState<Period>("1M");
  const [myPrices, setMyPrices] = useState<Record<string, string>>({});

  const {
    myRequests,
    allRequests,
    loading,
    createRequest,
    submitResponse,
  } = useExchange(storeId);

  const chartData = useMemo(
    () => generatePriceHistory(selectedProduct, periodDays[period]),
    [selectedProduct, period]
  );

  const activeRequestsCount = myRequests.filter((r) => r.status === "active").length;
  const totalResponses = myRequests.reduce((s, r) => s + (r.responses_count || 0), 0);

  const categorySummary = useMemo(() => {
    const map: Record<string, number> = {};
    DEMO_PRODUCTS.forEach((p) => {
      map[p.category] = (map[p.category] || 0) + 1;
    });
    return Object.entries(map);
  }, []);

  return (
    <div className="space-y-0">
      {/* ── Top bar ── */}
      <div className="bg-slate-900 border border-slate-700 rounded-t-lg px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-white">{selectedProduct.name}</h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-emerald-400 font-medium">Розница: {selectedProduct.retailPrice.toLocaleString("ru")}₽</span>
            <span className="text-blue-400 font-medium">Опт: {selectedProduct.wholesalePrice.toLocaleString("ru")}₽</span>
            <span className={`flex items-center gap-0.5 ${selectedProduct.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {selectedProduct.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {selectedProduct.change >= 0 ? "+" : ""}{selectedProduct.change}%
            </span>
          </div>
        </div>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Создать заявку
        </Button>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_240px] border border-t-0 border-slate-700 rounded-b-lg overflow-hidden">
        {/* ── Left: Product list ── */}
        <div className="bg-slate-900 border-r border-slate-700 max-h-[600px] overflow-y-auto">
          <div className="px-3 py-2 border-b border-slate-700 text-[11px] text-slate-400 font-medium uppercase tracking-wider">
            Товары
          </div>
          {DEMO_PRODUCTS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProduct(p)}
              className={`w-full text-left px-3 py-2.5 border-b border-slate-800 transition-colors text-xs ${
                selectedProduct.id === p.id
                  ? "bg-slate-800 border-l-2 border-l-emerald-500"
                  : "hover:bg-slate-800/60 border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-white font-medium truncate mr-2">{p.name}</span>
                <span className="text-slate-300 font-mono whitespace-nowrap">{p.wholesalePrice.toLocaleString("ru")}₽</span>
              </div>
              <div className="flex justify-between items-center mt-0.5">
                <span className="text-slate-500">{p.category}</span>
                <span className={`font-mono ${p.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {p.change >= 0 ? "+" : ""}{p.change}%
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* ── Center column ── */}
        <div className="bg-slate-900 flex flex-col min-h-0">
          {/* Chart */}
          <div className="flex-1 min-h-[280px] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" /> Розница
                </span>
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="w-3 h-0.5 bg-blue-400 inline-block rounded" /> Опт
                </span>
              </div>
              <div className="flex gap-1">
                {(["1W", "1M", "3M"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      period === p
                        ? "bg-slate-700 text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {p === "1W" ? "1Н" : p === "1M" ? "1М" : "3М"}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={50} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: 6, fontSize: 12 }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Line type="monotone" dataKey="retail" stroke="#34d399" strokeWidth={2} dot={false} name="Розница" />
                <Line type="monotone" dataKey="wholesale" stroke="#60a5fa" strokeWidth={2} dot={false} name="Опт" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Order book */}
          <div className="border-t border-slate-700 p-3">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Книга заявок</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-1.5 px-2 font-medium">Позиция</th>
                    <th className="text-center py-1.5 px-2 font-medium">Предл.</th>
                    <th className="text-right py-1.5 px-2 font-medium">Мин.</th>
                    <th className="text-right py-1.5 px-2 font-medium">Макс.</th>
                    <th className="text-right py-1.5 px-2 font-medium">Моё</th>
                  </tr>
                </thead>
                <tbody>
                  {DEMO_ORDER_BOOK.map((item) => (
                    <tr key={item.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-1.5 px-2 text-white">{item.productName}</td>
                      <td className="py-1.5 px-2 text-center">
                        {item.offersCount > 0 ? (
                          <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                            {item.offersCount}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right text-emerald-400 font-mono">
                        {item.minPrice > 0 ? `${item.minPrice.toLocaleString("ru")}₽` : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right text-red-400 font-mono">
                        {item.maxPrice > 0 ? `${item.maxPrice.toLocaleString("ru")}₽` : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <Input
                          type="number"
                          placeholder="—"
                          className="h-6 w-20 ml-auto text-xs bg-slate-800 border-slate-600 text-white text-right px-1.5"
                          value={myPrices[item.id] || ""}
                          onChange={(e) => setMyPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-2">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                <Send className="h-3 w-3 mr-1" />
                Отправить предложение
              </Button>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="bg-slate-900 border-l border-slate-700 flex flex-col min-h-0">
          {/* My requests summary */}
          <div className="p-3 border-b border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Мои заявки</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-slate-800 rounded p-2 text-center">
                <div className="text-lg font-bold text-white">{activeRequestsCount}</div>
                <div className="text-[10px] text-slate-400">Активных</div>
              </div>
              <div className="bg-slate-800 rounded p-2 text-center">
                <div className="text-lg font-bold text-white">{totalResponses}</div>
                <div className="text-[10px] text-slate-400">Откликов</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Новая заявка
            </Button>

            {/* Category breakdown */}
            <div className="mt-3 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Позиции</div>
              {categorySummary.map(([cat, count]) => (
                <div key={cat} className="flex justify-between text-xs">
                  <span className="text-slate-400">{cat}</span>
                  <span className="text-white font-mono">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* History */}
          <div className="p-3 flex-1 overflow-y-auto">
            <div className="flex items-center gap-2 mb-2">
              <History className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">История</span>
            </div>
            <div className="space-y-1">
              {DEMO_HISTORY.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-800">
                  <div className="flex-1 min-w-0">
                    <span className="text-slate-400 mr-2">{format(new Date(h.date), "dd.MM")}</span>
                    <span className="text-white truncate">{h.product}</span>
                  </div>
                  {h.type === "sent" ? (
                    <span className="text-emerald-400 font-mono whitespace-nowrap ml-2">{h.price?.toLocaleString("ru")}₽</span>
                  ) : (
                    <span className="text-slate-500 ml-2">закрыта</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ExchangeCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        storeId={storeId}
        onSubmit={createRequest}
      />
    </div>
  );
}
