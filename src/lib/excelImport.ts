import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

// Template column headers (Russian)
export const EXCEL_TEMPLATE_HEADERS = [
  'Номенклатура',
  'Название*',
  'Описание',
  'Закупочная цена',
  'Единица измерения',
  'Объём',
  'Тип фасовки',
  'Группа',
  'Фото (ссылки через ;)'
];

// Example row for template
const EXAMPLE_ROW = [
  'SYR-001',
  'Сыр Голландский',
  'Твёрдый сыр высокого качества, выдержка 12 месяцев',
  300,
  'кг',
  10,
  'head',
  'Молочные продукты',
  'https://example.com/photo1.jpg; https://example.com/photo2.jpg'
];

// Default instructions (will be dynamically updated for groups)
const DEFAULT_INSTRUCTIONS = [
  'Уникальный код товара (опционально)',
  'Обязательное поле',
  'Опционально',
  'Опционально (число)',
  'кг/шт/л/уп/г/мл/м',
  'Вес целого товара или кол-во в упаковке (цена × объём = цена за упаковку)',
  'head/package/piece/can/box/carcass',
  'Опционально. Если группы нет — она будет создана',
  'Несколько ссылок разделяйте через точку с запятой (;)'
];

/**
 * Generate and download Excel template file with dynamic group hints
 */
export async function downloadExcelTemplate(storeId: string): Promise<void> {
  // Fetch existing groups for this store
  const { data: groups } = await supabase
    .from('product_groups')
    .select('name')
    .eq('store_id', storeId)
    .order('sort_order');

  // Build dynamic instruction for groups column
  const groupNames = groups?.map(g => g.name).join(', ') || '';
  const groupInstruction = groupNames 
    ? `Существующие: ${groupNames}. Или введите новую`
    : 'Введите название группы. Если её нет — она будет создана';

  // Create dynamic instructions array
  const instructions = [...DEFAULT_INSTRUCTIONS];
  instructions[6] = groupInstruction;

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create data array with headers, instructions, and example
  const data = [
    EXCEL_TEMPLATE_HEADERS,
    instructions,
    EXAMPLE_ROW
  ];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // Номенклатура
    { wch: 25 }, // Название
    { wch: 40 }, // Описание
    { wch: 15 }, // Закупочная цена
    { wch: 18 }, // Единица измерения
    { wch: 12 }, // Объём
    { wch: 15 }, // Тип фасовки
    { wch: 30 }, // Группа
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
  'Номенклатура'?: string;
  'Название*'?: string;
  'Описание'?: string;
  'Закупочная цена'?: number | string;
  'Единица измерения'?: string;
  'Объём'?: number | string;
  'Тип фасовки'?: string;
  'Группа'?: string;
  'Фото (ссылки через ;)'?: string;
}

// Duplicate product info
export interface DuplicateProduct {
  excelRowIndex: number;
  excelName: string;
  excelSku?: string;
  excelRow: ExcelRow;
  existingProduct: {
    id: string;
    name: string;
    sku: string | null;
    description: string | null;
    buy_price: number | null;
    quantity: number;
  };
  shouldUpdate: boolean;
  matchedBy: 'sku' | 'name';
}

// Pre-import check result
export interface PreImportCheck {
  newProducts: { row: ExcelRow; rowIndex: number }[];
  duplicates: DuplicateProduct[];
  totalRows: number;
}

/**
 * Check for duplicate products before import
 * Priority: first match by SKU, then by name
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
  
  // Parse with header row (first row contains column names)
  const allRows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { 
    header: undefined, // use first row as headers
    defval: '',
    raw: false 
  });

  // Filter valid rows - check each row for valid product name
  const validRows: { row: ExcelRow; rowIndex: number }[] = [];
  allRows.forEach((row, index) => {
    const name = row['Название*'];
    // Skip if no name column or empty
    if (name === undefined || name === null) return;
    const nameStr = String(name).trim();
    // Skip empty names and instruction rows
    if (nameStr === '' || nameStr.startsWith('Обязательное') || nameStr === 'Название*') return;
    
    // index is 0-based from data rows (after header), so Excel row = index + 2
    validRows.push({ row, rowIndex: index + 2 });
  });

  if (validRows.length === 0) {
    return { newProducts: [], duplicates: [], totalRows: 0 };
  }

  // Get existing products from database (include sku)
  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, name, sku, description, buy_price, quantity')
    .eq('store_id', storeId)
    .is('deleted_at', null);

  // Create maps for quick lookup
  const skuMap = new Map<string, typeof existingProducts[0]>();
  const nameMap = new Map<string, typeof existingProducts[0]>();
  existingProducts?.forEach(p => {
    if (p.sku) skuMap.set(p.sku.toLowerCase(), p);
    nameMap.set(p.name.toLowerCase(), p);
  });

  // Find duplicates
  const duplicates: DuplicateProduct[] = [];
  const newProducts: { row: ExcelRow; rowIndex: number }[] = [];

  validRows.forEach(({ row, rowIndex }) => {
    const excelName = row['Название*']?.toString().trim() || '';
    const excelSku = row['Номенклатура']?.toString().trim() || '';
    
    // Priority: match by SKU first, then by name
    let existing: typeof existingProducts[0] | undefined;
    let matchedBy: 'sku' | 'name' = 'name';
    
    if (excelSku) {
      existing = skuMap.get(excelSku.toLowerCase());
      if (existing) matchedBy = 'sku';
    }
    
    if (!existing) {
      existing = nameMap.get(excelName.toLowerCase());
      matchedBy = 'name';
    }

    if (existing) {
      duplicates.push({
        excelRowIndex: rowIndex,
        excelName,
        excelSku,
        excelRow: row,
        existingProduct: existing,
        shouldUpdate: true,
        matchedBy,
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
/**
 * Get or create a product group, using cache for performance
 */
async function getOrCreateGroup(
  groupName: string,
  storeId: string,
  groupCache: Map<string, string>
): Promise<string | null> {
  if (!groupName || !groupName.trim()) return null;
  
  const normalizedName = groupName.trim();
  const normalizedLower = normalizedName.toLowerCase();
  
  // Check cache first
  if (groupCache.has(normalizedLower)) {
    return groupCache.get(normalizedLower)!;
  }
  
  // Create new group
  const { data, error } = await supabase
    .from('product_groups')
    .insert({
      store_id: storeId,
      name: normalizedName,
      sort_order: groupCache.size
    })
    .select('id')
    .single();
    
  if (error) {
    console.error('Error creating group:', error);
    return null;
  }
  
  // Add to cache
  groupCache.set(normalizedLower, data.id);
  return data.id;
}

/**
 * Assign product to group
 */
async function assignProductToGroup(productId: string, groupId: string): Promise<void> {
  // First remove existing assignments for this product
  await supabase
    .from('product_group_assignments')
    .delete()
    .eq('product_id', productId);

  // Then create new assignment
  const { error } = await supabase
    .from('product_group_assignments')
    .insert({
      product_id: productId,
      group_id: groupId
    });
    
  if (error) {
    console.error('Error assigning product to group:', error);
  }
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

    // Load existing groups for this store
    const { data: existingGroupsData } = await supabase
      .from('product_groups')
      .select('id, name')
      .eq('store_id', storeId);
    
    // Create group cache (name -> id)
    const groupCache = new Map<string, string>();
    existingGroupsData?.forEach(g => {
      groupCache.set(g.name.toLowerCase(), g.id);
    });

    // Create a map of duplicates to update for quick lookup (by sku and name)
    const duplicateMap = new Map<string, DuplicateProduct>();
    duplicatesToUpdate.forEach(d => {
      if (d.shouldUpdate) {
        if (d.excelSku) {
          duplicateMap.set(`sku:${d.excelSku.toLowerCase()}`, d);
        }
        duplicateMap.set(`name:${d.excelName.toLowerCase()}`, d);
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
        const sku = row['Номенклатура']?.toString().trim() || null;

        if (!name) {
          progress.errors.push(`Строка ${i + 3}: Отсутствует название товара`);
          continue;
        }

        // Parse optional fields
        const buyPrice = parseFloat(row['Закупочная цена']?.toString() || '0') || null;
        const unitWeight = parseFloat(row['Объём']?.toString() || '0') || null;

        // Check if this is a duplicate to update (by sku first, then by name)
        let duplicateInfo = sku ? duplicateMap.get(`sku:${sku.toLowerCase()}`) : undefined;
        if (!duplicateInfo) {
          duplicateInfo = duplicateMap.get(`name:${name.toLowerCase()}`);
        }

        if (duplicateInfo) {
          // UPDATE existing product (update name if matched by sku, update sku if provided)
          const updateData: any = {
            description: row['Описание']?.toString().trim() || null,
            buy_price: buyPrice,
            unit: mapUnit(row['Единица измерения']),
            unit_weight: unitWeight,
            packaging_type: mapPackagingType(row['Тип фасовки']),
            updated_at: new Date().toISOString()
          };
          
          // If matched by SKU, we can also update the name
          if (duplicateInfo.matchedBy === 'sku') {
            updateData.name = name;
          }
          
          // Update SKU if provided in Excel
          if (sku) {
            updateData.sku = sku;
          }
          
          const { error: updateError } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', duplicateInfo.existingProduct.id);

          if (updateError) {
            console.error('Update error:', updateError);
            progress.errors.push(`Строка ${i + 3}: Ошибка обновления товара - ${updateError.message}`);
            continue;
          }

          // Process group assignment
          const groupName = row['Группа']?.toString().trim();
          if (groupName) {
            const groupId = await getOrCreateGroup(groupName, storeId, groupCache);
            if (groupId) {
              await assignProductToGroup(duplicateInfo.existingProduct.id, groupId);
            }
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
          // Check if this is a duplicate that was skipped (by sku or name)
          const allDuplicateNames = duplicatesToUpdate.map(d => d.excelName.toLowerCase());
          const allDuplicateSkus = duplicatesToUpdate
            .filter(d => d.excelSku)
            .map(d => d.excelSku!.toLowerCase());
          
          if (allDuplicateNames.includes(name.toLowerCase()) || 
              (sku && allDuplicateSkus.includes(sku.toLowerCase()))) {
            // This duplicate was not selected for update, skip it
            continue;
          }

          // CREATE new product
          const { data: product, error: insertError } = await supabase
            .from('products')
            .insert({
              store_id: storeId,
              name,
              sku,
              description: row['Описание']?.toString().trim() || null,
              price: 0,
              buy_price: buyPrice,
              unit: mapUnit(row['Единица измерения']),
              quantity: 0,
              unit_weight: unitWeight,
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

          // Process group assignment
          const groupName = row['Группа']?.toString().trim();
          if (groupName && product) {
            const groupId = await getOrCreateGroup(groupName, storeId, groupCache);
            if (groupId) {
              await assignProductToGroup(product.id, groupId);
            }
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

/**
 * Export all products to Excel file in the same format as import template
 */
export async function exportProductsToExcel(
  storeId: string,
  products: { 
    id: string; 
    name: string;
    sku: string | null;
    description: string | null; 
    buy_price: number | null; 
    unit: string | null; 
    unit_weight: number | null; 
    packaging_type: string | null; 
    images: string[] | null;
  }[],
  getProductGroupIds: (productId: string) => string[]
): Promise<void> {
  // Fetch existing groups for this store
  const { data: groups } = await supabase
    .from('product_groups')
    .select('id, name')
    .eq('store_id', storeId);

  // Create map of group id -> name
  const groupMap = new Map<string, string>();
  groups?.forEach(g => groupMap.set(g.id, g.name));

  // Build data rows from products
  const rows = products.map(product => {
    // Get group name for this product
    const groupIds = getProductGroupIds(product.id);
    const groupName = groupIds.length > 0 
      ? groupMap.get(groupIds[0]) || '' 
      : '';

    return [
      product.sku || '',                              // Номенклатура
      product.name || '',                              // Название*
      product.description || '',                       // Описание
      product.buy_price ?? '',                         // Закупочная цена
      product.unit || 'шт',                           // Единица измерения
      product.unit_weight ?? '',                       // Объём
      product.packaging_type || '',                    // Тип фасовки
      groupName,                                       // Группа
      (product.images || []).join('; ')               // Фото (ссылки через ;)
    ];
  });

  // Create workbook with headers and data
  const wb = XLSX.utils.book_new();
  const data = [
    EXCEL_TEMPLATE_HEADERS,
    ...rows
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // Номенклатура
    { wch: 30 }, // Название
    { wch: 50 }, // Описание
    { wch: 15 }, // Закупочная цена
    { wch: 18 }, // Единица измерения
    { wch: 12 }, // Объём
    { wch: 15 }, // Тип фасовки
    { wch: 25 }, // Группа
    { wch: 60 }, // Фото
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Ассортимент');

  // Download file with date in name
  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `ассортимент_${date}.xlsx`);
}

// Status labels for export/import
const STATUS_LABELS: Record<string, string> = {
  'in_stock': 'В наличии',
  'out_of_stock': 'Нет в наличии',
  'on_order': 'Под заказ',
  'coming_soon': 'Ожидается',
  'pre_order': 'Под заказ',
  'hidden': 'Скрыт',
};

// Reverse status labels for import (Russian -> English)
const STATUS_LABELS_REVERSE: Record<string, string> = {
  'в наличии': 'in_stock',
  'нет в наличии': 'out_of_stock',
  'под заказ': 'pre_order',
  'ожидается': 'coming_soon',
  'скрыт': 'hidden',
  'in_stock': 'in_stock',
  'out_of_stock': 'out_of_stock',
  'pre_order': 'pre_order',
  'hidden': 'hidden',
};

// ============================================
// CATALOG IMPORT FUNCTIONALITY
// ============================================

// Template column headers for catalog import (Russian)
export const CATALOG_IMPORT_TEMPLATE_HEADERS = [
  'Номенклатура',
  'Название*',
  'Описание',
  'Категории',
  'Ед. изм.',
  'Объем',
  'Вид (тип фасовки)',
  'Себестоимость',
  'Наценка %',
  'Наценка руб',
  'Статус',
  'Цена ½ (₽/кг)',
  'Цена ¼ (₽/кг)',
  'Цена порции',
  'Группа',
  'Фото (ссылки через ;)'
];

// Instructions for catalog import template
const CATALOG_IMPORT_INSTRUCTIONS = [
  'Уникальный код товара',
  'Обязательное',
  'Опционально',
  'Через ; (Сыры; Твердые)',
  'кг/шт/л/уп/г/мл/м',
  'Вес/кол-во единицы',
  'head/package/piece/can/box/carcass',
  'Число',
  'Только % ИЛИ руб',
  'Только % ИЛИ руб',
  'in_stock/out_of_stock/pre_order/hidden',
  'Число или пусто',
  'Число или пусто',
  'Число или пусто',
  'Группа для ассортимента',
  'Несколько через ;'
];

// Example row for catalog import template
const CATALOG_IMPORT_EXAMPLE = [
  'SYR-001',
  'Сыр Голландский',
  'Твёрдый сыр высокого качества',
  'Сыры; Твёрдые сыры',
  'кг',
  10,
  'head',
  300,
  30,
  '',
  'in_stock',
  350,
  400,
  '',
  'Молочные продукты',
  'https://example.com/photo1.jpg'
];

export interface CatalogImportProgress {
  total: number;
  current: number;
  currentProduct: string;
  status: 'parsing' | 'checking' | 'importing' | 'uploading_images' | 'done' | 'error';
  errors: string[];
  successCount: number;
  addedToCatalogCount: number;
  updatedCount?: number;
}

export interface CatalogExcelRow {
  'Номенклатура'?: string;
  'Название*'?: string;
  'Описание'?: string;
  'Категории'?: string;
  'Ед. изм.'?: string;
  'Объем'?: number | string;
  'Вид (тип фасовки)'?: string;
  'Себестоимость'?: number | string;
  'Наценка %'?: number | string;
  'Наценка руб'?: number | string;
  'Статус'?: string;
  'Цена ½ (₽/кг)'?: number | string;
  'Цена ¼ (₽/кг)'?: number | string;
  'Цена порции'?: number | string;
  'Группа'?: string;
  'Фото (ссылки через ;)'?: string;
}

// Pre-import check for catalog import
export interface CatalogImportCheck {
  existingProducts: {
    row: CatalogExcelRow;
    rowIndex: number;
    productId: string;
    productName: string;
  }[];
  newProducts: {
    row: CatalogExcelRow;
    rowIndex: number;
    name: string;
    category?: string;
    description?: string;
  }[];
  errors: string[];
  totalRows: number;
}

/**
 * Check which products exist in the assortment before catalog import
 * Priority: match by SKU first, then by name
 */
export async function checkCatalogImportProducts(
  file: File,
  storeId: string
): Promise<CatalogImportCheck> {
  // Read Excel file
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const allRows: CatalogExcelRow[] = XLSX.utils.sheet_to_json(sheet, { range: 0 });
  
  // Filter out instruction row and empty rows
  const validRows: { row: CatalogExcelRow; rowIndex: number }[] = [];
  allRows.forEach((row, index) => {
    if (index === 1) return; // Skip instruction row
    const name = row['Название*'];
    if (!name || typeof name !== 'string') return;
    const nameStr = name.trim();
    if (nameStr === '' || nameStr.startsWith('Обязательное') || nameStr === 'Название*') return;
    
    // index is 0-based, Excel row = index + 2 (header + 1-indexed)
    validRows.push({ row, rowIndex: index + 2 });
  });

  if (validRows.length === 0) {
    return { existingProducts: [], newProducts: [], errors: [], totalRows: 0 };
  }

  // Get existing products from database (include sku)
  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, name, sku')
    .eq('store_id', storeId)
    .is('deleted_at', null);

  // Create maps for quick lookup
  const skuMap = new Map<string, { id: string; name: string }>();
  const nameMap = new Map<string, { id: string; name: string }>();
  existingProducts?.forEach(p => {
    if (p.sku) skuMap.set(p.sku.toLowerCase(), { id: p.id, name: p.name });
    nameMap.set(p.name.toLowerCase(), { id: p.id, name: p.name });
  });

  // Categorize rows
  const result: CatalogImportCheck = {
    existingProducts: [],
    newProducts: [],
    errors: [],
    totalRows: validRows.length
  };

  validRows.forEach(({ row, rowIndex }) => {
    const name = row['Название*']?.toString().trim();
    const sku = row['Номенклатура']?.toString().trim();
    
    if (!name) {
      result.errors.push(`Строка ${rowIndex}: Отсутствует название товара`);
      return;
    }

    // Priority: match by SKU first, then by name
    let existing: { id: string; name: string } | undefined;
    
    if (sku) {
      existing = skuMap.get(sku.toLowerCase());
    }
    
    if (!existing) {
      existing = nameMap.get(name.toLowerCase());
    }
    
    if (existing) {
      result.existingProducts.push({
        row,
        rowIndex,
        productId: existing.id,
        productName: existing.name
      });
    } else {
      result.newProducts.push({
        row,
        rowIndex,
        name,
        category: row['Категории']?.toString().trim(),
        description: row['Описание']?.toString().trim()
      });
    }
  });

  return result;
}

/**
 * Download catalog import template with catalog-specific fields
 */
export async function downloadCatalogImportTemplate(storeId: string, catalogId: string): Promise<void> {
  // Fetch existing groups for this store
  const { data: groups } = await supabase
    .from('product_groups')
    .select('name')
    .eq('store_id', storeId)
    .order('sort_order');

  // Fetch existing categories for this store
  const { data: categories } = await supabase
    .from('categories')
    .select('name')
    .eq('store_id', storeId)
    .order('sort_order');

  // Build dynamic instructions
  const instructions = [...CATALOG_IMPORT_INSTRUCTIONS];
  
  // Update categories hint
  const categoryNames = categories?.map(c => c.name).join(', ') || '';
  if (categoryNames) {
    instructions[2] = `Существующие: ${categoryNames.slice(0, 50)}...`;
  }
  
  // Update groups hint
  const groupNames = groups?.map(g => g.name).join(', ') || '';
  if (groupNames) {
    instructions[13] = `Существующие: ${groupNames.slice(0, 50)}...`;
  }

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create data array with headers, instructions, and example
  const data = [
    CATALOG_IMPORT_TEMPLATE_HEADERS,
    instructions,
    CATALOG_IMPORT_EXAMPLE
  ];

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // Номенклатура
    { wch: 25 }, // Название
    { wch: 35 }, // Описание
    { wch: 25 }, // Категории
    { wch: 12 }, // Ед. изм.
    { wch: 10 }, // Объем
    { wch: 18 }, // Тип фасовки
    { wch: 14 }, // Себестоимость
    { wch: 12 }, // Наценка %
    { wch: 14 }, // Наценка руб
    { wch: 15 }, // Статус
    { wch: 14 }, // Цена ½
    { wch: 14 }, // Цена ¼
    { wch: 14 }, // Цена порции
    { wch: 25 }, // Группа
    { wch: 50 }, // Фото
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Импорт в прайс-лист');

  // Generate and download file
  XLSX.writeFile(wb, 'шаблон_импорта_в_прайс_лист.xlsx');
}

/**
 * Parse categories string into array
 */
function parseCategories(categoriesStr: string | undefined): string[] {
  if (!categoriesStr) return [];
  return categoriesStr
    .split(';')
    .map(c => c.trim())
    .filter(Boolean);
}

/**
 * Parse status string to valid status value
 */
function parseStatus(statusStr: string | undefined): string {
  if (!statusStr) return 'in_stock';
  const normalized = statusStr.toLowerCase().trim();
  return STATUS_LABELS_REVERSE[normalized] || 'in_stock';
}

/**
 * New product to create during catalog import
 */
export interface NewProductToCreate {
  rowIndex: number;
  name: string;
}

/**
 * Import products to catalog from Excel file
 * @param newProductsToCreate - List of new products that user approved to create. If empty, only existing products will be updated.
 */
export async function importProductsToCatalog(
  file: File,
  storeId: string,
  catalogId: string,
  onProgress: (progress: CatalogImportProgress) => void,
  newProductsToCreate: NewProductToCreate[] = []
): Promise<void> {
  const progress: CatalogImportProgress = {
    total: 0,
    current: 0,
    currentProduct: '',
    status: 'parsing',
    errors: [],
    successCount: 0,
    addedToCatalogCount: 0,
    updatedCount: 0
  };

  // Create set of approved new product row indices for quick lookup
  const approvedNewProductRows = new Set(newProductsToCreate.map(p => p.rowIndex));

  try {
    onProgress(progress);

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const allRows: CatalogExcelRow[] = XLSX.utils.sheet_to_json(sheet, { range: 0 });
    
    // Filter out instruction row and empty rows, track original indices
    const rows: { row: CatalogExcelRow; originalIndex: number }[] = [];
    allRows.forEach((row, index) => {
      if (index === 1) return; // Skip instruction row
      const name = row['Название*'];
      if (!name || typeof name !== 'string') return;
      const nameStr = name.trim();
      if (nameStr === '' || nameStr.startsWith('Обязательное') || nameStr === 'Название*') return;
      
      // Excel row = index + 2 (header + 1-indexed)
      rows.push({ row, originalIndex: index + 2 });
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

    // Load existing products for this store
    const { data: existingProducts } = await supabase
      .from('products')
      .select('id, name')
      .eq('store_id', storeId);

    // Create map for quick lookup
    const productMap = new Map<string, string>();
    existingProducts?.forEach(p => {
      productMap.set(p.name.toLowerCase(), p.id);
    });

    // Load existing groups
    const { data: existingGroupsData } = await supabase
      .from('product_groups')
      .select('id, name')
      .eq('store_id', storeId);
    
    const groupCache = new Map<string, string>();
    existingGroupsData?.forEach(g => {
      groupCache.set(g.name.toLowerCase(), g.id);
    });

    // Load existing categories
    const { data: existingCategoriesData } = await supabase
      .from('categories')
      .select('id, name')
      .eq('store_id', storeId);
    
    const categoryCache = new Map<string, string>();
    existingCategoriesData?.forEach(c => {
      categoryCache.set(c.name.toLowerCase(), c.id);
    });

    // Check existing catalog visibility
    const { data: existingVisibility } = await supabase
      .from('product_catalog_visibility')
      .select('product_id')
      .eq('catalog_id', catalogId);

    const visibleProducts = new Set(existingVisibility?.map(v => v.product_id) || []);

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const { row, originalIndex } = rows[i];
      progress.current = i + 1;
      progress.currentProduct = row['Название*'] || `Строка ${originalIndex}`;
      onProgress(progress);

      try {
        const name = row['Название*']?.toString().trim();
        if (!name) {
          progress.errors.push(`Строка ${originalIndex}: Отсутствует название товара`);
          continue;
        }

        // Parse fields
        const buyPrice = parseFloat(row['Себестоимость']?.toString() || '0') || null;
        const unitWeight = parseFloat(row['Объем']?.toString() || '0') || null;
        const markupPercent = parseFloat(row['Наценка %']?.toString() || '0') || null;
        const markupFixed = parseFloat(row['Наценка руб']?.toString() || '0') || null;
        const priceHalf = parseFloat(row['Цена ½ (₽/кг)']?.toString() || '0') || null;
        const priceQuarter = parseFloat(row['Цена ¼ (₽/кг)']?.toString() || '0') || null;
        const pricePortion = parseFloat(row['Цена порции']?.toString() || '0') || null;
        const status = parseStatus(row['Статус']);
        const categories = parseCategories(row['Категории']);

        let productId = productMap.get(name.toLowerCase());
        const isNewProduct = !productId;

        if (isNewProduct) {
          // Check if this new product was approved by user
          if (!approvedNewProductRows.has(originalIndex)) {
            // User did not approve this new product, skip it
            console.log(`[Import] Пропускаем новый товар "${name}" (строка ${originalIndex}) - не одобрен пользователем`);
            continue;
          }

          // Create new product (approved by user)
          const { data: product, error: insertError } = await supabase
            .from('products')
            .insert({
              store_id: storeId,
              name,
              description: row['Описание']?.toString().trim() || null,
              price: 0,
              buy_price: buyPrice,
              unit: mapUnit(row['Ед. изм.']),
              quantity: 0,
              unit_weight: unitWeight,
              packaging_type: mapPackagingType(row['Вид (тип фасовки)']),
              is_active: true,
              slug: generateSlug(name),
              source: 'excel_catalog'
            })
            .select()
            .single();

          if (insertError) {
            console.error('Insert error:', insertError);
            progress.errors.push(`Строка ${originalIndex}: Ошибка создания товара - ${insertError.message}`);
            continue;
          }

          productId = product.id;
          productMap.set(name.toLowerCase(), productId);
          progress.successCount++;

          // Process group assignment
          const groupName = row['Группа']?.toString().trim();
          if (groupName) {
            const groupId = await getOrCreateGroup(groupName, storeId, groupCache);
            if (groupId) {
              await assignProductToGroup(productId, groupId);
            }
          }

          // Process images if provided
          const photoUrls = row['Фото (ссылки через ;)']?.toString().trim();
          if (photoUrls) {
            await processProductImages(photoUrls, productId, i, progress as unknown as ImportProgress, onProgress as unknown as (p: ImportProgress) => void);
          }
        } else {
          // Update existing product's base fields if needed
          if (buyPrice !== null || unitWeight !== null) {
            await supabase
              .from('products')
              .update({
                buy_price: buyPrice ?? undefined,
                unit_weight: unitWeight ?? undefined,
                unit: mapUnit(row['Ед. изм.']),
                packaging_type: mapPackagingType(row['Вид (тип фасовки)']),
                updated_at: new Date().toISOString()
              })
              .eq('id', productId);
          }
          progress.updatedCount = (progress.updatedCount || 0) + 1;
        }

        // Add to catalog if not already there
        if (!visibleProducts.has(productId)) {
          const { error: visibilityError } = await supabase
            .from('product_catalog_visibility')
            .insert({
              product_id: productId,
              catalog_id: catalogId
            });

          if (visibilityError && !visibilityError.message.includes('duplicate')) {
            console.error('Visibility error:', visibilityError);
          } else {
            visibleProducts.add(productId);
            progress.addedToCatalogCount++;
          }
        }

        // Create/update catalog product settings
        const portionPrices: Record<string, number> = {};
        if (priceHalf !== null) portionPrices.half = priceHalf;
        if (priceQuarter !== null) portionPrices.quarter = priceQuarter;
        if (pricePortion !== null) portionPrices.portion = pricePortion;

        // Resolve category names to IDs
        const categoryIds: string[] = [];
        console.log(`[Import] Товар "${name}" - категории из Excel:`, categories);
        
        for (const catName of categories) {
          let catId = categoryCache.get(catName.toLowerCase());
          console.log(`[Import] Категория "${catName}" - найдена в кеше: ${catId ? 'да' : 'нет'}`);
          
          if (!catId) {
            // Create new category
            console.log(`[Import] Создаём новую категорию "${catName}"...`);
            const { data: newCat, error: catError } = await supabase
              .from('categories')
              .insert({
                store_id: storeId,
                name: catName,
                slug: generateSlug(catName)
              })
              .select('id')
              .single();
            
            if (catError) {
              console.error(`[Import] Ошибка создания категории "${catName}":`, catError);
            } else if (newCat) {
              catId = newCat.id;
              categoryCache.set(catName.toLowerCase(), catId);
              console.log(`[Import] ✅ Категория "${catName}" создана с id: ${catId}`);
            }
          }
          if (catId) categoryIds.push(catId);
        }
        
        console.log(`[Import] Итого categoryIds для товара "${name}":`, categoryIds);

        // Upsert catalog product settings
        const settingsPayload: any = {
          catalog_id: catalogId,
          product_id: productId,
          status,
          categories: categoryIds.length > 0 ? categoryIds : null,
          updated_at: new Date().toISOString()
        };

        if (markupPercent !== null && markupPercent > 0) {
          settingsPayload.markup_type = 'percent';
          settingsPayload.markup_value = markupPercent;
        } else if (markupFixed !== null && markupFixed > 0) {
          settingsPayload.markup_type = 'fixed';
          settingsPayload.markup_value = markupFixed;
        }

        if (Object.keys(portionPrices).length > 0) {
          settingsPayload.portion_prices = portionPrices;
        }

        console.log(`[Import] Сохраняем настройки для "${name}":`, settingsPayload);

        const { error: settingsError } = await supabase
          .from('catalog_product_settings')
          .upsert(settingsPayload, {
            onConflict: 'catalog_id,product_id'
          });

        if (settingsError) {
          console.error(`[Import] ❌ Ошибка сохранения настроек для "${name}":`, settingsError);
          progress.errors.push(`Строка ${i + 3}: Ошибка сохранения настроек - ${settingsError.message}`);
        } else {
          console.log(`[Import] ✅ Настройки сохранены для "${name}"`);
        }

      } catch (rowError) {
        console.error(`Error processing row ${i + 3}:`, rowError);
        progress.errors.push(`Строка ${i + 3}: ${rowError instanceof Error ? rowError.message : 'Неизвестная ошибка'}`);
      }
    }

    progress.status = 'done';
    onProgress(progress);
  } catch (error) {
    console.error('Catalog import error:', error);
    progress.status = 'error';
    progress.errors.push(error instanceof Error ? error.message : 'Ошибка чтения файла');
    onProgress(progress);
  }
}

// Catalog export product interface
export interface CatalogExportProduct {
  name: string;
  description: string | null;
  categories: string[] | null;
  unit: string | null;
  unitWeight: number | null;
  packagingType: string | null;
  buyPrice: number | null;
  markup: string;
  price: number;
  priceFull: number | null;
  priceHalf: number | null;
  priceQuarter: number | null;
  pricePortion: number | null;
  status: string;
  images: string[] | null;
}

/**
 * Export catalog products to Excel file with selected columns
 */
export function exportCatalogToExcel(
  catalogName: string,
  products: CatalogExportProduct[],
  enabledColumns: string[]
): void {
  // Define column mappings
  const columnMappings: { id: string; header: string; getValue: (p: CatalogExportProduct) => string | number }[] = [
    { id: 'photo', header: 'Фото', getValue: p => (p.images || []).join('; ') },
    { id: 'name', header: 'Название', getValue: p => p.name || '' },
    { id: 'description', header: 'Описание', getValue: p => p.description || '' },
    { id: 'categories', header: 'Категории', getValue: p => (p.categories || []).join(', ') },
    { id: 'unit', header: 'Ед. изм.', getValue: p => p.unit || '' },
    { id: 'volume', header: 'Объем', getValue: p => p.unitWeight ?? '' },
    { id: 'type', header: 'Вид (тип фасовки)', getValue: p => p.packagingType || '' },
    { id: 'buyPrice', header: 'Себестоимость', getValue: p => p.buyPrice ?? '' },
    { id: 'markup', header: 'Наценка', getValue: p => p.markup || '' },
    { id: 'price', header: 'Цена', getValue: p => p.price ?? '' },
    { id: 'priceFull', header: 'Целая', getValue: p => p.priceFull ?? '' },
    { id: 'priceHalf', header: '½', getValue: p => p.priceHalf ?? '' },
    { id: 'priceQuarter', header: '¼', getValue: p => p.priceQuarter ?? '' },
    { id: 'pricePortion', header: 'Порция', getValue: p => p.pricePortion ?? '' },
    { id: 'status', header: 'Статус', getValue: p => STATUS_LABELS[p.status] || p.status || '' },
  ];

  // Filter to only enabled columns
  const activeColumns = columnMappings.filter(col => enabledColumns.includes(col.id));

  // Build headers
  const headers = activeColumns.map(col => col.header);

  // Build data rows
  const rows = products.map(product => 
    activeColumns.map(col => col.getValue(product))
  );

  // Create workbook
  const wb = XLSX.utils.book_new();
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Set column widths based on content
  ws['!cols'] = activeColumns.map(col => {
    switch (col.id) {
      case 'photo': return { wch: 60 };
      case 'name': return { wch: 30 };
      case 'description': return { wch: 50 };
      case 'categories': return { wch: 30 };
      default: return { wch: 15 };
    }
  });

  // Sanitize catalog name for filename
  const safeCatalogName = catalogName.replace(/[^a-zA-Zа-яА-Я0-9\s-]/g, '').trim() || 'прайс-лист';
  const date = new Date().toISOString().split('T')[0];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Прайс-лист');
  XLSX.writeFile(wb, `${safeCatalogName}_${date}.xlsx`);
}
