import { Phone, Mail, MapPin } from "lucide-react";
import type { RetailStore } from "@/hooks/useRetailStore";

interface RetailFooterProps {
  store: RetailStore;
}

export function RetailFooter({ store }: RetailFooterProps) {
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

          {/* Contacts */}
          <div>
            <h4 className="font-semibold mb-3">Контакты</h4>
            <div className="space-y-2 text-sm">
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
          </div>

          {/* Info */}
          <div>
            <h4 className="font-semibold mb-3">Информация</h4>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Доставка и оплата</p>
              <p>Возврат и обмен</p>
              <p>Политика конфиденциальности</p>
            </div>
          </div>
        </div>

        <div className="border-t mt-8 pt-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {store.retail_name || store.name}. Все права защищены.</p>
        </div>
      </div>
    </footer>
  );
}
