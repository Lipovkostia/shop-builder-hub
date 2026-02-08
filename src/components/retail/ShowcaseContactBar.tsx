import { useState, useEffect, useRef } from "react";
import { Phone } from "lucide-react";

interface ShowcaseContactBarProps {
  phone: string | null;
}

export function ShowcaseContactBar({ phone }: ShowcaseContactBarProps) {
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

  if (!phone) return null;

  // Clean phone for tel: link
  const telHref = `tel:${phone.replace(/[^\d+]/g, "")}`;

  return (
    <div
      className={`w-full bg-muted/60 border-b border-border py-1.5 transition-transform duration-300 md:translate-y-0 ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="container mx-auto px-4 flex items-center justify-center gap-1.5">
        <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
        <a
          href={telHref}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {phone}
        </a>
      </div>
    </div>
  );
}
