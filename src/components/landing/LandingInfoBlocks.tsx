import { useState, useEffect } from "react";

interface InfoBlock {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  image_url: string | null;
}

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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {blocks.map((block) => (
        <div
          key={block.id}
          className="rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="px-3 pt-3 pb-1.5">
            <h3 className="text-sm font-bold leading-tight truncate">
              {block.title}
            </h3>
            {block.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {block.description}
              </p>
            )}
          </div>
          <div className="px-3 pb-3">
            <div className="relative w-full rounded-lg overflow-hidden bg-muted" style={{ aspectRatio: "16/9" }}>
              {block.image_url ? (
                <img
                  src={block.image_url}
                  alt={block.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/40 text-xs">
                  Нет изображения
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
