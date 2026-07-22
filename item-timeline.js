(() => {
  "use strict";

  const root = document.documentElement;
  const tableBody = document.getElementById("itemsTableBody");
  const table = tableBody?.closest("table");
  const tableWrap = table?.closest(".table-wrap");
  const headerRow = table?.querySelector("thead tr");
  const summaryGrid = document.getElementById("summaryGrid");
  if (!tableBody || !table || !headerRow || !summaryGrid) return;

  const nextFrame = window.requestAnimationFrame?.bind(window) || ((callback) => window.setTimeout(callback, 0));

  const style = document.createElement("style");
  style.id = "item-timeline-styles";
  style.textContent = `
    html { scroll-padding-top: 10px; }
    [data-column="item-timeline"], .item-timeline-cell { min-width: 255px; }
    .item-timeline-cell { white-space: normal; }
    .item-timeline {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 3px;
      min-width: 220px;
      font-variant-numeric: tabular-nums;
    }
    .timeline-event {
      display: inline-grid;
      grid-template-columns: 7px auto;
      align-items: center;
      gap: 4px;
      min-height: 25px;
      padding: 2px 5px;
      border: 1px solid #9a9a94;
      background: #f8f8f4;
      color: #1f1f1f;
      line-height: 1.15;
    }
    .timeline-dot {
      width: 7px;
      height: 7px;
      border: 1px solid #174b6b;
      border-radius: 50%;
      background: #d7eaf7;
    }
    .timeline-copy { display: grid; gap: 1px; }
    .timeline-copy strong { font-size: 9px; font-weight: 700; color: #123e5d; white-space: nowrap; }
    .timeline-copy small { font-size: 9px; color: #555; white-space: nowrap; }
    .timeline-connector { color: #6f8798; font-size: 12px; font-weight: 700; }
    .timeline-event.gr .timeline-dot { border-color: #256f3a; background: #dff2df; }
    .timeline-event.cancelled { color: #8d0000; background: #ffe8e8; text-decoration: line-through; opacity: .78; }
    .timeline-event.cancelled .timeline-dot { border-color: #8d0000; background: #ffcaca; }
    .timeline-event.return .timeline-dot { border-color: #9a5200; background: #ffe5b8; }
    .timeline-event.open .timeline-dot { border-color: #8d6b00; background: #fff0a6; }
    .timeline-legend {
      min-height: 29px;
      padding: 4px 7px;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 5px 12px;
      border-bottom: 1px solid #85857f;
      background: #f1f0e8;
      color: #333;
      font-size: 9px;
    }
    .timeline-legend-title { color: #123e5d; font-weight: 700; }
    .timeline-legend-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }
    .timeline-legend-dot {
      width: 7px;
      height: 7px;
      flex: 0 0 auto;
      border: 1px solid #174b6b;
      border-radius: 50%;
      background: #d7eaf7;
    }
    .timeline-legend-dot.gr { border-color: #256f3a; background: #dff2df; }
    .timeline-legend-dot.cancelled { border-color: #8d0000; background: #ffcaca; }
    .timeline-legend-dot.return { border-color: #9a5200; background: #ffe5b8; }
    .timeline-legend-dot.open { border-color: #8d6b00; background: #fff0a6; }
    .timeline-legend-item.cancelled { color: #8d0000; text-decoration: line-through; opacity: .78; }
    .hide-item-timeline .timeline-legend,
    .hide-item-timeline [data-column="item-timeline"],
    .hide-item-timeline .item-timeline-cell { display: none !important; }
    .hide-cancelled-gr .timeline-event.cancelled,
    .hide-cancelled-gr .timeline-event.cancelled + .timeline-connector { display: none !important; }

    .table-wrap {
      scroll-behavior: smooth;
      scroll-padding-top: 30px;
      scrollbar-gutter: stable both-edges;
      scrollbar-width: thin;
      scrollbar-color: #7890a2 #e5e5df;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
      overscroll-behavior-y: auto;
      touch-action: pan-x pan-y;
    }
    .table-wrap::-webkit-scrollbar { width: 11px; height: 11px; }
    .table-wrap::-webkit-scrollbar-track { background: #e5e5df; }
    .table-wrap::-webkit-scrollbar-thumb {
      min-height: 34px;
      border: 2px solid #e5e5df;
      border-radius: 8px;
      background: #7890a2;
    }
    .table-wrap::-webkit-scrollbar-thumb:hover { background: #526f84; }
    .sap-menu, .sap-toolbar, .sap-tabs {
      scrollbar-width: thin;
      scrollbar-color: #7890a2 #e5e5df;
      -webkit-overflow-scrolling: touch;
    }

    .performance-mode .item-timeline-cell { contain: content; }
    .performance-mode .timeline-event { box-shadow: none !important; transition: none !important; }
    .performance-mode .table-wrap { scroll-behavior: auto; }
    @media (prefers-reduced-motion: reduce) {
      html, .table-wrap { scroll-behavior: auto !important; }
    }
    @media (max-width: 760px) {
      [data-column="item-timeline"], .item-timeline-cell { min-width: 220px; }
    }
  `;
  document.head.appendChild(style);

  function installSmoothGridScrolling() {
    if (!tableWrap) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    let targetLeft = tableWrap.scrollLeft;
    let targetTop = tableWrap.scrollTop;
    let frameId = 0;

    const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

    function cancelAnimation() {
      if (frameId) window.cancelAnimationFrame?.(frameId);
      frameId = 0;
      targetLeft = tableWrap.scrollLeft;
      targetTop = tableWrap.scrollTop;
    }

    function animate() {
      if (root.classList.contains("performance-mode") || reducedMotion?.matches) {
        cancelAnimation();
        return;
      }

      const leftDifference = targetLeft - tableWrap.scrollLeft;
      const topDifference = targetTop - tableWrap.scrollTop;
      const closeEnough = Math.abs(leftDifference) < 0.5 && Math.abs(topDifference) < 0.5;

      if (closeEnough) {
        tableWrap.scrollLeft = targetLeft;
        tableWrap.scrollTop = targetTop;
        frameId = 0;
        return;
      }

      tableWrap.scrollLeft += leftDifference * 0.24;
      tableWrap.scrollTop += topDifference * 0.24;
      frameId = nextFrame(animate);
    }

    tableWrap.addEventListener("wheel", (event) => {
      if (root.classList.contains("performance-mode") || reducedMotion?.matches || !finePointer?.matches) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const modeMultiplier = event.deltaMode === 1
        ? 18
        : event.deltaMode === 2
          ? tableWrap.clientHeight
          : 1;

      let deltaX = event.deltaX * modeMultiplier;
      let deltaY = event.deltaY * modeMultiplier;
      if (event.shiftKey && Math.abs(deltaX) < Math.abs(deltaY)) {
        deltaX = deltaY;
        deltaY = 0;
      }

      deltaX = clamp(deltaX, -220, 220);
      deltaY = clamp(deltaY, -220, 220);

      const maximumLeft = Math.max(0, tableWrap.scrollWidth - tableWrap.clientWidth);
      const maximumTop = Math.max(0, tableWrap.scrollHeight - tableWrap.clientHeight);
      const canScrollHorizontally = deltaX < 0 ? tableWrap.scrollLeft > 0 : deltaX > 0 && tableWrap.scrollLeft < maximumLeft;
      const canScrollVertically = deltaY < 0 ? tableWrap.scrollTop > 0 : deltaY > 0 && tableWrap.scrollTop < maximumTop;

      if (!canScrollHorizontally && !canScrollVertically) return;
      event.preventDefault();

      targetLeft = clamp(targetLeft + deltaX, 0, maximumLeft);
      targetTop = clamp(targetTop + deltaY, 0, maximumTop);
      if (!frameId) frameId = nextFrame(animate);
    }, { passive: false });

    tableWrap.addEventListener("pointerdown", cancelAnimation, { passive: true });
    tableWrap.addEventListener("touchstart", cancelAnimation, { passive: true });
    tableWrap.addEventListener("scroll", () => {
      if (!frameId) {
        targetLeft = tableWrap.scrollLeft;
        targetTop = tableWrap.scrollTop;
      }
    }, { passive: true });

    reducedMotion?.addEventListener?.("change", cancelAnimation);
  }

  function getPoDate() {
    for (const card of summaryGrid.querySelectorAll(".summary-card")) {
      const label = card.querySelector("span")?.textContent?.trim().toLowerCase();
      if (label === "po date") return card.querySelector("strong")?.textContent?.trim() || "—";
    }
    return "—";
  }

  function ensureTimelineHeader() {
    if (headerRow.querySelector('[data-column="item-timeline"]')) return true;
    const grDateHeader = headerRow.querySelector('[data-column="gr-date"]');
    if (!grDateHeader) return false;

    const timelineHeader = document.createElement("th");
    timelineHeader.dataset.column = "item-timeline";
    timelineHeader.textContent = "Item Timeline";
    grDateHeader.insertAdjacentElement("afterend", timelineHeader);
    return true;
  }

  function parseReceiptChip(chip, dateChip) {
    const raw = chip.textContent?.trim() || "—";
    const separator = " · ";
    const separatorIndex = raw.lastIndexOf(separator);
    const fallbackNumber = separatorIndex >= 0 ? raw.slice(0, separatorIndex).trim() : raw;
    const fallbackDate = separatorIndex >= 0 ? raw.slice(separatorIndex + separator.length).trim() : "—";

    return {
      number: chip.dataset.grNumber || fallbackNumber || "—",
      date: chip.dataset.grDate || dateChip?.textContent?.trim() || fallbackDate || "—",
      cancelled: chip.classList.contains("cancelled")
    };
  }

  function createEvent(label, date, type, cancelled = false) {
    const event = document.createElement("span");
    event.className = `timeline-event ${type}${cancelled ? " cancelled" : ""}`;

    const dot = document.createElement("span");
    dot.className = "timeline-dot";
    dot.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "timeline-copy";

    const title = document.createElement("strong");
    title.textContent = label;

    const dateText = document.createElement("small");
    dateText.textContent = date || "—";

    copy.append(title, dateText);
    event.append(dot, copy);
    return event;
  }

  function appendEvent(timeline, event) {
    if (timeline.children.length) {
      const connector = document.createElement("span");
      connector.className = "timeline-connector";
      connector.textContent = "›";
      connector.setAttribute("aria-hidden", "true");
      timeline.appendChild(connector);
    }
    timeline.appendChild(event);
  }

  function renderTimelineForRow(row, poDate) {
    if (row.dataset.itemTimelineRendered === "true") return true;

    const grDateCell = row.querySelector(":scope > .gr-date-cell");
    if (!grDateCell) return false;

    const cells = row.cells;
    if (cells.length < 8) return false;

    const receiptCell = cells[5];
    const statusCell = cells[cells.length - 1];
    const receiptChips = [...receiptCell.querySelectorAll(".gr-chip")];
    const dateChips = [...grDateCell.querySelectorAll(".gr-chip")];

    const timelineCell = document.createElement("td");
    timelineCell.className = "item-timeline-cell";

    const timeline = document.createElement("div");
    timeline.className = "item-timeline";
    timeline.setAttribute("aria-label", "Item document timeline");

    appendEvent(timeline, createEvent("PO", poDate, "po"));

    receiptChips.forEach((chip, index) => {
      const receipt = parseReceiptChip(chip, dateChips[index]);
      appendEvent(
        timeline,
        createEvent(`GR ${receipt.number}`, receipt.date, "gr", receipt.cancelled)
      );
    });

    const statusText = statusCell.textContent?.trim().toLowerCase() || "";
    if (statusText.includes("returned")) {
      appendEvent(timeline, createEvent("Return", "Recorded", "return"));
    } else if (!receiptChips.length) {
      appendEvent(timeline, createEvent("Awaiting GR", "Open", "open"));
    }

    timelineCell.appendChild(timeline);
    row.insertBefore(timelineCell, statusCell);
    row.dataset.itemTimelineRendered = "true";
    return true;
  }

  let renderQueued = false;
  let retryTimer = 0;

  function renderTimelines() {
    renderQueued = false;
    if (!ensureTimelineHeader()) {
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(scheduleTimelineRender, 20);
      return;
    }

    const poDate = getPoDate();
    let pending = false;
    for (const row of tableBody.rows) {
      if (!renderTimelineForRow(row, poDate)) pending = true;
    }

    if (pending) {
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(scheduleTimelineRender, 20);
    }
  }

  function scheduleTimelineRender() {
    if (renderQueued) return;
    renderQueued = true;
    nextFrame(renderTimelines);
  }

  const observer = new MutationObserver(scheduleTimelineRender);
  observer.observe(tableBody, { childList: true, subtree: true });
  scheduleTimelineRender();

  function installTimelineLegend() {
    const toolbar = table.closest(".items-section")?.querySelector(".alv-toolbar");
    if (!toolbar || document.getElementById("itemTimelineLegend")) return;

    const legend = document.createElement("div");
    legend.id = "itemTimelineLegend";
    legend.className = "timeline-legend";
    legend.setAttribute("aria-label", "Item timeline legend");
    legend.innerHTML = `
      <strong class="timeline-legend-title">Legend:</strong>
      <span class="timeline-legend-item"><span class="timeline-legend-dot" aria-hidden="true"></span>PO</span>
      <span class="timeline-legend-item"><span class="timeline-legend-dot gr" aria-hidden="true"></span>Active GR</span>
      <span class="timeline-legend-item cancelled"><span class="timeline-legend-dot cancelled" aria-hidden="true"></span>Cancelled GR</span>
      <span class="timeline-legend-item"><span class="timeline-legend-dot return" aria-hidden="true"></span>Goods return</span>
      <span class="timeline-legend-item"><span class="timeline-legend-dot open" aria-hidden="true"></span>Awaiting GR</span>
    `;
    toolbar.insertAdjacentElement("afterend", legend);
  }

  function installTimelineControl() {
    const controlOptions = document.querySelector("#controlTabPanel .control-options");
    if (!controlOptions || controlOptions.querySelector("#showItemTimelineToggle")) return;

    const option = document.createElement("label");
    option.className = "control-option";
    option.innerHTML = `
      <input id="showItemTimelineToggle" type="checkbox" checked />
      <strong>Show item timeline</strong>
      <span>Shows the PO, every GR event, cancelled receipt, and return status for each line item.</span>
    `;
    controlOptions.appendChild(option);

    const toggle = option.querySelector("#showItemTimelineToggle");
    const apply = () => document.body.classList.toggle("hide-item-timeline", !toggle.checked);
    toggle.addEventListener("change", apply);

    const resetButton = document.getElementById("resetControlButton");
    resetButton?.addEventListener("click", () => {
      toggle.checked = true;
      apply();
    });

    apply();
  }

  installSmoothGridScrolling();
  installTimelineLegend();
  installTimelineControl();
})();