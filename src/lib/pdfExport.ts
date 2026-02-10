import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CatalogExportProduct } from './excelImport';

const STATUS_LABELS: Record<string, string> = {
  'in_stock': 'В наличии',
  'out_of_stock': 'Нет в наличии',
  'pre_order': 'Под заказ',
  'hidden': 'Скрыт',
};

const COLUMN_MAPPINGS: { id: string; header: string; getValue: (p: CatalogExportProduct) => string | number }[] = [
  { id: 'sku', header: 'Код', getValue: p => p.sku || '' },
  { id: 'name', header: 'Название', getValue: p => p.name || '' },
  { id: 'description', header: 'Описание', getValue: p => p.description || '' },
  { id: 'categories', header: 'Категории', getValue: p => (p.categories || []).join(', ') },
  { id: 'unit', header: 'Ед. изм.', getValue: p => p.unit || '' },
  { id: 'volume', header: 'Объем', getValue: p => p.unitWeight ?? '' },
  { id: 'type', header: 'Тип фасовки', getValue: p => p.packagingType || '' },
  { id: 'buyPrice', header: 'Себестоимость', getValue: p => p.buyPrice ?? '' },
  { id: 'markup', header: 'Наценка', getValue: p => p.markup || '' },
  { id: 'price', header: 'Цена', getValue: p => p.price ?? '' },
  { id: 'priceFull', header: 'Целая', getValue: p => p.priceFull ?? '' },
  { id: 'priceHalf', header: '½', getValue: p => p.priceHalf ?? '' },
  { id: 'priceQuarter', header: '¼', getValue: p => p.priceQuarter ?? '' },
  { id: 'pricePortion', header: 'Порция', getValue: p => p.pricePortion ?? '' },
  { id: 'status', header: 'Статус', getValue: p => STATUS_LABELS[p.status] || p.status || '' },
];

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportCatalogToPdf(
  catalogName: string,
  products: CatalogExportProduct[],
  enabledColumns: string[],
  includePhotos: boolean,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Title
  doc.setFontSize(14);
  doc.text(catalogName, 14, 15);
  doc.setFontSize(8);
  doc.text(new Date().toLocaleDateString('ru-RU'), 14, 20);

  const activeColumns = COLUMN_MAPPINGS.filter(col => enabledColumns.includes(col.id));

  // Build headers
  const headers: string[] = [];
  if (includePhotos) headers.push('Фото');
  headers.push(...activeColumns.map(c => c.header));

  // Pre-load images if needed
  let imageMap: Map<number, string> = new Map();
  if (includePhotos) {
    const total = products.length;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const imgUrl = p.images?.[0];
      if (imgUrl) {
        const base64 = await loadImageAsBase64(imgUrl);
        if (base64) imageMap.set(i, base64);
      }
      onProgress?.(i + 1, total);
    }
  }

  // Build body
  const body = products.map((p, idx) => {
    const row: (string | number)[] = [];
    if (includePhotos) row.push(''); // placeholder for image
    row.push(...activeColumns.map(c => c.getValue(p)));
    return row;
  });

  const photoColIdx = includePhotos ? 0 : -1;
  const cellSize = 8;

  autoTable(doc, {
    startY: 24,
    head: [headers],
    body,
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [30, 30, 30],
      fontStyle: 'bold',
      fontSize: 7,
    },
    columnStyles: includePhotos
      ? { 0: { cellWidth: cellSize + 4, minCellHeight: cellSize + 4 } }
      : {},
    didDrawCell: (data) => {
      if (
        includePhotos &&
        data.section === 'body' &&
        data.column.index === photoColIdx
      ) {
        const img = imageMap.get(data.row.index);
        if (img) {
          try {
            doc.addImage(
              img,
              'JPEG',
              data.cell.x + 1.5,
              data.cell.y + 1.5,
              cellSize,
              cellSize,
            );
          } catch {
            // skip broken image
          }
        }
      }
    },
  });

  const safeName = catalogName.replace(/[^a-zA-Zа-яА-Я0-9\s-]/g, '').trim() || 'прайс-лист';
  const date = new Date().toISOString().split('T')[0];
  doc.save(`${safeName}_${date}.pdf`);
}
