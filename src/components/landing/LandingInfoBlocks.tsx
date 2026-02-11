import { useState, useEffect } from "react";
import { Rocket, List, Store, Link2, Info } from "lucide-react";

interface InfoBlock {
  id: string;
  title: string;
  description: string;
  icon: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  rocket: Rocket,
  list: List,
  store: Store,
  link: Link2,
  info: Info,
};

export default function LandingInfoBlocks() {
  const [blocks, setBlocks] = useState<InfoBlock[]>([]);

  useEffect(() => {
    const fetchBlocks = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-info-blocks`
        );
        if (!res.ok) return;
        const json = await res.json();
        setBlocks(json.data || []);
      } catch (e) {
        console.error("Info blocks error:", e);
      }
    };
    fetchBlocks();
  }, []);

  if (blocks.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {blocks.map((b) => {
        const Icon = iconMap[b.icon] || Info;
        return (
          <div
            key={b.id}
            className="rounded-lg border bg-card p-3 flex flex-col gap-1"
          >
            <Icon className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold leading-tight">{b.title}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{b.description}</p>
          </div>
        );
      })}
    </div>
  );
}
