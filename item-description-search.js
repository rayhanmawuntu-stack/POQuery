(() => {
  "use strict";

  const tableBody = document.getElementById("itemsTableBody");
  const table = tableBody?.closest("table");
  const toolbar = document.querySelector(".items-section .alv-toolbar");
  const itemCountBadge = document.getElementById("itemCountBadge");
  const poResult = document.getElementById("poResult");
  const resultPoNumber = document.getElementById("resultPoNumber");

  if (!tableBody || !table || !toolbar) return;

  const style = document.createElement("style");
  style.id = "item-description-search-style";
  style.textContent = `
    .item-description-search {
      min-width: 360px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 4px;
      white-space: nowrap;
    }
    .item-description-search label {
      color: #173c58;
      font-size: 9px;
      font-weight: 700;
    }
    .item-description-search input {
      width: min(280px, 28vw);
      min-width: 150px;
      height: 21px;
      padding: 2px 5px;
      border: 1px solid #66655f;
      outline: 0;
      background: #fffec4;
      box-shadow: inset 1px 1px 2px rgba(0,0,0,.2);
      color: #111;
    }
    .item-description-search input:focus {
      border: 2px solid #2f6f9a;
      padding: 1px 4px;
    }
    .item-description-search input:disabled {
      background: #e7e7e2;
      color: #777;
      box-shadow: none;
    }
    .item-description-search button {
      min-width: 43px;
    }
    .item-description-search-status {
      min-width: 58px;
      color: #4d4d4d;
      font-size: 9px;
      text-align: right;
    }
    tr.description-search-hidden {
      display: none !important;
    }
    @media (max-width: 900px) {
      .items-section .alv-toolbar { flex-wrap: wrap; }
      .item-description-search {
        order: 3;
        width: 100%;
        min-width: 0;
        margin: 3px 0 0;
      }
      .item-description-search input {
        width: auto;
        min-width: 0;
        flex: 1;
      }
    }
  `;
  document.head.appendChild(style);

  const controls = document.createElement("span");
  controls.className = "item-description-search";
  controls.innerHTML = `
    <label for="itemDescriptionSearch">Description</label>
    <input id="itemDescriptionSearch" type="search" placeholder="Search within this PO" autocomplete="off" spellcheck="false" aria-controls="itemsTableBody" disabled />
    <button id="clearItemDescriptionSearch" type="button" title="Clear item description search" disabled>Clear</button>
    <span id="itemDescriptionSearchStatus" class="item-description-search-status" aria-live="polite"></span>
  `;

  const spacer = toolbar.querySelector(".toolbar-spacer");
  toolbar.insertBefore(controls, spacer || null);

  const input = controls.querySelector("#itemDescriptionSearch");
  const clearButton = controls.querySelector("#clearItemDescriptionSearch");
  const status = controls.querySelector("#itemDescriptionSearchStatus");
  let lastPoNumber = "";
  let timer = 0;

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function descriptionColumnIndex() {
    const headerRow = table.tHead?.rows?.[0];
    if (!headerRow) return -1;
    return [...headerRow.cells].findIndex((cell) => normalize(cell.textContent) === "description");
  }

  function selectedPoIsVisible() {
    return Boolean(poResult && !poResult.hidden && resultPoNumber?.textContent?.trim());
  }

  function clearRowFilter() {
    for (const row of tableBody.rows) row.classList.remove("description-search-hidden");
  }

  function updateBadge(total, matches, hasQuery) {
    if (!itemCountBadge) return;
    itemCountBadge.textContent = hasQuery
      ? `${matches} of ${total} item${total === 1 ? "" : "s"}`
      : `${total} item${total === 1 ? "" : "s"}`;
  }

  function applyFilter() {
    const rows = [...tableBody.rows];
    const columnIndex = descriptionColumnIndex();
    const query = normalize(input.value);
    const active = selectedPoIsVisible() && rows.length > 0 && columnIndex >= 0;

    input.disabled = !active;
    clearButton.disabled = !active || !query;

    if (!active) {
      clearRowFilter();
      status.textContent = "";
      return;
    }

    let matches = 0;
    for (const row of rows) {
      const cell = row.cells[columnIndex];
      const description = cell?.dataset.descriptionSearchText || normalize(cell?.textContent);
      if (cell && !cell.dataset.descriptionSearchText) cell.dataset.descriptionSearchText = description;
      const matched = !query || description.includes(query);
      row.classList.toggle("description-search-hidden", !matched);
      if (matched) matches += 1;
    }

    updateBadge(rows.length, matches, Boolean(query));
    status.textContent = query ? `${matches} found` : "";
  }

  function scheduleFilter() {
    window.clearTimeout(timer);
    const delay = document.documentElement.classList.contains("performance-mode") ? 120 : 55;
    timer = window.setTimeout(applyFilter, delay);
  }

  function syncForCurrentPo() {
    const currentPo = resultPoNumber?.textContent?.trim() || "";
    if (currentPo !== lastPoNumber) {
      lastPoNumber = currentPo;
      input.value = "";
    }
    applyFilter();
  }

  input.addEventListener("input", scheduleFilter);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      input.value = "";
      applyFilter();
      input.blur();
    }
  });

  clearButton.addEventListener("click", () => {
    input.value = "";
    applyFilter();
    input.focus();
  });

  const rowsObserver = new MutationObserver(() => {
    window.requestAnimationFrame(syncForCurrentPo);
  });
  rowsObserver.observe(tableBody, { childList: true });

  if (poResult) {
    const visibilityObserver = new MutationObserver(syncForCurrentPo);
    visibilityObserver.observe(poResult, { attributes: true, attributeFilter: ["hidden"] });
  }

  syncForCurrentPo();
})();
