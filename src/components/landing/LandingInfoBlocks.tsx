import { useState, useEffect } from "react";
import { Rocket, Store, Zap, Shield, BarChart3, Globe } from "lucide-react";

interface InfoBlock {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  image_url: string | null;
}

const iconMap: Record<string, React.ReactNode> = {
  Rocket: <Rocket className="h-4 w-4" />,
  Store: <Store className="h-4 w-4" />,
  Zap: <Zap className="h-4 w-4" />,
  Shield: <Shield className="h-4 w-4" />,
  BarChart3: <BarChart3 className="h-4 w-4" />,
  Globe: <Globe className="h-4 w-4" />,
};

export default function LandingInfoBlocks() {
  const [blocks, setBlocks] = useState<InfoBlock[]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-info-blocks`)
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setBlocks(json.data);
      })
      .catch(() => {});
  }, []);

  if (blocks.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {blocks.map((block) => (
        <div
          key={block.id}
          className="rounded-xl border bg-card overflow-hidden flex flex-row h-[140px]"
        >
          {/* Image left side */}
          {block.image_url ? (
            <div className="w-[140px] shrink-0 bg-muted">
              <img
                src={block.image_url}
                alt={block.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-[140px] shrink-0 bg-muted/50 flex items-center justify-center">
              <div className="text-primary">
                {block.icon && iconMap[block.icon]
                  ? React.cloneElement(iconMap[block.icon] as React.ReactElement, {
                      className: "h-8 w-8",
                    })
                  : <Rocket className="h-8 w-8 text-muted-foreground/40" />}
              </div>
            </div>
          )}

          {/* Text right side */}
          <div className="flex-1 p-3 flex flex-col justify-center gap-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {block.icon && iconMap[block.icon] && (
                <span className="text-primary shrink-0">
                  {iconMap[block.icon]}
                </span>
              )}
              <p className="text-xs font-semibold leading-tight truncate">
                {block.title}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-4">
              {block.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
