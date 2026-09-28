/**
 * LightRays – WebGL ray background
 * Minimal working version
 */
(function() {
  'use strict';

  // Check if OGL is loaded
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
    this.renderer = null;
    this.uniforms = null;
    this.mesh = null;

    // Create renderer
    var renderer = new OGL.Renderer({
      dpr: Math.min(window.devicePixelRatio, 2),
      alpha: true
    });
    this.renderer = renderer;

    var gl = renderer.gl;
    var canvas = gl.canvas;
    canvas.style.cssText = 'display:block;width:100%;height:100%;';

    // Clear container
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(canvas);

    // Uniforms
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

    // Mesh
    var geometry = new OGL.Triangle(gl);
    var program = new OGL.Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: this.uniforms
    });
    this.mesh = new OGL.Mesh(gl, { geometry: geometry, program: program });

    // Resize
    this._resize = function() {
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

    // Mouse
    this._onMouse = function(e) {
      if (!self.container) return;
      var rect = self.container.getBoundingClientRect();
      self.mouse.x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      self.mouse.y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    };

    // Loop
    this._loop = function(t) {
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
      } catch(e) {}
      self.animationId = requestAnimationFrame(self._loop);
    };

    // Setup
    window.addEventListener('resize', this._resize);
    if (this.options.followMouse) {
      window.addEventListener('mousemove', this._onMouse);
    }
    this._resize();
    this.animationId = requestAnimationFrame(this._loop);
  }

  // Expose globally
  window.LightRays = LightRays;
  console.log('LightRays loaded successfully!');
})();