/* AXON — GPU fluid simulation (stable-fluids style, after Jos Stam / Pavel Dobryakov).
   Velocity and dye live in half-float ping-pong render targets. Each frame:
   splat -> curl -> vorticity -> divergence -> pressure (dissipate + Jacobi) -> gradient subtract
   -> advect velocity -> advect dye -> mask (dye copied to a viewport-sized target, alpha = max(r,g,b)). */
window.AxonFluid = function (renderer, opts) {
  "use strict";
  var S = window.AXON_SHADERS;
  var cfg = {
    simRes: opts.simRes, dyeRes: opts.dyeRes, type: opts.type,
    velocityDissipation: 0.98, densityDissipation: 0.97, pressureDissipation: 0.95,
    pressureIterations: 5, curl: 30, dt: 1 / 60
  };

  var scene = new THREE.Scene();
  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  scene.add(quad);

  function target(w, h, type) {
    return new THREE.WebGLRenderTarget(w, h, {
      type: type || cfg.type, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false, stencilBuffer: false
    });
  }
  function pingPong(w, h) {
    var o = { read: target(w, h), write: target(w, h) };
    o.swap = function () { var t = o.read; o.read = o.write; o.write = t; };
    o.dispose = function () { o.read.dispose(); o.write.dispose(); };
    return o;
  }
  function material(frag, uniforms) {
    uniforms.texelSize = { value: new THREE.Vector2() };
    return new THREE.ShaderMaterial({
      vertexShader: S.fluidVert, fragmentShader: frag, uniforms: uniforms,
      depthTest: false, depthWrite: false, blending: THREE.NoBlending
    });
  }

  var sim = cfg.simRes, dye = cfg.dyeRes;
  var simTexel = new THREE.Vector2(1 / sim, 1 / sim), dyeTexel = new THREE.Vector2(1 / dye, 1 / dye);
  var velocity = pingPong(sim, sim), density = pingPong(dye, dye), pressure = pingPong(sim, sim);
  var divergenceRT = target(sim, sim), curlRT = target(sim, sim);
  var maskRT = null;

  var M = {
    splat: material(S.splat, { uTarget: { value: null }, aspectRatio: { value: 1 }, color: { value: new THREE.Vector3() }, pA: { value: new THREE.Vector2() }, pB: { value: new THREE.Vector2() }, radius: { value: 0.01 } }),
    curl: material(S.curl, { uVelocity: { value: null } }),
    vorticity: material(S.vorticity, { uVelocity: { value: null }, uCurl: { value: null }, curl: { value: cfg.curl }, dt: { value: cfg.dt } }),
    divergence: material(S.divergence, { uVelocity: { value: null } }),
    clear: material(S.clear, { uTexture: { value: null }, value: { value: cfg.pressureDissipation } }),
    pressure: material(S.pressure, { uPressure: { value: null }, uDivergence: { value: null } }),
    gradient: material(S.gradient, { uPressure: { value: null }, uVelocity: { value: null } }),
    advection: material(S.advection, { uVelocity: { value: null }, uSource: { value: null }, dyeTexelSize: { value: new THREE.Vector2() }, dt: { value: cfg.dt }, dissipation: { value: 1 } }),
    mask: material(S.mask, { uDye: { value: null } })
  };

  function pass(mat, out, texel) {
    mat.uniforms.texelSize.value.copy(texel || simTexel);
    quad.material = mat;
    renderer.setRenderTarget(out);
    renderer.render(scene, camera);
  }

  // Clear all targets to zero once.
  [velocity.read, velocity.write, density.read, density.write, pressure.read, pressure.write, divergenceRT, curlRT].forEach(function (rt) {
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear();
  });
  renderer.setRenderTarget(null);

  var aspect = 1;
  function resize(w, h) {
    // Viewport-sized density mask (CSS pixels; 8-bit is enough for a 0..1 mask).
    if (maskRT) maskRT.dispose();
    maskRT = target(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), THREE.UnsignedByteType);
    aspect = w / h;
  }

  // Add one brush stroke from a to b (UV, y up). force = (vx, vy) in velocity units.
  function splat(a, b, vx, vy, radius) {
    var u = M.splat.uniforms;
    u.aspectRatio.value = aspect; u.pA.value.copy(a); u.pB.value.copy(b); u.radius.value = radius;
    u.uTarget.value = velocity.read.texture; u.color.value.set(vx, vy, 1);
    pass(M.splat, velocity.write); velocity.swap();
    u.uTarget.value = density.read.texture; u.color.value.set(1, 1, 1);
    pass(M.splat, density.write, dyeTexel); density.swap();
  }

  function step() {
    M.curl.uniforms.uVelocity.value = velocity.read.texture;
    pass(M.curl, curlRT);

    M.vorticity.uniforms.uVelocity.value = velocity.read.texture;
    M.vorticity.uniforms.uCurl.value = curlRT.texture;
    pass(M.vorticity, velocity.write); velocity.swap();

    M.divergence.uniforms.uVelocity.value = velocity.read.texture;
    pass(M.divergence, divergenceRT);

    M.clear.uniforms.uTexture.value = pressure.read.texture;
    pass(M.clear, pressure.write); pressure.swap();

    M.pressure.uniforms.uDivergence.value = divergenceRT.texture;
    for (var i = 0; i < cfg.pressureIterations; i++) {
      M.pressure.uniforms.uPressure.value = pressure.read.texture;
      pass(M.pressure, pressure.write); pressure.swap();
    }

    M.gradient.uniforms.uPressure.value = pressure.read.texture;
    M.gradient.uniforms.uVelocity.value = velocity.read.texture;
    pass(M.gradient, velocity.write); velocity.swap();

    var adv = M.advection.uniforms;
    adv.uVelocity.value = velocity.read.texture; adv.uSource.value = velocity.read.texture;
    adv.dyeTexelSize.value.copy(simTexel); adv.dissipation.value = cfg.velocityDissipation;
    pass(M.advection, velocity.write); velocity.swap();

    adv.uVelocity.value = velocity.read.texture; adv.uSource.value = density.read.texture;
    adv.dyeTexelSize.value.copy(dyeTexel); adv.dissipation.value = cfg.densityDissipation;
    pass(M.advection, density.write, simTexel); density.swap();

    M.mask.uniforms.uDye.value = density.read.texture;
    pass(M.mask, maskRT, dyeTexel);
    renderer.setRenderTarget(null);
  }

  function dispose() {
    velocity.dispose(); density.dispose(); pressure.dispose(); divergenceRT.dispose(); curlRT.dispose();
    if (maskRT) maskRT.dispose();
    Object.keys(M).forEach(function (k) { M[k].dispose(); });
    quad.geometry.dispose();
  }

  return {
    resize: resize, splat: splat, step: step, dispose: dispose,
    get velocity() { return velocity.read.texture; },
    get mask() { return maskRT.texture; },
    get density() { return density.read.texture; }
  };
};
