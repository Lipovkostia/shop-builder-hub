import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Globe, Loader2 } from "lucide-react";
import { useExchange } from "@/hooks/useExchange";
import { ExchangeRequestCard } from "@/components/admin/ExchangeRequestCard";
import { ExchangeCreateDialog } from "@/components/admin/ExchangeCreateDialog";

interface ExchangeSectionProps {
  storeId: string | null;
}

export function ExchangeSection({ storeId }: ExchangeSectionProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const {
    myRequests,
    allRequests,
    loading,
    createRequest,
    closeRequest,
    submitResponse,
    fetchResponseItems,
  } = useExchange(storeId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Биржа заявок</h2>
          <p className="text-sm text-muted-foreground">
            Создавайте заявки на закупку и получайте предложения от поставщиков
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Новая заявка
        </Button>
      </div>

      <Tabs defaultValue="my" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="my" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Мои заявки
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Все заявки
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : myRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">Нет заявок</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Создайте первую заявку на закупку, выбрав товары из ассортимента или добавив вручную
              </p>
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Создать заявку
              </Button>
            </div>
          ) : (
            myRequests.map((req) => (
              <ExchangeRequestCard
                key={req.id}
                request={req}
                isOwn
                onClose={() => closeRequest(req.id)}
                onFetchResponses={() => fetchResponseItems(req.id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Globe className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">Нет активных заявок</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Пока нет заявок от других продавцов. Они появятся здесь, когда кто-то создаст запрос на закупку.
              </p>
            </div>
          ) : (
            allRequests.map((req) => (
              <ExchangeRequestCard
                key={req.id}
                request={req}
                isOwn={false}
                onSubmitResponse={(prices) => submitResponse(req.id, prices)}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <ExchangeCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        storeId={storeId}
        onSubmit={createRequest}
      />
    </div>
  );
}
