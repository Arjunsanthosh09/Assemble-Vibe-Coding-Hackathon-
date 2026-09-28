// Timeline session tabs — swaps between the "Session 01" / "Session 02"
// agenda panels. No framework needed, just show/hide + aria state.
function initTimelineTabs() {
  const tabs = document.querySelectorAll('.timeline-day-tab');
  const panels = document.querySelectorAll('[data-session-panel]');
  if (!tabs.length || !panels.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-session');

      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      panels.forEach((panel) => {
        const match = panel.getAttribute('data-session-panel') === target;
        panel.hidden = !match;
      });
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTimelineTabs);
} else {
  initTimelineTabs();
}