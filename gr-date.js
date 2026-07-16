(() => {
  "use strict";

  const tableBody = document.getElementById("itemsTableBody");
  const headerRow = tableBody?.closest("table")?.querySelector("thead tr");

  function ensureGrDateHeader() {
    if (!headerRow || headerRow.querySelector('[data-column="gr-date"]')) return;
    const statusHeader = headerRow.lastElementChild;
    const grDateHeader = document.createElement("th");
    grDateHeader.dataset.column = "gr-date";
    grDateHeader.textContent = "GR Date";
    headerRow.insertBefore(grDateHeader, statusHeader);
  }

  function splitReceiptLabel(label) {
    const separator = " · ";
    const separatorIndex = label.lastIndexOf(separator);
    if (separatorIndex === -1) return { number: label.trim(), date: "—" };

    return {
      number: label.slice(0, separatorIndex).trim(),
      date: label.slice(separatorIndex + separator.length).trim() || "—"
    };
  }

  function renderGrDates() {
    if (!tableBody || !headerRow) return;
    ensureGrDateHeader();

    tableBody.querySelectorAll(":scope > tr").forEach((row) => {
      const cells = [...row.children];
      if (cells.length < 7) return;

      const receiptCell = cells[5];
      const statusCell = cells[cells.length - 1];
      const receipts = [...receiptCell.querySelectorAll(".gr-chip")].map((chip) => {
        const receipt = splitReceiptLabel(chip.textContent || "");
        chip.textContent = receipt.number || "—";
        return {
          date: receipt.date,
          cancelled: chip.classList.contains("cancelled")
        };
      });

      let dateCell = row.querySelector(":scope > .gr-date-cell");
      if (!dateCell) {
        dateCell = document.createElement("td");
        dateCell.className = "gr-date-cell";
        row.insertBefore(dateCell, statusCell);
      }

      dateCell.innerHTML = receipts.length
        ? `<div class="gr-list">${receipts.map((receipt) => `<span class="gr-chip${receipt.cancelled ? " cancelled" : ""}" title="${receipt.cancelled ? "Cancelled goods receipt date" : "Goods receipt date"}">${receipt.date}</span>`).join("")}</div>`
        : '<span class="muted-value">No GR date</span>';
    });
  }

  if (tableBody && headerRow) {
    const receiptObserver = new MutationObserver(renderGrDates);
    receiptObserver.observe(tableBody, { childList: true });
    renderGrDates();
  }

  const tabBar = document.querySelector(".sap-tabs");
  const tabButtons = tabBar ? [...tabBar.querySelectorAll(".sap-tab")] : [];
  const uploadPanel = document.getElementById("uploadPanel");
  const workspace = document.getElementById("workspace");
  const poResult = document.getElementById("poResult");
  const resultPoNumber = document.getElementById("resultPoNumber");
  const existingCopyButton = document.getElementById("copySummaryButton");
  const existingPrintButton = document.getElementById("printButton");
  const toast = document.getElementById("toast");

  if (!tabBar || tabButtons.length < 3 || !uploadPanel || !workspace) return;

  const style = document.createElement("style");
  style.id = "functional-tabs-styles";
  style.textContent = `
    .tab-hidden { display: none !important; }
    .sap-tab { cursor: pointer; }
    .sap-tab:focus-visible { outline: 2px solid #1f5f8b; outline-offset: -2px; }
    .sap-tab[aria-selected="true"] { position: relative; z-index: 2; }
    .tab-content-panel { margin-bottom: 8px; }
    .tab-intro { padding: 10px 12px; color: #333; border-bottom: 1px solid #aaa; background: #f5f4ec; }
    .tab-intro strong { display: block; margin-bottom: 3px; color: #0e3957; }
    .tab-intro span { font-size: 11px; color: #555; }
    .control-options { padding: 10px 12px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .control-option { min-height: 66px; padding: 9px 10px; display: grid; grid-template-columns: auto 1fr; align-content: start; gap: 3px 8px; border: 1px solid #aaa99f; background: #f1f0e8; cursor: pointer; }
    .control-option input { margin: 2px 0 0; accent-color: #225b80; }
    .control-option strong { color: #123e5d; font-size: 12px; }
    .control-option span { grid-column: 2; color: #555; font-size: 10px; line-height: 1.35; }
    .control-status-grid { margin: 0 12px 10px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-top: 1px solid #aaa99f; border-left: 1px solid #aaa99f; }
    .control-status-item { min-height: 52px; padding: 7px 9px; border-right: 1px solid #aaa99f; border-bottom: 1px solid #aaa99f; background: #fff; }
    .control-status-item span { display: block; color: #555; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .control-status-item strong { display: block; margin-top: 5px; color: #111; font-size: 11px; }
    .tab-actions-row { padding: 0 12px 11px; display: flex; gap: 6px; flex-wrap: wrap; }
    .output-layout { padding: 10px 12px 12px; display: grid; grid-template-columns: minmax(240px, .8fr) minmax(320px, 1.2fr); gap: 10px; }
    .output-card { border: 1px solid #aaa99f; background: #f1f0e8; }
    .output-card-heading { padding: 6px 8px; border-bottom: 1px solid #aaa99f; background: linear-gradient(#eef6fb, #c9dfed); color: #0e3957; font-weight: 700; font-size: 11px; }
    .output-card-body { padding: 10px; }
    .output-document-state { display: grid; grid-template-columns: 110px 1fr; gap: 6px 10px; font-size: 11px; }
    .output-document-state span { color: #555; }
    .output-document-state strong { overflow-wrap: anywhere; }
    .output-buttons { display: grid; gap: 7px; }
    .output-buttons button { justify-content: flex-start; text-align: left; }
    .output-help { margin: 8px 0 0; color: #555; font-size: 10px; line-height: 1.4; }
    .compact-grid .table-wrap th, .compact-grid .table-wrap td { padding-top: 2px; padding-bottom: 2px; font-size: 10px; }
    .hide-gr-date [data-column="gr-date"], .hide-gr-date .gr-date-cell { display: none !important; }
    .hide-cancelled-gr .gr-chip.cancelled { display: none !important; }
    @media (max-width: 760px) {
      .control-options, .control-status-grid, .output-layout { grid-template-columns: 1fr; }
      .output-document-state { grid-template-columns: 90px 1fr; }
    }
  `;
  document.head.appendChild(style);

  const controlPanel = document.createElement("section");
  controlPanel.id = "controlTabPanel";
  controlPanel.className = "sap-panel tab-content-panel";
  controlPanel.setAttribute("role", "tabpanel");
  controlPanel.hidden = true;
  controlPanel.innerHTML = `
    <div class="sap-panel-heading">
      <span>Review Controls</span>
      <span class="panel-hint">Display and validation settings for the imported workbook</span>
    </div>
    <div class="tab-intro">
      <strong>Accounting review configuration</strong>
      <span>These settings change how the item-level GR matching grid is displayed. They do not modify the imported workbook.</span>
    </div>
    <div class="control-options">
      <label class="control-option">
        <input id="showGrDateToggle" type="checkbox" checked />
        <strong>Show GR Date per item</strong>
        <span>Displays the matching posting date beside each goods-receipt document.</span>
      </label>
      <label class="control-option">
        <input id="showCancelledToggle" type="checkbox" checked />
        <strong>Show cancelled GR entries</strong>
        <span>Keeps cancelled receipt documents and dates visible with strike-through formatting.</span>
      </label>
      <label class="control-option">
        <input id="compactGridToggle" type="checkbox" />
        <strong>Compact accounting grid</strong>
        <span>Reduces row height for reviewing larger purchase orders.</span>
      </label>
    </div>
    <div class="control-status-grid">
      <div class="control-status-item"><span>Workbook status</span><strong id="controlWorkbookState">Not loaded</strong></div>
      <div class="control-status-item"><span>GR Date mapping</span><strong id="controlGrDateState">Waiting for workbook</strong></div>
      <div class="control-status-item"><span>Processing mode</span><strong>Local browser session</strong></div>
    </div>
    <div class="tab-actions-row">
      <button id="resetControlButton" class="sap-action-button" type="button">Reset Display Controls</button>
      <button id="controlReturnButton" class="sap-link-button bordered" type="button">Return to Documents</button>
    </div>
  `;

  const outputPanel = document.createElement("section");
  outputPanel.id = "outputTabPanel";
  outputPanel.className = "sap-panel tab-content-panel";
  outputPanel.setAttribute("role", "tabpanel");
  outputPanel.hidden = true;
  outputPanel.innerHTML = `
    <div class="sap-panel-heading">
      <span>Output Control</span>
      <span class="panel-hint">Print, copy, or export the current accounting document</span>
    </div>
    <div class="output-layout">
      <div class="output-card">
        <div class="output-card-heading">Selected Document</div>
        <div class="output-card-body output-document-state">
          <span>PO Number</span><strong id="outputPoNumber">No document selected</strong>
          <span>Output Status</span><strong id="outputSelectionState">Select a PO in Documents</strong>
          <span>Data Source</span><strong>Current browser session</strong>
        </div>
      </div>
      <div class="output-card">
        <div class="output-card-heading">Available Output Actions</div>
        <div class="output-card-body">
          <div class="output-buttons">
            <button id="outputCopyButton" class="sap-action-button" type="button" disabled>Copy PO Summary</button>
            <button id="outputPrintButton" class="sap-action-button" type="button" disabled>Print Accounting View</button>
            <button id="outputCsvButton" class="sap-action-button" type="button" disabled>Export Item Grid as CSV</button>
            <button id="outputReturnButton" class="sap-link-button bordered" type="button">Return to Documents</button>
          </div>
          <p class="output-help">CSV export includes the visible item-level columns, including the GR number and matching GR date for each item.</p>
        </div>
      </div>
    </div>
  `;

  tabBar.insertAdjacentElement("afterend", outputPanel);
  tabBar.insertAdjacentElement("afterend", controlPanel);

  const tabs = [
    { button: tabButtons[0], name: "documents", panelId: "documentsTabPanel" },
    { button: tabButtons[1], name: "control", panelId: controlPanel.id },
    { button: tabButtons[2], name: "output", panelId: outputPanel.id }
  ];

  tabs.forEach((tab, index) => {
    tab.button.id = `${tab.name}Tab`;
    tab.button.setAttribute("role", "tab");
    tab.button.setAttribute("aria-controls", tab.panelId);
    tab.button.setAttribute("aria-selected", index === 0 ? "true" : "false");
    tab.button.tabIndex = index === 0 ? 0 : -1;
  });

  controlPanel.setAttribute("aria-labelledby", "controlTab");
  outputPanel.setAttribute("aria-labelledby", "outputTab");

  function showTab(name, focusButton = false) {
    const selected = tabs.find((tab) => tab.name === name) || tabs[0];

    tabs.forEach((tab) => {
      const active = tab === selected;
      tab.button.classList.toggle("active", active);
      tab.button.setAttribute("aria-selected", active ? "true" : "false");
      tab.button.tabIndex = active ? 0 : -1;
    });

    const documentsActive = selected.name === "documents";
    uploadPanel.classList.toggle("tab-hidden", !documentsActive);
    workspace.classList.toggle("tab-hidden", !documentsActive);
    controlPanel.hidden = selected.name !== "control";
    outputPanel.hidden = selected.name !== "output";

    if (selected.name === "control") updateControlState();
    if (selected.name === "output") updateOutputState();
    if (focusButton) selected.button.focus();
  }

  tabs.forEach((tab, index) => {
    tab.button.addEventListener("click", () => showTab(tab.name));
    tab.button.addEventListener("keydown", (event) => {
      let targetIndex = index;
      if (event.key === "ArrowRight") targetIndex = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") targetIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") targetIndex = 0;
      else if (event.key === "End") targetIndex = tabs.length - 1;
      else return;

      event.preventDefault();
      showTab(tabs[targetIndex].name, true);
    });
  });

  const showGrDateToggle = controlPanel.querySelector("#showGrDateToggle");
  const showCancelledToggle = controlPanel.querySelector("#showCancelledToggle");
  const compactGridToggle = controlPanel.querySelector("#compactGridToggle");
  const resetControlButton = controlPanel.querySelector("#resetControlButton");
  const controlReturnButton = controlPanel.querySelector("#controlReturnButton");
  const controlWorkbookState = controlPanel.querySelector("#controlWorkbookState");
  const controlGrDateState = controlPanel.querySelector("#controlGrDateState");

  function applyControls() {
    document.body.classList.toggle("hide-gr-date", !showGrDateToggle.checked);
    document.body.classList.toggle("hide-cancelled-gr", !showCancelledToggle.checked);
    document.body.classList.toggle("compact-grid", compactGridToggle.checked);
  }

  showGrDateToggle.addEventListener("change", applyControls);
  showCancelledToggle.addEventListener("change", applyControls);
  compactGridToggle.addEventListener("change", applyControls);
  resetControlButton.addEventListener("click", () => {
    showGrDateToggle.checked = true;
    showCancelledToggle.checked = true;
    compactGridToggle.checked = false;
    applyControls();
    notify("Display controls reset");
  });
  controlReturnButton.addEventListener("click", () => showTab("documents", true));

  function updateControlState() {
    const workbookLoaded = !workspace.hidden;
    const detectedColumnsText = document.getElementById("detectedColumns")?.textContent || "";
    const grDateDetected = /GR Date:\s*(?!not found)/i.test(detectedColumnsText);

    controlWorkbookState.textContent = workbookLoaded ? "Workbook loaded" : "Not loaded";
    controlGrDateState.textContent = workbookLoaded
      ? (grDateDetected ? "GR Date column detected" : "GR Date column not detected")
      : "Waiting for workbook";
  }

  const outputPoNumber = outputPanel.querySelector("#outputPoNumber");
  const outputSelectionState = outputPanel.querySelector("#outputSelectionState");
  const outputCopyButton = outputPanel.querySelector("#outputCopyButton");
  const outputPrintButton = outputPanel.querySelector("#outputPrintButton");
  const outputCsvButton = outputPanel.querySelector("#outputCsvButton");
  const outputReturnButton = outputPanel.querySelector("#outputReturnButton");

  function currentPoNumber() {
    return resultPoNumber?.textContent?.trim() || "";
  }

  function hasSelectedPo() {
    return Boolean(currentPoNumber()) && poResult && !poResult.hidden;
  }

  function updateOutputState() {
    const selected = hasSelectedPo();
    const poNumber = currentPoNumber();
    outputPoNumber.textContent = selected ? poNumber : "No document selected";
    outputSelectionState.textContent = selected ? "Ready for output" : "Select a PO in Documents";
    outputCopyButton.disabled = !selected;
    outputPrintButton.disabled = !selected;
    outputCsvButton.disabled = !selected;
  }

  outputCopyButton.addEventListener("click", () => {
    if (!hasSelectedPo()) return notify("Select a purchase order first");
    existingCopyButton?.click();
  });

  outputPrintButton.addEventListener("click", () => {
    if (!hasSelectedPo()) return notify("Select a purchase order first");
    showTab("documents");
    window.setTimeout(() => existingPrintButton?.click(), 50);
  });

  function csvEscape(value) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  outputCsvButton.addEventListener("click", () => {
    if (!hasSelectedPo() || !tableBody || !headerRow) return notify("Select a purchase order first");
    renderGrDates();

    const headers = [...headerRow.children].map((cell) => csvEscape(cell.textContent));
    const rows = [...tableBody.querySelectorAll(":scope > tr")].map((row) =>
      [...row.children].map((cell) => csvEscape(cell.textContent)).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PO-${currentPoNumber()}-items.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify("Item grid exported as CSV");
  });

  outputReturnButton.addEventListener("click", () => showTab("documents", true));

  function notify(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(notify.timeout);
    notify.timeout = window.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  const stateObserver = new MutationObserver(() => {
    updateControlState();
    updateOutputState();
  });
  stateObserver.observe(workspace, { attributes: true, attributeFilter: ["hidden"] });
  if (poResult) stateObserver.observe(poResult, { attributes: true, attributeFilter: ["hidden"] });
  if (resultPoNumber) stateObserver.observe(resultPoNumber, { childList: true });
  const detectedColumns = document.getElementById("detectedColumns");
  if (detectedColumns) stateObserver.observe(detectedColumns, { childList: true, subtree: true });

  applyControls();
  updateControlState();
  updateOutputState();
  showTab("documents");
})();