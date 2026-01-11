import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

// Template column headers (Russian)
export const EXCEL_TEMPLATE_HEADERS = [
  'Название*',
  'Описание',
  'Цена продажи*',
  'Закупочная цена',
  'Единица измерения',
  'Количество',
  'Артикул (SKU)',
  'Тип фасовки',
  'Вес единицы (кг)',
  'Вес порции (кг)',
  'Наценка (%)',
  'Наценка (₽)',
  'Старая цена',
  'Активен',
  'Фото (ссылки через ;)'
];

// Example row for template
const EXAMPLE_ROW = [
  'Сыр Голландский',
  'Твёрдый сыр высокого качества, выдержка 12 месяцев',
  450,
  300,
  'кг',
  100,
  'SYR-001',
  'head',
  2.5,
  0.25,
  20,
  '',
  500,
  'да',
  'https://example.com/photo1.jpg; https://example.com/photo2.jpg'
];

// Instructions row
const INSTRUCTIONS = [
  'Обязательное поле',
  'Опционально',
  'Обязательное поле (число)',
  'Опционально (число)',
  'кг/шт/л/уп/г/мл/м',
  'Опционально (число)',
  'Опционально',
  'head/package/piece/can/box/carcass',
  'Опционально (число)',
  'Опционально (число)',
  'Если указано - игнорируется наценка в рублях',
  'Используется если не указана % наценка',
  'Опционально (для показа скидки)',
  'да/нет (по умолчанию: да)',
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
    { wch: 15 }, // Цена продажи
    { wch: 15 }, // Закупочная цена
    { wch: 18 }, // Единица измерения
    { wch: 12 }, // Количество
    { wch: 15 }, // Артикул
    { wch: 15 }, // Тип фасовки
    { wch: 15 }, // Вес единицы
    { wch: 15 }, // Вес порции
    { wch: 12 }, // Наценка %
    { wch: 12 }, // Наценка ₽
    { wch: 12 }, // Старая цена
    { wch: 10 }, // Активен
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
}

export interface ExcelRow {
  'Название*'?: string;
  'Описание'?: string;
  'Цена продажи*'?: number | string;
  'Закупочная цена'?: number | string;
  'Единица измерения'?: string;
  'Количество'?: number | string;
  'Артикул (SKU)'?: string;
  'Тип фасовки'?: string;
  'Вес единицы (кг)'?: number | string;
  'Вес порции (кг)'?: number | string;
  'Наценка (%)'?: number | string;
  'Наценка (₽)'?: number | string;
  'Старая цена'?: number | string;
  'Активен'?: string;
  'Фото (ссылки через ;)'?: string;
}

/**
 * Parse Excel file and import products to database
 */
export async function importProductsFromExcel(
  file: File,
  storeId: string,
  onProgress: (progress: ImportProgress) => void
): Promise<void> {
  const progress: ImportProgress = {
    total: 0,
    current: 0,
    currentProduct: '',
    status: 'parsing',
    errors: [],
    successCount: 0
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

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      progress.current = i + 1;
      progress.currentProduct = row['Название*'] || `Строка ${i + 3}`;
      onProgress(progress);

      try {
        // Validate required fields
        const name = row['Название*']?.toString().trim();
        const price = parseFloat(row['Цена продажи*']?.toString() || '0');

        if (!name) {
          progress.errors.push(`Строка ${i + 3}: Отсутствует название товара`);
          continue;
        }

        if (isNaN(price) || price <= 0) {
          progress.errors.push(`Строка ${i + 3}: Некорректная цена "${row['Цена продажи*']}"`);
          continue;
        }

        // Parse optional fields
        const buyPrice = parseFloat(row['Закупочная цена']?.toString() || '0') || null;
        const quantity = parseFloat(row['Количество']?.toString() || '0') || 0;
        const markupPercent = parseFloat(row['Наценка (%)']?.toString() || '0') || null;
        const markupFixed = parseFloat(row['Наценка (₽)']?.toString() || '0') || null;
        const comparePrice = parseFloat(row['Старая цена']?.toString() || '0') || null;
        const unitWeight = parseFloat(row['Вес единицы (кг)']?.toString() || '0') || null;
        const portionWeight = parseFloat(row['Вес порции (кг)']?.toString() || '0') || null;
        const isActive = row['Активен']?.toString().toLowerCase() !== 'нет';

        // Determine markup type
        let markupType: string | null = null;
        let markupValue: number | null = null;
        if (markupPercent && markupPercent > 0) {
          markupType = 'percent';
          markupValue = markupPercent;
        } else if (markupFixed && markupFixed > 0) {
          markupType = 'fixed';
          markupValue = markupFixed;
        }

        // Create product in database (without images first)
        const { data: product, error: insertError } = await supabase
          .from('products')
          .insert({
            store_id: storeId,
            name,
            description: row['Описание']?.toString().trim() || null,
            price,
            buy_price: buyPrice,
            unit: mapUnit(row['Единица измерения']),
            quantity,
            sku: row['Артикул (SKU)']?.toString().trim() || null,
            packaging_type: mapPackagingType(row['Тип фасовки']),
            unit_weight: unitWeight,
            portion_weight: portionWeight,
            markup_type: markupType,
            markup_value: markupValue,
            compare_price: comparePrice,
            is_active: isActive,
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
          progress.status = 'uploading_images';
          onProgress(progress);

          const urls = photoUrls.split(';').map(u => u.trim()).filter(Boolean);
          const uploadedUrls: string[] = [];

          for (let j = 0; j < urls.length; j++) {
            const imageUrl = urls[j];
            if (!imageUrl.startsWith('http')) {
              progress.errors.push(`Строка ${i + 3}: Некорректная ссылка на фото "${imageUrl}"`);
              continue;
            }

            try {
              const { data: imageData, error: imageError } = await supabase.functions.invoke(
                'fetch-external-image',
                {
                  body: {
                    imageUrl,
                    productId: product.id,
                    imageIndex: j
                  }
                }
              );

              if (imageError) {
                console.error('Image fetch error:', imageError);
                progress.errors.push(`Строка ${i + 3}: Не удалось загрузить фото ${j + 1}`);
              } else if (imageData?.url) {
                uploadedUrls.push(imageData.url);
              }
            } catch (imgError) {
              console.error('Image processing error:', imgError);
              progress.errors.push(`Строка ${i + 3}: Ошибка обработки фото ${j + 1}`);
            }
          }

          // Update product with uploaded image URLs
          if (uploadedUrls.length > 0) {
            const { error: updateError } = await supabase
              .from('products')
              .update({ images: uploadedUrls })
              .eq('id', product.id);

            if (updateError) {
              console.error('Image update error:', updateError);
              progress.errors.push(`Строка ${i + 3}: Не удалось сохранить ссылки на фото`);
            }
          }

          progress.status = 'importing';
        }

        progress.successCount++;
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
