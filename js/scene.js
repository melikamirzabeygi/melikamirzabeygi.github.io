/* Particle background (from the AXON study): a GPU particle formation stirred by a GPU fluid.
   Runs behind the page. It fades as the visitor scrolls past the first screen, mirrors itself for
   right-to-left Persian, lowers the particle count on slow devices, and quietly does nothing if
   Three.js or floating-point render targets are unavailable (the page works without it). */
window.MMScene = (function () {
  "use strict";
  var api = { ready: false, setMirror: function () {} };
  if (!window.THREE || !window.AxonFluid || !window.AxonParticles) return api;

  var params = new URLSearchParams(location.search);
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" }); }
  catch (e) { console.warn("[MM] WebGL unavailable: particle background disabled."); return api; }
  var gl = renderer.getContext();

  function canRender(type) {
    var rt = new THREE.WebGLRenderTarget(4, 4, { type: type, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    renderer.setRenderTarget(rt); renderer.clear();
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    renderer.setRenderTarget(null); rt.dispose();
    return ok;
  }
  var floatOK = canRender(THREE.FloatType), halfOK = canRender(THREE.HalfFloatType);
  if ((!floatOK && !halfOK) || renderer.capabilities.maxVertexTextures < 1) {
    console.warn("[MM] Float render targets unavailable: particle background disabled.");
    renderer.dispose(); return api;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x1d2233, 1);
  renderer.domElement.className = "webgl";
  renderer.domElement.setAttribute("aria-hidden", "true");
  document.body.prepend(renderer.domElement);

  var mobile = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
  var size = +params.get("size") || (mobile ? 128 : 512);
  var particleType = floatOK ? THREE.FloatType : THREE.HalfFloatType;
  var fluidType = halfOK ? THREE.HalfFloatType : THREE.FloatType;

  function makeMatcap() {
    var c = document.createElement("canvas"); c.width = c.height = 64;
    var g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, 64, 64);
    var body = g.createRadialGradient(24, 22, 2, 32, 32, 32);
    body.addColorStop(0, "#f2f2f2"); body.addColorStop(0.35, "#b9b9b9"); body.addColorStop(0.8, "#4a4a4a"); body.addColorStop(1, "#1a1a1a");
    g.fillStyle = body; g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill();
    var t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    return t;
  }
  var matcap = makeMatcap();

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000);
  var CAM_BASE = new THREE.Vector3(-1.17, 0, 6);
  var DEG = Math.PI / 180;
  var group = new THREE.Group();
  group.position.set(0.343, 0.16, -1);
  group.scale.set(5, 5, 6);
  group.rotation.set(-28.4 * DEG, 390 * DEG, 4.92 * DEG, "XYZ");
  scene.add(group);

  var fluid = window.AxonFluid(renderer, { simRes: mobile ? 128 : 256, dyeRes: mobile ? 256 : 512, type: fluidType });
  fluid.resize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x1d2233, 1);

  var particles = null;
  function buildParticles(n) {
    if (particles) { group.remove(particles.points); particles.dispose(); }
    size = n;
    particles = window.AxonParticles(renderer, {
      size: n, type: particleType, matcap: matcap,
      pointSize: mobile ? 9 : 6,
      intensity: (mobile ? 0.55 : 0.32) * Math.min(1, Math.sqrt(65536 / (n * n))) * (mobile ? 1 : 1.2),
      flowScale: 6
    });
    group.add(particles.points);
    particles.setDistRef(CAM_BASE.z / 6);
    time = 0;                                      // re-run the 3-second formation
  }
  var time = 0;
  buildParticles(size);

    /* The formation keeps the same placement in both languages: in Persian the information column moves to the
     left and the case cards to the right, and the default placement already sits clear of the left column. */
  api.setMirror = function () {};

  function fitCamera(aspect) {
    CAM_BASE.z = aspect < 1 ? 6 / Math.max(aspect * 1.25, 0.5) : 6;
    if (particles) particles.setDistRef(CAM_BASE.z / 6);
  }
  fitCamera(window.innerWidth / window.innerHeight);
  camera.position.copy(CAM_BASE); camera.lookAt(0, 0, 0);

  /* pointer and touch -> fluid splats */
  var cur = new THREE.Vector2(), prev = new THREE.Vector2(), hasPointer = false, lastEvent = 0, mouseN = new THREE.Vector2();
  function move(x, y, isStart) {
    var now = performance.now();
    cur.set(x, y);
    if (!hasPointer || isStart || now - lastEvent > 50) prev.copy(cur);
    hasPointer = true; lastEvent = now;
    mouseN.set(x / window.innerWidth * 2 - 1, -(y / window.innerHeight * 2 - 1));
  }
  window.addEventListener("pointermove", function (e) { if (e.pointerType !== "touch") move(e.clientX, e.clientY, false); }, { passive: true });
  window.addEventListener("touchstart", function (e) { var t = e.touches[0]; if (t) move(t.clientX, t.clientY, true); }, { passive: true });
  window.addEventListener("touchmove", function (e) { var t = e.touches[0]; if (t) move(t.clientX, t.clientY, false); }, { passive: true });

  var A = new THREE.Vector2(), B = new THREE.Vector2();
  function splat() {
    if (!hasPointer) return;
    var dx = cur.x - prev.x, dy = cur.y - prev.y, dist = Math.hypot(dx, dy);
    if (dist > 0.01) {
      var radius = Math.min(dist / 5, 1) * 60 * 0.6 * (mobile ? 0.8 : 1);
      var mult = Math.min(dist / 15, 1) * 10, w = window.innerWidth, h = window.innerHeight;
      A.set(prev.x / w, 1 - prev.y / h); B.set(cur.x / w, 1 - cur.y / h);
      fluid.splat(A, B, dx * mult, -dy * mult, radius / 200);
    }
    prev.copy(cur);
  }

  var CAM_RANGE = 0.18, camTarget = new THREE.Vector3();
  function updateCamera() {
    camTarget.set(CAM_BASE.x + mouseN.x * -1 * CAM_RANGE, CAM_BASE.y + mouseN.y * 2 * CAM_RANGE, CAM_BASE.z);
    camera.position.lerp(camTarget, 0.05);
    camera.lookAt(0, 0, 0);
  }

  /* fade with scroll: full strength on the first screen, dim behind the reading sections */
  var canvas = renderer.domElement, visible = true;
  function onScroll() {
    var k = Math.min(window.scrollY / (window.innerHeight * 0.6), 1);
    var o = 1 - k * 0.86;
    canvas.style.opacity = o.toFixed(3);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    fitCamera(w / h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    fluid.resize(w, h);
    particles.setPixelRatio(renderer.getPixelRatio());
  }
  window.addEventListener("resize", resize);

  /* loop with adaptive quality: if the first ~2 s average below ~40 fps, halve the particle grid (min 128) */
  var running = true, raf = 0, last = performance.now(), slowSum = 0, slowN = 0, adapted = 0;
  function tick(dt) {
    time += dt;
    updateCamera();
    scene.updateMatrixWorld(); camera.updateMatrixWorld();
    splat();
    fluid.step();
    particles.update(time, dt * 60, camera, group, fluid);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  }
  function frame(now) {
    if (!running) return;
    var raw = (now - last) / 1000; last = now;
    var dt = Math.min(Math.max(raw, 0), 1 / 30);
    tick(dt);
    if (adapted < 2 && time > 0.5) {
      slowSum += raw; slowN++;
      if (slowN === 90) {
        if (slowSum / slowN > 1 / 40 && size > 128) { buildParticles(size / 2); adapted++; console.info("[MM] particle grid reduced to " + size + "² for speed"); }
        else adapted = 2;
        slowSum = 0; slowN = 0;
      }
    }
    raf = requestAnimationFrame(frame);
  }
  var MANUAL = params.has("debug") && params.has("manual");
  if (!MANUAL) raf = requestAnimationFrame(frame);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
    else if (!running && !MANUAL) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  window.addEventListener("pagehide", function () { running = false; cancelAnimationFrame(raf); particles.dispose(); fluid.dispose(); renderer.dispose(); });
  canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); running = false; cancelAnimationFrame(raf); canvas.style.display = "none"; });

  api.ready = true;
  if (params.has("debug")) {
    api.tick = function (n) { for (var i = 0; i < (n || 1); i++) tick(1 / 60); };
    api.move = move;
    api.info = function () { return { particles: size * size, float32: floatOK, webgl2: renderer.capabilities.isWebGL2 }; };
  }
  return api;
})();
