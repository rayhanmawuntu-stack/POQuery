(() => {
  "use strict";

  const uploadPanel = document.getElementById("uploadPanel");
  const workspace = document.getElementById("workspace");
  if (!uploadPanel || !workspace) return;

  function syncSourcePanel() {
    uploadPanel.hidden = !workspace.hidden;
  }

  const observer = new MutationObserver(syncSourcePanel);
  observer.observe(workspace, { attributes: true, attributeFilter: ["hidden"] });
  syncSourcePanel();
})();
