# PO Query

A fast, browser-based purchase order lookup tool. Import an Excel report and search a PO number to view supplier, item, description, quantity, price, total value, payment terms/TOP, goods receipts, and goods returns.

## Features

- Imports `.xlsx`, `.xls`, `.xlsm`, and `.csv` files.
- Processes the workbook entirely in the browser; PO data is never uploaded or stored.
- Searches exact or partial PO numbers with suggestions.
- Groups duplicate source rows created by multiple goods-receipt records.
- Displays supplier, creator, PO date, TOP/payment terms, value, line items, GR history, and return status.
- Automatically detects common column-name variations.
- Responsive layout for desktop and mobile.
- Printable result view and copyable PO summary.

## Expected columns

The importer recognizes common alternatives for these fields:

| Field | Example accepted headers |
| --- | --- |
| PO number | `PO Number`, `PO No`, `Purchase Order Number` |
| Supplier | `BPName`, `Supplier Name`, `Vendor Name` |
| Supplier code | `BPCode`, `Supplier Code`, `Vendor Code` |
| Item | `Stock Item`, `Item Code`, `Material Code` |
| Description | `Item/Service Description`, `Item Description`, `Description` |
| Quantity | `Quantity`, `Qty`, `Ordered Quantity` |
| Unit price | `Price`, `Unit Price`, `Item Price` |
| Line total | `Total PO`, `Line Total`, `Total Price` |
| TOP | `TOP`, `Payment Terms`, `Terms of Payment`, `Payment Term` |
| Goods receipt | `Goods Receipt No`, `GR No`, `GRN Number` |

Only a PO-number column is mandatory. Missing fields are shown as unavailable.

## Run locally

No build tools are required. Open `index.html` directly, or serve the directory with any static web server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## GitHub Pages

1. Open the repository **Settings**.
2. Go to **Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose the `main` branch and `/ (root)` folder.
5. Save.

The site will be available at the GitHub Pages URL shown in the Pages settings.

## Privacy

The selected workbook is read locally with SheetJS in the user's browser. This repository does not include or collect any PO data.
