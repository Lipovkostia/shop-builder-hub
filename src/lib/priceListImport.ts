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
 * Preview Excel file - extract column info for user to map
 */
export async function previewPriceListExcel(file: File): Promise<ExcelPreviewData> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Get all data as array of arrays
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  
  // Find the first row with meaningful data (likely header)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const nonEmptyCells = row.filter(cell => cell !== undefined && cell !== null && cell !== '').length;
    if (nonEmptyCells >= 2) {
      headerRowIdx = i;
      break;
    }
  }
  
  const headerRow = data[headerRowIdx] || [];
  
  // Build column info with sample values
  const columns: ExcelColumnInfo[] = [];
  let suggestedNameColumn: number | null = null;
  let suggestedPriceColumn: number | null = null;
  
  // Find max column count
  let maxCols = 0;
  for (const row of data) {
    if (row && row.length > maxCols) maxCols = row.length;
  }
  
  for (let colIdx = 0; colIdx < maxCols; colIdx++) {
    const header = String(headerRow[colIdx] || '').trim();
    
    // Get sample values from next 5 rows after header
    const sampleValues: string[] = [];
    for (let rowIdx = headerRowIdx + 1; rowIdx < Math.min(headerRowIdx + 6, data.length); rowIdx++) {
      const row = data[rowIdx];
      if (row && row[colIdx] !== undefined && row[colIdx] !== null && row[colIdx] !== '') {
        sampleValues.push(String(row[colIdx]));
      }
    }
    
    // Skip completely empty columns
    if (!header && sampleValues.length === 0) continue;
    
    columns.push({
      index: colIdx,
      header: header || `Колонка ${colIdx + 1}`,
      sampleValues,
    });
    
    // Try to auto-detect name column
    const headerLower = header.toLowerCase();
    if (headerLower.includes('номенклатура') || headerLower.includes('название') || headerLower.includes('наименование')) {
      suggestedNameColumn = colIdx;
    }
    
    // Try to auto-detect price column
    if (headerLower.includes('прайс') || headerLower === 'цена' || headerLower.includes('стоимость')) {
      suggestedPriceColumn = colIdx;
    }
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
  
  // Count actual data rows (excluding header and empty rows)
  let rowCount = 0;
  for (let i = headerRowIdx + 1; i < data.length; i++) {
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
  
  // Find header row (same logic as preview)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const nonEmptyCells = row.filter(cell => cell !== undefined && cell !== null && cell !== '').length;
    if (nonEmptyCells >= 2) {
      headerRowIdx = i;
      break;
    }
  }
  
  // Parse data rows
  for (let i = headerRowIdx + 1; i < data.length; i++) {
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
