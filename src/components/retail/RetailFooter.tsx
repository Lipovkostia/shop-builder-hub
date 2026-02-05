import { Phone, Mail, MapPin } from "lucide-react";
import type { RetailStore } from "@/hooks/useRetailStore";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface RetailFooterProps {
  store: RetailStore;
}

export function RetailFooter({ store }: RetailFooterProps) {
  const hasDeliveryPayment = !!store.retail_footer_delivery_payment;
  const hasReturns = !!store.retail_footer_returns;
  const hasContacts = !!(store.contact_phone || store.contact_email || store.address);

  return (
    <footer className="bg-muted/50 border-t mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Store info */}
          <div>
            <h3 className="font-bold text-lg mb-3">{store.retail_name || store.name}</h3>
            {store.description && (
              <p className="text-sm text-muted-foreground">{store.description}</p>
            )}
          </div>

          {/* Contacts accordion */}
          {hasContacts && (
            <div>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="contacts" className="border-b-0">
                  <AccordionTrigger className="py-0 font-semibold hover:no-underline">
                    Контакты
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 text-sm pt-3">
                      {store.contact_phone && (
                        <a
                          href={`tel:${store.contact_phone}`}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                        >
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {store.contact_phone}
                        </a>
                      )}
                      {store.contact_email && (
                        <a
                          href={`mailto:${store.contact_email}`}
                          className="flex items-center gap-2 hover:text-primary transition-colors"
                        >
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {store.contact_email}
                        </a>
                      )}
                      {store.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{store.address}</span>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          )}

          {/* Info accordion */}
          <div>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="info" className="border-b-0">
                <AccordionTrigger className="py-0 font-semibold hover:no-underline">
                  Информация
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-3">
                    {hasDeliveryPayment && (
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="delivery" className="border-b-0">
                          <AccordionTrigger className="py-2 text-sm text-muted-foreground hover:no-underline hover:text-foreground">
                            Доставка и оплата
                          </AccordionTrigger>
                          <AccordionContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {store.retail_footer_delivery_payment}
                            </p>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}
                    {hasReturns && (
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="returns" className="border-b-0">
                          <AccordionTrigger className="py-2 text-sm text-muted-foreground hover:no-underline hover:text-foreground">
                            Возврат и обмен
                          </AccordionTrigger>
                          <AccordionContent>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {store.retail_footer_returns}
                            </p>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}
                    {!hasDeliveryPayment && !hasReturns && (
                      <p className="text-sm text-muted-foreground">
                        Информация скоро появится
                      </p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        <div className="border-t mt-8 pt-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {store.retail_name || store.name}. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}
