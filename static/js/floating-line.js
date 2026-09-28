// floating-lines.js - Vanilla JS implementation of the Three.js floating lines effect

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
    // Setup scene
    this.scene = new THREE.Scene();
    
    // Setup camera
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.camera.position.z = 1;
    
    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false 
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);
    
    // Create uniforms
    this.uniforms = this.createUniforms();
    
    // Create material
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: this.getVertexShader(),
      fragmentShader: this.getFragmentShader()
    });
    
    // Create mesh
    this.geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
    
    // Setup event listeners
    this.setupEvents();
    
    // Setup resize
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Start animation loop
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
    
    return {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector3(1, 1, 1) },
      animationSpeed: { value: this.options.animationSpeed || 1 },
      
      enableTop: { value: this.options.enabledWaves.includes('top') },
      enableMiddle: { value: this.options.enabledWaves.includes('middle') },
      enableBottom: { value: this.options.enabledWaves.includes('bottom') },
      
      topLineCount: { value: typeof this.options.lineCount === 'number' ? this.options.lineCount : (this.options.lineCount[0] || 6) },
      middleLineCount: { value: typeof this.options.lineCount === 'number' ? this.options.lineCount : (this.options.lineCount[1] || 6) },
      bottomLineCount: { value: typeof this.options.lineCount === 'number' ? this.options.lineCount : (this.options.lineCount[2] || 6) },
      
      topLineDistance: { value: (typeof this.options.lineDistance === 'number' ? this.options.lineDistance : (this.options.lineDistance[0] || 8)) * 0.01 },
      middleLineDistance: { value: (typeof this.options.lineDistance === 'number' ? this.options.lineDistance : (this.options.lineDistance[1] || 8)) * 0.01 },
      bottomLineDistance: { value: (typeof this.options.lineDistance === 'number' ? this.options.lineDistance : (this.options.lineDistance[2] || 8)) * 0.01 },
      
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
    if (value.startsWith('#')) {
      value = value.slice(1);
    }
    
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
    if (this.options.interactive !== false) {
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
    
    // Update time
    this.uniforms.iTime.value = this.clock.getElapsedTime();
    
    // Update mouse with damping
    const damping = 0.05;
    if (this.options.interactive !== false) {
      this.mouse.lerp(this.targetMouse, damping);
      this.uniforms.iMouse.value.copy(this.mouse);
      
      this.mouseInfluence += (this.targetInfluence - this.mouseInfluence) * damping;
      this.uniforms.bendInfluence.value = this.mouseInfluence;
    }
    
    // Update parallax
    if (this.options.parallax !== false) {
      this.parallaxOffset.lerp(this.targetParallax, damping);
      this.uniforms.parallaxOffset.value.copy(this.parallaxOffset);
    }
    
    // Render
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