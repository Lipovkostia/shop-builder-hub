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
 * Parse Excel file and extract product names and prices
 * The Excel format has product name in column "Номенклатура, Упаковка" (or similar)
 * and price in column "Прайс" or "Цена"
 */
export async function parsePriceListExcel(file: File): Promise<PriceListProduct[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Get all data as array of arrays to handle merged cells
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  
  const products: PriceListProduct[] = [];
  
  // Find the header row - look for "Прайс" or "Цена" column
  let headerRowIdx = -1;
  let priceColIdx = -1;
  let nameColIdx = -1;
  
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    
    for (let j = 0; j < row.length; j++) {
      const cellValue = String(row[j] || '').toLowerCase().trim();
      if (cellValue.includes('прайс') || cellValue === 'цена') {
        priceColIdx = j;
        headerRowIdx = i;
      }
      if (cellValue.includes('номенклатура') || cellValue.includes('название')) {
        nameColIdx = j;
      }
    }
    
    if (priceColIdx >= 0) break;
  }
  
  // If we couldn't find clear columns, try to detect by data pattern
  // Product names are typically in column 3-4 (index 3), prices in the last populated column
  if (priceColIdx < 0) {
    // Look for rows with price-like values
    for (let i = 5; i < Math.min(30, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      
      // Find the last column with a numeric value (price)
      for (let j = row.length - 1; j >= 0; j--) {
        const val = row[j];
        if (val !== undefined && val !== null && val !== '') {
          const parsed = parsePrice(val as string | number);
          if (parsed > 0) {
            priceColIdx = j;
            break;
          }
        }
      }
      
      // Find the first column with a text value (name)
      for (let j = 0; j < row.length; j++) {
        const val = row[j];
        if (val !== undefined && val !== null && val !== '') {
          const str = String(val).trim();
          if (str.length > 3 && !/^\d+$/.test(str)) {
            nameColIdx = j;
            break;
          }
        }
      }
      
      if (priceColIdx >= 0 && nameColIdx >= 0) {
        headerRowIdx = i - 1;
        break;
      }
    }
  }
  
  // Default to common positions if not found
  if (nameColIdx < 0) nameColIdx = 3;
  if (priceColIdx < 0) priceColIdx = data[0]?.length ? data[0].length - 1 : 14;
  
  console.log('[PriceList] Detected columns:', { nameColIdx, priceColIdx, headerRowIdx });
  
  // Parse data rows (skip headers)
  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 5;
  
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    
    // Get product name - look for first non-empty string in the name column area
    let name = '';
    for (let j = nameColIdx; j >= 0 && j < nameColIdx + 5; j++) {
      const val = row[j];
      if (val !== undefined && val !== null && val !== '') {
        const str = String(val).trim();
        if (str.length > 2 && !/^\d+[,.]?\d*$/.test(str)) {
          name = str;
          break;
        }
      }
    }
    
    // Get price from the price column
    const priceRaw = row[priceColIdx];
    const price = parsePrice(priceRaw as string | number);
    
    // Skip rows without valid name or price
    if (!name || price <= 0) continue;
    
    // Skip header-like rows
    if (name.toLowerCase().includes('номенклатура') || 
        name.toLowerCase().includes('артикул') ||
        name.toLowerCase().includes('название')) {
      continue;
    }
    
    products.push({
      name: name,
      buyPrice: price,
      rawPrice: String(priceRaw)
    });
  }
  
  console.log(`[PriceList] Parsed ${products.length} products from Excel`);
  return products;
}

/**
 * Import products from price list Excel file to catalog
 * 
 * Logic:
 * 1. If product name 100% matches - update only buy_price
 * 2. If no match - create new product with 0% markup
 * 3. Products NOT in the Excel file - set status to "hidden"
 */
export async function importPriceListToCatalog(
  file: File,
  storeId: string,
  catalogId: string,
  onProgress: (progress: PriceListImportProgress) => void
): Promise<PriceListImportResult> {
  const progress: PriceListImportProgress = {
    total: 0,
    current: 0,
    currentProduct: '',
    status: 'parsing',
    matched: 0,
    created: 0,
    hidden: 0,
    errors: []
  };
  
  onProgress(progress);
  
  try {
    // Parse Excel file
    const excelProducts = await parsePriceListExcel(file);
    progress.total = excelProducts.length;
    progress.status = 'processing';
    onProgress(progress);
    
    if (excelProducts.length === 0) {
      progress.status = 'error';
      progress.errors.push('Не найдено товаров в файле. Проверьте формат файла.');
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
    
    // Process each product from Excel
    for (let i = 0; i < excelProducts.length; i++) {
      const excelProduct = excelProducts[i];
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
