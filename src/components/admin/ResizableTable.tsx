import * as React from "react";
import { useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, GripHorizontal } from "lucide-react";

/**
 * Resizable Table - extends standard table styling with column resize and drag-and-drop functionality
 * Supports reordering of both columns and rows with touch support for mobile
 */

interface ColumnConfig {
  id: string;
  minWidth: number;
  defaultWidth: number;
}

interface ResizableTableContextValue {
  columnWidths: Record<string, number>;
  setColumnWidth: (id: string, width: number) => void;
  columnOrder: string[];
  setColumnOrder: (order: string[]) => void;
  isDraggingColumn: boolean;
  setIsDraggingColumn: (v: boolean) => void;
}

const ResizableTableContext = React.createContext<ResizableTableContextValue | null>(null);

// Context for column drag state
interface ColumnDragContextValue {
  isDragging: boolean;
  activeId: string | null;
}

const ColumnDragContext = React.createContext<ColumnDragContextValue>({ isDragging: false, activeId: null });

// Internal wrapper for column drag that goes outside the table (used automatically inside ResizableTable)
function DraggableColumnWrapperInternal({ children }: { children: React.ReactNode }) {
  const context = React.useContext(ResizableTableContext);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    context?.setIsDraggingColumn(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    context?.setIsDraggingColumn(false);

    if (over && active.id !== over.id && context) {
      const oldIndex = context.columnOrder.indexOf(active.id as string);
      const newIndex = context.columnOrder.indexOf(over.id as string);
      context.setColumnOrder(arrayMove(context.columnOrder, oldIndex, newIndex));
    }
  };

  if (!context) {
    return <>{children}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ColumnDragContext.Provider value={{ isDragging: !!activeId, activeId }}>
        <SortableContext items={context.columnOrder} strategy={horizontalListSortingStrategy}>
          {children}
        </SortableContext>
      </ColumnDragContext.Provider>
      <DragOverlay dropAnimation={null}>
        {activeId ? (
          <div className="bg-primary/20 border border-primary rounded px-2 py-1 text-xs font-medium shadow-lg">
            {activeId}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface ResizableTableProps extends React.HTMLAttributes<HTMLTableElement> {
  columns: ColumnConfig[];
  storageKey?: string;
  onColumnOrderChange?: (order: string[]) => void;
}

export function ResizableTable({ 
  columns, 
  storageKey,
  onColumnOrderChange,
  className, 
  children,
  ...props 
}: ResizableTableProps) {
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`table-widths-${storageKey}`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // ignore
        }
      }
    }
    return columns.reduce((acc, col) => {
      acc[col.id] = col.defaultWidth;
      return acc;
    }, {} as Record<string, number>);
  });

  const [columnOrder, setColumnOrderState] = useState<string[]>(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`table-column-order-${storageKey}`);
      if (saved) {
        try {
          const savedOrder = JSON.parse(saved);
          // Validate that all columns are present
          const columnIds = columns.map(c => c.id);
          if (savedOrder.length === columnIds.length && 
              savedOrder.every((id: string) => columnIds.includes(id))) {
            return savedOrder;
          }
        } catch (e) {
          // ignore
        }
      }
    }
    return columns.map(c => c.id);
  });

  const [isDraggingColumn, setIsDraggingColumn] = useState(false);

  const setColumnWidth = useCallback((id: string, width: number) => {
    setColumnWidthsState(prev => {
      const newWidths = { ...prev, [id]: width };
      if (storageKey) {
        localStorage.setItem(`table-widths-${storageKey}`, JSON.stringify(newWidths));
      }
      return newWidths;
    });
  }, [storageKey]);

  const setColumnOrder = useCallback((order: string[]) => {
    setColumnOrderState(order);
    if (storageKey) {
      localStorage.setItem(`table-column-order-${storageKey}`, JSON.stringify(order));
    }
    onColumnOrderChange?.(order);
  }, [storageKey, onColumnOrderChange]);

  const contextValue = useMemo(() => ({
    columnWidths,
    setColumnWidth,
    columnOrder,
    setColumnOrder,
    isDraggingColumn,
    setIsDraggingColumn,
  }), [columnWidths, setColumnWidth, columnOrder, setColumnOrder, isDraggingColumn]);

  return (
    <ResizableTableContext.Provider value={contextValue}>
      <DraggableColumnWrapperInternal>
        <div className="relative w-full overflow-x-auto scrollbar-thin">
          <table 
            className={cn(
              "w-max min-w-full caption-bottom text-xs border-collapse",
              className
            )} 
            {...props}
          >
            {children}
          </table>
        </div>
      </DraggableColumnWrapperInternal>
    </ResizableTableContext.Provider>
  );
}

interface ResizableTableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  enableColumnDrag?: boolean;
}

// Alias for external usage if needed
export const DraggableColumnWrapper = DraggableColumnWrapperInternal;

export function ResizableTableHeader({ 
  className, 
  children,
  enableColumnDrag = true,
  ...props 
}: ResizableTableHeaderProps) {
  return (
    <thead 
      className={cn(
        "[&_tr]:border-b bg-muted/30 sticky top-0 z-10",
        className
      )} 
      {...props}
    >
      {children}
    </thead>
  );
}

export function ResizableTableBody({ 
  className, 
  ...props 
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  );
}

// Context for row drag and drop
interface RowDndContextValue {
  activeId: string | null;
}

const RowDndContext = React.createContext<RowDndContextValue | null>(null);

// Wrapper that provides DndContext at the table container level (outside table element)
interface DraggableTableWrapperProps {
  items: string[];
  onReorder?: (items: string[]) => void;
  children: React.ReactNode;
}

export function DraggableTableWrapper({
  items,
  onReorder,
  children,
}: DraggableTableWrapperProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      onReorder?.(arrayMove(items, oldIndex, newIndex));
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <RowDndContext.Provider value={{ activeId }}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </RowDndContext.Provider>
      <DragOverlay dropAnimation={null}>
        {activeId ? (
          <div className="bg-card border shadow-lg rounded px-3 py-2 text-xs">
            Перемещение строки...
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Sortable wrapper for rows - simplified version without DndContext
interface SortableTableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export function SortableTableBody({ 
  className, 
  children,
  ...props 
}: SortableTableBodyProps) {
  return (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props}>
      {children}
    </tbody>
  );
}

// Sortable row component
interface SortableTableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  id: string;
  disabled?: boolean;
}

export function SortableTableRow({ 
  id,
  disabled = false,
  className, 
  children,
  ...props 
}: SortableTableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50",
        "h-11",
        isDragging && "bg-muted/80 shadow-lg z-50",
        className
      )}
      {...props}
    >
      {!disabled && (
        <td className="w-8 px-1">
          <button
            type="button"
            className="p-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </td>
      )}
      {children}
    </tr>
  );
}

export function ResizableTableRow({ 
  className, 
  ...props 
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b transition-colors data-[state=selected]:bg-muted hover:bg-muted/50",
        "h-11",
        className
      )}
      {...props}
    />
  );
}

// Sortable header cell wrapper
interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  columnId: string;
  minWidth?: number;
  resizable?: boolean;
  draggable?: boolean;
}

export function SortableTableHead({ 
  columnId,
  minWidth = 50,
  resizable = true,
  draggable = true,
  className, 
  children,
  style,
  ...props 
}: SortableTableHeadProps) {
  const context = React.useContext(ResizableTableContext);
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: columnId, disabled: !draggable });

  const width = context?.columnWidths[columnId] ?? minWidth;

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

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX.current;
      const newWidth = Math.max(minWidth, startWidth.current + diff);
      context?.setColumnWidth(columnId, newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const diff = e.touches[0].clientX - startX.current;
      const newWidth = Math.max(minWidth, startWidth.current + diff);
      context?.setColumnWidth(columnId, newWidth);
    };

    const handleEnd = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isResizing, columnId, minWidth, context]);

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <th
      ref={setNodeRef}
      className={cn(
        "h-10 px-3 text-left align-middle font-medium text-muted-foreground",
        "whitespace-nowrap overflow-hidden relative select-none group/header",
        isDragging && "opacity-50 bg-primary/10",
        className
      )}
      style={{ 
        ...style, 
        ...dragStyle,
        width: `${width}px`, 
        minWidth: `${minWidth}px`, 
        maxWidth: `${width}px` 
      }}
      {...props}
    >
      <div className="flex items-center gap-1">
        {draggable && (
          <button
            type="button"
            className="p-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground md:opacity-0 md:group-hover/header:opacity-100 transition-opacity touch-none flex-shrink-0"
            {...attributes}
            {...listeners}
          >
            <GripHorizontal className="h-3 w-3" />
          </button>
        )}
        <div className="truncate flex-1">{children}</div>
      </div>
      {resizable && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 transition-colors touch-none",
            isResizing && "bg-primary"
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        />
      )}
    </th>
  );
}

interface ResizableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  columnId: string;
  minWidth?: number;
  resizable?: boolean;
}

export function ResizableTableHead({ 
  columnId,
  minWidth = 50,
  resizable = true,
  className, 
  children,
  style,
  ...props 
}: ResizableTableHeadProps) {
  const context = React.useContext(ResizableTableContext);
  const [isResizing, setIsResizing] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const width = context?.columnWidths[columnId] ?? minWidth;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = width;
  }, [width]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsResizing(true);
    startX.current = e.touches[0].clientX;
    startWidth.current = width;
  }, [width]);

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX.current;
      const newWidth = Math.max(minWidth, startWidth.current + diff);
      context?.setColumnWidth(columnId, newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const diff = e.touches[0].clientX - startX.current;
      const newWidth = Math.max(minWidth, startWidth.current + diff);
      context?.setColumnWidth(columnId, newWidth);
    };

    const handleEnd = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isResizing, columnId, minWidth, context]);

  return (
    <th
      className={cn(
        "h-10 px-3 text-left align-middle font-medium text-muted-foreground",
        "whitespace-nowrap overflow-hidden relative select-none",
        className
      )}
      style={{ ...style, width: `${width}px`, minWidth: `${minWidth}px`, maxWidth: `${width}px` }}
      {...props}
    >
      <div className="truncate pr-2">{children}</div>
      {resizable && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 transition-colors touch-none",
            isResizing && "bg-primary"
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        />
      )}
    </th>
  );
}

interface ResizableTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  columnId: string;
}

export function ResizableTableCell({ 
  columnId,
  className, 
  children,
  style,
  ...props 
}: ResizableTableCellProps) {
  const context = React.useContext(ResizableTableContext);
  const width = context?.columnWidths[columnId];

  return (
    <td 
      className={cn(
        "px-3 py-2 align-middle",
        "whitespace-nowrap overflow-hidden",
        className
      )} 
      style={{ ...style, width: width ? `${width}px` : undefined, maxWidth: width ? `${width}px` : undefined }}
      {...props}
    >
      <div className="truncate">{children}</div>
    </td>
  );
}

// Hook to get column order for rendering cells in correct order
export function useColumnOrder() {
  const context = React.useContext(ResizableTableContext);
  return context?.columnOrder ?? [];
}

// Component that renders children cells in the correct column order
interface OrderedCellsProps {
  columnId: string;
  children: React.ReactNode;
}

interface OrderedCellsContainerProps {
  cells: Record<string, React.ReactNode>;
  fixedStart?: string[]; // Column IDs that should always be at the start (like drag handle)
  fixedEnd?: string[]; // Column IDs that should always be at the end (like actions)
}

export function OrderedCellsContainer({ cells, fixedStart = [], fixedEnd = [] }: OrderedCellsContainerProps) {
  const columnOrder = useColumnOrder();
  
  // Determine which columns are reorderable (not fixed)
  const reorderableColumns = columnOrder.filter(
    id => !fixedStart.includes(id) && !fixedEnd.includes(id)
  );
  
  // Build final order: fixedStart + reorderable (in columnOrder sequence) + fixedEnd
  const finalOrder = [...fixedStart, ...reorderableColumns, ...fixedEnd];
  
  return (
    <>
      {finalOrder.map(columnId => cells[columnId])}
    </>
  );
}

// Export context for external use if needed
export { ResizableTableContext };
