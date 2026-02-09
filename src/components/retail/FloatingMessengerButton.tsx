import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { MaxIcon } from "@/components/icons/MaxIcon";
import { Phone } from "lucide-react";

interface FloatingMessengerButtonProps {
  phone: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  maxLink?: string | null;
}

export function FloatingMessengerButton({ phone, whatsapp, telegram, maxLink }: FloatingMessengerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const items: { icon: React.ReactNode; label: string; href: string }[] = [];

  if (whatsapp) {
    const cleaned = whatsapp.replace(/[^\d]/g, "");
    items.push({
      icon: <WhatsAppIcon className="h-5 w-5" />,
      label: "WhatsApp",
      href: `https://wa.me/${cleaned}`,
    });
  }

  if (telegram) {
    const username = telegram.replace(/^@/, "");
    items.push({
      icon: <TelegramIcon className="h-5 w-5" />,
      label: "Telegram",
      href: `https://t.me/${username}`,
    });
  }

  if (maxLink) {
    const href = maxLink.startsWith("http") ? maxLink : `https://${maxLink}`;
    items.push({
      icon: <MaxIcon className="h-5 w-5" />,
      label: "Max",
      href,
    });
  }

  if (phone) {
    const cleaned = phone.replace(/[^\d+]/g, "");
    items.push({
      icon: <Phone className="h-5 w-5" />,
      label: phone,
      href: `tel:${cleaned}`,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2 md:bottom-6">
      {/* Tray items */}
      <div
        className={`flex flex-col gap-2 transition-all duration-300 origin-bottom ${
          isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-75 pointer-events-none"
        }`}
      >
        {items.map((item, i) => (
          <a
            key={i}
            href={item.href}
            target={item.href.startsWith("tel:") ? undefined : "_blank"}
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-background border border-border rounded-full pl-4 pr-5 py-2.5 shadow-lg hover:shadow-xl transition-all hover:scale-105 text-sm font-medium text-foreground"
          >
            <span className="text-primary">{item.icon}</span>
            <span>{item.label}</span>
          </a>
        ))}
      </div>

      {/* FAB button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label={isOpen ? "Закрыть мессенджеры" : "Написать нам"}
      >
        <div className={`transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`}>
          {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        </div>
      </button>
    </div>
  );
}
