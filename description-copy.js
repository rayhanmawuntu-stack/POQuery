(() => {
  "use strict";

  const tableBody = document.getElementById("itemsTableBody");
  if (!tableBody) return;

  const nextFrame = window.requestAnimationFrame?.bind(window) || ((callback) => window.setTimeout(callback, 0));
  const toast = document.getElementById("toast");
  const footerStatusText = document.getElementById("footerStatusText");

  const style = document.createElement("style");
  style.id = "item-description-copy-styles";
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
    .description-copy-button {
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
    .description-copy-button:hover,
    .description-copy-button:focus-visible {
      border-color: #245b82;
      background: #d9edf9;
      outline: 1px dotted #123e5d;
      outline-offset: -3px;
    }
    .description-copy-button.is-copied {
      color: #1f6b2d;
      background: #e2f2df;
    }
    .description-copy-button:disabled {
      cursor: default;
      color: #888;
      background: #e5e5df;
    }
    .performance-mode .description-copy-button {
      background-image: none;
      box-shadow: none;
      transition: none;
    }
    @media print {
      .description-copy-button { display: none !important; }
      .item-description-content { display: block; min-width: 0; }
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

  function enhanceRow(row) {
    if (!(row instanceof HTMLTableRowElement) || row.dataset.descriptionCopyReady === "true") return;

    const descriptionCell = row.cells[1];
    if (!descriptionCell) return;

    const description = descriptionCell.textContent?.trim() || "";
    const displayText = description || "—";

    const wrapper = document.createElement("div");
    wrapper.className = "item-description-content";

    const text = document.createElement("span");
    text.className = "item-description-text";
    text.textContent = displayText;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "description-copy-button";
    button.dataset.copyDescription = description;
    button.setAttribute("aria-label", `Copy item description: ${displayText}`);
    button.title = "Copy item description";
    button.textContent = "⧉";
    button.disabled = !description || description === "—";

    wrapper.append(text, button);
    descriptionCell.replaceChildren(wrapper);
    row.dataset.descriptionCopyReady = "true";
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
    const button = event.target.closest(".description-copy-button");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;

    const description = button.dataset.copyDescription || "";
    if (!description) return;

    try {
      await copyText(description);
      const original = button.textContent;
      button.textContent = "✓";
      button.classList.add("is-copied");
      notify("Item description copied");
      window.setTimeout(() => {
        button.textContent = original;
        button.classList.remove("is-copied");
      }, 1200);
    } catch (error) {
      console.error(error);
      notify("Unable to copy item description");
    }
  });

  const observer = new MutationObserver(scheduleEnhancement);
  observer.observe(tableBody, { childList: true });
  scheduleEnhancement();
})();
