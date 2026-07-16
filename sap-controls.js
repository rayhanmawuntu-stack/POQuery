(() => {
  "use strict";

  const documentTabs = [...document.querySelectorAll(".sap-tabs .sap-tab")];
  const poSearch = document.getElementById("poSearch");
  const searchForm = document.getElementById("searchForm");
  const fileInput = document.getElementById("fileInput");
  const suggestions = document.getElementById("suggestions");
  const welcomeState = document.getElementById("welcomeState");
  const noResultState = document.getElementById("noResultState");
  const poResult = document.getElementById("poResult");
  const resultPoNumber = document.getElementById("resultPoNumber");
  const resultSupplier = document.getElementById("resultSupplier");
  const summaryGrid = document.getElementById("summaryGrid");
  const tableBody = document.getElementById("itemsTableBody");
  const table = tableBody?.closest("table");
  const tableWrap = table?.closest(".table-wrap");
  const subtotalLine = document.getElementById("alvSubtotalLine");
  const detectedDetails = document.querySelector("#detectedColumnsSection details");
  const footerStatus = document.getElementById("footerStatusText");
  const toast = document.getElementById("toast");

  if (!searchForm || !poSearch || !fileInput || !tableBody || !table) return;

  const button = (id) => document.getElementById(id);

  function notify(message) {
    if (footerStatus) footerStatus.textContent = message;
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => toast.classList.remove("show"), 1900);
  }

  function activateTab(index) {
    const target = documentTabs[index];
    if (!target) return;
    target.click();
  }

  function showDocuments() {
    activateTab(0);
  }

  function showControl() {
    activateTab(1);
  }

  function showOutput() {
    activateTab(2);
  }

  function hasWorkbook() {
    const workspace = document.getElementById("workspace");
    return Boolean(workspace && !workspace.hidden);
  }

  function hasSelectedPo() {
    return Boolean(resultPoNumber?.textContent?.trim()) && Boolean(poResult && !poResult.hidden);
  }

  function clearSelection() {
    poSearch.value = "";
    const clearButton = document.getElementById("clearSearchButton");
    if (clearButton) clearButton.hidden = true;
    if (suggestions) suggestions.hidden = true;
    if (poResult) poResult.hidden = true;
    if (noResultState) noResultState.hidden = true;
    if (welcomeState) welcomeState.hidden = false;
    if (subtotalLine) subtotalLine.hidden = true;
    for (const row of tableBody.rows) row.hidden = false;
    delete tableBody.dataset.filterTerm;
    notify("Selection cleared");
  }

  function focusSearch() {
    showDocuments();
    if (!hasWorkbook()) {
      fileInput.click();
      return;
    }
    poSearch.focus();
    poSearch.select();
    notify("Enter purchase order number");
  }

  function executeSearch() {
    showDocuments();
    if (!hasWorkbook()) {
      fileInput.click();
      notify("Select a workbook first");
      return;
    }
    searchForm.requestSubmit();
  }

  function refreshSelection() {
    if (!hasWorkbook()) {
      notify("No workbook loaded");
      return;
    }
    if (poSearch.value.trim()) {
      searchForm.requestSubmit();
      notify("Document refreshed");
    } else {
      poSearch.focus();
      notify("Enter a purchase order number");
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function summaryMap() {
    const result = new Map();
    for (const card of summaryGrid?.querySelectorAll(".summary-card") || []) {
      const label = card.querySelector("span")?.textContent?.trim().toLowerCase();
      const value = card.querySelector("strong")?.textContent?.trim();
      if (label) result.set(label, value || "—");
    }
    return result;
  }

  function headerIndex(label) {
    const normalized = label.trim().toLowerCase();
    return [...table.tHead.rows[0].cells].findIndex(
      (cell) => cell.textContent.trim().toLowerCase() === normalized
    );
  }

  function parseAmount(value) {
    const text = String(value ?? "").trim().replace(/\s/g, "");
    if (!text) return 0;
    const cleaned = text.replace(/[^0-9,.-]/g, "");
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    let numeric = cleaned;

    if (lastComma >= 0 && lastDot >= 0) {
      numeric = lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
    } else if (lastComma >= 0) {
      const decimals = cleaned.length - lastComma - 1;
      numeric = decimals > 0 && decimals <= 2
        ? cleaned.replace(",", ".")
        : cleaned.replace(/,/g, "");
    } else if (lastDot >= 0) {
      const decimals = cleaned.length - lastDot - 1;
      if (decimals === 3 && cleaned.split(".").length > 1) numeric = cleaned.replace(/\./g, "");
    }

    const parsed = Number(numeric);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function detectCurrency(...values) {
    for (const value of values) {
      const match = String(value ?? "").trim().match(/^([^0-9-]+?)\s*(?=\d)/);
      if (match) return match[1].trim();
    }
    return "";
  }

  function formatAmount(value, currency = "") {
    const amount = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2
    }).format(value);
    return currency ? `${currency} ${amount}` : amount;
  }

  function visibleRows() {
    return [...tableBody.rows].filter((row) => !row.hidden);
  }

  function buildPrintSheet() {
    if (!hasSelectedPo()) {
      notify("Select a purchase order before printing");
      return null;
    }

    document.getElementById("purchaseOrderPrintSheet")?.remove();

    const summary = summaryMap();
    const headers = {
      item: headerIndex("Item"),
      description: headerIndex("Description"),
      quantity: headerIndex("Quantity"),
      unitPrice: headerIndex("Unit price"),
      netValue: headerIndex("Net value")
    };
    const rows = [...tableBody.rows];
    const supplierText = resultSupplier?.textContent?.trim() || "—";
    const supplierParts = supplierText.split(" · ");
    const supplierName = supplierParts[0] || "—";
    const supplierCode = supplierParts.slice(1).join(" · ") || "—";
    const poNumber = resultPoNumber?.textContent?.trim() || "—";
    const poDate = summary.get("po date") || "—";
    const paymentTerms = summary.get("top / payment terms") || "—";
    const createdBy = summary.get("created by") || "—";
    const poValueText = summary.get("po value") || "—";

    let subtotal = 0;
    const itemRows = rows.map((row, index) => {
      const cells = row.cells;
      const itemCode = headers.item >= 0 ? cells[headers.item]?.textContent?.trim() : "";
      const description = headers.description >= 0 ? cells[headers.description]?.textContent?.trim() : "";
      const quantity = headers.quantity >= 0 ? cells[headers.quantity]?.textContent?.trim() : "";
      const unitPrice = headers.unitPrice >= 0 ? cells[headers.unitPrice]?.textContent?.trim() : "";
      const netValue = headers.netValue >= 0 ? cells[headers.netValue]?.textContent?.trim() : "";
      subtotal += parseAmount(netValue);

      return `
        <tr>
          <td class="po-print-center">${index + 1}</td>
          <td>${escapeHtml(itemCode || "—")}</td>
          <td>${escapeHtml(description || "—")}</td>
          <td class="po-print-number">${escapeHtml(quantity || "—")}</td>
          <td class="po-print-center">—</td>
          <td class="po-print-number">${escapeHtml(unitPrice || "—")}</td>
          <td class="po-print-number">${escapeHtml(netValue || "—")}</td>
        </tr>
      `;
    }).join("");

    const firstUnitPrice = headers.unitPrice >= 0 ? rows[0]?.cells[headers.unitPrice]?.textContent : "";
    const firstNetValue = headers.netValue >= 0 ? rows[0]?.cells[headers.netValue]?.textContent : "";
    const currency = detectCurrency(firstUnitPrice, firstNetValue, poValueText);
    const totalAmount = parseAmount(poValueText);
    const difference = totalAmount && subtotal ? totalAmount - subtotal : 0;
    const differenceText = Math.abs(difference) > 0.005 ? formatAmount(difference, currency) : "—";
    const totalDisplay = poValueText !== "—"
      ? poValueText
      : formatAmount(subtotal + difference, currency);

    const sheet = document.createElement("section");
    sheet.id = "purchaseOrderPrintSheet";
    sheet.setAttribute("aria-hidden", "true");
    sheet.innerHTML = `
      <div class="po-print-page">
        <header class="po-print-header">
          <div class="po-print-supplier">
            <div class="po-print-small-line"><strong>Supplier Code:</strong> ${escapeHtml(supplierCode)}</div>
            <h1>${escapeHtml(supplierName)}</h1>
            <div class="po-print-address">Address: —</div>
            <div>Indonesia</div>
            <div class="po-print-contact-grid">
              <strong>ATTN</strong><span>:</span><span>—</span>
              <strong>Tel. No</strong><span>:</span><span>—</span>
              <strong>Fax No</strong><span>:</span><span>—</span>
            </div>
          </div>
          <div class="po-print-brand">
            <div class="po-print-logo"><span>KSB</span><i></i></div>
            <div class="po-print-meta">
              <strong>Purchase Order No.</strong><span>:</span><b>ID- ${escapeHtml(poNumber)}</b>
              <strong>Date</strong><span>:</span><span>${escapeHtml(poDate)}</span>
              <strong>Our Job No.</strong><span>:</span><span>—</span>
              <strong>Other</strong><span>:</span><span>Created by ${escapeHtml(createdBy)}</span>
            </div>
          </div>
        </header>

        <section class="po-print-reference">
          <div><strong>Your Quotation No.</strong><span>:</span><span>—</span></div>
          <div><strong>Dated</strong><span>:</span><span>—</span></div>
        </section>

        <p class="po-print-intro">We are pleased to place an order with you for the following goods and the terms and conditions set forth below:</p>

        <table class="po-print-items">
          <thead>
            <tr>
              <th>Item</th>
              <th>Item Number</th>
              <th>Description</th>
              <th>Qty.</th>
              <th>UoM</th>
              <th>Unit Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <section class="po-print-totals">
          <div><strong>Sub Total</strong><span>${escapeHtml(formatAmount(subtotal, currency))}</span></div>
          <div><strong>VAT / Tax</strong><span>${escapeHtml(differenceText)}</span></div>
          <div class="grand-total"><strong>Total Amount</strong><span>${escapeHtml(totalDisplay)}</span></div>
        </section>

        <section class="po-print-terms">
          <div><strong>PRICES</strong><span>:</span><span>${escapeHtml(currency || "As stated above")}, Franco KSB Indonesia Cibitung</span></div>
          <div><strong>DELIVERY</strong><span>:</span><span>—</span></div>
          <div><strong>PAYMENT</strong><span>:</span><span>${escapeHtml(paymentTerms)}</span></div>
          <div><strong>DESPATCH MODE</strong><span>:</span><span>—</span></div>
        </section>

        <section class="po-print-instructions">
          <strong>SPECIAL INSTRUCTIONS: Refer attached / To be advised</strong>
          <ul>
            <li>Kindly acknowledge receipt of this purchase order and return the confirmation to the purchaser.</li>
            <li>Please state the purchase order number on the delivery note and invoice.</li>
            <li>Attach a copy of the purchase order to the delivery documentation where required.</li>
            <li>Delivery, receiving hours, warranty, and supplier terms remain subject to the agreed commercial conditions.</li>
          </ul>
        </section>
      </div>
    `;
    document.body.appendChild(sheet);
    return sheet;
  }

  function installPrintStyle() {
    if (document.getElementById("purchase-order-print-style")) return;
    const style = document.createElement("style");
    style.id = "purchase-order-print-style";
    style.textContent = `
      #purchaseOrderPrintSheet { display: none; }
      @page { size: A4 portrait; margin: 10mm 11mm; }
      @media print {
        html, body { background: #fff !important; }
        body > .page-shell, body > .toast { display: none !important; }
        #purchaseOrderPrintSheet {
          display: block !important;
          color: #111;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 9pt;
          line-height: 1.25;
        }
        .po-print-page { width: 100%; }
        .po-print-header {
          display: grid;
          grid-template-columns: 1.08fr .92fr;
          gap: 16mm;
          min-height: 45mm;
        }
        .po-print-supplier h1 { margin: 5px 0 2px; font-size: 12pt; text-transform: uppercase; }
        .po-print-small-line { font-size: 8pt; }
        .po-print-address { margin-top: 2px; }
        .po-print-contact-grid, .po-print-meta {
          margin-top: 6px;
          display: grid;
          grid-template-columns: max-content 8px 1fr;
          gap: 1px 5px;
        }
        .po-print-brand { display: grid; align-content: start; gap: 9mm; }
        .po-print-logo {
          justify-self: end;
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 22pt;
          font-weight: 900;
          letter-spacing: -1px;
        }
        .po-print-logo i {
          width: 24px;
          height: 24px;
          display: block;
          border: 6px solid #222;
          border-radius: 3px;
          transform: rotate(45deg);
        }
        .po-print-reference {
          width: 58%;
          margin: 5mm 0 3mm;
          display: grid;
          gap: 3px;
        }
        .po-print-reference > div, .po-print-terms > div {
          display: grid;
          grid-template-columns: 42mm 5mm 1fr;
        }
        .po-print-intro { margin: 0 0 3mm; }
        .po-print-items {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .po-print-items th {
          padding: 2mm 1.5mm;
          border-top: 1px solid #111;
          border-bottom: 1px solid #111;
          text-align: left;
          font-weight: 700;
        }
        .po-print-items td {
          padding: 2mm 1.5mm;
          vertical-align: top;
          border: 0;
        }
        .po-print-items th:nth-child(1) { width: 8%; }
        .po-print-items th:nth-child(2) { width: 18%; }
        .po-print-items th:nth-child(3) { width: 32%; }
        .po-print-items th:nth-child(4) { width: 8%; }
        .po-print-items th:nth-child(5) { width: 8%; }
        .po-print-items th:nth-child(6) { width: 13%; }
        .po-print-items th:nth-child(7) { width: 13%; }
        .po-print-center { text-align: center; }
        .po-print-number { text-align: right; font-variant-numeric: tabular-nums; }
        .po-print-totals {
          width: 43%;
          margin: 4mm 0 5mm auto;
          display: grid;
          gap: 0;
        }
        .po-print-totals > div {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8mm;
          padding: 2.5mm 0;
          border-bottom: 1px solid #111;
        }
        .po-print-totals span { text-align: right; font-variant-numeric: tabular-nums; }
        .po-print-totals .grand-total { border-bottom: 3px double #111; }
        .po-print-terms { display: grid; gap: 2px; margin-top: 4mm; }
        .po-print-instructions { margin-top: 4mm; }
        .po-print-instructions ul { margin: 2mm 0 0 5mm; padding: 0; }
        .po-print-instructions li { margin: 1px 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function printPurchaseOrder() {
    installPrintStyle();
    const sheet = buildPrintSheet();
    if (!sheet) return;
    notify("Opening purchase order print preview");
    window.setTimeout(() => window.print(), 0);
  }

  function exportCsvViaOutput() {
    showOutput();
    window.setTimeout(() => {
      const exportButton = document.getElementById("outputCsvButton");
      if (exportButton && !exportButton.disabled) {
        exportButton.click();
      } else {
        notify("Select a purchase order before exporting");
      }
    }, 0);
  }

  function sortRows() {
    const rows = [...tableBody.rows];
    if (rows.length < 2) {
      notify("No item rows to sort");
      return;
    }
    const ascending = tableBody.dataset.sortDirection !== "asc";
    rows.sort((a, b) => {
      const left = a.cells[0]?.textContent?.trim() || "";
      const right = b.cells[0]?.textContent?.trim() || "";
      return left.localeCompare(right, undefined, { numeric: true }) * (ascending ? 1 : -1);
    });
    const fragment = document.createDocumentFragment();
    rows.forEach((row) => fragment.appendChild(row));
    tableBody.appendChild(fragment);
    tableBody.dataset.sortDirection = ascending ? "asc" : "desc";
    notify(`Items sorted ${ascending ? "ascending" : "descending"}`);
  }

  function filterRows() {
    const previous = tableBody.dataset.filterTerm || "";
    const term = window.prompt("Filter item rows by item, description, GR, status, or timeline:", previous);
    if (term === null) return;
    const normalized = term.trim().toLowerCase();
    tableBody.dataset.filterTerm = normalized;
    let visible = 0;
    for (const row of tableBody.rows) {
      const matches = !normalized || row.textContent.toLowerCase().includes(normalized);
      row.hidden = !matches;
      if (matches) visible += 1;
    }
    if (subtotalLine) subtotalLine.hidden = true;
    notify(normalized ? `${visible} item row${visible === 1 ? "" : "s"} matched` : "Item filter cleared");
  }

  function showSubtotal() {
    const netIndex = headerIndex("Net value");
    if (netIndex < 0) {
      notify("Net value column not found");
      return;
    }
    let subtotal = 0;
    let currency = "";
    const rows = visibleRows();
    for (const row of rows) {
      const text = row.cells[netIndex]?.textContent?.trim() || "";
      subtotal += parseAmount(text);
      currency ||= detectCurrency(text);
    }
    if (subtotalLine) {
      subtotalLine.textContent = `Visible subtotal (${rows.length} item${rows.length === 1 ? "" : "s"}): ${formatAmount(subtotal, currency)}`;
      subtotalLine.hidden = false;
    }
    notify("Visible subtotal calculated");
  }

  function toggleLayout() {
    document.body.classList.toggle("compact-grid");
    const compactToggle = document.getElementById("compactGridToggle");
    if (compactToggle) compactToggle.checked = document.body.classList.contains("compact-grid");
    notify(document.body.classList.contains("compact-grid") ? "Compact ALV layout enabled" : "Standard ALV layout enabled");
  }

  function scrollGrid(position) {
    if (!tableWrap) return;
    tableWrap.scrollTo({
      top: position === "top" ? 0 : tableWrap.scrollHeight,
      behavior: document.documentElement.classList.contains("performance-mode") ? "auto" : "smooth"
    });
    notify(position === "top" ? "First item row" : "Last item row");
  }

  function cycleSuggestion() {
    const options = [...(suggestions?.querySelectorAll("[data-po]") || [])];
    if (!options.length) {
      poSearch.focus();
      notify("Start typing to find purchase orders");
      return;
    }
    const current = Number(suggestions.dataset.activeIndex || -1);
    const next = (current + 1) % options.length;
    suggestions.dataset.activeIndex = String(next);
    options[next].focus();
    options[next].scrollIntoView({ block: "nearest" });
  }

  function executeCommand() {
    const input = document.getElementById("commandInput");
    const command = input?.value?.trim().toUpperCase() || "";
    const normalized = command.replace(/\s+/g, "");

    if (!normalized || normalized === "ZPOQUERY" || normalized === "/NZPOQUERY") {
      showDocuments();
      focusSearch();
      return;
    }
    if (normalized === "/N" || normalized === "/NEND") {
      clearSelection();
      showDocuments();
      return;
    }
    if (normalized === "/O" || normalized === "/OZPOQUERY") {
      window.open(window.location.href, "_blank", "noopener");
      notify("New session opened");
      return;
    }
    if (normalized === "CONTROL") {
      showControl();
      return;
    }
    if (normalized === "OUTPUT") {
      showOutput();
      return;
    }
    notify(`Transaction ${command} is not available`);
  }

  button("commandExecuteButton")?.addEventListener("click", executeCommand);
  button("commandInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") executeCommand();
  });
  button("commandHistoryButton")?.addEventListener("click", () => {
    notify("Available: ZPOQUERY, CONTROL, OUTPUT, /N, /O");
    button("commandInput")?.focus();
  });

  button("toolbarSaveButton")?.addEventListener("click", exportCsvViaOutput);
  button("toolbarBackButton")?.addEventListener("click", () => {
    if (documentTabs[0]?.getAttribute("aria-selected") !== "true") showDocuments();
    else if (hasSelectedPo()) clearSelection();
    else window.scrollTo({ top: 0, behavior: "smooth" });
  });
  button("toolbarExitButton")?.addEventListener("click", () => {
    clearSelection();
    showDocuments();
    window.scrollTo({ top: 0, behavior: "smooth" });
    notify("Returned to initial screen");
  });
  button("toolbarCancelButton")?.addEventListener("click", clearSelection);
  button("toolbarFindButton")?.addEventListener("click", focusSearch);
  button("toolbarFindNextButton")?.addEventListener("click", cycleSuggestion);
  button("toolbarNewSessionButton")?.addEventListener("click", () => {
    window.open(window.location.href, "_blank", "noopener");
    notify("New session opened");
  });
  button("toolbarRefreshButton")?.addEventListener("click", refreshSelection);

  document.querySelector('[data-app-action="select-file"]')?.addEventListener("click", () => fileInput.click());
  document.querySelector('[data-app-action="execute"]')?.addEventListener("click", executeSearch);
  document.querySelector('[data-app-action="technical"]')?.addEventListener("click", () => {
    showDocuments();
    if (detectedDetails) detectedDetails.open = true;
    document.getElementById("detectedColumnsSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    notify("Technical information displayed");
  });
  document.querySelector('[data-app-action="control"]')?.addEventListener("click", showControl);

  document.querySelectorAll("[data-menu-action]").forEach((menuButton) => {
    menuButton.addEventListener("click", () => {
      const action = menuButton.dataset.menuAction;
      if (action === "documents") showDocuments();
      else if (action === "edit") focusSearch();
      else if (action === "goto") {
        if (detectedDetails) detectedDetails.open = true;
        document.getElementById("detectedColumnsSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (action === "environment") showControl();
      else if (action === "system") notify("System: LOCAL / Client 100 / Browser session");
      else if (action === "help") notify("F8 Execute · F3 Back · Ctrl+P Print · /O New session");
    });
  });

  button("alvSortButton")?.addEventListener("click", sortRows);
  button("alvFilterButton")?.addEventListener("click", filterRows);
  button("alvSubtotalButton")?.addEventListener("click", showSubtotal);
  button("alvLayoutButton")?.addEventListener("click", toggleLayout);
  button("alvTopButton")?.addEventListener("click", () => scrollGrid("top"));
  button("alvBottomButton")?.addEventListener("click", () => scrollGrid("bottom"));

  document.addEventListener("keydown", (event) => {
    if (event.key === "F8") {
      event.preventDefault();
      executeSearch();
    } else if (event.key === "F3") {
      event.preventDefault();
      button("toolbarBackButton")?.click();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
      event.preventDefault();
      printPurchaseOrder();
    }
  });

  document.addEventListener("click", (event) => {
    const printControl = event.target.closest("#printButton, #toolbarPrintButton, #outputPrintButton");
    if (!printControl) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    printPurchaseOrder();
  }, true);

  installPrintStyle();
  notify("Ready");
})();