(() => {
  "use strict";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const tabs = $$(".sap-tabs .sap-tab");
  const searchForm = $("#searchForm");
  const poSearch = $("#poSearch");
  const workspace = $("#workspace");
  const poResult = $("#poResult");
  const welcomeState = $("#welcomeState");
  const noResultState = $("#noResultState");
  const clearSearchButton = $("#clearSearchButton");
  const chooseFileButton = $("#chooseFileButton");
  const itemsTableBody = $("#itemsTableBody");
  const tableWrap = $(".table-wrap");
  const footerStatus = $("#footerStatusText");
  const toast = $("#toast");
  const subtotalLine = $("#alvSubtotalLine");

  let sortAscending = true;
  let activeFilter = "";

  function setStatus(message, kind = "ready") {
    if (footerStatus) footerStatus.textContent = message;
    const icon = $(".footer-status-icon");
    if (icon) {
      icon.textContent = kind === "error" ? "×" : kind === "warning" ? "!" : "✓";
      icon.style.color = kind === "error" ? "#9f0000" : kind === "warning" ? "#9b5a00" : "#1c6b28";
    }
  }

  function notify(message, kind = "ready") {
    setStatus(message, kind);
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => toast.classList.remove("show"), 2100);
  }

  function showTab(index, focus = false) {
    const button = tabs[index];
    if (!button) return;
    button.click();
    if (focus) button.focus();
  }

  function showDocuments() {
    showTab(0);
  }

  function selectedPoNumber() {
    return $("#resultPoNumber")?.textContent?.trim() || "";
  }

  function hasSelectedPo() {
    return Boolean(selectedPoNumber()) && poResult && !poResult.hidden;
  }

  function focusSearch(selectText = false) {
    showDocuments();
    if (workspace?.hidden) {
      chooseFileButton?.focus();
      notify("Select an Excel workbook first", "warning");
      return;
    }
    window.requestAnimationFrame(() => {
      poSearch?.focus({ preventScroll: false });
      if (selectText) poSearch?.select();
    });
  }

  function executeSearch() {
    showDocuments();
    if (workspace?.hidden) {
      chooseFileButton?.click();
      notify("Choose a workbook to begin", "warning");
      return;
    }
    if (!poSearch?.value.trim()) {
      focusSearch();
      notify("Enter a purchase order number", "warning");
      return;
    }
    searchForm?.requestSubmit();
    notify(`Executing PO ${poSearch.value.trim()}`);
  }

  function clearCurrentDocument() {
    showDocuments();
    if (poSearch) {
      poSearch.value = "";
      poSearch.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (clearSearchButton) clearSearchButton.hidden = true;
    const suggestions = $("#suggestions");
    if (suggestions) suggestions.hidden = true;
    if (poResult) poResult.hidden = true;
    if (noResultState) noResultState.hidden = true;
    if (welcomeState) welcomeState.hidden = false;
    if (subtotalLine) subtotalLine.hidden = true;
    activeFilter = "";
    for (const row of itemsTableBody?.rows || []) row.hidden = false;
    focusSearch();
    notify("Selection cleared");
  }

  function exportCurrentDocument() {
    if (!hasSelectedPo()) {
      notify("Select a purchase order before exporting", "warning");
      return;
    }
    const exportButton = $("#outputCsvButton");
    if (!exportButton) {
      notify("Output controls are not available", "error");
      return;
    }
    exportButton.click();
    notify(`Exporting PO ${selectedPoNumber()}`);
  }

  function printCurrentDocument() {
    if (!hasSelectedPo()) {
      notify("Select a purchase order before printing", "warning");
      return;
    }
    $("#printButton")?.click();
  }

  function showTechnicalInfo() {
    showDocuments();
    const details = $("#detectedColumnsSection details");
    if (!details) {
      notify("Load a workbook to view technical information", "warning");
      return;
    }
    details.open = true;
    details.scrollIntoView({ behavior: document.documentElement.classList.contains("performance-mode") ? "auto" : "smooth", block: "center" });
    notify("Technical information displayed");
  }

  function gotoDocument() {
    showDocuments();
    if (!hasSelectedPo()) {
      focusSearch();
      notify("Select a purchase order first", "warning");
      return;
    }
    poResult.scrollIntoView({ behavior: document.documentElement.classList.contains("performance-mode") ? "auto" : "smooth", block: "start" });
    notify(`Displaying PO ${selectedPoNumber()}`);
  }

  function showHelp() {
    let dialog = $("#sapHelpDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "sapHelpDialog";
      dialog.className = "help-dialog";
      dialog.innerHTML = `
        <header>PO Query — SAP Help</header>
        <div class="help-body">
          <strong>Available transaction commands</strong>
          <div><code>ZPOQUERY</code> Open Documents</div>
          <div><code>ZCONTROL</code> Open Review Controls</div>
          <div><code>ZOUTPUT</code> Open Output Control</div>
          <div><code>ZTECH</code> Show detected workbook columns</div>
          <div><code>PRINT</code> Print the selected purchase order</div>
          <div><code>EXPORT</code> Export the selected item grid to CSV</div>
          <div><code>/N</code> Clear the current selection</div>
          <strong>Keyboard</strong>
          <div>F8 Execute · F3 Back · Esc Cancel · Ctrl/Cmd+P Print</div>
        </div>
        <footer><button class="sap-action-button" type="button">Close</button></footer>
      `;
      document.body.appendChild(dialog);
      $("button", dialog).addEventListener("click", () => dialog.close());
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    }
    if (typeof dialog.showModal === "function") dialog.showModal();
    else alert("Commands: ZPOQUERY, ZCONTROL, ZOUTPUT, ZTECH, PRINT, EXPORT, /N");
    notify("Help opened");
  }

  function executeCommand() {
    const input = $("#commandInput");
    const command = input?.value.trim().toUpperCase().replace(/\s+/g, "") || "ZPOQUERY";
    const actions = {
      "ZPOQUERY": () => { showDocuments(); notify("Transaction ZPOQUERY"); },
      "/NZPOQUERY": () => { clearCurrentDocument(); showDocuments(); },
      "ZCONTROL": () => { showTab(1); notify("Review Controls"); },
      "/NZCONTROL": () => { showTab(1); notify("Review Controls"); },
      "ZOUTPUT": () => { showTab(2); notify("Output Control"); },
      "/NZOUTPUT": () => { showTab(2); notify("Output Control"); },
      "ZTECH": showTechnicalInfo,
      "PRINT": printCurrentDocument,
      "EXPORT": exportCurrentDocument,
      "/N": clearCurrentDocument,
      "HELP": showHelp
    };

    const action = actions[command];
    if (action) action();
    else {
      notify(`Transaction ${command} does not exist`, "error");
      input?.focus();
      input?.select();
    }
  }

  function nextSuggestion() {
    showDocuments();
    if (workspace?.hidden) {
      chooseFileButton?.click();
      return;
    }
    poSearch?.dispatchEvent(new Event("input", { bubbles: true }));
    window.requestAnimationFrame(() => {
      const first = $("#suggestions .suggestion-button");
      if (first) {
        first.focus();
        notify("First matching purchase order selected");
      } else {
        focusSearch(true);
        notify("No matching suggestion available", "warning");
      }
    });
  }

  function openNewSession() {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
    notify("New local session opened");
  }

  function refreshApplication() {
    notify("Refreshing application");
    window.setTimeout(() => window.location.reload(), 120);
  }

  function exitApplication() {
    if (window.confirm("Exit PO Query and clear the local workbook session?")) {
      window.location.reload();
    }
  }

  function parseNumericCell(text) {
    let value = String(text || "").replace(/\s+/g, " ").trim().replace(/[^0-9,.-]/g, "");
    if (!value) return 0;
    const comma = value.lastIndexOf(",");
    const dot = value.lastIndexOf(".");
    if (comma >= 0 && dot >= 0) {
      value = comma > dot ? value.replace(/\./g, "").replace(",", ".") : value.replace(/,/g, "");
    } else if (comma >= 0) {
      const digits = value.length - comma - 1;
      value = digits > 0 && digits <= 2 ? value.replace(",", ".") : value.replace(/,/g, "");
    } else if (dot >= 0) {
      const digits = value.length - dot - 1;
      if (digits === 3) value = value.replace(/\./g, "");
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function visibleRows() {
    return [...(itemsTableBody?.rows || [])].filter((row) => !row.hidden);
  }

  function sortRows() {
    if (!itemsTableBody || !itemsTableBody.rows.length) {
      notify("Select a purchase order first", "warning");
      return;
    }
    const rows = [...itemsTableBody.rows];
    rows.sort((a, b) => {
      const left = a.cells[0]?.textContent?.trim() || "";
      const right = b.cells[0]?.textContent?.trim() || "";
      return left.localeCompare(right, undefined, { numeric: true }) * (sortAscending ? 1 : -1);
    });
    const fragment = document.createDocumentFragment();
    rows.forEach((row) => fragment.appendChild(row));
    itemsTableBody.appendChild(fragment);
    notify(`Items sorted ${sortAscending ? "ascending" : "descending"}`);
    sortAscending = !sortAscending;
  }

  function filterRows() {
    if (!itemsTableBody || !itemsTableBody.rows.length) {
      notify("Select a purchase order first", "warning");
      return;
    }
    const query = window.prompt("Filter item grid by item, description, GR, status, or date:", activeFilter);
    if (query === null) return;
    activeFilter = query.trim().toLowerCase();
    let visible = 0;
    for (const row of itemsTableBody.rows) {
      row.hidden = Boolean(activeFilter) && !row.textContent.toLowerCase().includes(activeFilter);
      if (!row.hidden) visible += 1;
    }
    $("#alvFilterButton").textContent = activeFilter ? `Filter (${visible})` : "Filter";
    notify(activeFilter ? `${visible} item rows match the filter` : "Item filter cleared");
  }

  function calculateSubtotal() {
    const rows = visibleRows();
    if (!rows.length) {
      notify("No visible item rows to subtotal", "warning");
      return;
    }
    let quantity = 0;
    let netValue = 0;
    let currency = "";
    for (const row of rows) {
      quantity += parseNumericCell(row.cells[2]?.textContent);
      netValue += parseNumericCell(row.cells[4]?.textContent);
      if (!currency) {
        currency = (row.cells[4]?.textContent?.match(/^[A-Za-z]{3}/)?.[0] || "").toUpperCase();
      }
    }
    const formattedQuantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(quantity);
    const formattedValue = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(netValue);
    if (subtotalLine) {
      subtotalLine.textContent = `Visible lines: ${rows.length}    Quantity: ${formattedQuantity}    Net value: ${currency ? `${currency} ` : ""}${formattedValue}`;
      subtotalLine.hidden = false;
    }
    notify(`Subtotal calculated for ${rows.length} lines`);
  }

  function toggleLayout() {
    const toggle = $("#compactGridToggle");
    if (toggle) {
      toggle.checked = !toggle.checked;
      toggle.dispatchEvent(new Event("change", { bubbles: true }));
      $("#alvLayoutButton").textContent = toggle.checked ? "Layout: Compact" : "Layout";
      notify(toggle.checked ? "Compact ALV layout enabled" : "Standard ALV layout enabled");
      return;
    }
    document.body.classList.toggle("compact-grid");
    notify(document.body.classList.contains("compact-grid") ? "Compact ALV layout enabled" : "Standard ALV layout enabled");
  }

  function scrollGrid(toBottom) {
    if (!tableWrap || !itemsTableBody?.rows.length) {
      notify("Select a purchase order first", "warning");
      return;
    }
    tableWrap.scrollTo({
      top: toBottom ? tableWrap.scrollHeight : 0,
      behavior: document.documentElement.classList.contains("performance-mode") ? "auto" : "smooth"
    });
    notify(toBottom ? "Moved to last item" : "Moved to first item");
  }

  $$(".sap-menu [data-menu-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.menuAction;
      if (action === "documents") showDocuments();
      else if (action === "edit") focusSearch(true);
      else if (action === "goto") gotoDocument();
      else if (action === "environment") showTechnicalInfo();
      else if (action === "system") showTab(1);
      else if (action === "help") showHelp();
    });
  });

  $("#commandExecuteButton")?.addEventListener("click", executeCommand);
  $("#commandInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") executeCommand();
  });
  $("#commandHistoryButton")?.addEventListener("click", showHelp);
  $("#toolbarSaveButton")?.addEventListener("click", exportCurrentDocument);
  $("#toolbarBackButton")?.addEventListener("click", () => { showDocuments(); window.scrollTo({ top: 0, behavior: "smooth" }); notify("Back to Documents"); });
  $("#toolbarExitButton")?.addEventListener("click", exitApplication);
  $("#toolbarCancelButton")?.addEventListener("click", clearCurrentDocument);
  $("#toolbarPrintButton")?.addEventListener("click", printCurrentDocument);
  $("#toolbarFindButton")?.addEventListener("click", () => focusSearch(true));
  $("#toolbarFindNextButton")?.addEventListener("click", nextSuggestion);
  $("#toolbarNewSessionButton")?.addEventListener("click", openNewSession);
  $("#toolbarRefreshButton")?.addEventListener("click", refreshApplication);

  $$('[data-app-action]').forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.appAction;
      if (action === "select-file") chooseFileButton?.click();
      else if (action === "execute") executeSearch();
      else if (action === "technical") showTechnicalInfo();
      else if (action === "control") showTab(1);
    });
  });

  $("#alvSortButton")?.addEventListener("click", sortRows);
  $("#alvFilterButton")?.addEventListener("click", filterRows);
  $("#alvSubtotalButton")?.addEventListener("click", calculateSubtotal);
  $("#alvLayoutButton")?.addEventListener("click", toggleLayout);
  $("#alvTopButton")?.addEventListener("click", () => scrollGrid(false));
  $("#alvBottomButton")?.addEventListener("click", () => scrollGrid(true));

  chooseFileButton?.addEventListener("click", () => setStatus("Select a workbook"));
  searchForm?.addEventListener("submit", () => setStatus("Purchase order search executed"));
  $("#copySummaryButton")?.addEventListener("click", () => setStatus("Purchase order summary copied"));
  $("#printButton")?.addEventListener("click", () => setStatus("Print dialog opened"));

  document.addEventListener("keydown", (event) => {
    if (event.key === "F8") {
      event.preventDefault();
      executeSearch();
    } else if (event.key === "F3") {
      event.preventDefault();
      showDocuments();
      notify("Back to Documents");
    } else if (event.key === "Escape" && !$("#sapHelpDialog")?.open) {
      clearCurrentDocument();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
      if (hasSelectedPo()) {
        event.preventDefault();
        printCurrentDocument();
      }
    }
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => setStatus(`${tab.textContent.trim()} tab active`));
  });

  setStatus("Ready — transaction ZPOQUERY");
})();
