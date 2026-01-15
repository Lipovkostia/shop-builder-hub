import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export interface PriceListProduct {
  name: string;
  buyPrice: number;
  rawPrice: string;
}

export interface PriceListImportProgress {
  total: number;
  current: number;
  currentProduct: string;
  status: 'parsing' | 'processing' | 'complete' | 'error';
  matched: number;
  created: number;
  hidden: number;
  errors: string[];
}

export interface PriceListImportResult {
  success: boolean;
  matched: number;
  created: number;
  hidden: number;
  errors: string[];
}

export interface ExcelColumnInfo {
  index: number;
  header: string;
  sampleValues: string[];
}

export interface ExcelPreviewData {
  columns: ExcelColumnInfo[];
  rowCount: number;
  suggestedNameColumn: number | null;
  suggestedPriceColumn: number | null;
  rawData: unknown[][];
}

/**
 * Parse price string like "1,550.00" or "265.00" to number
 * Format: comma separates thousands, dot separates rubles from kopeks
 * We only care about the integer part (before the dot)
 */
function parsePrice(priceStr: string | number | undefined): number {
  if (priceStr === undefined || priceStr === null || priceStr === '') return 0;
  
  // If already a number, use it directly
  if (typeof priceStr === 'number') {
    return Math.floor(priceStr);
  }
  
  // Convert to string and clean up
  let str = String(priceStr).trim();
  
  // Remove any currency symbols
  str = str.replace(/[₽$€\s]/g, '');
  
  // Remove thousands separator (comma in this format)
  str = str.replace(/,/g, '');
  
  // Parse the number (this will handle the decimal point correctly)
  const num = parseFloat(str);
  
  if (isNaN(num)) return 0;
  
  // Return integer part only (ignore kopeks)
  return Math.floor(num);
}

/**
 * Generate slug from product name
 */
function generateSlug(name: string): string {
  const translitMap: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };

  return name
    .toLowerCase()
    .split('')
    .map(char => translitMap[char] || char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'product';
}

/**
 * Check if a row looks like a data row (has product name and price pattern)
 */
function isDataRow(row: unknown[], minNonEmpty: number = 2): boolean {
  if (!row) return false;
  
  let hasTextValue = false;
  let hasNumericValue = false;
  let nonEmptyCount = 0;
  
  for (const cell of row) {
    if (cell === undefined || cell === null || cell === '') continue;
    nonEmptyCount++;
    
    const str = String(cell).trim();
    
    // Check for numeric value (potential price) - patterns like "1 550,00" or "2500.00"
    if (/^\d[\d\s]*[,.]?\d*$/.test(str.replace(/\s/g, '')) && parseFloat(str.replace(/\s/g, '').replace(',', '.')) > 0) {
      hasNumericValue = true;
    }
    
    // Check for text value (potential product name) - at least 3 chars, contains letters
    if (str.length >= 3 && /[а-яА-Яa-zA-Z]/.test(str)) {
      // Exclude header-like values
      const lowerStr = str.toLowerCase();
      if (!lowerStr.includes('номенклатура') && 
          !lowerStr.includes('артикул') && 
          !lowerStr.includes('прайс') && 
          !lowerStr.includes('наименование') &&
          !lowerStr.includes('изображение') &&
          !lowerStr.includes('упаковка') &&
          !lowerStr.includes('rub') &&
          !lowerStr.includes('ндс') &&
          !lowerStr.includes('цена')) {
        hasTextValue = true;
      }
    }
  }
  
  return nonEmptyCount >= minNonEmpty && hasTextValue && hasNumericValue;
}

/**
 * Find the data start row by looking for the first row that has actual product data
 */
function findDataStartRow(data: unknown[][], maxRowsToCheck: number = 20): number {
  // Look for the first row that looks like actual data
  for (let i = 0; i < Math.min(maxRowsToCheck, data.length); i++) {
    if (isDataRow(data[i])) {
      return i;
    }
  }
  
  // Fallback: find first row with at least 2 non-empty cells
  for (let i = 0; i < Math.min(maxRowsToCheck, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const nonEmptyCells = row.filter(cell => cell !== undefined && cell !== null && cell !== '').length;
    if (nonEmptyCells >= 2) {
      return i;
    }
  }
  
  return 0;
}

/**
 * Preview Excel file - extract column info for user to map
 */
export async function previewPriceListExcel(file: File): Promise<ExcelPreviewData> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Get all data as array of arrays
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  
  // Find the first row with actual product data
  const dataStartRowIdx = findDataStartRow(data);
  
  console.log('[PriceList] Data starts at row:', dataStartRowIdx + 1);
  
  // Get first data row to extract column names from it
  const firstDataRow = data[dataStartRowIdx] || [];
  
  // Build column info with sample values from actual data rows
  const columns: ExcelColumnInfo[] = [];
  let suggestedNameColumn: number | null = null;
  let suggestedPriceColumn: number | null = null;
  
  // Find max column count
  let maxCols = 0;
  for (const row of data) {
    if (row && row.length > maxCols) maxCols = row.length;
  }
  
  for (let colIdx = 0; colIdx < maxCols; colIdx++) {
    // Get sample values from data rows
    const sampleValues: string[] = [];
    for (let rowIdx = dataStartRowIdx; rowIdx < Math.min(dataStartRowIdx + 5, data.length); rowIdx++) {
      const row = data[rowIdx];
      if (row && row[colIdx] !== undefined && row[colIdx] !== null && row[colIdx] !== '') {
        sampleValues.push(String(row[colIdx]));
      }
    }
    
    // Skip completely empty columns
    if (sampleValues.length === 0) continue;
    
    // Determine column header by looking at sample values pattern
    let header = `Колонка ${colIdx + 1}`;
    
    // Check if this looks like a name column (text values)
    const hasTextValues = sampleValues.some(v => {
      const str = String(v).trim();
      return str.length >= 3 && /[а-яА-Яa-zA-Z]/.test(str) && !/^\d+[,.\s]*\d*$/.test(str.replace(/\s/g, ''));
    });
    
    // Check if this looks like a price column (numeric values)
    const hasNumericValues = sampleValues.some(v => {
      const parsed = parsePrice(v);
      return parsed > 0 && parsed < 10000000;
    });
    
    if (hasTextValues && !hasNumericValues) {
      header = 'Название товара';
      if (suggestedNameColumn === null) {
        suggestedNameColumn = colIdx;
      }
    } else if (hasNumericValues && !hasTextValues) {
      header = 'Цена';
      if (suggestedPriceColumn === null) {
        suggestedPriceColumn = colIdx;
      }
    }
    
    columns.push({
      index: colIdx,
      header,
      sampleValues,
    });
  }
  
  // If no suggested columns found, try to detect by data pattern
  if (suggestedNameColumn === null || suggestedPriceColumn === null) {
    for (const col of columns) {
      // Check if column has price-like values
      const hasNumericValues = col.sampleValues.some(v => {
        const parsed = parsePrice(v);
        return parsed > 0 && parsed < 1000000;
      });
      
      // Check if column has text values (potential names)
      const hasTextValues = col.sampleValues.some(v => {
        const str = String(v).trim();
        return str.length > 5 && !/^\d+[,.]?\d*$/.test(str);
      });
      
      if (suggestedPriceColumn === null && hasNumericValues && !hasTextValues) {
        suggestedPriceColumn = col.index;
      }
      
      if (suggestedNameColumn === null && hasTextValues) {
        suggestedNameColumn = col.index;
      }
    }
  }
  
  // Count actual data rows (from data start)
  let rowCount = 0;
  for (let i = dataStartRowIdx; i < data.length; i++) {
    const row = data[i];
    if (row && row.some(cell => cell !== undefined && cell !== null && cell !== '')) {
      rowCount++;
    }
  }
  
  console.log('[PriceList] Preview:', { 
    columns: columns.length, 
    rowCount, 
    suggestedNameColumn, 
    suggestedPriceColumn 
  });
  
  return {
    columns,
    rowCount,
    suggestedNameColumn,
    suggestedPriceColumn,
    rawData: data,
  };
}

/**
 * Parse products from Excel using specified column mapping
 */
export function parseProductsWithMapping(
  previewData: ExcelPreviewData,
  nameColumnIdx: number,
  priceColumnIdx: number
): PriceListProduct[] {
  const products: PriceListProduct[] = [];
  const data = previewData.rawData;
  
  // Find first data row using the same logic as preview
  const dataStartRowIdx = findDataStartRow(data);
  
  // Parse data rows starting from data start
  for (let i = dataStartRowIdx; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    
    const nameRaw = row[nameColumnIdx];
    const priceRaw = row[priceColumnIdx];
    
    const name = String(nameRaw || '').trim();
    const price = parsePrice(priceRaw as string | number);
    
    // Skip rows without valid name or price
    if (!name || name.length < 2 || price <= 0) continue;
    
    // Skip header-like rows
    const nameLower = name.toLowerCase();
    if (nameLower.includes('номенклатура') || 
        nameLower.includes('артикул') ||
        nameLower.includes('название') ||
        nameLower.includes('наименование')) {
      continue;
    }
    
    products.push({
      name,
      buyPrice: price,
      rawPrice: String(priceRaw),
    });
  }
  
  console.log(`[PriceList] Parsed ${products.length} products with mapping`);
  return products;
}

/**
 * Import products from parsed list to catalog
 * 
 * Logic:
 * 1. If product name 100% matches - update only buy_price
 * 2. If no match - create new product with 0% markup
 * 3. Products NOT in the Excel file - set status to "hidden"
 */
export async function importProductsToCatalog(
  products: PriceListProduct[],
  storeId: string,
  catalogId: string,
  onProgress: (progress: PriceListImportProgress) => void
): Promise<PriceListImportResult> {
  const progress: PriceListImportProgress = {
    total: products.length,
    current: 0,
    currentProduct: '',
    status: 'processing',
    matched: 0,
    created: 0,
    hidden: 0,
    errors: []
  };
  
  onProgress(progress);
  
  try {
    if (products.length === 0) {
      progress.status = 'error';
      progress.errors.push('Не найдено товаров. Проверьте сопоставление колонок.');
      onProgress(progress);
      return {
        success: false,
        matched: 0,
        created: 0,
        hidden: 0,
        errors: progress.errors
      };
    }
    
    // Fetch existing products for the store
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, name, buy_price')
      .eq('store_id', storeId);
    
    if (fetchError) throw fetchError;
    
    // Create a map for quick lookup (lowercase name -> product)
    const productMap = new Map<string, { id: string; name: string; buy_price: number | null }>();
    existingProducts?.forEach(p => {
      productMap.set(p.name.toLowerCase().trim(), p);
    });
    
    // Track which products are in the Excel file
    const productsInExcel = new Set<string>();
    
    // Process each product
    for (let i = 0; i < products.length; i++) {
      const excelProduct = products[i];
      progress.current = i + 1;
      progress.currentProduct = excelProduct.name;
      onProgress(progress);
      
      const nameLower = excelProduct.name.toLowerCase().trim();
      const existingProduct = productMap.get(nameLower);
      
      if (existingProduct) {
        // 100% match found - update only buy_price
        productsInExcel.add(existingProduct.id);
        
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            buy_price: excelProduct.buyPrice,
            markup_type: 'percent',
            markup_value: 0
          })
          .eq('id', existingProduct.id);
        
        if (updateError) {
          progress.errors.push(`Ошибка обновления "${excelProduct.name}": ${updateError.message}`);
        } else {
          progress.matched++;
          
          // Ensure product is visible in this catalog
          await supabase
            .from('product_catalog_visibility')
            .upsert({
              product_id: existingProduct.id,
              catalog_id: catalogId
            }, { onConflict: 'product_id,catalog_id' });
          
          // Update status to in_stock in catalog settings
          await supabase
            .from('catalog_product_settings')
            .upsert({
              product_id: existingProduct.id,
              catalog_id: catalogId,
              status: 'in_stock',
              markup_type: 'percent',
              markup_value: 0
            }, { onConflict: 'product_id,catalog_id' });
        }
      } else {
        // No match - create new product
        const slug = generateSlug(excelProduct.name) + '-' + Date.now().toString(36);
        
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            store_id: storeId,
            name: excelProduct.name,
            slug: slug,
            price: excelProduct.buyPrice, // Set price same as buy price (0% markup)
            buy_price: excelProduct.buyPrice,
            markup_type: 'percent',
            markup_value: 0,
            is_active: true,
            quantity: 0,
            unit: 'кг'
          })
          .select('id')
          .single();
        
        if (createError) {
          progress.errors.push(`Ошибка создания "${excelProduct.name}": ${createError.message}`);
        } else if (newProduct) {
          progress.created++;
          productsInExcel.add(newProduct.id);
          
          // Add to catalog visibility
          await supabase
            .from('product_catalog_visibility')
            .insert({
              product_id: newProduct.id,
              catalog_id: catalogId
            });
          
          // Set catalog settings
          await supabase
            .from('catalog_product_settings')
            .insert({
              product_id: newProduct.id,
              catalog_id: catalogId,
              status: 'in_stock',
              markup_type: 'percent',
              markup_value: 0
            });
        }
      }
    }
    
    // Get all products currently visible in this catalog
    const { data: visibleInCatalog } = await supabase
      .from('product_catalog_visibility')
      .select('product_id')
      .eq('catalog_id', catalogId);
    
    // Hide products that are not in the Excel file
    if (visibleInCatalog) {
      for (const vis of visibleInCatalog) {
        if (!productsInExcel.has(vis.product_id)) {
          // This product was in catalog but not in Excel - hide it
          const { error: hideError } = await supabase
            .from('catalog_product_settings')
            .upsert({
              product_id: vis.product_id,
              catalog_id: catalogId,
              status: 'hidden'
            }, { onConflict: 'product_id,catalog_id' });
          
          if (!hideError) {
            progress.hidden++;
          }
        }
      }
    }
    
    progress.status = 'complete';
    onProgress(progress);
    
    return {
      success: true,
      matched: progress.matched,
      created: progress.created,
      hidden: progress.hidden,
      errors: progress.errors
    };
    
  } catch (error) {
    console.error('[PriceList] Import error:', error);
    progress.status = 'error';
    progress.errors.push(error instanceof Error ? error.message : 'Неизвестная ошибка');
    onProgress(progress);
    
    return {
      success: false,
      matched: progress.matched,
      created: progress.created,
      hidden: progress.hidden,
      errors: progress.errors
    };
  }
}
