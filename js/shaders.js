/* AXON — all GLSL shader sources.
   Written in GLSL ES 1.0 style (attribute/varying/texture2D/gl_FragColor). Three.js r150 automatically
   rewrites these for WebGL 2 (GLSL ES 3.0) through its built-in #define prefix, so the same source runs on
   WebGL 1 and WebGL 2. */
window.AXON_SHADERS = (function () {
  "use strict";

  /* ---------- shared full-screen vertex shader for the fluid passes ----------
     A 2×2 plane covers clip space. vL/vR/vT/vB are the UVs of the four neighbouring texels,
     which the finite-difference passes (curl, divergence, pressure, gradient) need. */
  var fluidVert = [
    "uniform vec2 texelSize;",
    "varying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;",
    "void main() {",
    "  vUv = position.xy * 0.5 + 0.5;",
    "  vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);",
    "  vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y);",
    "  gl_Position = vec4(position.xy, 0.0, 1.0);",
    "}"
  ].join("\n");

  var head = "precision highp float;\nvarying vec2 vUv; varying vec2 vL; varying vec2 vR; varying vec2 vT; varying vec2 vB;\n";

  /* Splat: adds a Gaussian "brush stroke" along the segment pA→pB (UV space, aspect-corrected). */
  var splat = head + [
    "uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 pA; uniform vec2 pB; uniform float radius;",
    "float segDist(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0); return length(pa - ba * h); }",
    "void main() {",
    "  vec2 asp = vec2(aspectRatio, 1.0);",
    "  float d = segDist(vUv * asp, pA * asp, pB * asp);",
    "  vec3 s = exp(-(d * d) / (radius * radius)) * color;",
    "  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + s, 1.0);",
    "}"
  ].join("\n");

  /* Curl (vorticity magnitude) of the 2D velocity field. */
  var curl = head + [
    "uniform sampler2D uVelocity;",
    "void main() {",
    "  float L = texture2D(uVelocity, vL).y; float R = texture2D(uVelocity, vR).y;",
    "  float T = texture2D(uVelocity, vT).x; float B = texture2D(uVelocity, vB).x;",
    "  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);",
    "}"
  ].join("\n");

  /* Vorticity confinement: pushes velocity along the curl gradient so small swirls are not smoothed away. */
  var vorticity = head + [
    "uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;",
    "void main() {",
    "  float L = texture2D(uCurl, vL).x; float R = texture2D(uCurl, vR).x;",
    "  float T = texture2D(uCurl, vT).x; float B = texture2D(uCurl, vB).x;",
    "  float C = texture2D(uCurl, vUv).x;",
    "  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));",
    "  force /= length(force) + 0.0001;",
    "  force *= curl * C; force.y *= -1.0;",
    "  vec2 vel = texture2D(uVelocity, vUv).xy + force * dt;",
    "  gl_FragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);",
    "}"
  ].join("\n");

  /* Divergence: how much fluid flows out of each cell (walls reflect at the borders). */
  var divergence = head + [
    "uniform sampler2D uVelocity;",
    "void main() {",
    "  float L = texture2D(uVelocity, vL).x; float R = texture2D(uVelocity, vR).x;",
    "  float T = texture2D(uVelocity, vT).y; float B = texture2D(uVelocity, vB).y;",
    "  vec2 C = texture2D(uVelocity, vUv).xy;",
    "  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;",
    "  if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;",
    "  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);",
    "}"
  ].join("\n");

  /* Multiplies a texture by a constant (used for pressure dissipation). */
  var clear = head + [
    "uniform sampler2D uTexture; uniform float value;",
    "void main() { gl_FragColor = value * texture2D(uTexture, vUv); }"
  ].join("\n");

  /* One Jacobi iteration of the pressure Poisson equation. */
  var pressure = head + [
    "uniform sampler2D uPressure; uniform sampler2D uDivergence;",
    "void main() {",
    "  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;",
    "  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;",
    "  float div = texture2D(uDivergence, vUv).x;",
    "  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);",
    "}"
  ].join("\n");

  /* Subtracts the pressure gradient so the velocity field becomes (approximately) divergence-free. */
  var gradient = head + [
    "uniform sampler2D uPressure; uniform sampler2D uVelocity;",
    "void main() {",
    "  float L = texture2D(uPressure, vL).x; float R = texture2D(uPressure, vR).x;",
    "  float T = texture2D(uPressure, vT).x; float B = texture2D(uPressure, vB).x;",
    "  vec2 vel = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);",
    "  gl_FragColor = vec4(vel, 0.0, 1.0);",
    "}"
  ].join("\n");

  /* Semi-Lagrangian advection: each texel looks back along the velocity and copies what was there.
     Bilinear interpolation is done manually so it also works where half-float linear filtering is missing. */
  var advection = head + [
    "uniform sampler2D uVelocity; uniform sampler2D uSource;",
    "uniform vec2 texelSize; uniform vec2 dyeTexelSize; uniform float dt; uniform float dissipation;",
    "vec4 bilerp(sampler2D sam, vec2 uv, vec2 ts) {",
    "  vec2 st = uv / ts - 0.5; vec2 iuv = floor(st); vec2 f = fract(st);",
    "  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * ts); vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * ts);",
    "  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * ts); vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * ts);",
    "  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);",
    "}",
    "void main() {",
    "  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;",
    "  gl_FragColor = dissipation * bilerp(uSource, coord, dyeTexelSize);",
    "}"
  ].join("\n");

  /* Density display / mask: copies dye into a viewport-sized target with alpha = max(r, g, b). */
  var mask = head + [
    "uniform sampler2D uDye;",
    "void main() { vec3 c = texture2D(uDye, vUv).rgb; gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0)); }"
  ].join("\n");

  /* ---------- particle simulation ---------- */
  var simVert = [
    "varying vec2 vUv;",
    "void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }"
  ].join("\n");

  /* Copies a texture (used once to seed the position target with the origin texture). */
  var copyFrag = "precision highp float;\nvarying vec2 vUv; uniform sampler2D uTex;\nvoid main(){ gl_FragColor = texture2D(uTex, vUv); }";

  /* The sculpted shape. Shared by the simulation; documented in README (Stage 6). */
  var sdfChunk = [
    "vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }",
    "mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }",
    "float shapeSDF(vec3 q) {",
    "  float a = atan(q.z, q.x);",                                   // angle around the ring
    "  float R = 0.20 + 0.03 * sin(3.0 * a + 0.6);",                // ring radius with three soft lobes
    "  vec2 d = vec2(length(q.xz) - R, q.y);",                       // 2D offset from the ring's centre line
    "  d = rot2(0.5 * a + 0.35) * d;",                               // half twist per turn keeps the ellipse continuous
    "  float r = 0.07 + 0.028 * sin(2.0 * a - 0.8);",                // tube thickness swells and narrows
    "  float e = length(d / vec2(1.0, 0.62)) - r;",                  // elliptical cross-section (approximate distance)
    "  return e * 0.62;",                                            // scaled so the field never overestimates distance
    "}",
    "float sdf(vec3 p) {",
    "  if (length(p) > 0.8) return length(p) - 0.7;",
    "  p.z = sqrt(p.z * p.z + 0.0215) - sqrt(0.012);",                // smooth mirror in depth (brief, section 8)
    "  p = qrot(vec4(0.5, 0.5, 0.5, 0.5), p);",                      // 120 degrees about (1,1,1)
    "  return shapeSDF(p);",
    "}"
  ].join("\n");

  /* 3D simplex noise (Ashima / Stefan Gustavson, MIT) and its curl. */
  var noiseChunk = [
    "vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }",
    "vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }",
    "float snoise(vec3 v) {",
    "  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);",
    "  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);",
    "  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);",
    "  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + 2.0 * C.xxx; vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;",
    "  i = mod(i, 289.0);",
    "  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));",
    "  float n_ = 1.0 / 7.0; vec3 ns = n_ * D.wyz - D.xzx;",
    "  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);",
    "  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);",
    "  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);",
    "  vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));",
    "  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;",
    "  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);",
    "  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));",
    "  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;",
    "  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0); m = m * m;",
    "  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));",
    "}",
    "vec3 snoiseVec3(vec3 x) {",
    "  return vec3(snoise(x), snoise(vec3(x.y - 19.1, x.z + 33.4, x.x + 47.2)), snoise(vec3(x.z + 74.2, x.x - 124.5, x.y + 99.4)));",
    "}",
    "vec3 curlNoise(vec3 p) {",
    "  const float e = 0.1; vec3 dx = vec3(e, 0.0, 0.0); vec3 dy = vec3(0.0, e, 0.0); vec3 dz = vec3(0.0, 0.0, e);",
    "  vec3 px0 = snoiseVec3(p - dx); vec3 px1 = snoiseVec3(p + dx);",
    "  vec3 py0 = snoiseVec3(p - dy); vec3 py1 = snoiseVec3(p + dy);",
    "  vec3 pz0 = snoiseVec3(p - dz); vec3 pz1 = snoiseVec3(p + dz);",
    "  float x = py1.z - py0.z - pz1.y + pz0.y; float y = pz1.x - pz0.x - px1.z + px0.z; float z = px1.y - px0.y - py1.x + py0.x;",
    "  return vec3(x, y, z) / (2.0 * e);",
    "}"
  ].join("\n");

  var simFrag = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform sampler2D uPos; uniform sampler2D uOrigin; uniform sampler2D uRandom;",
    "uniform sampler2D uFluidVel; uniform sampler2D uFluidMask;",
    "uniform float uTime; uniform float uHZ; uniform float uForm;",
    "uniform float uCurlScale; uniform float uCurlTime; uniform float uCurlSpeed; uniform float uMouseStrength; uniform float uFlowScale;",
    "uniform mat4 uViewProj; uniform mat4 uModel; uniform mat3 uCamRot; uniform mat3 uModelInvRot;",
    noiseChunk,
    sdfChunk,
    "vec3 safeNorm(vec3 v) { float l = length(v); return l > 1e-6 ? v / l : vec3(0.0); }",
    "void main() {",
    "  vec3 p = texture2D(uPos, vUv).xyz;",
    "  vec3 origin = texture2D(uOrigin, vUv).xyz;",
    // 1. keep particles inside the working volume
    "  if (length(p) > 0.7) p /= 2.0;",
    // 2. curl-noise drift
    "  p += safeNorm(curlNoise(p * uCurlScale + uTime * uCurlTime * uCurlSpeed)) * 0.0002 * uHZ;",
    // 3. SDF gradient by central differences
    "  const float h = 0.001;",
    "  vec3 g = vec3(sdf(p + vec3(h, 0, 0)) - sdf(p - vec3(h, 0, 0)),",
    "                sdf(p + vec3(0, h, 0)) - sdf(p - vec3(0, h, 0)),",
    "                sdf(p + vec3(0, 0, h)) - sdf(p - vec3(0, 0, h))) / (2.0 * h);",
    // 4. signed distance
    "  float d = sdf(p);",
    // 5. tangential swirl around the surface
    "  p += cross(safeNorm(p), safeNorm(g)) * 0.0005;",
    // 6. pull onto the surface
    "  p += -g * d * 0.5 * uForm;",                                  // uForm ramps 0->1 over ~3 s (formation)
    // 7. spring back towards the origin
    "  p += (origin - p) * 0.0002 * uHZ;",
    // 8. project into screen UV
    "  vec4 clip = uViewProj * uModel * vec4(p, 1.0);",
    "  vec2 suv = clip.xy / clip.w * 0.5 + 0.5;",
    // 9-10. fluid push, expressed in the particles' local space
    "  if (clip.w > 0.0 && suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) {",
    "    vec2 flow = texture2D(uFluidVel, suv).xy;",
    "    float density = texture2D(uFluidMask, suv).a;",
    "    vec3 worldDir = uCamRot * vec3(flow, 0.0);",
    "    vec3 localDir = uModelInvRot * worldDir;",
    "    p += localDir * uFlowScale * 0.0001 * uHZ * uMouseStrength * density;",
    "  }",
    "  gl_FragColor = vec4(p, 1.0);",
    "}"
  ].join("\n");

  /* ---------- particle rendering ---------- */
  var pointsVert = [
    "attribute vec4 random;",
    "uniform sampler2D uPos; uniform float uSize; uniform float uPixelRatio; uniform float uDistRef;",
    "varying vec4 vRandom; varying float vScale;",
    "void main() {",
    "  vec3 p = texture2D(uPos, position.xy).xyz;",                    // position.xy holds this particle's texel UV
    "  vec4 mv = modelViewMatrix * vec4(p, 1.0);",
    "  gl_Position = projectionMatrix * mv;",
    "  float dist = -mv.z / uDistRef;",                                // distance relative to the camera's base distance
    "  float expand = mix(1.0, 1.5, pow(random.y, 150.0));",            // a rare few particles are 50% larger
    "  float scale = smoothstep(11.0, 4.0, dist) * random.z;",         // farther and low random.z -> smaller
    "  vScale = scale; vRandom = random;",
    "  gl_PointSize = scale < 0.1 ? 0.0 : uSize * scale * expand * uPixelRatio * (6.0 / dist);",
    "}"
  ].join("\n");

  var pointsFrag = [
    "precision highp float;",
    "uniform sampler2D uMatcap; uniform float uTime; uniform float uIntensity;",
    "varying vec4 vRandom; varying float vScale;",
    "vec3 softLight(vec3 a, vec3 b) { return mix(2.0 * a * b + a * a * (1.0 - 2.0 * b), sqrt(a) * (2.0 * b - 1.0) + 2.0 * a * (1.0 - b), step(0.5, b)); }",
    "vec3 overlay(vec3 a, vec3 b) { return mix(2.0 * a * b, 1.0 - 2.0 * (1.0 - a) * (1.0 - b), step(0.5, a)); }",
    "void main() {",
    "  vec2 c = gl_PointCoord - 0.5;",
    "  if (vScale < 0.1 || dot(c, c) > 0.25) discard;",                 // round sprite, tiny particles dropped
    "  vec3 col = mix(vec3(0.0), vec3(0.62), vRandom.x);",             // black-to-grey base
    "  if (vRandom.w > 0.965) col = vec3(0.6, 0.45, 1.0);",            // sparse lavender points
    "  float tw = sin(uTime * (0.8 + vRandom.y * 3.0) + vRandom.z * 6.2831853);",
    "  col += pow(max(tw, 0.0), 30.0) * step(0.85, vRandom.y) * 0.9;", // occasional sparkle
    "  float a = uTime * 0.35 * (vRandom.y - 0.5);",
    "  vec3 m = texture2D(uMatcap, rot2(a) * c * 0.9 + 0.5).rgb;",     // rotating matcap lookup
    "  col = mix(col, softLight(clamp(col, 0.0, 1.0), m), 0.6);",
    "  col = mix(col, overlay(clamp(col, 0.0, 1.0), m), 0.4);",
    "  gl_FragColor = vec4(col * uIntensity, 1.0);",
    "}"
  ].join("\n").replace("void main", "mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }\nvoid main");

  return {
    fluidVert: fluidVert, splat: splat, curl: curl, vorticity: vorticity, divergence: divergence,
    clear: clear, pressure: pressure, gradient: gradient, advection: advection, mask: mask,
    simVert: simVert, copyFrag: copyFrag, simFrag: simFrag, pointsVert: pointsVert, pointsFrag: pointsFrag
  };
})();
