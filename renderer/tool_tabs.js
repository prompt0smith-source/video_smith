(() => {
  function init(container, opts = {}) {
    if (!container) return null;
    const tabs = [...container.querySelectorAll(".sheetTab[data-tab]")];
    const panels = [...document.querySelectorAll(".sheetPanel[data-tab-panel]")];
    let activeTab = opts.defaultTab || tabs[0]?.dataset.tab || null;

    function apply(tabName) {
      activeTab = tabName;
      tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
      panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.tabPanel === tabName));
      opts.onChange?.(tabName);
    }

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => apply(tab.dataset.tab));
    });

    if (activeTab) apply(activeTab);
    return {
      getActiveTab() {
        return activeTab;
      },
      switchTo(tabName) {
        if (!tabName) return;
        apply(tabName);
      }
    };
  }

  window.VideoSmithToolTabs = { init };
})();
