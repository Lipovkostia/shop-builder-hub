import { useState, useEffect, useRef } from "react";
import { Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { MaxIcon } from "@/components/icons/MaxIcon";

interface ShowcaseContactBarProps {
  phone: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  maxLink?: string | null;
}

export function ShowcaseContactBar({ phone, whatsapp, telegram, maxLink }: ShowcaseContactBarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY > lastScrollY.current && currentY > 50) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const hasAnyContact = phone || whatsapp || telegram || maxLink;
  if (!hasAnyContact) return null;

  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";
  const waHref = whatsapp ? `https://wa.me/${whatsapp.replace(/[^\d]/g, "")}` : "";
  const tgHref = telegram ? `https://t.me/${telegram.replace(/^@/, "")}` : "";
  const maxHref = maxLink ? (maxLink.startsWith("http") ? maxLink : `https://${maxLink}`) : "";

  return (
    <div
      className={`w-full bg-muted/60 border-b border-border py-1.5 transition-transform duration-300 md:translate-y-0 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container mx-auto px-4 flex items-center justify-center gap-2.5">
        {/* Messenger icons */}
        {whatsapp && (
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title="WhatsApp">
            <WhatsAppIcon className="h-3.5 w-3.5" />
          </a>
        )}
        {telegram && (
          <a href={tgHref} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title="Telegram">
            <TelegramIcon className="h-3.5 w-3.5" />
          </a>
        )}
        {maxLink && (
          <a href={maxHref} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" title="Max">
            <MaxIcon className="h-3.5 w-3.5" />
          </a>
        )}

        {/* Separator between messengers and phone */}
        {(whatsapp || telegram || maxLink) && phone && (
          <span className="w-px h-3 bg-border" />
        )}

        {/* Phone */}
        {phone && (
          <>
            <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
            <a
              href={telHref}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {phone}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
