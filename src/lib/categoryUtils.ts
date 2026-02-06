// Utility functions for building and working with category hierarchies

export interface CategoryWithHierarchy {
  id: string;
  name: string;
  parent_id?: string | null;
  catalog_parent_id?: string | null;
  sort_order?: number | null;
}

export interface CategoryNode {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  children: CategoryNode[];
}

/**
 * Build a tree structure from flat category list
 * Priority: catalog_parent_id > parent_id > null (root)
 */
export function buildCategoryTree(categories: CategoryWithHierarchy[]): CategoryNode[] {
  const roots: CategoryNode[] = [];
  const childrenMap = new Map<string, CategoryNode[]>();
  
  // Sort categories by sort_order first
  const sorted = [...categories].sort((a, b) => {
    const orderA = a.sort_order ?? 999999;
    const orderB = b.sort_order ?? 999999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
  
  sorted.forEach(cat => {
    // Priority: catalog_parent_id > parent_id
    const parentId = (cat as any).catalog_parent_id ?? cat.parent_id ?? null;
    
    const node: CategoryNode = {
      id: cat.id,
      name: cat.name,
      parent_id: parentId,
      sort_order: cat.sort_order ?? 999999,
      children: [],
    };
    
    if (!parentId) {
      roots.push(node);
    } else {
      const siblings = childrenMap.get(parentId) || [];
      siblings.push(node);
      childrenMap.set(parentId, siblings);
    }
  });
  
  // Attach children to their parents
  function attachChildren(nodes: CategoryNode[]) {
    nodes.forEach(node => {
      node.children = childrenMap.get(node.id) || [];
      attachChildren(node.children);
    });
  }
  
  attachChildren(roots);
  
  return roots;
}

/**
 * Flatten a category tree into a display list with depth information
 */
export interface FlatCategoryItem {
  id: string;
  name: string;
  depth: number;
  isParent: boolean;
}

export function flattenCategoryTree(tree: CategoryNode[]): FlatCategoryItem[] {
  const result: FlatCategoryItem[] = [];
  
  function traverse(nodes: CategoryNode[], depth: number) {
    nodes.forEach(node => {
      result.push({
        id: node.id,
        name: node.name,
        depth,
        isParent: node.children.length > 0,
      });
      traverse(node.children, depth + 1);
    });
  }
  
  traverse(tree, 0);
  return result;
}

/**
 * Get all descendant category IDs for a given category
 * Useful for inclusive filtering (select parent = show all children's products)
 */
export function getAllDescendantIds(categoryId: string, tree: CategoryNode[]): Set<string> {
  const result = new Set<string>([categoryId]);
  
  function findAndCollect(nodes: CategoryNode[]): boolean {
    for (const node of nodes) {
      if (node.id === categoryId) {
        // Found the category, collect all its descendants
        collectDescendants(node);
        return true;
      }
      if (findAndCollect(node.children)) {
        return true;
      }
    }
    return false;
  }
  
  function collectDescendants(node: CategoryNode) {
    result.add(node.id);
    node.children.forEach(child => collectDescendants(child));
  }
  
  findAndCollect(tree);
  return result;
}
