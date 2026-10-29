/* AXON — GPU particle system.
   Positions live in a size×size float texture (one particle per texel). A full-screen simulation pass
   reads the current texture and writes the next one (ping-pong). The Points mesh reads the latest texture
   in its vertex shader, so particle positions never travel back to the CPU. */
window.AxonParticles = function (renderer, opts) {
  "use strict";
  var S = window.AXON_SHADERS;
  var size = opts.size, count = size * size, type = opts.type;

  // --- data textures: origin positions (uniform in [-1,1]^3) and per-particle random vec4 in [0,1] ---
  var origin = new Float32Array(count * 4), random = new Float32Array(count * 4), ref = new Float32Array(count * 3);
  for (var i = 0; i < count; i++) {
    origin[i * 4] = Math.random() * 2 - 1; origin[i * 4 + 1] = Math.random() * 2 - 1; origin[i * 4 + 2] = Math.random() * 2 - 1; origin[i * 4 + 3] = 1;
    random[i * 4] = Math.random(); random[i * 4 + 1] = Math.random(); random[i * 4 + 2] = Math.random(); random[i * 4 + 3] = Math.random();
    var x = i % size, y = Math.floor(i / size);
    ref[i * 3] = (x + 0.5) / size; ref[i * 3 + 1] = (y + 0.5) / size; ref[i * 3 + 2] = 0;   // texel centre UV
  }
  function dataTex(arr) {
    var t = new THREE.DataTexture(arr, size, size, THREE.RGBAFormat, THREE.FloatType);
    t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
    return t;
  }
  var originTex = dataTex(origin), randomTex = dataTex(random);

  // --- ping-pong position targets ---
  function rt() {
    return new THREE.WebGLRenderTarget(size, size, {
      type: type, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      depthBuffer: false, stencilBuffer: false
    });
  }
  var read = rt(), write = rt();

  var simScene = new THREE.Scene(), simCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; simScene.add(quad);

  var copyMat = new THREE.ShaderMaterial({ vertexShader: S.simVert, fragmentShader: S.copyFrag, uniforms: { uTex: { value: originTex } }, depthTest: false, depthWrite: false });
  var simMat = new THREE.ShaderMaterial({
    vertexShader: S.simVert, fragmentShader: S.simFrag, depthTest: false, depthWrite: false,
    uniforms: {
      uPos: { value: null }, uOrigin: { value: originTex }, uRandom: { value: randomTex },
      uFluidVel: { value: null }, uFluidMask: { value: null },
      uTime: { value: 0 }, uHZ: { value: 1 }, uForm: { value: 0 },
      uCurlScale: { value: 1 }, uCurlTime: { value: 0.5 }, uCurlSpeed: { value: 1 }, uMouseStrength: { value: 0.4 },
      uFlowScale: { value: opts.flowScale },
      uViewProj: { value: new THREE.Matrix4() }, uModel: { value: new THREE.Matrix4() },
      uCamRot: { value: new THREE.Matrix3() }, uModelInvRot: { value: new THREE.Matrix3() }
    }
  });

  // Seed: copy the random origin positions into the first position target.
  quad.material = copyMat;
  renderer.setRenderTarget(read); renderer.render(simScene, simCam); renderer.setRenderTarget(null);

  // --- points ---
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(ref, 3));
  geo.setAttribute("random", new THREE.BufferAttribute(random.slice(0), 4));
  var pointsMat = new THREE.ShaderMaterial({
    vertexShader: S.pointsVert, fragmentShader: S.pointsFrag,
    uniforms: {
      uPos: { value: read.texture }, uSize: { value: opts.pointSize }, uPixelRatio: { value: renderer.getPixelRatio() }, uDistRef: { value: 1 },
      uMatcap: { value: opts.matcap }, uTime: { value: 0 }, uIntensity: { value: opts.intensity }
    },
    transparent: true, blending: THREE.AdditiveBlending, depthTest: true, depthWrite: false
  });
  var points = new THREE.Points(geo, pointsMat);
  points.frustumCulled = false;

  var tmp4 = new THREE.Matrix4();
  function update(time, hz, camera, group, fluid) {
    var u = simMat.uniforms;
    u.uPos.value = read.texture; u.uTime.value = time; u.uHZ.value = hz;
    var f = Math.min(time / 3, 1); u.uForm.value = f * f;   // formation ramp over the first 3 s
    u.uFluidVel.value = fluid.velocity; u.uFluidMask.value = fluid.mask;
    u.uViewProj.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    u.uModel.value.copy(group.matrixWorld);
    u.uCamRot.value.setFromMatrix4(camera.matrixWorld);
    u.uModelInvRot.value.setFromMatrix4(tmp4.copy(group.matrixWorld).invert());
    quad.material = simMat;
    renderer.setRenderTarget(write); renderer.render(simScene, simCam); renderer.setRenderTarget(null);
    var t = read; read = write; write = t;
    pointsMat.uniforms.uPos.value = read.texture;
    pointsMat.uniforms.uTime.value = time;
  }

  function dispose() {
    read.dispose(); write.dispose(); originTex.dispose(); randomTex.dispose();
    copyMat.dispose(); simMat.dispose(); pointsMat.dispose(); geo.dispose(); quad.geometry.dispose();
  }

  return {
    points: points, update: update, dispose: dispose, count: count,
    setPixelRatio: function (pr) { pointsMat.uniforms.uPixelRatio.value = pr; },
    setDistRef: function (r) { pointsMat.uniforms.uDistRef.value = r; },
    readPositions: function () {                     // debugging aid (float32 targets only)
      var buf = new Float32Array(count * 4);
      renderer.readRenderTargetPixels(read, 0, 0, size, size, buf);
      return buf;
    }
  };
};
