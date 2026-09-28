/* ============================================================
   ASSEMBLE — shared front-end behaviour (no backend)
   ============================================================ */

/* ---- Nav scroll state ---- */
(function(){
  const nav = document.querySelector('header.nav');
  if(!nav) return;
  const onScroll = () => {
    if(window.scrollY > 30) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();

  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if(toggle && links){
    toggle.addEventListener('click', () => {
      const open = links.style.display === 'flex';
      links.style.display = open ? 'none' : 'flex';
      links.style.flexDirection = 'column';
      links.style.position = 'fixed';
      links.style.top = '64px';
      links.style.left = '0';
      links.style.right = '0';
      links.style.background = '#0f0f14';
      links.style.padding = '24px 28px';
      links.style.borderBottom = '1px solid #232330';
      links.style.gap = '18px';
    });
  }
})();

/* ---- Image placeholder loader ----
   Every .img-slot contains an <img> pointing at a path under /images.
   If the file exists it displays and scales in; if not, the slot
   shows an animated placeholder with the expected filename so it's
   obvious what to drop in later. No manual wiring needed per image. */
function initImageSlots(){
  document.querySelectorAll('.img-slot').forEach(slot => {
    const img = slot.querySelector('img');
    if(!img) return;
    const markState = () => {
      if(img.complete && img.naturalWidth > 0){
        slot.classList.add('has-img');
        slot.classList.remove('empty');
      } else {
        slot.classList.add('empty');
        slot.classList.remove('has-img');
      }
    };
    img.addEventListener('load', markState);
    img.addEventListener('error', markState);
    markState();
  });
}

/* ---- Scroll-reveal + stagger ---- */
function initReveal(){
  const staggerGroups = document.querySelectorAll('.reveal-stagger');
  staggerGroups.forEach(group => {
    [...group.children].forEach((child, i) => {
      child.style.transitionDelay = `${Math.min(i, 8) * 70}ms`;
    });
  });

  const targets = document.querySelectorAll('.reveal, .reveal-stagger');
  if(!('IntersectionObserver' in window)){
    targets.forEach(el => el.classList.add('visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  targets.forEach(el => io.observe(el));
}

/* ---- Countdown timer ---- */
function initCountdown(targetISO){
  const dEl = document.getElementById('cd-days');
  const hEl = document.getElementById('cd-hours');
  const mEl = document.getElementById('cd-mins');
  const sEl = document.getElementById('cd-secs');
  if(!dEl) return;
  const target = new Date(targetISO).getTime();

  function tick(){
    const now = Date.now();
    let diff = target - now;
    if(diff < 0) diff = 0;
    const days = Math.floor(diff / (1000*60*60*24));
    const hours = Math.floor((diff / (1000*60*60)) % 24);
    const mins = Math.floor((diff / (1000*60)) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    dEl.textContent = String(days).padStart(2,'0');
    hEl.textContent = String(hours).padStart(2,'0');
    mEl.textContent = String(mins).padStart(2,'0');
    sEl.textContent = String(secs).padStart(2,'0');
  }
  tick();
  setInterval(tick, 1000);
}

/* ---- Codename generator ---- */
const CODENAME_PREFIX = [
  'Vibranium','Quantum','Solar','Neon','Crimson','Iron','Shadow','Astro',
  'Volt','Storm','Cipher','Nova','Titan','Rogue','Arc','Phantom'
];
const CODENAME_CORE = [
  'Falcon','Widow','Warden','Vanguard','Serpent','Fox','Ronin','Specter',
  'Hawk','Wolf','Sentinel','Reactor','Blade','Comet','Wraith','Marshal'
];
const CODENAME_SUFFIX = [
  'Prime','Protocol','Squad','Division','Unit-7','Collective','Cell','Force'
];

function generateCodename(){
  const p = CODENAME_PREFIX[Math.floor(Math.random()*CODENAME_PREFIX.length)];
  const c = CODENAME_CORE[Math.floor(Math.random()*CODENAME_CORE.length)];
  const s = CODENAME_SUFFIX[Math.floor(Math.random()*CODENAME_SUFFIX.length)];
  return `${p} ${c} ${s}`;
}

function initCodenameGenerator(){
  const btn = document.getElementById('gen-codename-btn');
  const out = document.getElementById('codename-output');
  if(!btn || !out) return;
  btn.addEventListener('click', () => {
    out.textContent = generateCodename();
    out.style.animation = 'none';
    // trigger reflow to restart animation
    void out.offsetWidth;
    out.style.animation = 'flicker 0.4s ease';
  });
}

/* small flicker keyframes injected once */
(function injectFlicker(){
  const style = document.createElement('style');
  style.textContent = `@keyframes flicker{0%{opacity:0;transform:translateY(6px);}100%{opacity:1;transform:translateY(0);}}`;
  document.head.appendChild(style);
})();

/* ---- Toast helper ---- */
function showToast(title, message){
  let toast = document.querySelector('.toast');
  if(!toast){
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<div class="tt"></div><div class="tm"></div>`;
    document.body.appendChild(toast);
  }
  toast.querySelector('.tt').textContent = title;
  toast.querySelector('.tm').textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 4200);
}

/* ---- Simple client-side form validation helper ---- */
function validateField(fieldEl, condition){
  if(condition){
    fieldEl.classList.remove('invalid');
    return true;
  } else {
    fieldEl.classList.add('invalid');
    return false;
  }
}

/* ---- FAQ auto-close siblings (optional nicety) ---- */
document.addEventListener('DOMContentLoaded', () => {
  const faqs = document.querySelectorAll('.faq-item');
  faqs.forEach(item => {
    item.addEventListener('toggle', () => {
      if(item.open){
        faqs.forEach(other => { if(other !== item) other.open = false; });
      }
    });
  });
});

/* ============================================================
   DOMAIN SECTION — globe marker + hero-pop 3D tilt
   (was js/domain.js)
   ============================================================ */
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

    // Pause the spin while hovered/focused, resume on leave
    globe.addEventListener('mouseenter', () => globe.classList.add('is-paused'));
    globe.addEventListener('mouseleave', () => globe.classList.remove('is-paused'));

    // Nudge the marker to a new spot on the sphere every few seconds
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
      const py = (e.clientY - rect.top) / rect.height;  // 0..1 down card

      const ry = (px - 0.5) * 2 * MAX_TILT;           // left/right lean
      const rx = (0.5 - py) * 2 * (MAX_TILT * 0.5);   // up/down lean, gentler

      img.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
      img.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
    });

    card.addEventListener('mouseleave', () => {
      img.style.setProperty('--ry', '-10deg');
      img.style.setProperty('--rx', '4deg');
    });
  });
}

/* ============================================================
   TIMELINE SESSION TABS — show/hide agenda panels + aria state
   (was js/timeline-tabs.js)
   ============================================================ */
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
        panel.hidden = panel.getAttribute('data-session-panel') !== target;
      });
    });
  });
}

/* ============================================================
   LIGHTRAYS — WebGL ray background for the timeline section
   (was js/lightray.js + the inline init script in index.html)
   Requires the OGL global (loaded from CDN before main.js).
   ============================================================ */
(function () {
  'use strict';

  if (typeof OGL === 'undefined') {
    console.warn('OGL not loaded. LightRays will not work.');
    return;
  }

  function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : [1, 1, 1];
  }

  function getAnchorAndDir(origin, w, h) {
    var o = 0.2;
    switch (origin) {
      case 'top-left': return { anchor: [0, -o * h], dir: [0, 1] };
      case 'top-right': return { anchor: [w, -o * h], dir: [0, 1] };
      case 'left': return { anchor: [-o * w, 0.5 * h], dir: [1, 0] };
      case 'right': return { anchor: [(1 + o) * w, 0.5 * h], dir: [-1, 0] };
      case 'bottom-left': return { anchor: [0, (1 + o) * h], dir: [0, -1] };
      case 'bottom-center': return { anchor: [0.5 * w, (1 + o) * h], dir: [0, -1] };
      case 'bottom-right': return { anchor: [w, (1 + o) * h], dir: [0, -1] };
      default: return { anchor: [0.5 * w, -o * h], dir: [0, 1] };
    }
  }

  var VERT = `
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  var FRAG = `
    precision highp float;
    uniform float iTime;
    uniform vec2 iResolution;
    uniform vec2 rayPos;
    uniform vec2 rayDir;
    uniform vec3 raysColor;
    uniform float raysSpeed;
    uniform float lightSpread;
    uniform float rayLength;
    uniform float pulsating;
    uniform float fadeDistance;
    uniform float saturation;
    uniform vec2 mousePos;
    uniform float mouseInfluence;
    uniform float noiseAmount;
    uniform float distortion;
    varying vec2 vUv;

    float noise(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    float rayStrength(vec2 source, vec2 refDir, vec2 coord, float a, float b, float speed) {
      vec2 toCoord = coord - source;
      vec2 dir = normalize(toCoord);
      float cosA = dot(dir, refDir);
      float da = cosA + distortion * sin(iTime * 2.0 + length(toCoord) * 0.01) * 0.2;
      float spread = pow(max(da, 0.0), 1.0 / max(lightSpread, 0.001));
      float dist = length(toCoord);
      float maxDist = iResolution.x * rayLength;
      float lenFall = clamp((maxDist - dist) / maxDist, 0.0, 1.0);
      float fadeFall = clamp((iResolution.x * fadeDistance - dist) / (iResolution.x * fadeDistance), 0.5, 1.0);
      float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;
      float base = clamp(
        (0.45 + 0.15 * sin(da * a + iTime * speed)) +
        (0.3 + 0.2 * cos(-da * b + iTime * speed)),
        0.0, 1.0
      );
      return base * lenFall * fadeFall * spread * pulse;
    }

    void main() {
      vec2 coord = vec2(gl_FragCoord.x, iResolution.y - gl_FragCoord.y);
      vec2 finalDir = rayDir;
      if (mouseInfluence > 0.0) {
        vec2 mouseScreen = mousePos * iResolution.xy;
        vec2 mouseDir = normalize(mouseScreen - rayPos);
        finalDir = normalize(mix(rayDir, mouseDir, mouseInfluence));
      }
      vec4 r1 = vec4(1.0) * rayStrength(rayPos, finalDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
      vec4 r2 = vec4(1.0) * rayStrength(rayPos, finalDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);
      vec4 color = r1 * 0.5 + r2 * 0.4;
      if (noiseAmount > 0.0) {
        float n = noise(coord * 0.01 + iTime * 0.1);
        color.rgb *= (1.0 - noiseAmount + noiseAmount * n);
      }
      float bright = 1.0 - (coord.y / iResolution.y);
      color.x *= 0.1 + bright * 0.8;
      color.y *= 0.3 + bright * 0.6;
      color.z *= 0.5 + bright * 0.5;
      if (saturation != 1.0) {
        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        color.rgb = mix(vec3(gray), color.rgb, saturation);
      }
      color.rgb *= raysColor;
      gl_FragColor = color;
    }
  `;

  function LightRays(container, options) {
    var self = this;
    if (!container) { console.error('LightRays: container required'); return; }
    if (typeof OGL === 'undefined') { console.error('OGL not loaded'); return; }

    this.container = container;
    this.options = Object.assign({
      raysOrigin: 'top-center',
      raysColor: '#6c5ce7',
      raysSpeed: 0.8,
      lightSpread: 0.6,
      rayLength: 2.5,
      pulsating: true,
      fadeDistance: 1.2,
      saturation: 0.9,
      followMouse: true,
      mouseInfluence: 0.08,
      noiseAmount: 0.05,
      distortion: 0.02,
    }, options || {});

    this.mouse = { x: 0.5, y: 0.5 };
    this.smoothMouse = { x: 0.5, y: 0.5 };
    this.animationId = null;

    var renderer = new OGL.Renderer({
      dpr: Math.min(window.devicePixelRatio, 2),
      alpha: true
    });
    this.renderer = renderer;

    var gl = renderer.gl;
    var canvas = gl.canvas;
    canvas.style.cssText = 'display:block;width:100%;height:100%;';

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(canvas);

    var opts = this.options;
    this.uniforms = {
      iTime: { value: 0 },
      iResolution: { value: [1, 1] },
      rayPos: { value: [0, 0] },
      rayDir: { value: [0, 1] },
      raysColor: { value: hexToRgb(opts.raysColor) },
      raysSpeed: { value: opts.raysSpeed },
      lightSpread: { value: opts.lightSpread },
      rayLength: { value: opts.rayLength },
      pulsating: { value: opts.pulsating ? 1 : 0 },
      fadeDistance: { value: opts.fadeDistance },
      saturation: { value: opts.saturation },
      mousePos: { value: [0.5, 0.5] },
      mouseInfluence: { value: opts.mouseInfluence },
      noiseAmount: { value: opts.noiseAmount },
      distortion: { value: opts.distortion }
    };

    var geometry = new OGL.Triangle(gl);
    var program = new OGL.Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: this.uniforms
    });
    this.mesh = new OGL.Mesh(gl, { geometry: geometry, program: program });

    this._resize = function () {
      if (!self.renderer || !self.container) return;
      var w = self.container.clientWidth || 800;
      var h = self.container.clientHeight || 600;
      self.renderer.setSize(w, h);
      var dpr = self.renderer.dpr;
      self.uniforms.iResolution.value = [w * dpr, h * dpr];
      var pos = getAnchorAndDir(self.options.raysOrigin, w * dpr, h * dpr);
      self.uniforms.rayPos.value = pos.anchor;
      self.uniforms.rayDir.value = pos.dir;
    };

    this._onMouse = function (e) {
      if (!self.container) return;
      var rect = self.container.getBoundingClientRect();
      self.mouse.x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      self.mouse.y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    };

    this._loop = function (t) {
      if (!self.renderer || !self.uniforms || !self.mesh) {
        self.animationId = requestAnimationFrame(self._loop);
        return;
      }
      self.uniforms.iTime.value = t * 0.001;
      if (self.options.followMouse && self.options.mouseInfluence > 0) {
        var s = 0.92;
        self.smoothMouse.x = self.smoothMouse.x * s + self.mouse.x * (1 - s);
        self.smoothMouse.y = self.smoothMouse.y * s + self.mouse.y * (1 - s);
        self.uniforms.mousePos.value = [self.smoothMouse.x, self.smoothMouse.y];
      }
      try {
        self.renderer.render({ scene: self.mesh });
      } catch (e) {}
      self.animationId = requestAnimationFrame(self._loop);
    };

    window.addEventListener('resize', this._resize);
    if (this.options.followMouse) {
      window.addEventListener('mousemove', this._onMouse);
    }
    this._resize();
    this.animationId = requestAnimationFrame(this._loop);
  }

  window.LightRays = LightRays;

  function initLightRays() {
    const container = document.getElementById('lightrays-bg');
    if (!container) return;

    const config = {
      raysOrigin: 'top-center',
      raysColor: '#6c5ce7',      // soft purple
      raysSpeed: 0.8,
      lightSpread: 0.6,
      rayLength: 2.5,
      pulsating: true,
      fadeDistance: 1.2,
      saturation: 0.9,
      followMouse: true,
      mouseInfluence: 0.08,
      noiseAmount: 0.05,
      distortion: 0.02,
    };
    window.lightRays = new LightRays(container, config);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLightRays);
  } else {
    initLightRays();
  }
})();

/* ============================================================
   FLOATING LINES BACKGROUND (Three.js)
   (was js/floating-line.js + the inline <script type="module">
   in index.html — merged here)
   THREE is loaded on demand via dynamic import below.
   ============================================================ */
let THREE;

class FloatingLinesBackground {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      enabledWaves: ['top', 'middle', 'bottom'],
      lineCount: 8,
      lineDistance: 8,
      bendRadius: 8,
      bendStrength: -2,
      interactive: true,
      parallax: true,
      animationSpeed: 1,
      gradientStart: '#e945f5',
      gradientMid: '#6f6f6f',
      gradientEnd: '#6a6a6a',
      ...options
    };

    this.clock = new THREE.Clock();
    this.mouse = new THREE.Vector2(-1000, -1000);
    this.targetMouse = new THREE.Vector2(-1000, -1000);
    this.mouseInfluence = 0;
    this.targetInfluence = 0;
    this.parallaxOffset = new THREE.Vector2(0, 0);
    this.targetParallax = new THREE.Vector2(0, 0);

    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.camera.position.z = 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.uniforms = this.createUniforms();
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader()
    });

    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);

    this.setupEvents();

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.animate();
  }

  createUniforms() {
    const gradientColors = [
      this.options.gradientStart,
      this.options.gradientMid,
      this.options.gradientEnd
    ].filter(c => c);

    const maxStops = 8;
    const lineGradient = Array.from({ length: maxStops }, () => new THREE.Vector3(1, 1, 1));
    gradientColors.slice(0, maxStops).forEach((hex, i) => {
      const color = this.hexToVec3(hex);
      lineGradient[i].set(color.x, color.y, color.z);
    });

    const lc = typeof this.options.lineCount === 'number'
      ? this.options.lineCount
      : (this.options.lineCount[0] || 6);
    const mc = typeof this.options.lineCount === 'number'
      ? this.options.lineCount
      : (this.options.lineCount[1] || 6);
    const bc = typeof this.options.lineCount === 'number'
      ? this.options.lineCount
      : (this.options.lineCount[2] || 6);
    const ld = (i, fallback) => (typeof this.options.lineDistance === 'number'
      ? this.options.lineDistance
      : (this.options.lineDistance[i] || fallback)) * 0.01;

    return {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector3(1, 1, 1) },
      animationSpeed: { value: this.options.animationSpeed || 1 },

      enableTop: { value: this.options.enabledWaves.includes('top') },
      enableMiddle: { value: this.options.enabledWaves.includes('middle') },
      enableBottom: { value: this.options.enabledWaves.includes('bottom') },

      topLineCount: { value: lc },
      middleLineCount: { value: mc },
      bottomLineCount: { value: bc },

      topLineDistance: { value: ld(0, 8) },
      middleLineDistance: { value: ld(1, 8) },
      bottomLineDistance: { value: ld(2, 8) },

      topWavePosition: { value: new THREE.Vector3(10.0, 0.5, -0.4) },
      middleWavePosition: { value: new THREE.Vector3(5.0, 0.0, 0.2) },
      bottomWavePosition: { value: new THREE.Vector3(2.0, -0.7, 0.4) },

      iMouse: { value: new THREE.Vector2(-1000, -1000) },
      interactive: { value: this.options.interactive !== false },
      bendRadius: { value: this.options.bendRadius || 8 },
      bendStrength: { value: this.options.bendStrength || -2 },
      bendInfluence: { value: 0 },

      parallax: { value: this.options.parallax !== false },
      parallaxStrength: { value: this.options.parallaxStrength || 0.2 },
      parallaxOffset: { value: new THREE.Vector2(0, 0) },

      lineGradient: { value: lineGradient },
      lineGradientCount: { value: gradientColors.length }
    };
  }

  hexToVec3(hex) {
    let value = hex.trim();
    if (value.startsWith('#')) value = value.slice(1);

    let r = 255, g = 255, b = 255;
    if (value.length === 3) {
      r = parseInt(value[0] + value[0], 16);
      g = parseInt(value[1] + value[1], 16);
      b = parseInt(value[2] + value[2], 16);
    } else if (value.length === 6) {
      r = parseInt(value.slice(0, 2), 16);
      g = parseInt(value.slice(2, 4), 16);
      b = parseInt(value.slice(4, 6), 16);
    }
    return new THREE.Vector3(r / 255, g / 255, b / 255);
  }

  getVertexShader() {
    return `
      precision highp float;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
  }

  getFragmentShader() {
    return `
      precision highp float;

      uniform float iTime;
      uniform vec3  iResolution;
      uniform float animationSpeed;

      uniform bool enableTop;
      uniform bool enableMiddle;
      uniform bool enableBottom;

      uniform int topLineCount;
      uniform int middleLineCount;
      uniform int bottomLineCount;

      uniform float topLineDistance;
      uniform float middleLineDistance;
      uniform float bottomLineDistance;

      uniform vec3 topWavePosition;
      uniform vec3 middleWavePosition;
      uniform vec3 bottomWavePosition;

      uniform vec2 iMouse;
      uniform bool interactive;
      uniform float bendRadius;
      uniform float bendStrength;
      uniform float bendInfluence;

      uniform bool parallax;
      uniform float parallaxStrength;
      uniform vec2 parallaxOffset;

      uniform vec3 lineGradient[8];
      uniform int lineGradientCount;

      const vec3 BLACK = vec3(0.0);
      const vec3 PINK  = vec3(233.0, 71.0, 245.0) / 255.0;
      const vec3 BLUE  = vec3(47.0, 75.0, 162.0) / 255.0;

      mat2 rotate(float r) {
        return mat2(cos(r), sin(r), -sin(r), cos(r));
      }

      vec3 background_color(vec2 uv) {
        vec3 col = vec3(0.0);
        float y = sin(uv.x - 0.2) * 0.3 - 0.1;
        float m = uv.y - y;
        col += mix(BLUE, BLACK, smoothstep(0.0, 1.0, abs(m)));
        col += mix(PINK, BLACK, smoothstep(0.0, 1.0, abs(m - 0.8)));
        return col * 0.5;
      }

      vec3 getLineColor(float t, vec3 baseColor) {
        if (lineGradientCount <= 0) {
          return baseColor;
        }
        vec3 gradientColor;
        if (lineGradientCount == 1) {
          gradientColor = lineGradient[0];
        } else {
          float clampedT = clamp(t, 0.0, 0.9999);
          float scaled = clampedT * float(lineGradientCount - 1);
          int idx = int(floor(scaled));
          float f = fract(scaled);
          int idx2 = min(idx + 1, lineGradientCount - 1);
          vec3 c1 = lineGradient[idx];
          vec3 c2 = lineGradient[idx2];
          gradientColor = mix(c1, c2, f);
        }
        return gradientColor * 0.5;
      }

      float wave(vec2 uv, float offset, vec2 screenUv, vec2 mouseUv, bool shouldBend) {
        float time = iTime * animationSpeed;
        float x_offset = offset;
        float x_movement = time * 0.1;
        float amp = sin(offset + time * 0.2) * 0.3;
        float y = sin(uv.x + x_offset + x_movement) * amp;

        if (shouldBend) {
          vec2 d = screenUv - mouseUv;
          float influence = exp(-dot(d, d) * bendRadius);
          float bendOffset = (mouseUv.y - screenUv.y) * influence * bendStrength * bendInfluence;
          y += bendOffset;
        }

        float m = uv.y - y;
        return 0.0175 / max(abs(m) + 0.01, 1e-3) + 0.01;
      }

      void main() {
        vec2 baseUv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
        baseUv.y *= -1.0;

        if (parallax) {
          baseUv += parallaxOffset;
        }

        vec3 col = vec3(0.0);
        vec3 b = lineGradientCount > 0 ? vec3(0.0) : background_color(baseUv);
        vec2 mouseUv = vec2(0.0);

        if (interactive) {
          mouseUv = (2.0 * iMouse - iResolution.xy) / iResolution.y;
          mouseUv.y *= -1.0;
        }

        if (enableBottom) {
          for (int i = 0; i < bottomLineCount; ++i) {
            float fi = float(i);
            float t = fi / max(float(bottomLineCount - 1), 1.0);
            vec3 lineCol = getLineColor(t, b);
            float angle = bottomWavePosition.z * log(length(baseUv) + 1.0);
            vec2 ruv = baseUv * rotate(angle);
            col += lineCol * wave(
              ruv + vec2(bottomLineDistance * fi + bottomWavePosition.x, bottomWavePosition.y),
              1.5 + 0.2 * fi,
              baseUv,
              mouseUv,
              interactive
            ) * 0.2;
          }
        }

        if (enableMiddle) {
          for (int i = 0; i < middleLineCount; ++i) {
            float fi = float(i);
            float t = fi / max(float(middleLineCount - 1), 1.0);
            vec3 lineCol = getLineColor(t, b);
            float angle = middleWavePosition.z * log(length(baseUv) + 1.0);
            vec2 ruv = baseUv * rotate(angle);
            col += lineCol * wave(
              ruv + vec2(middleLineDistance * fi + middleWavePosition.x, middleWavePosition.y),
              2.0 + 0.15 * fi,
              baseUv,
              mouseUv,
              interactive
            );
          }
        }

        if (enableTop) {
          for (int i = 0; i < topLineCount; ++i) {
            float fi = float(i);
            float t = fi / max(float(topLineCount - 1), 1.0);
            vec3 lineCol = getLineColor(t, b);
            float angle = topWavePosition.z * log(length(baseUv) + 1.0);
            vec2 ruv = baseUv * rotate(angle);
            ruv.x *= -1.0;
            col += lineCol * wave(
              ruv + vec2(topLineDistance * fi + topWavePosition.x, topWavePosition.y),
              1.0 + 0.2 * fi,
              baseUv,
              mouseUv,
              interactive
            ) * 0.1;
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `;
  }

  setupEvents() {
    if (this.options.interactive === false) return;

    const handlePointerMove = (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const dpr = this.renderer.getPixelRatio();

      this.targetMouse.set(x * dpr, (rect.height - y) * dpr);
      this.targetInfluence = 1.0;

      if (this.options.parallax !== false) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const offsetX = (x - centerX) / rect.width;
        const offsetY = -(y - centerY) / rect.height;
        const strength = this.options.parallaxStrength || 0.2;
        this.targetParallax.set(offsetX * strength, offsetY * strength);
      }
    };

    const handlePointerLeave = () => {
      this.targetInfluence = 0.0;
    };

    this.renderer.domElement.addEventListener('pointermove', handlePointerMove);
    this.renderer.domElement.addEventListener('pointerleave', handlePointerLeave);

    this._cleanupEvents = () => {
      this.renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      this.renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
    };
  }

  resize() {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;

    this.renderer.setSize(width, height, false);

    const canvasWidth = this.renderer.domElement.width;
    const canvasHeight = this.renderer.domElement.height;
    this.uniforms.iResolution.value.set(canvasWidth, canvasHeight, 1);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    this.uniforms.iTime.value = this.clock.getElapsedTime();

    const damping = 0.05;
    if (this.options.interactive !== false) {
      this.mouse.lerp(this.targetMouse, damping);
      this.uniforms.iMouse.value.copy(this.mouse);

      this.mouseInfluence += (this.targetInfluence - this.mouseInfluence) * damping;
      this.uniforms.bendInfluence.value = this.mouseInfluence;
    }

    if (this.options.parallax !== false) {
      this.parallaxOffset.lerp(this.targetParallax, damping);
      this.uniforms.parallaxOffset.value.copy(this.parallaxOffset);
    }

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this._cleanupEvents) {
      this._cleanupEvents();
    }
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}

async function initFloatingLines() {
  try {
    THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
  } catch (e) {
    console.warn('Three.js failed to load — floating lines disabled.', e);
    return;
  }
  const container = document.getElementById('floating-lines-bg');
  if (!container) return;

  const bg = new FloatingLinesBackground(container, {
    enabledWaves: ['top', 'middle', 'bottom'],
    lineCount: 8,
    lineDistance: 8,
    bendRadius: 8,
    bendStrength: -2,
    interactive: true,
    parallax: true,
    animationSpeed: 1,
    gradientStart: '#e945f5',
    gradientMid: '#6f6f6f',
    gradientEnd: '#6a6a6a'
  });
  window.__floatingLinesBg = bg; // store for cleanup if needed
}

/* ============================================================
   MODULE BACKGROUNDS — gridscan + evil eye (ES modules that use
   the importmap). Loaded on demand so main.js stays classic.
   ============================================================ */
function initModuleBackgrounds() {
  import('./gridscan-bg.js').catch(e => console.warn('gridscan-bg failed:', e));
  import('./evil-eye-bg.js').catch(e => console.warn('evil-eye-bg failed:', e));
}

/* ============================================================
   BOOT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initImageSlots();
  initReveal();
  initCountdown('2026-09-25T09:00:00+05:30');
  initCodenameGenerator();
  initDomainGlobe();
  initDomainHeroTilt();
  initTimelineTabs();
  initFloatingLines();
  initModuleBackgrounds();
});
