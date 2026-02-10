

## Fix: Category Dropdown Not Responding to Clicks

### Problem
In the category dropdown menus (Guest Catalog, Customer Dashboard, Storefront), categories that have subcategories are wrapped in plain `<div>` elements. Radix UI's DropdownMenu component expects all items to be direct children of the content or inside `DropdownMenuGroup` -- wrapping them in plain `<div>` breaks the internal focus/click system. This causes some items (like "сыр") to be visually selectable but not actually triggering the click handler.

### Solution
Replace all plain `<div key={...}>` wrappers around grouped DropdownMenuItems with `<DropdownMenuGroup key={...}>` in three files:

### Files to Modify

**1. `src/pages/GuestCatalogView.tsx` (lines ~992-1017)**
- Replace `<div key={cat.id}>` with `<DropdownMenuGroup key={cat.id}>`
- Add `onSelect` handlers to all `DropdownMenuItem` components for extra reliability
- Import `DropdownMenuGroup` (already exported from dropdown-menu.tsx)

**2. `src/pages/CustomerDashboard.tsx` (lines ~650-675)**
- Same fix: replace `<div key={cat.id}>` with `<DropdownMenuGroup key={cat.id}>`
- Add `onSelect` handlers

**3. `src/pages/StoreFront.tsx` (lines ~914-969)**  
- Replace `<div key={cat.id}>` with `<DropdownMenuGroup key={cat.id}>`
- The StoreFront already uses a custom `<div>` for the section header (expand/collapse toggle) -- this will be kept but the outer wrapper will use `DropdownMenuGroup`
- Add `onSelect` handlers to child items

### Technical Details

The key change in each file:
```tsx
// BEFORE (broken):
<div key={cat.id}>
  <DropdownMenuItem onClick={() => onSelectCategory(cat.id)}>
    ...
  </DropdownMenuItem>
  {children.map(child => (
    <DropdownMenuItem key={child.id} onClick={() => onSelectCategory(child.id)}>
      ...
    </DropdownMenuItem>
  ))}
</div>

// AFTER (fixed):
<DropdownMenuGroup key={cat.id}>
  <DropdownMenuItem onSelect={() => onSelectCategory(cat.id)}>
    ...
  </DropdownMenuItem>
  {children.map(child => (
    <DropdownMenuItem key={child.id} onSelect={() => onSelectCategory(child.id)}>
      ...
    </DropdownMenuItem>
  ))}
</DropdownMenuGroup>
```

Using `onSelect` instead of `onClick` is the Radix-recommended approach -- it handles both mouse clicks and keyboard selection, and automatically closes the menu after selection.

