import React, { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ResizableColumnHeaderProps {
  columnId: string;
  width: number;
  minWidth?: number;
  onWidthChange: (id: string, width: number) => void;
  className?: string;
  children: React.ReactNode;
}

export function ResizableColumnHeader({
  columnId,
  width,
  minWidth = 40,
  onWidthChange,
  className,
  children,
}: ResizableColumnHeaderProps) {
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = width;
  }, [width]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    startX.current = e.touches[0].clientX;
    startWidth.current = width;
  }, [width]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX.current;
      const newWidth = Math.max(minWidth, startWidth.current + diff);
      onWidthChange(columnId, newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const diff = e.touches[0].clientX - startX.current;
      const newWidth = Math.max(minWidth, startWidth.current + diff);
      onWidthChange(columnId, newWidth);
    };

    const handleEnd = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);

    // Prevent text selection while resizing
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, columnId, minWidth, onWidthChange]);

  return (
    <div
      className={cn(
        "flex-shrink-0 px-2 py-2 relative select-none overflow-hidden",
        className
      )}
      style={{ width, minWidth, maxWidth: width }}
    >
      <span className="truncate block">{children}</span>
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors touch-none",
          isResizing && "bg-primary"
        )}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      />
    </div>
  );
}
