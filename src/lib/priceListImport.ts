import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

export interface PriceListProduct {
  // Identifier fields
  sku?: string;           // Product code (if identifying by SKU)
  name: string;           // Product name
  
  // Fields to update
  buyPrice?: number;      // Buy price (optional)
  unit?: string;          // Unit of measurement (optional)
  rawPrice?: string;      // Original price string
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
  suggestedSkuColumn: number | null;
  rawData: unknown[][];
}

// Extended column mapping interface
export interface ExtendedColumnMapping {
  identifierType: 'sku' | 'name';
  identifierColumn: number | null;
  fieldsToUpdate: {
    buyPrice: number | null;
    price: number | null;
    unit: number | null;
    name: number | null;
    description: number | null;
    group: number | null;
    volume: number | null;
    photos: number | null;
  };
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
  let suggestedSkuColumn: number | null = null;
  
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
    
    // Check if this looks like a SKU column (short codes, alphanumeric)
    const looksLikeSku = sampleValues.some(v => {
      const str = String(v).trim();
      // SKU typically: short (< 20 chars), alphanumeric, may have dashes
      return str.length > 0 && str.length < 30 && /^[a-zA-Z0-9\-_.]+$/.test(str);
    });
    
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
    
    // Check for unit column (short text like "кг", "шт", "л")
    const looksLikeUnit = sampleValues.some(v => {
      const str = String(v).trim().toLowerCase();
      return ['кг', 'шт', 'л', 'м', 'уп', 'бут', 'пач', 'kg', 'pcs', 'pc'].includes(str);
    });
    
    if (looksLikeSku && !hasNumericValues) {
      header = 'Код товара';
      if (suggestedSkuColumn === null) {
        suggestedSkuColumn = colIdx;
      }
    } else if (looksLikeUnit) {
      header = 'Единица измерения';
    } else if (hasTextValues && !hasNumericValues && !looksLikeSku) {
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
    suggestedPriceColumn,
    suggestedSkuColumn
  });
  
  return {
    columns,
    rowCount,
    suggestedNameColumn,
    suggestedPriceColumn,
    suggestedSkuColumn,
    rawData: data,
  };
}

/**
 * Parse products from Excel using extended column mapping
 */
export function parseProductsWithExtendedMapping(
  previewData: ExcelPreviewData,
  mapping: ExtendedColumnMapping
): PriceListProduct[] {
  const products: PriceListProduct[] = [];
  const data = previewData.rawData;
  
  // Find first data row using the same logic as preview
  const dataStartRowIdx = findDataStartRow(data);
  
  // Parse data rows starting from data start
  for (let i = dataStartRowIdx; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    
    // Get identifier value
    const identifierValue = mapping.identifierColumn !== null 
      ? String(row[mapping.identifierColumn] || '').trim() 
      : '';
    
    // Skip rows without valid identifier
    if (!identifierValue || identifierValue.length < 1) continue;
    
    // Skip header-like rows
    const identifierLower = identifierValue.toLowerCase();
    if (identifierLower.includes('номенклатура') || 
        identifierLower.includes('артикул') ||
        identifierLower.includes('название') ||
        identifierLower.includes('наименование') ||
        identifierLower.includes('код товара') ||
        identifierLower.includes('sku')) {
      continue;
    }
    
    // Build product object
    const product: PriceListProduct = {
      name: mapping.identifierType === 'name' ? identifierValue : '',
      sku: mapping.identifierType === 'sku' ? identifierValue : undefined,
    };
    
    // Add fields to update
    const { fieldsToUpdate } = mapping;
    
    if (fieldsToUpdate.buyPrice !== null) {
      const priceRaw = row[fieldsToUpdate.buyPrice];
      const price = parsePrice(priceRaw as string | number);
      if (price > 0) {
        product.buyPrice = price;
        product.rawPrice = String(priceRaw);
      }
    }
    
    if (fieldsToUpdate.unit !== null) {
      const unitRaw = row[fieldsToUpdate.unit];
      const unit = String(unitRaw || '').trim();
      if (unit) {
        product.unit = unit;
      }
    }
    
    if (fieldsToUpdate.name !== null && mapping.identifierType === 'sku') {
      const nameRaw = row[fieldsToUpdate.name];
      const name = String(nameRaw || '').trim();
      if (name) {
        product.name = name;
      }
    }
    
    // For name-based identification, we need at least one field to update
    if (mapping.identifierType === 'name') {
      if (product.buyPrice === undefined && product.unit === undefined) {
        continue;
      }
    }
    
    products.push(product);
  }
  
  console.log(`[PriceList] Parsed ${products.length} products with extended mapping`);
  return products;
}

/**
 * Parse products from Excel using legacy column mapping (backward compatibility)
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

export interface ProductAnalysis {
  matchingProducts: Array<{
    excel: PriceListProduct;
    existing: { id: string; name: string; sku: string | null; buy_price: number | null; unit: string | null };
  }>;
  newProducts: PriceListProduct[];
}

/**
 * Analyze products before import - separate matching and new products
 */
export async function analyzeProductsForImport(
  products: PriceListProduct[],
  storeId: string,
  identifierType: 'sku' | 'name' = 'name'
): Promise<ProductAnalysis> {
  // Fetch existing products for the store
  const { data: existingProducts, error: fetchError } = await supabase
    .from('products')
    .select('id, name, sku, buy_price, unit')
    .eq('store_id', storeId);
  
  if (fetchError) throw fetchError;
  
  // Create a map for quick lookup based on identifier type
  const productMap = new Map<string, { id: string; name: string; sku: string | null; buy_price: number | null; unit: string | null }>();
  existingProducts?.forEach(p => {
    if (identifierType === 'sku' && p.sku) {
      productMap.set(p.sku.toLowerCase().trim(), p);
    } else {
      productMap.set(p.name.toLowerCase().trim(), p);
    }
  });
  
  const matchingProducts: ProductAnalysis['matchingProducts'] = [];
  const newProducts: PriceListProduct[] = [];
  
  for (const excelProduct of products) {
    let lookupKey: string;
    
    if (identifierType === 'sku' && excelProduct.sku) {
      lookupKey = excelProduct.sku.toLowerCase().trim();
    } else {
      lookupKey = excelProduct.name.toLowerCase().trim();
    }
    
    const existingProduct = productMap.get(lookupKey);
    
    if (existingProduct) {
      matchingProducts.push({
        excel: excelProduct,
        existing: existingProduct
      });
    } else {
      newProducts.push(excelProduct);
    }
  }
  
  console.log(`[PriceList] Analysis (${identifierType}): ${matchingProducts.length} matching, ${newProducts.length} new`);
  
  return { matchingProducts, newProducts };
}

/**
 * Import products from parsed list to catalog with extended field support
 */
export async function importProductsToCatalogExtended(
  products: PriceListProduct[],
  storeId: string,
  catalogId: string,
  identifierType: 'sku' | 'name',
  fieldsToUpdate: ('buyPrice' | 'unit' | 'name')[],
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
      .select('id, name, sku, buy_price, unit')
      .eq('store_id', storeId);
    
    if (fetchError) throw fetchError;
    
    // Create a map for quick lookup based on identifier type
    const productMap = new Map<string, { id: string; name: string; sku: string | null; buy_price: number | null; unit: string | null }>();
    existingProducts?.forEach(p => {
      if (identifierType === 'sku' && p.sku) {
        productMap.set(p.sku.toLowerCase().trim(), p);
      } else {
        productMap.set(p.name.toLowerCase().trim(), p);
      }
    });
    
    // Track which products are in the Excel file
    const productsInExcel = new Set<string>();
    
    // Process each product
    for (let i = 0; i < products.length; i++) {
      const excelProduct = products[i];
      progress.current = i + 1;
      progress.currentProduct = excelProduct.sku || excelProduct.name;
      onProgress(progress);
      
      let lookupKey: string;
      if (identifierType === 'sku' && excelProduct.sku) {
        lookupKey = excelProduct.sku.toLowerCase().trim();
      } else {
        lookupKey = excelProduct.name.toLowerCase().trim();
      }
      
      const existingProduct = productMap.get(lookupKey);
      
      if (existingProduct) {
        // Match found - update only selected fields
        productsInExcel.add(existingProduct.id);
        
        // Build update object with only selected fields
        const updateData: Record<string, unknown> = {};
        
        if (fieldsToUpdate.includes('buyPrice') && excelProduct.buyPrice !== undefined) {
          updateData.buy_price = excelProduct.buyPrice;
          updateData.markup_type = 'percent';
          updateData.markup_value = 0;
          // Update price to match buy_price (0% markup)
          updateData.price = excelProduct.buyPrice;
        }
        
        if (fieldsToUpdate.includes('unit') && excelProduct.unit) {
          updateData.unit = excelProduct.unit;
        }
        
        if (fieldsToUpdate.includes('name') && excelProduct.name && identifierType === 'sku') {
          updateData.name = excelProduct.name;
        }
        
        // Only update if there's something to update
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', existingProduct.id);
          
          if (updateError) {
            progress.errors.push(`Ошибка обновления "${excelProduct.name || excelProduct.sku}": ${updateError.message}`);
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
        }
      } else {
        // No match - create new product (only if we have name)
        if (!excelProduct.name) {
          progress.errors.push(`Не указано название для товара с кодом "${excelProduct.sku}"`);
          continue;
        }
        
        const slug = generateSlug(excelProduct.name) + '-' + Date.now().toString(36);
        
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            store_id: storeId,
            name: excelProduct.name,
            sku: excelProduct.sku || null,
            slug: slug,
            price: excelProduct.buyPrice || 0,
            buy_price: excelProduct.buyPrice || 0,
            markup_type: 'percent',
            markup_value: 0,
            is_active: true,
            quantity: 0,
            unit: excelProduct.unit || 'кг'
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

/**
 * Import products from parsed list to catalog (legacy function for backward compatibility)
 */
export async function importProductsToCatalog(
  products: PriceListProduct[],
  storeId: string,
  catalogId: string,
  onProgress: (progress: PriceListImportProgress) => void
): Promise<PriceListImportResult> {
  // Use extended import with name identification and buyPrice update
  return importProductsToCatalogExtended(
    products,
    storeId,
    catalogId,
    'name',
    ['buyPrice'],
    onProgress
  );
}

// Import options for full assortment import
export interface AssortmentImportOptions {
  createNewProducts: boolean;
  hideNotInFile: boolean;
}

/**
 * Import products using column mapping for assortment (store-level import, not catalog)
 */
export async function importProductsWithMapping(
  file: File,
  storeId: string,
  mapping: ExtendedColumnMapping,
  options: AssortmentImportOptions,
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
    // Preview and parse file
    const preview = await previewPriceListExcel(file);
    const data = preview.rawData;
    
    // Find first data row
    const dataStartRowIdx = findDataStartRowInternal(data);
    
    // Parse products based on mapping
    const parsedProducts: ParsedAssortmentProduct[] = [];
    
    for (let i = dataStartRowIdx; i < data.length; i++) {
      const row = data[i] as unknown[];
      if (!row) continue;
      
      // Get identifier value
      const identifierValue = mapping.identifierColumn !== null 
        ? String(row[mapping.identifierColumn] || '').trim() 
        : '';
      
      // Skip rows without valid identifier
      if (!identifierValue || identifierValue.length < 1) continue;
      
      // Skip header-like rows
      const identifierLower = identifierValue.toLowerCase();
      if (identifierLower.includes('номенклатура') || 
          identifierLower.includes('артикул') ||
          identifierLower.includes('название') ||
          identifierLower.includes('наименование') ||
          identifierLower.includes('код товара') ||
          identifierLower.includes('sku')) {
        continue;
      }
      
      // Build product object
      const product: ParsedAssortmentProduct = {
        identifier: identifierValue,
        identifierType: mapping.identifierType,
        rowIndex: i + 1,
      };
      
      // Parse fields to update
      const { fieldsToUpdate } = mapping;
      
      if (fieldsToUpdate.buyPrice !== null) {
        const priceRaw = row[fieldsToUpdate.buyPrice];
        const price = parsePrice(priceRaw as string | number);
        if (price > 0) {
          product.buyPrice = price;
        }
      }
      
      if (fieldsToUpdate.price !== null) {
        const priceRaw = row[fieldsToUpdate.price];
        const price = parsePrice(priceRaw as string | number);
        if (price > 0) {
          product.price = price;
        }
      }
      
      if (fieldsToUpdate.unit !== null) {
        const unitRaw = row[fieldsToUpdate.unit];
        const unit = String(unitRaw || '').trim();
        if (unit) {
          product.unit = unit;
        }
      }
      
      if (fieldsToUpdate.name !== null) {
        const nameRaw = row[fieldsToUpdate.name];
        const name = String(nameRaw || '').trim();
        if (name) {
          product.name = name;
        }
      }
      
      if (fieldsToUpdate.description !== null) {
        const descRaw = row[fieldsToUpdate.description];
        const desc = String(descRaw || '').trim();
        if (desc) {
          product.description = desc;
        }
      }
      
      if (fieldsToUpdate.group !== null) {
        const groupRaw = row[fieldsToUpdate.group];
        const group = String(groupRaw || '').trim();
        if (group) {
          product.group = group;
        }
      }
      
      if (fieldsToUpdate.volume !== null) {
        const volumeRaw = row[fieldsToUpdate.volume];
        const volume = parseFloat(String(volumeRaw || '0').replace(',', '.'));
        if (volume > 0) {
          product.volume = volume;
        }
      }
      
      if (fieldsToUpdate.photos !== null) {
        const photosRaw = row[fieldsToUpdate.photos];
        const photos = String(photosRaw || '').trim();
        if (photos) {
          product.photos = photos.split(';').map(s => s.trim()).filter(Boolean);
        }
      }
      
      parsedProducts.push(product);
    }
    
    progress.total = parsedProducts.length;
    progress.status = 'processing';
    onProgress(progress);
    
    if (parsedProducts.length === 0) {
      progress.status = 'error';
      progress.errors.push('Не найдено товаров для импорта. Проверьте сопоставление колонок.');
      onProgress(progress);
      return {
        success: false,
        matched: 0,
        created: 0,
        hidden: 0,
        errors: progress.errors
      };
    }
    
    // Fetch existing products
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, name, sku, buy_price, unit, is_active')
      .eq('store_id', storeId)
      .is('deleted_at', null);
    
    if (fetchError) throw fetchError;
    
    // Create lookup maps
    const skuMap = new Map<string, ExistingProduct>();
    const nameMap = new Map<string, ExistingProduct>();
    existingProducts?.forEach(p => {
      if (p.sku) skuMap.set(p.sku.toLowerCase().trim(), p);
      nameMap.set(p.name.toLowerCase().trim(), p);
    });
    
    // Fetch existing groups
    const { data: existingGroups } = await supabase
      .from('product_groups')
      .select('id, name')
      .eq('store_id', storeId);
    
    const groupCache = new Map<string, string>();
    existingGroups?.forEach(g => {
      groupCache.set(g.name.toLowerCase().trim(), g.id);
    });
    
    // Track products in file for hiding logic
    const productsInFile = new Set<string>();
    
    // Process each product
    for (let i = 0; i < parsedProducts.length; i++) {
      const product = parsedProducts[i];
      progress.current = i + 1;
      progress.currentProduct = product.name || product.identifier;
      onProgress(progress);
      
      // Find existing product
      let existing: ExistingProduct | undefined;
      if (product.identifierType === 'sku') {
        existing = skuMap.get(product.identifier.toLowerCase().trim());
      } else {
        existing = nameMap.get(product.identifier.toLowerCase().trim());
      }
      
      if (existing) {
        // Update existing product
        productsInFile.add(existing.id);
        
        const updateData: Record<string, unknown> = {};
        
        if (product.buyPrice !== undefined) {
          updateData.buy_price = product.buyPrice;
        }
        
        if (product.price !== undefined) {
          updateData.price = product.price;
        }
        
        if (product.unit !== undefined) {
          updateData.unit = product.unit;
        }
        
        if (product.name !== undefined && product.identifierType === 'sku') {
          updateData.name = product.name;
        }
        
        if (product.description !== undefined) {
          updateData.description = product.description;
        }
        
        if (product.volume !== undefined) {
          updateData.unit_weight = product.volume;
        }
        
        // Handle photos
        if (product.photos && product.photos.length > 0) {
          // For now, just set images directly (TODO: upload via edge function)
          updateData.images = product.photos;
        }
        
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('products')
            .update(updateData)
            .eq('id', existing.id);
          
          if (updateError) {
            progress.errors.push(`Строка ${product.rowIndex}: Ошибка обновления "${product.identifier}" - ${updateError.message}`);
          } else {
            progress.matched++;
            
            // Handle group assignment
            if (product.group) {
              const groupId = await getOrCreateGroupInternal(product.group, storeId, groupCache);
              if (groupId) {
                await assignProductToGroupInternal(existing.id, groupId);
              }
            }
          }
        }
      } else if (options.createNewProducts) {
        // Create new product
        const productName = product.name || product.identifier;
        const slug = generateSlug(productName) + '-' + Date.now().toString(36);
        
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            store_id: storeId,
            name: productName,
            sku: product.identifierType === 'sku' ? product.identifier : null,
            slug: slug,
            price: product.price ?? product.buyPrice ?? 0,
            buy_price: product.buyPrice ?? null,
            markup_type: 'percent',
            markup_value: 0,
            is_active: true,
            quantity: 0,
            unit: product.unit || 'шт',
            description: product.description || null,
            unit_weight: product.volume || null,
            images: product.photos || null,
            source: 'excel'
          })
          .select('id')
          .single();
        
        if (createError) {
          progress.errors.push(`Строка ${product.rowIndex}: Ошибка создания "${productName}" - ${createError.message}`);
        } else if (newProduct) {
          progress.created++;
          productsInFile.add(newProduct.id);
          
          // Handle group assignment
          if (product.group) {
            const groupId = await getOrCreateGroupInternal(product.group, storeId, groupCache);
            if (groupId) {
              await assignProductToGroupInternal(newProduct.id, groupId);
            }
          }
        }
      }
    }
    
    // Hide products not in file
    if (options.hideNotInFile && existingProducts) {
      for (const existing of existingProducts) {
        if (!productsInFile.has(existing.id) && existing.is_active) {
          const { error: hideError } = await supabase
            .from('products')
            .update({ is_active: false })
            .eq('id', existing.id);
          
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
    console.error('[AssortmentImport] Error:', error);
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

// Internal types
interface ParsedAssortmentProduct {
  identifier: string;
  identifierType: 'sku' | 'name';
  rowIndex: number;
  buyPrice?: number;
  price?: number;
  unit?: string;
  name?: string;
  description?: string;
  group?: string;
  volume?: number;
  photos?: string[];
}

interface ExistingProduct {
  id: string;
  name: string;
  sku: string | null;
  buy_price: number | null;
  unit: string | null;
  is_active: boolean | null;
}

// Internal helpers (to avoid conflicts with excelImport.ts)
function findDataStartRowInternal(data: unknown[][], maxRowsToCheck: number = 20): number {
  for (let i = 0; i < Math.min(maxRowsToCheck, data.length); i++) {
    const row = data[i] as unknown[];
    if (!row) continue;
    
    let hasTextValue = false;
    let hasNumericValue = false;
    let nonEmptyCount = 0;
    
    for (const cell of row) {
      if (cell === undefined || cell === null || cell === '') continue;
      nonEmptyCount++;
      
      const str = String(cell).trim();
      
      if (/^\d[\d\s]*[,.]?\d*$/.test(str.replace(/\s/g, '')) && parseFloat(str.replace(/\s/g, '').replace(',', '.')) > 0) {
        hasNumericValue = true;
      }
      
      if (str.length >= 3 && /[а-яА-Яa-zA-Z]/.test(str)) {
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
    
    if (nonEmptyCount >= 2 && hasTextValue && hasNumericValue) {
      return i;
    }
  }
  
  for (let i = 0; i < Math.min(maxRowsToCheck, data.length); i++) {
    const row = data[i] as unknown[];
    if (!row) continue;
    const nonEmptyCells = row.filter(cell => cell !== undefined && cell !== null && cell !== '').length;
    if (nonEmptyCells >= 2) {
      return i;
    }
  }
  
  return 0;
}

async function getOrCreateGroupInternal(
  groupName: string,
  storeId: string,
  groupCache: Map<string, string>
): Promise<string | null> {
  if (!groupName || !groupName.trim()) return null;
  
  const normalizedName = groupName.trim();
  const normalizedLower = normalizedName.toLowerCase();
  
  if (groupCache.has(normalizedLower)) {
    return groupCache.get(normalizedLower)!;
  }
  
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
  
  groupCache.set(normalizedLower, data.id);
  return data.id;
}

async function assignProductToGroupInternal(productId: string, groupId: string): Promise<void> {
  await supabase
    .from('product_group_assignments')
    .delete()
    .eq('product_id', productId);

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
