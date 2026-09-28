const tabs = [...document.querySelectorAll(".timeline-day-tab")];
const panels = [...document.querySelectorAll("[data-session-panel]")];

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const session = tab.dataset.session;
    tabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.sessionPanel !== session;
    });
  });
});
