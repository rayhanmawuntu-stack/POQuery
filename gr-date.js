(() => {
  "use strict";

  const tableBody = document.getElementById("itemsTableBody");
  const headerRow = tableBody?.closest("table")?.querySelector("thead tr");
  if (!tableBody || !headerRow) return;

  function ensureHeader() {
    if (headerRow.querySelector('[data-column="gr-date"]')) return;
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
    ensureHeader();

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

  const observer = new MutationObserver(renderGrDates);
  observer.observe(tableBody, { childList: true });
  renderGrDates();
})();
