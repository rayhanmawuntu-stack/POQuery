(() => {
  "use strict";

  const LOGO_URL = "https://file.garden/ad-wGPVIV3ilAD_L/WORK%20PROJECT/LABEL%20MAKER/KSB_SVG.svg.png";
  const nativePrint = window.print.bind(window);

  const preload = document.createElement("link");
  preload.rel = "preload";
  preload.as = "image";
  preload.href = LOGO_URL;
  document.head.appendChild(preload);

  const style = document.createElement("style");
  style.id = "ksb-print-logo-style";
  style.textContent = `
    .po-print-logo-image {
      display: block;
      width: 40mm;
      max-width: 100%;
      height: auto;
      max-height: 17mm;
      object-fit: contain;
      object-position: right center;
    }
    .po-print-logo-fallback {
      display: none;
      font-size: 22pt;
      font-weight: 900;
      letter-spacing: -1px;
    }
  `;
  document.head.appendChild(style);

  function applyLogo() {
    const container = document.querySelector("#purchaseOrderPrintSheet .po-print-logo");
    if (!container || container.dataset.ksbLogoApplied === "true") return;

    const image = document.createElement("img");
    image.className = "po-print-logo-image";
    image.src = LOGO_URL;
    image.alt = "KSB";
    image.decoding = "async";

    const fallback = document.createElement("span");
    fallback.className = "po-print-logo-fallback";
    fallback.textContent = "KSB";

    image.addEventListener("load", () => {
      image.hidden = false;
      fallback.style.display = "none";
    });
    image.addEventListener("error", () => {
      image.hidden = true;
      fallback.style.display = "inline-block";
    });

    container.replaceChildren(image, fallback);
    container.dataset.ksbLogoApplied = "true";
  }

  const observer = new MutationObserver(applyLogo);
  observer.observe(document.body, { childList: true, subtree: true });
  applyLogo();

  window.print = () => {
    applyLogo();
    const image = document.querySelector("#purchaseOrderPrintSheet .po-print-logo-image");
    if (!image || image.complete) {
      nativePrint();
      return;
    }

    let printed = false;
    const finish = () => {
      if (printed) return;
      printed = true;
      nativePrint();
    };

    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
    window.setTimeout(finish, 2000);
  };
})();
