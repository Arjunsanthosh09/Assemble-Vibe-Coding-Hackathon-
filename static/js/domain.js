// Domains section behavior — currently just drives the small decorative
// globe icon next to the "Choose Your Power" eyebrow. No 3D library
// required; this is CSS-driven, JS only adds the marker dot and
// hover/reduced-motion handling.

function initDomainGlobe() {
  const globes = document.querySelectorAll('.domain-globe');
  if (!globes.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  globes.forEach((globe) => {
    // Inject the pulsing marker dot once
    if (!globe.querySelector('.marker')) {
      const marker = document.createElement('span');
      marker.className = 'marker';
      globe.appendChild(marker);
    }

    if (reduceMotion) {
      globe.classList.add('is-paused');
      return;
    }

    // Pause the spin while hovered/focused, resume on leave — a small
    // "interactive" touch without needing a WebGL globe.
    globe.addEventListener('mouseenter', () => globe.classList.add('is-paused'));
    globe.addEventListener('mouseleave', () => globe.classList.remove('is-paused'));

    // Every so often, nudge the marker to a new spot on the sphere so it
    // doesn't feel static.
    const marker = globe.querySelector('.marker');
    const spots = [
      { top: '30%', left: '62%' },
      { top: '55%', left: '35%' },
      { top: '68%', left: '58%' },
      { top: '40%', left: '48%' },
    ];
    let i = 0;
    setInterval(() => {
      i = (i + 1) % spots.length;
      marker.style.top = spots[i].top;
      marker.style.left = spots[i].left;
    }, 3200);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDomainGlobe);
} else {
  initDomainGlobe();
}

// ---------- Hero pop-up 3D tilt ----------
// The rise/fade on hover is pure CSS. This just adds the "tilt toward
// the cursor" part: as the pointer moves across a card, we compute how
// far off-center it is and write that to --rx/--ry, which the card's
// .hero-pop-img transform (in domain.css) reads from.
function initDomainHeroTilt() {
  const cards = document.querySelectorAll('.domain-card');
  if (!cards.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // CSS fallback (rise+fade, no tilt) still applies

  const MAX_TILT = 14; // degrees

  cards.forEach((card) => {
    const img = card.querySelector('.hero-pop-img');
    if (!img) return;

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;  // 0..1 across card
      const py = (e.clientY - rect.top) / rect.height;   // 0..1 down card

      const ry = (px - 0.5) * 2 * MAX_TILT;   // left/right lean
      const rx = (0.5 - py) * 2 * (MAX_TILT * 0.5); // up/down lean, gentler

      img.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      img.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    });

    card.addEventListener('mouseleave', () => {
      img.style.setProperty('--ry', '-10deg');
      img.style.setProperty('--rx', '4deg');
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDomainHeroTilt);
} else {
  initDomainHeroTilt();
}