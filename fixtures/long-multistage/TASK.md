# Order pipeline

Repair the complete pipeline in `src/orders.ts`.

- Parse CSV rows `id,quantity,unit_cents,status`; ignore the header and blank lines.
- Reject duplicate IDs and non-positive/non-integer numeric fields. Errors must name the one-based source line.
- Only `paid` rows contribute to revenue.
- For each paid row, subtotal is `quantity * unit_cents`; apply a 10% integer discount with `Math.floor` when subtotal is at least 10,000 cents.
- Return paid records sorted by ID plus the total net cents.
- Preserve exported names and add focused regression coverage.
