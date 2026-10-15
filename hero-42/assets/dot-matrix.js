/* Dot Matrix — Originkit.
   Vanilla WebGL2 port of the React/ogl component. Shaders and the UI->shader
   mappings are unchanged; ogl's Renderer/Program/RenderTarget/Plane are replaced
   with the raw GL calls they wrap (fullscreen triangle, one FBO, two passes).
   Glyph-atlas mode is not built (component default is useGlyphAtlas: false) —
   the uniforms stay wired to a 1x1 dummy so the shader is enable-able as-is. */
(function () {
  "use strict";

  var perlinVertexShader = `#version 300 es
in vec2 uv;
in vec2 position;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0., 1.);
}`;

  var perlinFragmentShader = `#version 300 es
precision mediump float;
uniform float uFrequency;
uniform float uTime;
uniform float uSpeed;
uniform float uValue;
uniform vec2 uResolution;
in vec2 vUv;
out vec4 fragColor;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  uv = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;
  float hue = abs(snoise(vec3(uv * uFrequency, uTime * uSpeed)));
  vec3 rainbowColor = hsv2rgb(vec3(hue, 1.0, uValue));
  fragColor = vec4(rainbowColor, 1.0);
}`;

  var dotVertexShader = `#version 300 es
in vec2 uv;
in vec2 position;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0., 1.);
}`;

  var dotFragmentShader = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform sampler2D uTexture;
uniform int uPaletteCount;
uniform vec3 uPalette[10];
uniform float uPaletteA[10];
uniform float uCellSize;
uniform float uGamma;
uniform float uPaletteBias;
uniform int uUseGlyphAtlas;
uniform sampler2D uGlyphAtlas;
uniform ivec2 uGlyphGrid;
uniform int uCharCount;
out vec4 fragColor;

void main() {
  vec2 pix = gl_FragCoord.xy;
  float cell = max(uCellSize, 1.0);

  vec2 cellIdx = floor(pix / cell);
  vec2 cellCenter = (cellIdx + 0.5) * cell;
  vec3 col = texture(uTexture, cellCenter / uResolution.xy).rgb;
  float gray = 0.3 * col.r + 0.59 * col.g + 0.11 * col.b;
  gray = pow(clamp(gray, 0.0001, 1.0), uGamma);

  float mark = 0.0;
  if (uUseGlyphAtlas == 1 && uCharCount > 0 && uGlyphGrid.x > 0 && uGlyphGrid.y > 0) {
    float g = clamp(gray + uPaletteBias, 0.0, 1.0);
    int idx = int(clamp(floor(g * float(uCharCount - 1) + 0.5), 0.0, float(uCharCount - 1)));
    vec2 cellUV = fract(pix / cell);
    vec2 grid = vec2(uGlyphGrid);
    vec2 tileSize = 1.0 / grid;
    float colIdx = float(idx % uGlyphGrid.x);
    float rowIdx = floor(float(idx) / float(uGlyphGrid.x));
    vec2 atlasUV = (vec2(colIdx, rowIdx) + cellUV) * tileSize;
    vec3 glyphSample = texture(uGlyphAtlas, atlasUV).rgb;
    mark = dot(glyphSample, vec3(0.299, 0.587, 0.114));
  } else {
    vec2 cellUV = fract(pix / cell) - 0.5;
    float dist = length(cellUV);
    float radius = clamp(gray + uPaletteBias, 0.0, 1.0) * 0.5;
    float aa = fwidth(dist) + 1e-4;
    mark = 1.0 - smoothstep(radius - aa, radius + aa, dist);
  }

  float g2 = clamp(gray + uPaletteBias, 0.0, 1.0);
  int cnt = max(uPaletteCount, 1);
  vec3 dotCol;
  float dotOpacity;
  if (cnt <= 1) {
    dotCol = uPalette[0];
    dotOpacity = uPaletteA[0];
  } else {
    float scaled = g2 * float(cnt - 1);
    int i0 = int(floor(scaled));
    i0 = clamp(i0, 0, cnt - 2);
    float f = scaled - float(i0);
    dotCol = mix(uPalette[i0], uPalette[i0 + 1], f);
    dotOpacity = mix(uPaletteA[i0], uPaletteA[i0 + 1], f);
  }
  fragColor = vec4(dotCol, mark * dotOpacity);
}`;

  var MAX_COLORS = 10;
  var DEFAULTS = { frequency: 1, speed: 6, cellSize: 20, gamma: 4, paletteBias: 10 };

  function parseColorToRgba(input) {
    if (!input) return { r: 0, g: 0, b: 0, a: 1 };
    var str = String(input).trim();
    var m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i);
    if (m) {
      return {
        r: Math.max(0, Math.min(255, parseFloat(m[1]))) / 255,
        g: Math.max(0, Math.min(255, parseFloat(m[2]))) / 255,
        b: Math.max(0, Math.min(255, parseFloat(m[3]))) / 255,
        a: m[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(m[4]))) : 1,
      };
    }
    var hex = str.replace(/^#/, "");
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split("").map(function (c) { return c + c; }).join("");
    }
    if (hex.length === 6) hex += "ff";
    if (hex.length !== 8 || /[^0-9a-f]/i.test(hex)) return { r: 0, g: 0, b: 0, a: 1 };
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
      a: parseInt(hex.slice(6, 8), 16) / 255,
    };
  }

  function mapLinear(v, inMin, inMax, outMin, outMax) {
    if (inMax === inMin) return outMin;
    return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
  }
  var mapFrequency = function (ui) { return mapLinear(ui, 1, 10, 0.3, 6); };
  var mapSpeed = function (ui) { return ui * 0.05; };
  var mapCellSize = function (ui) { return mapLinear(ui, 1, 100, 6, 60); };
  var mapGamma = function (ui) { return mapLinear(ui, 1, 20, 0.5, 8); };
  var mapPaletteBias = function (ui) { return ui * 0.05; };

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) || "shader compile failed");
    }
    return s;
  }

  function link(gl, vsSrc, fsSrc) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || "program link failed");
    }
    // Fullscreen triangle: covers the viewport with uv 0..1 across the visible area.
    var vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    var attrs = [
      ["position", new Float32Array([-1, -1, 3, -1, -1, 3])],
      ["uv", new Float32Array([0, 0, 2, 0, 0, 2])],
    ];
    for (var i = 0; i < attrs.length; i++) {
      var loc = gl.getAttribLocation(p, attrs[i][0]);
      if (loc < 0) continue;
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, attrs[i][1], gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
    return { program: p, vao: vao };
  }

  var instances = [];
  var rafId = null;
  var lastTime = 0;
  var FRAME_INTERVAL = 1e3 / 30;

  function create(canvas) {
    var gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
    });
    if (!gl) return null;

    var perlin = link(gl, perlinVertexShader, perlinFragmentShader);
    var dot = link(gl, dotVertexShader, dotFragmentShader);
    var u = function (prog, name) { return gl.getUniformLocation(prog, name); };

    var colors = (canvas.dataset.colors || "")
      .split(",")
      .map(function (c) { return c.trim(); })
      .filter(Boolean)
      .slice(0, MAX_COLORS);
    if (!colors.length) colors = ["#FFFFFF", "#E07000", "#000000"];

    var rgb = new Float32Array(MAX_COLORS * 3);
    var alpha = new Float32Array(MAX_COLORS);
    for (var i = 0; i < colors.length; i++) {
      var c = parseColorToRgba(colors[i]);
      rgb[i * 3] = c.r; rgb[i * 3 + 1] = c.g; rgb[i * 3 + 2] = c.b;
      alpha[i] = c.a;
    }

    var num = function (key) {
      var v = parseFloat(canvas.dataset[key]);
      return isFinite(v) ? v : DEFAULTS[key];
    };
    // ponytail: seed offsets uTime so same-size cards don't show an identical
    // noise field. Swap for a real uSeed uniform if you need it decoupled from speed.
    var seed = parseFloat(canvas.dataset.seed) || 0;

    // 1x1 dummy keeps the (unused) glyph sampler bound; see header note.
    var dummy = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, dummy);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    var rtTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, rtTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rtTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    gl.useProgram(dot.program);
    gl.uniform1i(u(dot.program, "uTexture"), 0);
    gl.uniform1i(u(dot.program, "uGlyphAtlas"), 1);
    gl.uniform1i(u(dot.program, "uPaletteCount"), colors.length);
    gl.uniform3fv(u(dot.program, "uPalette"), rgb);
    gl.uniform1fv(u(dot.program, "uPaletteA"), alpha);
    gl.uniform1f(u(dot.program, "uCellSize"), mapCellSize(num("cellSize")));
    gl.uniform1f(u(dot.program, "uGamma"), mapGamma(num("gamma")));
    gl.uniform1f(u(dot.program, "uPaletteBias"), mapPaletteBias(num("paletteBias")));
    gl.uniform1i(u(dot.program, "uUseGlyphAtlas"), 0);
    gl.uniform2i(u(dot.program, "uGlyphGrid"), 0, 0);
    gl.uniform1i(u(dot.program, "uCharCount"), 0);

    gl.useProgram(perlin.program);
    gl.uniform1f(u(perlin.program, "uFrequency"), mapFrequency(num("frequency")));
    gl.uniform1f(u(perlin.program, "uSpeed"), mapSpeed(num("speed")));
    gl.uniform1f(u(perlin.program, "uValue"), 1);

    var inst = {
      gl: gl, canvas: canvas, perlin: perlin, dot: dot, fbo: fbo, rtTex: rtTex,
      dummy: dummy, seed: seed, w: 0, h: 0,
      uPerlinTime: u(perlin.program, "uTime"),
      uPerlinRes: u(perlin.program, "uResolution"),
      uDotRes: u(dot.program, "uResolution"),
    };

    resize(inst);
    var ro = new ResizeObserver(function () { resize(inst); draw(inst, lastTime); });
    ro.observe(canvas);
    return inst;
  }

  function resize(inst) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = inst.canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width * dpr));
    var h = Math.max(1, Math.round(r.height * dpr));
    if (w === inst.w && h === inst.h) return;
    inst.w = w; inst.h = h;
    inst.canvas.width = w;
    inst.canvas.height = h;
    var gl = inst.gl;
    gl.bindTexture(gl.TEXTURE_2D, inst.rtTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  }

  function draw(inst, time) {
    var gl = inst.gl;
    gl.viewport(0, 0, inst.w, inst.h);

    gl.bindFramebuffer(gl.FRAMEBUFFER, inst.fbo);
    gl.useProgram(inst.perlin.program);
    gl.bindVertexArray(inst.perlin.vao);
    gl.uniform1f(inst.uPerlinTime, time * 0.001 + inst.seed);
    gl.uniform2f(inst.uPerlinRes, inst.w, inst.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(inst.dot.program);
    gl.bindVertexArray(inst.dot.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, inst.rtTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, inst.dummy);
    gl.uniform2f(inst.uDotRes, inst.w, inst.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(time) {
    rafId = requestAnimationFrame(tick);
    if (time - lastTime < FRAME_INTERVAL) return;
    lastTime = time;
    for (var i = 0; i < instances.length; i++) draw(instances[i], time);
  }

  function init() {
    var nodes = document.querySelectorAll("canvas[data-dot-matrix]");
    for (var i = 0; i < nodes.length; i++) {
      try {
        var inst = create(nodes[i]);
        if (inst) instances.push(inst);
      } catch (e) {
        if (window.console) console.warn("dot-matrix:", e.message);
      }
    }
    if (!instances.length) return;
    var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) {
      for (var j = 0; j < instances.length; j++) draw(instances[j], 0);
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  // Run with ?selftest — asserts the color parsing and the UI->shader mappings.
  function selftest() {
    var ok = true;
    var eq = function (a, b, msg) {
      if (Math.abs(a - b) < 0.002) return true;
      console.error("dot-matrix selftest FAIL:", msg, a, "!=", b);
      ok = false;
      return false;
    };
    var c = parseColorToRgba("#9BF5C68C");
    eq(c.r, 0x9b / 255, "hex8 r");
    eq(c.a, 0x8c / 255, "hex8 a");
    eq(parseColorToRgba("#0F8").g, 1, "hex3 expands");
    eq(parseColorToRgba("#0F88").a, 0x88 / 255, "hex4 alpha");
    eq(parseColorToRgba("#1E7548").a, 1, "hex6 is opaque");
    eq(parseColorToRgba("rgba(255,0,0,0.5)").a, 0.5, "rgba alpha");
    eq(parseColorToRgba("#1E7548").r, 0x1e / 255, "hex6 r");
    eq(mapFrequency(1), 0.3, "frequency floor");
    eq(mapSpeed(6), 0.3, "speed");
    eq(mapCellSize(20), 6 + (19 / 99) * 54, "cellSize");
    eq(mapGamma(4), 0.5 + (3 / 19) * 7.5, "gamma");
    eq(mapPaletteBias(10), 0.5, "paletteBias");
    console.log(ok ? "dot-matrix selftest: PASS" : "dot-matrix selftest: FAIL");
    return ok;
  }
  if (location.search.indexOf("selftest") !== -1) selftest();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
