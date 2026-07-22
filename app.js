(() => {
  "use strict";

  const HEADER_ALIASES = {
    poNumber: ["po number", "po no", "po no.", "purchase order", "purchase order number", "document number", "doc num"],
    supplierCode: ["bpcode", "bp code", "vendor code", "supplier code", "business partner code"],
    supplierName: ["bpname", "bp name", "vendor name", "supplier name", "business partner name"],
    itemCode: ["stock item", "item code", "item no", "item number", "material code", "sku"],
    description: ["item/service description", "item service description", "item description", "description", "material description"],
    creator: ["creator of document", "creator", "created by", "buyer", "purchaser"],
    poDate: ["po date", "purchase order date", "document date", "posting date"],
    quantity: ["quantity", "qty", "po quantity", "ordered quantity"],
    priceCurrency: ["price currency", "po currency", "currency", "currency code"],
    price: ["price", "unit price", "item price", "po price", "unit cost"],
    totalPo: ["total po", "po total", "line total", "total price", "extended price", "net total"],
    currencyRate: ["currency rate", "exchange rate", "rate"],
    top: ["top", "terms of payment", "term of payment", "payment terms", "payment term", "payment condition", "credit terms"],
    grNumber: ["goods receipt no", "goods receipt number", "gr no", "gr number", "grn no", "grn number"],
    grDate: ["gr date", "grn date", "goods receipt date"],
    grItem: ["gr item", "gr item code", "goods receipt item"],
    grDescription: ["gr desc", "gr description", "goods receipt description"],
    cancelled: ["status cancel", "cancel status", "cancelled", "canceled", "is cancelled"],
    goodsReturnNumber: ["goods return no", "goods return number", "return no"],
    goodsReturnDate: ["goods return date", "return date"]
  };

  const FIELD_LABELS = {
    poNumber: "PO Number",
    supplierCode: "Supplier Code",
    supplierName: "Supplier Name",
    itemCode: "Item Code",
    description: "Description",
    creator: "Creator",
    poDate: "PO Date",
    quantity: "Quantity",
    priceCurrency: "Currency",
    price: "Unit Price",
    totalPo: "Total PO",
    currencyRate: "Currency Rate",
    top: "TOP / Payment Terms",
    grNumber: "Goods Receipt No.",
    grDate: "GR Date",
    cancelled: "Cancellation Status",
    goodsReturnNumber: "Goods Return No.",
    goodsReturnDate: "Goods Return Date"
  };

  const state = {
    rows: [],
    headers: [],
    mapping: {},
    poIndex: new Map(),
    poNumbers: [],
    currentPo: null,
    fileName: "",
    sheetName: ""
  };

  const el = {
    uploadPanel: document.getElementById("uploadPanel"),
    fileInput: document.getElementById("fileInput"),
    chooseFileButton: document.getElementById("chooseFileButton"),
    changeFileButton: document.getElementById("changeFileButton"),
    workspace: document.getElementById("workspace"),
    fileName: document.getElementById("fileName"),
    fileMeta: document.getElementById("fileMeta"),
    sheetBadge: document.getElementById("sheetBadge"),
    searchForm: document.getElementById("searchForm"),
    poSearch: document.getElementById("poSearch"),
    clearSearchButton: document.getElementById("clearSearchButton"),
    suggestions: document.getElementById("suggestions"),
    searchHint: document.getElementById("searchHint"),
    welcomeState: document.getElementById("welcomeState"),
    noResultState: document.getElementById("noResultState"),
    noResultMessage: document.getElementById("noResultMessage"),
    poResult: document.getElementById("poResult"),
    resultPoNumber: document.getElementById("resultPoNumber"),
    resultStatus: document.getElementById("resultStatus"),
    resultSupplier: document.getElementById("resultSupplier"),
    summaryGrid: document.getElementById("summaryGrid"),
    topNotice: document.getElementById("topNotice"),
    itemCountBadge: document.getElementById("itemCountBadge"),
    itemsTableBody: document.getElementById("itemsTableBody"),
    detectedColumns: document.getElementById("detectedColumns"),
    copySummaryButton: document.getElementById("copySummaryButton"),
    copyExcelButton: document.getElementById("copyExcelButton"),
    printButton: document.getElementById("printButton"),
    toast: document.getElementById("toast")
  };

  function canonicalize(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function normalizePo(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
    return String(value).trim().replace(/\.0+$/, "");
  }

  function detectMapping(headers) {
    const normalizedHeaders = headers.map((header) => ({ original: header, normalized: canonicalize(header) }));
    const mapping = {};

    Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
      const normalizedAliases = aliases.map(canonicalize);
      let match = normalizedHeaders.find((header) => normalizedAliases.includes(header.normalized));

      if (!match) {
        match = normalizedHeaders.find((header) =>
          normalizedAliases.some((alias) => alias.length >= 5 && header.normalized.includes(alias))
        );
      }

      mapping[field] = match?.original ?? null;
    });

    return mapping;
  }

  function getValue(row, field) {
    const header = state.mapping[field];
    return header ? row[header] : "";
  }

  function parseNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value === null || value === undefined || value === "") return 0;

    let text = String(value).trim().replace(/\s/g, "").replace(/[^0-9,.-]/g, "");
    if (!text) return 0;

    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");

    if (lastComma >= 0 && lastDot >= 0) {
      if (lastComma > lastDot) text = text.replace(/\./g, "").replace(",", ".");
      else text = text.replace(/,/g, "");
    } else if (lastComma >= 0) {
      const decimalDigits = text.length - lastComma - 1;
      text = decimalDigits > 0 && decimalDigits <= 2 ? text.replace(",", ".") : text.replace(/,/g, "");
    } else if (lastDot >= 0) {
      const decimalDigits = text.length - lastDot - 1;
      if (decimalDigits === 3 && text.split(".").length > 1) text = text.replace(/\./g, "");
    }

    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatNumber(value, maximumFractionDigits = 2) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits
    }).format(parseNumber(value));
  }

  function formatMoney(value, currency) {
    const numeric = parseNumber(value);
    const symbol = String(currency || "").trim();
    const fractionDigits = Number.isInteger(numeric) ? 0 : 2;
    const amount = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: 2
    }).format(numeric);
    return symbol ? `${symbol} ${amount}` : amount;
  }

  function formatDate(value) {
    if (value === null || value === undefined || value === "") return "—";

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(value);
    }

    if (typeof value === "number" && window.XLSX?.SSF) {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const date = new Date(parsed.y, parsed.m - 1, parsed.d);
        return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
      }
    }

    const text = String(value).trim();
    const parts = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
    if (parts) {
      const year = Number(parts[3]) < 100 ? 2000 + Number(parts[3]) : Number(parts[3]);
      const date = new Date(year, Number(parts[2]) - 1, Number(parts[1]));
      if (!Number.isNaN(date.getTime())) {
        return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
      }
    }

    return text || "—";
  }

  function isCancelled(value) {
    return ["y", "yes", "true", "1", "cancelled", "canceled"].includes(String(value ?? "").trim().toLowerCase());
  }

  function firstNonEmpty(rows, field) {
    for (const row of rows) {
      const value = getValue(row, field);
      if (value !== null && value !== undefined && String(value).trim() !== "") return value;
    }
    return "";
  }

  function uniqueValues(rows, field) {
    return [...new Set(rows.map((row) => String(getValue(row, field) ?? "").trim()).filter(Boolean))];
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function buildPoIndex(rows) {
    const index = new Map();
    rows.forEach((row) => {
      const po = normalizePo(getValue(row, "poNumber"));
      if (!po) return;
      if (!index.has(po)) index.set(po, []);
      index.get(po).push(row);
    });
    return index;
  }

  function buildLineItems(rows) {
    const grouped = new Map();

    rows.forEach((row, rowIndex) => {
      const itemCode = String(getValue(row, "itemCode") ?? "").trim();
      const description = String(getValue(row, "description") ?? "").trim();
      const quantity = getValue(row, "quantity");
      const price = getValue(row, "price");
      const totalPo = getValue(row, "totalPo");
      const currency = String(getValue(row, "priceCurrency") ?? "").trim();

      const lineKey = [itemCode, description, parseNumber(quantity), currency, parseNumber(price), parseNumber(totalPo)].join("¦") || `row-${rowIndex}`;

      if (!grouped.has(lineKey)) {
        grouped.set(lineKey, {
          itemCode,
          description,
          quantity,
          price,
          totalPo,
          currency,
          receipts: [],
          hasActiveReceipt: false,
          hasReturn: false
        });
      }

      const item = grouped.get(lineKey);
      const grNumber = normalizePo(getValue(row, "grNumber"));
      const grDate = getValue(row, "grDate");
      const cancelled = isCancelled(getValue(row, "cancelled"));
      const returnNumber = normalizePo(getValue(row, "goodsReturnNumber"));

      if (grNumber) {
        const receiptKey = `${grNumber}|${formatDate(grDate)}|${cancelled}`;
        if (!item.receipts.some((receipt) => receipt.key === receiptKey)) {
          item.receipts.push({ key: receiptKey, number: grNumber, date: formatDate(grDate), cancelled });
        }
        if (!cancelled) item.hasActiveReceipt = true;
      }
      if (returnNumber) item.hasReturn = true;
    });

    return [...grouped.values()];
  }

  function getPoStatus(items) {
    const hasReceipt = items.some((item) => item.hasActiveReceipt);
    const allHaveReceipt = items.length > 0 && items.every((item) => item.hasActiveReceipt);
    const hasReturn = items.some((item) => item.hasReturn);

    if (hasReturn) return { label: "Has goods return", className: "danger" };
    if (allHaveReceipt) return { label: "All items have GR", className: "success" };
    if (hasReceipt) return { label: "Partially received", className: "warning" };
    return { label: "Open / no GR", className: "warning" };
  }

  function getTotalPo(rows, items) {
    const uniqueLineTotal = items.reduce((sum, item) => sum + parseNumber(item.totalPo), 0);
    if (uniqueLineTotal) return uniqueLineTotal;
    return parseNumber(firstNonEmpty(rows, "totalPo"));
  }

  function getCurrency(rows, items) {
    const currencies = [...new Set(items.map((item) => item.currency).filter(Boolean))];
    if (currencies.length === 1) return currencies[0];
    if (currencies.length > 1) return "Multiple currencies";
    return String(firstNonEmpty(rows, "priceCurrency") || "").trim();
  }

  function createSummaryCard(label, value, highlight = false) {
    return `<article class="summary-card${highlight ? " highlight" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "—")}</strong></article>`;
  }

  function renderDetectedColumns() {
    el.detectedColumns.innerHTML = Object.entries(FIELD_LABELS)
      .map(([field, label]) => {
        const header = state.mapping[field];
        return `<span class="column-chip${header ? "" : " missing"}">${escapeHtml(label)}: ${escapeHtml(header || "not found")}</span>`;
      })
      .join("");
  }

  function renderPo(poNumber) {
    const rows = state.poIndex.get(poNumber);
    if (!rows?.length) return showNoResult(poNumber);

    state.currentPo = poNumber;
    const items = buildLineItems(rows);
    const supplierName = firstNonEmpty(rows, "supplierName") || "Unknown supplier";
    const supplierCode = firstNonEmpty(rows, "supplierCode");
    const creator = firstNonEmpty(rows, "creator");
    const poDate = formatDate(firstNonEmpty(rows, "poDate"));
    const top = firstNonEmpty(rows, "top");
    const currency = getCurrency(rows, items);
    const totalPo = getTotalPo(rows, items);
    const receiptNumbers = uniqueValues(rows.filter((row) => !isCancelled(getValue(row, "cancelled"))), "grNumber");
    const returnNumbers = uniqueValues(rows, "goodsReturnNumber");
    const status = getPoStatus(items);

    el.resultPoNumber.textContent = poNumber;
    el.resultSupplier.textContent = supplierCode ? `${supplierName} · ${supplierCode}` : supplierName;
    el.resultStatus.textContent = status.label;
    el.resultStatus.className = `status-badge ${status.className}`;

    const totalText = currency === "Multiple currencies" ? "Multiple currencies" : formatMoney(totalPo, currency);
    el.summaryGrid.innerHTML = [
      createSummaryCard("Supplier", supplierName),
      createSummaryCard("PO date", poDate),
      createSummaryCard("Created by", creator || "—"),
      createSummaryCard("TOP / Payment terms", top || "Not available", true),
      createSummaryCard("PO value", totalText),
      createSummaryCard("Unique items", String(items.length)),
      createSummaryCard("Goods receipts", receiptNumbers.length ? `${receiptNumbers.length} document${receiptNumbers.length === 1 ? "" : "s"}` : "No active GR"),
      createSummaryCard("Goods returns", returnNumbers.length ? `${returnNumbers.length} return${returnNumbers.length === 1 ? "" : "s"}` : "None")
    ].join("");

    el.topNotice.hidden = Boolean(state.mapping.top);
    el.itemCountBadge.textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;

    el.itemsTableBody.innerHTML = items.map((item) => {
      const receiptMarkup = item.receipts.length
        ? `<div class="gr-list">${item.receipts.map((receipt) => `<span class="gr-chip${receipt.cancelled ? " cancelled" : ""}" title="${receipt.cancelled ? "Cancelled receipt" : "Goods receipt"}">${escapeHtml(receipt.number)} · ${escapeHtml(receipt.date)}</span>`).join("")}</div>`
        : `<span class="muted-value">No GR</span>`;
      const rowStatus = item.hasReturn
        ? `<span class="row-status open">Returned</span>`
        : item.hasActiveReceipt
          ? `<span class="row-status received">Has GR</span>`
          : `<span class="row-status open">Open</span>`;

      return `<tr>
        <td class="item-code">${escapeHtml(item.itemCode || "—")}</td>
        <td class="item-description">${escapeHtml(item.description || "—")}</td>
        <td class="number-cell">${escapeHtml(formatNumber(item.quantity))}</td>
        <td class="number-cell">${escapeHtml(formatMoney(item.price, item.currency))}</td>
        <td class="number-cell">${escapeHtml(formatMoney(item.totalPo, item.currency))}</td>
        <td>${receiptMarkup}</td>
        <td>${rowStatus}</td>
      </tr>`;
    }).join("");

    el.welcomeState.hidden = true;
    el.noResultState.hidden = true;
    el.poResult.hidden = false;
    el.suggestions.hidden = true;
    el.searchHint.textContent = `${rows.length.toLocaleString("en-US")} source row${rows.length === 1 ? "" : "s"} found for this PO.`;
    renderDetectedColumns();
  }

  function showNoResult(query) {
    state.currentPo = null;
    el.welcomeState.hidden = true;
    el.poResult.hidden = true;
    el.noResultState.hidden = false;
    el.noResultMessage.textContent = query ? `No PO number matched “${query}”. Check the number or choose a suggestion.` : "Enter a PO number and try again.";
  }

  function findMatches(query, limit = 8) {
    const normalizedQuery = normalizePo(query).toLowerCase();
    if (!normalizedQuery) return [];
    return state.poNumbers
      .filter((po) => po.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
        const bStarts = b.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b, undefined, { numeric: true });
      })
      .slice(0, limit);
  }

  function renderSuggestions(query) {
    const matches = findMatches(query);
    el.clearSearchButton.hidden = !query;

    if (!query) {
      el.suggestions.hidden = true;
      el.searchHint.textContent = "Start typing a PO number to see matching records.";
      return;
    }

    if (!matches.length) {
      el.suggestions.hidden = true;
      el.searchHint.textContent = "No matching PO numbers in the imported file.";
      return;
    }

    el.suggestions.innerHTML = matches.map((po) => {
      const rows = state.poIndex.get(po) || [];
      const supplier = firstNonEmpty(rows, "supplierName") || "Unknown supplier";
      return `<button class="suggestion-button" type="button" data-po="${escapeHtml(po)}"><strong>${escapeHtml(po)}</strong><span>${escapeHtml(supplier)}</span></button>`;
    }).join("");
    el.suggestions.hidden = false;
    el.searchHint.textContent = `${matches.length} suggested match${matches.length === 1 ? "" : "es"}.`;
  }

  async function importFile(file) {
    if (!file) return;
    if (!window.XLSX) {
      showToast("Excel reader could not load. Check your internet connection and refresh.");
      return;
    }

    try {
      setLoading(true);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: true });

      if (!rows.length) throw new Error("The first worksheet does not contain any data rows.");

      const headers = Object.keys(rows[0]);
      const mapping = detectMapping(headers);
      if (!mapping.poNumber) {
        throw new Error("A PO number column was not found. Use a header such as ‘PO Number’, ‘PO No’, or ‘Purchase Order Number’. ");
      }

      state.rows = rows;
      state.headers = headers;
      state.mapping = mapping;
      state.poIndex = buildPoIndex(rows);
      state.poNumbers = [...state.poIndex.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      state.currentPo = null;
      state.fileName = file.name;
      state.sheetName = sheetName;

      el.fileName.textContent = file.name;
      el.fileMeta.textContent = `${rows.length.toLocaleString("en-US")} rows · ${state.poNumbers.length.toLocaleString("en-US")} purchase orders`;
      el.sheetBadge.textContent = `Sheet: ${sheetName}`;
      el.workspace.hidden = false;
      el.poSearch.value = "";
      el.clearSearchButton.hidden = true;
      el.welcomeState.hidden = false;
      el.noResultState.hidden = true;
      el.poResult.hidden = true;
      el.suggestions.hidden = true;
      el.searchHint.textContent = "Start typing a PO number to see matching records.";
      renderDetectedColumns();

      setTimeout(() => {
        el.workspace.scrollIntoView({ behavior: "smooth", block: "start" });
        el.poSearch.focus({ preventScroll: true });
      }, 70);

      showToast(`${state.poNumbers.length.toLocaleString("en-US")} purchase orders loaded`);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "The Excel file could not be imported.");
    } finally {
      setLoading(false);
      el.fileInput.value = "";
    }
  }

  function setLoading(isLoading) {
    el.chooseFileButton.disabled = isLoading;
    el.chooseFileButton.textContent = isLoading ? "Reading file…" : "Choose Excel file";
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => el.toast.classList.remove("show"), 2400);
  }

  function buildSummaryText() {
    if (!state.currentPo) return "";
    const rows = state.poIndex.get(state.currentPo) || [];
    const items = buildLineItems(rows);
    const currency = getCurrency(rows, items);
    const total = getTotalPo(rows, items);
    const lines = [
      `PO Number: ${state.currentPo}`,
      `Supplier: ${firstNonEmpty(rows, "supplierName") || "—"}`,
      `Supplier Code: ${firstNonEmpty(rows, "supplierCode") || "—"}`,
      `PO Date: ${formatDate(firstNonEmpty(rows, "poDate"))}`,
      `Created By: ${firstNonEmpty(rows, "creator") || "—"}`,
      `TOP: ${firstNonEmpty(rows, "top") || "Not available in workbook"}`,
      `PO Value: ${currency === "Multiple currencies" ? currency : formatMoney(total, currency)}`,
      "",
      "Items:"
    ];

    items.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.itemCode || "—"} — ${item.description || "—"} | Qty ${formatNumber(item.quantity)} | ${formatMoney(item.price, item.currency)} each | ${formatMoney(item.totalPo, item.currency)}`);
    });

    return lines.join("\n");
  }

  function sanitizeExcelCell(value) {
    return String(value ?? "")
      .replace(/[\t\r\n]+/g, " ")
      .trim();
  }

  function buildExcelText() {
    if (!state.currentPo) return { text: "", rowCount: 0 };

    const rows = state.poIndex.get(state.currentPo) || [];
    const excelRows = [];

    buildLineItems(rows).forEach((item) => {
      const grNumbers = item.receipts.length
        ? item.receipts.map((receipt) => receipt.number)
        : [""];

      grNumbers.forEach((grNumber) => {
        excelRows.push([
          sanitizeExcelCell(item.description),
          sanitizeExcelCell(state.currentPo),
          sanitizeExcelCell(grNumber)
        ].join("\t"));
      });
    });

    return { text: excelRows.join("\n"), rowCount: excelRows.length };
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("Copy command was unavailable");
  }

  el.chooseFileButton.addEventListener("click", () => el.fileInput.click());
  el.changeFileButton.addEventListener("click", () => el.fileInput.click());
  el.fileInput.addEventListener("change", (event) => importFile(event.target.files?.[0]));

  ["dragenter", "dragover"].forEach((eventName) => {
    el.uploadPanel.addEventListener(eventName, (event) => {
      event.preventDefault();
      el.uploadPanel.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    el.uploadPanel.addEventListener(eventName, (event) => {
      event.preventDefault();
      el.uploadPanel.classList.remove("is-dragging");
    });
  });
  el.uploadPanel.addEventListener("drop", (event) => importFile(event.dataTransfer?.files?.[0]));

  el.poSearch.addEventListener("input", (event) => renderSuggestions(event.target.value.trim()));
  el.poSearch.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      el.suggestions.hidden = true;
      el.poSearch.blur();
    }
  });

  el.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = normalizePo(el.poSearch.value);
    if (!query) return showNoResult("");

    if (state.poIndex.has(query)) return renderPo(query);
    const matches = findMatches(query, 50);
    if (matches.length === 1) {
      el.poSearch.value = matches[0];
      return renderPo(matches[0]);
    }
    showNoResult(query);
  });

  el.suggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-po]");
    if (!button) return;
    const po = button.dataset.po;
    el.poSearch.value = po;
    renderPo(po);
  });

  el.clearSearchButton.addEventListener("click", () => {
    el.poSearch.value = "";
    el.clearSearchButton.hidden = true;
    el.suggestions.hidden = true;
    el.poSearch.focus();
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-panel")) el.suggestions.hidden = true;
  });

  el.copySummaryButton.addEventListener("click", async () => {
    const text = buildSummaryText();
    if (!text) return;
    try {
      await copyText(text);
      showToast("PO summary copied");
    } catch (error) {
      console.error(error);
      showToast("Unable to copy PO summary");
    }
  });

  el.copyExcelButton.addEventListener("click", async () => {
    const { text, rowCount } = buildExcelText();
    if (!text) return;
    try {
      await copyText(text);
      showToast(`${rowCount} Excel row${rowCount === 1 ? "" : "s"} copied`);
    } catch (error) {
      console.error(error);
      showToast("Unable to copy Excel rows");
    }
  });

  el.printButton.addEventListener("click", () => window.print());
})();
