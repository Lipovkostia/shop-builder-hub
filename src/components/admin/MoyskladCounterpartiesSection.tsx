import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, RefreshCw, Users, Phone, Mail, MapPin, Building2, FileText, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

export interface MoyskladCounterparty {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  description: string | null;
  companyType: string | null;
  legalTitle: string | null;
  legalAddress: string | null;
  legalAddressFull: any | null;
  actualAddress: string | null;
  actualAddressFull: any | null;
  inn: string | null;
  kpp: string | null;
  ogrn: string | null;
  ogrnip: string | null;
  okpo: string | null;
  certificateNumber: string | null;
  certificateDate: string | null;
  tags: string[];
  code: string | null;
  externalCode: string | null;
  archived: boolean;
  created: string | null;
  updated: string | null;
  salesAmount: number;
  discountCardNumber: string | null;
  fax: string | null;
}

interface Props {
  login: string;
  password: string;
}

const companyTypeLabels: Record<string, string> = {
  legal: "Юр. лицо",
  entrepreneur: "ИП",
  individual: "Физ. лицо",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={handleCopy} className="ml-1 text-muted-foreground hover:text-foreground inline-flex items-center">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <span className="text-muted-foreground">{label}: </span>
        <span className="text-foreground break-all">{value}</span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function CounterpartyCard({ cp }: { cp: MoyskladCounterparty }) {
  const [expanded, setExpanded] = useState(false);
  const isMobile = useIsMobile();

  const hasDetails = cp.inn || cp.kpp || cp.ogrn || cp.ogrnip || cp.okpo ||
    cp.legalAddress || cp.actualAddress || cp.legalTitle || cp.description ||
    cp.fax || cp.certificateNumber || cp.discountCardNumber || cp.code || cp.externalCode;

  return (
    <div className="border rounded-lg bg-card hover:border-primary/30 transition-colors">
      <div
        className="p-3 cursor-pointer flex items-start justify-between gap-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-sm text-foreground truncate">{cp.name}</h3>
            {cp.companyType && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {companyTypeLabels[cp.companyType] || cp.companyType}
              </Badge>
            )}
            {cp.archived && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                Архив
              </Badge>
            )}
            {cp.tags.length > 0 && cp.tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {tag}
              </Badge>
            ))}
          </div>
          {/* Key info always visible */}
          <div className={`flex ${isMobile ? 'flex-col gap-1' : 'flex-wrap items-center gap-x-4 gap-y-1'}`}>
            {cp.phone && (
              <a href={`tel:${cp.phone}`} className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={e => e.stopPropagation()}>
                <Phone className="h-3 w-3" />
                {cp.phone}
              </a>
            )}
            {cp.email && (
              <a href={`mailto:${cp.email}`} className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={e => e.stopPropagation()}>
                <Mail className="h-3 w-3" />
                {cp.email}
              </a>
            )}
            {cp.inn && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3 w-3" />
                ИНН: {cp.inn}
              </span>
            )}
          </div>
        </div>
        {hasDetails && (
          <button className="text-muted-foreground mt-1 flex-shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t space-y-1.5">
          <InfoRow icon={Building2} label="Юр. название" value={cp.legalTitle} />
          <InfoRow icon={MapPin} label="Юр. адрес" value={cp.legalAddress} />
          <InfoRow icon={MapPin} label="Факт. адрес" value={cp.actualAddress} />
          <InfoRow icon={FileText} label="ИНН" value={cp.inn} />
          <InfoRow icon={FileText} label="КПП" value={cp.kpp} />
          <InfoRow icon={FileText} label="ОГРН" value={cp.ogrn} />
          <InfoRow icon={FileText} label="ОГРНИП" value={cp.ogrnip} />
          <InfoRow icon={FileText} label="ОКПО" value={cp.okpo} />
          <InfoRow icon={FileText} label="Код" value={cp.code} />
          <InfoRow icon={FileText} label="Внешний код" value={cp.externalCode} />
          <InfoRow icon={Phone} label="Факс" value={cp.fax} />
          <InfoRow icon={FileText} label="Номер карты" value={cp.discountCardNumber} />
          <InfoRow icon={FileText} label="Номер свидетельства" value={cp.certificateNumber} />
          {cp.certificateDate && (
            <InfoRow icon={FileText} label="Дата свидетельства" value={new Date(cp.certificateDate).toLocaleDateString('ru-RU')} />
          )}
          {cp.description && (
            <div className="text-xs mt-2">
              <span className="text-muted-foreground">Описание: </span>
              <span className="text-foreground">{cp.description}</span>
            </div>
          )}
          {cp.salesAmount > 0 && (
            <div className="text-xs">
              <span className="text-muted-foreground">Сумма продаж: </span>
              <span className="text-foreground font-medium">{(cp.salesAmount / 100).toLocaleString('ru-RU')} ₽</span>
            </div>
          )}
          {cp.created && (
            <div className="text-xs text-muted-foreground">
              Создан: {new Date(cp.created).toLocaleDateString('ru-RU')}
              {cp.updated && ` • Обновлён: ${new Date(cp.updated).toLocaleDateString('ru-RU')}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MoyskladCounterpartiesSection({ login, password }: Props) {
  const { toast } = useToast();
  const [counterparties, setCounterparties] = useState<MoyskladCounterparty[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalCount, setTotalCount] = useState(0);

  const fetchCounterparties = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all counterparties (paginated)
      let all: MoyskladCounterparty[] = [];
      let offset = 0;
      const batchSize = 100;
      let total = 0;

      do {
        const { data, error } = await supabase.functions.invoke("moysklad", {
          body: {
            action: "get_counterparties",
            login,
            password,
            counterpartyLimit: batchSize,
            counterpartyOffset: offset,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        all = [...all, ...(data.counterparties || [])];
        total = data.meta?.size || all.length;
        offset += batchSize;
      } while (offset < total && offset < 1000); // safety cap

      setCounterparties(all);
      setTotalCount(total);
      setLoaded(true);
    } catch (error: any) {
      console.error("Error fetching counterparties:", error);
      toast({
        title: "Ошибка загрузки контрагентов",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [login, password, toast]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return counterparties;
    const q = searchQuery.toLowerCase();
    return counterparties.filter(cp =>
      cp.name.toLowerCase().includes(q) ||
      cp.phone?.toLowerCase().includes(q) ||
      cp.email?.toLowerCase().includes(q) ||
      cp.inn?.includes(q) ||
      cp.legalTitle?.toLowerCase().includes(q) ||
      cp.code?.toLowerCase().includes(q)
    );
  }, [counterparties, searchQuery]);

  if (!loaded && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium text-foreground mb-2">Контрагенты МойСклад</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Загрузите список контрагентов из МойСклад со всеми доступными данными
        </p>
        <Button onClick={fetchCounterparties}>
          <Users className="h-4 w-4 mr-2" />
          Загрузить контрагентов
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Контрагенты</h3>
          <Badge variant="secondary" className="text-xs">
            {filtered.length} из {totalCount}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={fetchCounterparties}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по имени, телефону, email, ИНН..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-9"
        />
      </div>

      {loading && counterparties.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {searchQuery ? "Ничего не найдено" : "Нет контрагентов"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cp => (
            <CounterpartyCard key={cp.id} cp={cp} />
          ))}
        </div>
      )}
    </div>
  );
}
