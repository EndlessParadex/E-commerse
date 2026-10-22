# BAM Storefront — Design No. 2 (Modern Light Wholesale Marketplace)

Status: implemented on `feature/b2b-store-sales-shared-cart`; full local build/test verification still required.

## What changed

- Storefront header: wholesale subtitle, modern search/address affordances and direct catalog navigation.
- Homepage hero: replaces the old dark illustrated box design with a light blue storefront showcase. Maintains working category slides, controls, pause, links, keyboard and reduced-motion behavior. The large cardboard sample asset is no longer used.
- Promotions: up to four distinct product groups as stacked cards on desktop, with genuine catalog prices and discount labels only if `oldPrice > price >= 0`. Uses readable brand initials when a product has no photo. No fake countdown or stock scarcity.
- Category shortcuts: visual catalog cards with distinct product counts and previews of up to two real subcategories.
- Listing/category views: category banner, navigable subcategory chips, current catalog filters, sorting, result count, empty states and responsive grid.
- Featured product grid: up to eight product groups from the active catalog; uses existing product cards and add-to-cart handling. Ratings from demo catalog are not presented as verified reviews when server workflow is active.
- Supplier and additional catalog promotion sections: aligned visual language, without duplicating backend logic.

## Unchanged

All backend and database code, store/Sales roles, separate personal/store carts, COD/bank payment, stock authority, Admin review/finalization, and fixed delivery schedule. Category/product navigation uses existing hash routes.

## QA required before rollout

1. Run `npm test`, `npm run lint`, and `npm run build` locally.
2. Open `#/ ` (without the space), `#/kategori/<valid-id>`, category subcategory routes, `#/cari?q=`, and product pages.
3. Validate desktop 1440/1024px, tablet 768px, mobile 390/360px, dark mode where supported, keyboard tab order and carousel pause.
4. Test catalog loading/failure/empty states; confirm no invented discount, stock, ratings or delivery claims.
5. Verify buyers, Sales, and Admin retain their separate shopping flows.

For real Flash Sale campaigns (start/end windows, campaign prices, countdown and managed product selection), a separate server-validated promotion module is still required. The current offers use only validated product catalog price fields.
