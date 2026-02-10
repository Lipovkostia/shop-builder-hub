

## Auto-assign categories from other price lists (bulk action)

### Problem
When adding products to a new price list, the seller must manually assign categories to each product, even though those same products may already have categories set in other price lists. This is tedious for large assortments (750+ items).

### Solution
Add a new button "Подставить категории" (auto-fill categories) to the bulk actions panel in price lists. When clicked, it will:
1. Take all selected products
2. Look up their category assignments in other price lists (via `catalog_product_settings`)
3. Copy those categories into the current price list
4. Skip products that already have categories assigned (or overwrite -- configurable via a confirmation dialog)

### User flow

1. Seller opens a price list, selects products (checkbox or Shift+Click)
2. In the bulk panel, clicks the new "Подставить категории" button
3. A confirmation dialog appears showing:
   - How many products will be affected
   - Option: "Replace existing categories" or "Only fill empty"
4. On confirm, categories are copied from the first found price list that has them

### Technical changes

**1. `src/components/admin/BulkEditPanel.tsx`**
- Add a new prop: `onBulkAutoFillCategories?: (mode: "fill_empty" | "replace_all") => void`
- Add a new button with a `Wand2` (or `Copy`) icon next to the existing "Категории" button
- On click, show a small dialog/popover asking the mode (fill empty vs replace all), then call the callback

**2. `src/pages/AdminPanel.tsx`**
- Implement the `onBulkAutoFillCategories` handler:
  - For each selected product, find `catalog_product_settings` records from OTHER catalogs (already available in the `settings` array from `useCatalogProductSettings`)
  - For each product, pick the first non-empty `categories` array found in another catalog
  - Call `updateCatalogProductPricing` for each product with the found categories
  - Show a toast with results: "Categories filled for N of M products"
- Pass the handler to `BulkEditPanel`

### Data flow (no DB changes needed)
- All `catalog_product_settings` for the store are already loaded in memory via `useCatalogProductSettings`
- The logic simply reads categories from other catalog entries and writes them to the current catalog
- No new tables, no new edge functions, no migrations required

### Edge cases
- Products with no categories in any other price list will be skipped (count shown in toast)
- If "fill empty" mode is selected, products that already have categories in current price list are skipped
- Categories that exist in another price list but not in the current price list's category settings will still be assigned (they reference global category IDs)
