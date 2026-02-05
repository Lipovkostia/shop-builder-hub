/**
 * Category tree utilities for hierarchical category management
 */

export interface CategoryWithParent {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  parent_id: string | null;
  sort_order?: number | null;
  product_count?: number;
  // Catalog-specific overrides
  custom_name?: string | null;
  catalog_sort_order?: number | null;
}

export interface CategoryTree extends CategoryWithParent {
  children: CategoryTree[];
  totalProductCount: number; // Sum of this category + all descendants
  display_name: string; // The name to display (custom_name or name)
}

/**
 * Build a tree structure from flat category list
 */
export function buildCategoryTree<T extends CategoryWithParent>(categories: T[]): CategoryTree[] {
  const map = new Map<string, CategoryTree>();
  const roots: CategoryTree[] = [];

  // Sort helper - use catalog_sort_order if available, otherwise sort_order
  const sortByOrder = (a: CategoryTree, b: CategoryTree) => {
    const orderA = a.catalog_sort_order ?? a.sort_order ?? 9999;
    const orderB = b.catalog_sort_order ?? b.sort_order ?? 9999;
    if (orderA !== orderB) return orderA - orderB;
    return a.display_name.localeCompare(b.display_name, 'ru');
  };

  // Initialize all nodes
  categories.forEach(cat => {
    map.set(cat.id, { 
      ...cat, 
      children: [],
      totalProductCount: cat.product_count || 0,
      display_name: cat.custom_name || cat.name,
    });
  });

  // Build tree structure
  categories.forEach(cat => {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort roots and children by sort_order
  roots.sort(sortByOrder);
  function sortChildren(node: CategoryTree) {
    node.children.sort(sortByOrder);
    node.children.forEach(sortChildren);
  }
  roots.forEach(sortChildren);

  // Calculate total product counts (including children)
  function calculateTotalCount(node: CategoryTree): number {
    const childrenCount = node.children.reduce(
      (sum, child) => sum + calculateTotalCount(child), 
      0
    );
    node.totalProductCount = (node.product_count || 0) + childrenCount;
    return node.totalProductCount;
  }

  roots.forEach(calculateTotalCount);

  return roots;
}

/**
 * Get all descendant category IDs (including the given category)
 */
export function getDescendantIds(
  categoryId: string, 
  categories: CategoryWithParent[]
): string[] {
  const descendants: string[] = [categoryId];
  
  const findChildren = (parentId: string) => {
    const children = categories.filter(c => c.parent_id === parentId);
    children.forEach(child => {
      descendants.push(child.id);
      findChildren(child.id);
    });
  };
  
  findChildren(categoryId);
  return descendants;
}

/**
 * Get the parent chain for a category (for auto-expanding)
 */
export function getParentChain(
  categoryId: string, 
  categories: CategoryWithParent[]
): string[] {
  const chain: string[] = [];
  let current = categories.find(c => c.id === categoryId);
  
  while (current?.parent_id) {
    chain.push(current.parent_id);
    current = categories.find(c => c.id === current!.parent_id);
  }
  
  return chain;
}

/**
 * Check if a category has children
 */
export function hasChildren(
  categoryId: string, 
  categories: CategoryWithParent[]
): boolean {
  return categories.some(c => c.parent_id === categoryId);
}

/**
 * Get direct children of a category
 */
export function getDirectChildren<T extends CategoryWithParent>(
  categoryId: string, 
  categories: T[]
): T[] {
  return categories.filter(c => c.parent_id === categoryId);
}

/**
 * Get only root (top-level) categories
 */
export function getRootCategories<T extends CategoryWithParent>(categories: T[]): T[] {
  return categories.filter(c => !c.parent_id);
}

/**
 * Filter tree to only include categories with products
 */
export function filterTreeWithProducts(tree: CategoryTree[]): CategoryTree[] {
  return tree.filter(node => {
    // Filter children first
    node.children = filterTreeWithProducts(node.children);
    // Keep if has products or has children with products
    return node.totalProductCount > 0;
  });
}
