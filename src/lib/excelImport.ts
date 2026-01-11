import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

// Template column headers (Russian)
export const EXCEL_TEMPLATE_HEADERS = [
  'Название*',
  'Описание',
  'Закупочная цена',
  'Единица измерения',
  'Количество',
  'Тип фасовки',
  'Фото (ссылки через ;)'
];

// Example row for template
const EXAMPLE_ROW = [
  'Сыр Голландский',
  'Твёрдый сыр высокого качества, выдержка 12 месяцев',
  300,
  'кг',
  100,
  'head',
  'https://example.com/photo1.jpg; https://example.com/photo2.jpg'
];

// Instructions row
const INSTRUCTIONS = [
  'Обязательное поле',
  'Опционально',
  'Опционально (число)',
  'кг/шт/л/уп/г/мл/м',
  'Опционально (число)',
  'head/package/piece/can/box/carcass',
  'Несколько ссылок разделяйте через точку с запятой (;)'
];

/**
 * Generate and download Excel template file
 */
export function downloadExcelTemplate(): void {
  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create data array with headers, instructions, and example
  const data = [
    EXCEL_TEMPLATE_HEADERS,
    INSTRUCTIONS,
    EXAMPLE_ROW
  ];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, // Название
    { wch: 40 }, // Описание
    { wch: 15 }, // Закупочная цена
    { wch: 18 }, // Единица измерения
    { wch: 12 }, // Количество
    { wch: 15 }, // Тип фасовки
    { wch: 50 }, // Фото
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Товары');

  // Generate and download file
  XLSX.writeFile(wb, 'шаблон_импорта_товаров.xlsx');
}

/**
 * Generate a URL-safe slug from product name
 */
function generateSlug(name: string): string {
  const translitMap: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', ' ': '-'
  };

  return name
    .toLowerCase()
    .split('')
    .map(char => translitMap[char] || char)
    .join('')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
}

/**
 * Map unit string to database format
 */
function mapUnit(unit: string | undefined): string {
  if (!unit) return 'шт';
  const unitLower = unit.toLowerCase().trim();
  const validUnits = ['кг', 'шт', 'л', 'уп', 'г', 'мл', 'м'];
  return validUnits.includes(unitLower) ? unitLower : 'шт';
}

/**
 * Map packaging type string to database format
 */
function mapPackagingType(type: string | undefined): string | null {
  if (!type) return null;
  const typeLower = type.toLowerCase().trim();
  const validTypes = ['head', 'package', 'piece', 'can', 'box', 'carcass'];
  return validTypes.includes(typeLower) ? typeLower : null;
}

export interface ImportProgress {
  total: number;
  current: number;
  currentProduct: string;
  status: 'parsing' | 'importing' | 'uploading_images' | 'done' | 'error';
  errors: string[];
  successCount: number;
  updatedCount?: number;
}

export interface ExcelRow {
  'Название*'?: string;
  'Описание'?: string;
  'Закупочная цена'?: number | string;
  'Единица измерения'?: string;
  'Количество'?: number | string;
  'Тип фасовки'?: string;
  'Фото (ссылки через ;)'?: string;
}

// Duplicate product info
export interface DuplicateProduct {
  excelRowIndex: number;
  excelName: string;
  excelRow: ExcelRow;
  existingProduct: {
    id: string;
    name: string;
    description: string | null;
    buy_price: number | null;
    quantity: number;
  };
  shouldUpdate: boolean;
}

// Pre-import check result
export interface PreImportCheck {
  newProducts: { row: ExcelRow; rowIndex: number }[];
  duplicates: DuplicateProduct[];
  totalRows: number;
}

/**
 * Check for duplicate products before import
 */
export async function checkForDuplicates(
  file: File,
  storeId: string
): Promise<PreImportCheck> {
  // Read Excel file
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const allRows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { range: 0 });

  // Filter valid rows (skip instruction row and empty rows)
  const validRows: { row: ExcelRow; rowIndex: number }[] = [];
  allRows.forEach((row, index) => {
    // Skip instruction row (second row)
    if (index === 1) return;
    const name = row['Название*'];
    if (name && typeof name === 'string' && name.trim() !== '' && !name.startsWith('Обязательное')) {
      validRows.push({ row, rowIndex: index + 2 }); // +2 for Excel 1-based and header
    }
  });

  if (validRows.length === 0) {
    return { newProducts: [], duplicates: [], totalRows: 0 };
  }

  // Get existing products from database
  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, name, description, buy_price, quantity')
    .eq('store_id', storeId);

  // Find duplicates
  const duplicates: DuplicateProduct[] = [];
  const newProducts: { row: ExcelRow; rowIndex: number }[] = [];

  validRows.forEach(({ row, rowIndex }) => {
    const excelName = row['Название*']?.toString().trim() || '';
    const existing = existingProducts?.find(
      p => p.name.toLowerCase() === excelName.toLowerCase()
    );

    if (existing) {
      duplicates.push({
        excelRowIndex: rowIndex,
        excelName,
        excelRow: row,
        existingProduct: existing,
        shouldUpdate: true,
      });
    } else {
      newProducts.push({ row, rowIndex });
    }
  });

  return { newProducts, duplicates, totalRows: validRows.length };
}

/**
 * Parse Excel file and import products to database
 */
export async function importProductsFromExcel(
  file: File,
  storeId: string,
  onProgress: (progress: ImportProgress) => void,
  duplicatesToUpdate: DuplicateProduct[] = []
): Promise<void> {
  const progress: ImportProgress = {
    total: 0,
    current: 0,
    currentProduct: '',
    status: 'parsing',
    errors: [],
    successCount: 0,
    updatedCount: 0
  };

  try {
    onProgress(progress);

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON, starting from row 3 (skip headers and instructions)
    const allRows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { range: 0 });
    
    // Filter out instruction row and empty rows
    const rows = allRows.filter((row, index) => {
      // Skip instruction row (second row)
      if (index === 1) return false;
      // Skip empty rows
      const name = row['Название*'];
      return name && typeof name === 'string' && name.trim() !== '' && !name.startsWith('Обязательное');
    });

    progress.total = rows.length;
    progress.status = 'importing';
    onProgress(progress);

    if (rows.length === 0) {
      progress.status = 'error';
      progress.errors.push('Файл не содержит товаров для импорта');
      onProgress(progress);
      return;
    }

    // Create a map of duplicates to update for quick lookup
    const duplicateMap = new Map<string, DuplicateProduct>();
    duplicatesToUpdate.forEach(d => {
      if (d.shouldUpdate) {
        duplicateMap.set(d.excelName.toLowerCase(), d);
      }
    });

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      progress.current = i + 1;
      progress.currentProduct = row['Название*'] || `Строка ${i + 3}`;
      onProgress(progress);

      try {
        // Validate required fields
        const name = row['Название*']?.toString().trim();

        if (!name) {
          progress.errors.push(`Строка ${i + 3}: Отсутствует название товара`);
          continue;
        }

        // Parse optional fields
        const buyPrice = parseFloat(row['Закупочная цена']?.toString() || '0') || null;
        const quantity = parseFloat(row['Количество']?.toString() || '0') || 0;

        // Check if this is a duplicate to update
        const duplicateInfo = duplicateMap.get(name.toLowerCase());

        if (duplicateInfo) {
          // UPDATE existing product
          const { error: updateError } = await supabase
            .from('products')
            .update({
              description: row['Описание']?.toString().trim() || null,
              buy_price: buyPrice,
              unit: mapUnit(row['Единица измерения']),
              quantity,
              packaging_type: mapPackagingType(row['Тип фасовки']),
              updated_at: new Date().toISOString()
            })
            .eq('id', duplicateInfo.existingProduct.id);

          if (updateError) {
            console.error('Update error:', updateError);
            progress.errors.push(`Строка ${i + 3}: Ошибка обновления товара - ${updateError.message}`);
            continue;
          }

          // Process images if provided
          const photoUrls = row['Фото (ссылки через ;)']?.toString().trim();
          if (photoUrls) {
            await processProductImages(
              photoUrls, 
              duplicateInfo.existingProduct.id, 
              i, 
              progress, 
              onProgress
            );
          }

          progress.updatedCount = (progress.updatedCount || 0) + 1;
        } else {
          // Check if this is a duplicate that was skipped
          const allDuplicates = duplicatesToUpdate.map(d => d.excelName.toLowerCase());
          if (allDuplicates.includes(name.toLowerCase())) {
            // This duplicate was not selected for update, skip it
            continue;
          }

          // CREATE new product
          const { data: product, error: insertError } = await supabase
            .from('products')
            .insert({
              store_id: storeId,
              name,
              description: row['Описание']?.toString().trim() || null,
              price: 0,
              buy_price: buyPrice,
              unit: mapUnit(row['Единица измерения']),
              quantity,
              packaging_type: mapPackagingType(row['Тип фасовки']),
              markup_type: null,
              markup_value: null,
              is_active: true,
              slug: generateSlug(name),
              source: 'excel'
            })
            .select()
            .single();

          if (insertError) {
            console.error('Insert error:', insertError);
            progress.errors.push(`Строка ${i + 3}: Ошибка создания товара - ${insertError.message}`);
            continue;
          }

          // Process images if provided
          const photoUrls = row['Фото (ссылки через ;)']?.toString().trim();
          if (photoUrls && product) {
            await processProductImages(photoUrls, product.id, i, progress, onProgress);
          }

          progress.successCount++;
        }
      } catch (rowError) {
        console.error(`Error processing row ${i + 3}:`, rowError);
        progress.errors.push(`Строка ${i + 3}: ${rowError instanceof Error ? rowError.message : 'Неизвестная ошибка'}`);
      }
    }

    progress.status = 'done';
    onProgress(progress);
  } catch (error) {
    console.error('Excel import error:', error);
    progress.status = 'error';
    progress.errors.push(error instanceof Error ? error.message : 'Ошибка чтения файла');
    onProgress(progress);
  }
}

/**
 * Process and upload product images
 */
async function processProductImages(
  photoUrls: string,
  productId: string,
  rowIndex: number,
  progress: ImportProgress,
  onProgress: (progress: ImportProgress) => void
): Promise<void> {
  progress.status = 'uploading_images';
  onProgress(progress);

  const urls = photoUrls.split(';').map(u => u.trim()).filter(Boolean);
  const uploadedUrls: string[] = [];

  for (let j = 0; j < urls.length; j++) {
    const imageUrl = urls[j];
    if (!imageUrl.startsWith('http')) {
      progress.errors.push(`Строка ${rowIndex + 3}: Некорректная ссылка на фото "${imageUrl}"`);
      continue;
    }

    try {
      const { data: imageData, error: imageError } = await supabase.functions.invoke(
        'fetch-external-image',
        {
          body: {
            imageUrl,
            productId,
            imageIndex: j
          }
        }
      );

      if (imageError) {
        console.error('Image fetch error:', imageError);
        progress.errors.push(`Строка ${rowIndex + 3}: Не удалось загрузить фото ${j + 1}`);
      } else if (imageData?.url) {
        uploadedUrls.push(imageData.url);
      }
    } catch (imgError) {
      console.error('Image processing error:', imgError);
      progress.errors.push(`Строка ${rowIndex + 3}: Ошибка обработки фото ${j + 1}`);
    }
  }

  // Update product with uploaded image URLs
  if (uploadedUrls.length > 0) {
    const { error: updateError } = await supabase
      .from('products')
      .update({ images: uploadedUrls })
      .eq('id', productId);

    if (updateError) {
      console.error('Image update error:', updateError);
      progress.errors.push(`Строка ${rowIndex + 3}: Не удалось сохранить ссылки на фото`);
    }
  }

  progress.status = 'importing';
}
