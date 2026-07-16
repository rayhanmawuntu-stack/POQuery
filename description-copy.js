(() => {
  "use strict";

  const tableBody = document.getElementById("itemsTableBody");
  if (!tableBody) return;

  const nextFrame = window.requestAnimationFrame?.bind(window) || ((callback) => window.setTimeout(callback, 0));
  const toast = document.getElementById("toast");
  const footerStatusText = document.getElementById("footerStatusText");

  const style = document.createElement("style");
  style.id = "item-cell-copy-styles";
  style.textContent = `
    .item-description-content {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: 6px;
      min-width: 260px;
    }
    .item-description-text {
      min-width: 0;
      overflow-wrap: anywhere;
      line-height: 1.35;
    }
    .gr-copy-entry {
      display: inline-grid;
      grid-template-columns: minmax(0, auto) auto;
      align-items: center;
      justify-content: start;
      gap: 4px;
      width: fit-content;
      max-width: 100%;
    }
    .gr-copy-entry .gr-chip { margin: 0; }
    .description-copy-button,
    .gr-copy-button {
      width: 23px;
      height: 21px;
      min-width: 23px;
      padding: 0;
      display: inline-grid;
      place-items: center;
      border: 1px solid #7f7f79;
      border-radius: 0;
      background: linear-gradient(#fafafa, #d5d5cf);
      box-shadow: inset 1px 1px 0 #fff;
      color: #123e5d;
      font-family: Tahoma, "Segoe UI", Arial, sans-serif;
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
    }
    .gr-copy-button {
      width: 21px;
      height: 19px;
      min-width: 21px;
      font-size: 12px;
    }
    .description-copy-button:hover,
    .description-copy-button:focus-visible,
    .gr-copy-button:hover,
    .gr-copy-button:focus-visible {
      border-color: #245b82;
      background: #d9edf9;
      outline: 1px dotted #123e5d;
      outline-offset: -3px;
    }
    .description-copy-button.is-copied,
    .gr-copy-button.is-copied {
      color: #1f6b2d;
      background: #e2f2df;
    }
    .description-copy-button:disabled,
    .gr-copy-button:disabled {
      cursor: default;
      color: #888;
      background: #e5e5df;
    }
    .hide-cancelled-gr .gr-copy-entry.cancelled { display: none !important; }
    .performance-mode .description-copy-button,
    .performance-mode .gr-copy-button {
      background-image: none;
      box-shadow: none;
      transition: none;
    }
    @media print {
      .description-copy-button,
      .gr-copy-button { display: none !important; }
      .item-description-content { display: block; min-width: 0; }
      .gr-copy-entry { display: block; width: auto; }
    }
  `;
  document.head.appendChild(style);

  function notify(message) {
    if (footerStatusText) {
      const previous = footerStatusText.textContent || "Ready";
      footerStatusText.textContent = message;
      window.clearTimeout(notify.footerTimer);
      notify.footerTimer = window.setTimeout(() => {
        footerStatusText.textContent = previous === message ? "Ready" : previous;
      }, 1800);
    }

    if (toast) {
      toast.textContent = message;
      toast.classList.add("show");
      window.clearTimeout(notify.toastTimer);
      notify.toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
    }
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
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

  function createCopyButton(className, value, label, dataKey) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset[dataKey] = value;
    button.setAttribute("aria-label", label);
    button.title = label;
    button.textContent = "⧉";
    button.disabled = !value || value === "—";
    return button;
  }

  function enhanceDescription(row) {
    if (row.dataset.descriptionCopyReady === "true") return;

    const descriptionCell = row.cells[1];
    if (!descriptionCell) return;

    const description = descriptionCell.textContent?.trim() || "";
    const displayText = description || "—";

    const wrapper = document.createElement("div");
    wrapper.className = "item-description-content";

    const text = document.createElement("span");
    text.className = "item-description-text";
    text.textContent = displayText;

    const button = createCopyButton(
      "description-copy-button",
      description,
      `Copy item description: ${displayText}`,
      "copyDescription"
    );

    wrapper.append(text, button);
    descriptionCell.replaceChildren(wrapper);
    row.dataset.descriptionCopyReady = "true";
  }

  function getGrNumber(chip) {
    const stored = chip.dataset.grNumber?.trim();
    if (stored) return stored;

    const raw = chip.textContent?.trim() || "";
    const separatorIndex = raw.lastIndexOf(" · ");
    return (separatorIndex >= 0 ? raw.slice(0, separatorIndex) : raw).trim();
  }

  function enhanceGrNumbers(row) {
    const receiptCell = row.cells[5];
    if (!receiptCell) return;

    for (const chip of receiptCell.querySelectorAll(".gr-chip")) {
      if (chip.dataset.grCopyReady === "true") continue;

      const grNumber = getGrNumber(chip);
      const wrapper = document.createElement("span");
      wrapper.className = `gr-copy-entry${chip.classList.contains("cancelled") ? " cancelled" : ""}`;

      const button = createCopyButton(
        "gr-copy-button",
        grNumber,
        `Copy GR number: ${grNumber || "unavailable"}`,
        "copyGrNumber"
      );

      chip.parentNode?.insertBefore(wrapper, chip);
      wrapper.append(chip, button);
      chip.dataset.grCopyReady = "true";
    }
  }

  function enhanceRow(row) {
    if (!(row instanceof HTMLTableRowElement)) return;
    enhanceDescription(row);
    enhanceGrNumbers(row);
  }

  let enhancementQueued = false;
  function enhanceRows() {
    enhancementQueued = false;
    for (const row of tableBody.rows) enhanceRow(row);
  }

  function scheduleEnhancement() {
    if (enhancementQueued) return;
    enhancementQueued = true;
    nextFrame(enhanceRows);
  }

  tableBody.addEventListener("click", async (event) => {
    const button = event.target.closest(".description-copy-button, .gr-copy-button");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;

    const isGrCopy = button.classList.contains("gr-copy-button");
    const value = isGrCopy
      ? button.dataset.copyGrNumber || ""
      : button.dataset.copyDescription || "";
    if (!value) return;

    try {
      await copyText(value);
      const original = button.textContent;
      button.textContent = "✓";
      button.classList.add("is-copied");
      notify(isGrCopy ? `GR ${value} copied` : "Item description copied");
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove("is-copied");
      }, 1200);
    } catch (error) {
      console.error(error);
      notify(isGrCopy ? "Unable to copy GR number" : "Unable to copy item description");
    }
  });

  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(tableBody, { childList: true, subtree: true });
  scheduleEnhancement();
})();
