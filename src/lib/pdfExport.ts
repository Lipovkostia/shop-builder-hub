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

const THUMB_SIZE = 64;
const JPEG_QUALITY = 0.6;

async function loadAndCompressImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    const canvas = document.createElement('canvas');
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, THUMB_SIZE, THUMB_SIZE);
    bitmap.close();

    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch {
    return null;
  }
}

async function loadFontAsBase64(): Promise<string> {
  const resp = await fetch('/fonts/Roboto-Regular.ttf');
  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function exportCatalogToPdf(
  catalogName: string,
  products: CatalogExportProduct[],
  enabledColumns: string[],
  includePhotos: boolean,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Register Cyrillic font
  const fontBase64 = await loadFontAsBase64();
  doc.addFileToVFS('Roboto-Regular.ttf', fontBase64);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.setFont('Roboto');

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

  // Pre-load and compress images if needed
  let imageMap: Map<number, string> = new Map();
  if (includePhotos) {
    const total = products.length;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const imgUrl = p.images?.[0];
      if (imgUrl) {
        const compressed = await loadAndCompressImage(imgUrl);
        if (compressed) imageMap.set(i, compressed);
      }
      onProgress?.(i + 1, total);
    }
  }

  // Build body
  const body = products.map((p) => {
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
      font: 'Roboto',
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [30, 30, 30],
      fontStyle: 'bold',
      fontSize: 7,
      font: 'Roboto',
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
