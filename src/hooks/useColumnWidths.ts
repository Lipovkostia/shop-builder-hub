import { useState, useCallback, useRef } from "react";

interface ColumnWidthConfig {
  [key: string]: number;
}

const DEFAULT_WIDTHS: ColumnWidthConfig = {
  photo: 32,
  name: 200,
  sku: 80,
  desc: 96,
  source: 64,
  unit: 64,
  type: 80,
  volume: 64,
  cost: 64,
  price: 80,
  groups: 96,
  catalogs: 112,
  msProduct: 100,
  sync: 48,
};

const MIN_WIDTH = 40;

export function useColumnWidths(storageKey: string) {
  const [widths, setWidths] = useState<ColumnWidthConfig>(() => {
    try {
      const saved = localStorage.getItem(`col-widths-${storageKey}`);
      if (saved) return { ...DEFAULT_WIDTHS, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_WIDTHS };
  });

  const resizeState = useRef<{ col: string; startX: number; startW: number } | null>(null);

  const onResizeStart = useCallback((col: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    resizeState.current = { col, startX: clientX, startW: widths[col] || DEFAULT_WIDTHS[col] || 80 };

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      if (!resizeState.current) return;
      const cx = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const diff = cx - resizeState.current.startX;
      const newW = Math.max(MIN_WIDTH, resizeState.current.startW + diff);
      setWidths(prev => {
        const updated = { ...prev, [resizeState.current!.col]: newW };
        try { localStorage.setItem(`col-widths-${storageKey}`, JSON.stringify(updated)); } catch {}
        return updated;
      });
    };

    const handleEnd = () => {
      resizeState.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleEnd);
  }, [widths, storageKey]);

  return { widths, onResizeStart };
}
