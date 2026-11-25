// GLSL for the moon scene.
// Heavy work (moon surface, galaxy) is BAKED once into textures; per-frame shaders are tiny.

const NOISE = /* glsl */ `
#define PI 3.14159265359
float hash1(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash1(i), hash1(i+vec3(1,0,0)), f.x), mix(hash1(i+vec3(0,1,0)), hash1(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash1(i+vec3(0,0,1)), hash1(i+vec3(1,0,1)), f.x), mix(hash1(i+vec3(0,1,1)), hash1(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p = p*2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return v; }
vec3 hash3(vec3 p){
  p = vec3(dot(p, vec3(127.1,311.7,74.7)), dot(p, vec3(269.5,183.3,246.1)), dot(p, vec3(113.5,271.9,124.6)));
  return fract(sin(p)*43758.5453123);
}
vec3 dirFromUv(vec2 uv){
  float lon = (uv.x - 0.5) * 2.0 * PI;
  float lat = (uv.y - 0.5) * PI;
  return vec3(cos(lat)*sin(lon), sin(lat), cos(lat)*cos(lon));
}
vec3 dirLL(float latDeg, float lonDeg){
  float la = radians(latDeg), lo = radians(lonDeg);
  return vec3(cos(la)*sin(lo), sin(la), cos(la)*cos(lo));
}
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
`

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

// ---------------------------------------------------------------- Moon surface bake
// Output: R = albedo, G = height. Equirectangular, +Z = centre of the near side.
export const MOON_BAKE_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uDetail;
${NOISE}

vec2 craterLayer(vec3 p, float density, float depth){
  vec3 i = floor(p), f = fract(p);
  float h = 0.0, fresh = 0.0;
  for (int x = -1; x <= 1; x++)
  for (int y = -1; y <= 1; y++)
  for (int z = -1; z <= 1; z++){
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = hash3(i + g);
    if (o.x > density) continue;
    vec3 c = g + 0.15 + hash3(i + g + 7.31) * 0.7;
    float r = 0.16 + 0.34 * o.y;
    float d = length(c - f) / r;
    if (d < 1.7){
      float age = o.z;                                   // older craters are softer & shallower
      float bowl = d < 1.0 ? -smoothstep(1.0, 0.5, d) : 0.0;   // flat floors
      float rim = exp(-pow((d - 1.0) * mix(3.0, 6.0, age), 2.0)) * 0.55;
      float ejecta = d > 1.0 ? exp(-(d - 1.0) * 3.0) * 0.07 : 0.0;
      float peak = r > 0.36 ? smoothstep(0.28, 0.0, d) * 0.45 : 0.0;  // central peaks on big craters
      h += (bowl * 0.85 + rim + ejecta + peak) * depth * mix(0.25, 1.0, age);
      fresh = max(fresh, step(0.86, o.z) * smoothstep(1.6, 0.7, d));
    }
  }
  return vec2(h, fresh);
}

float mare(vec3 d, float lat, float lon, float rDeg, float edge){
  float ang = degrees(acos(clamp(dot(d, dirLL(lat, lon)), -1.0, 1.0)));
  return smoothstep(rDeg * 1.12, rDeg * 0.38, ang + edge);
}

float rays(vec3 d, float lat, float lon, float size, float seed){
  vec3 c = dirLL(lat, lon);
  float ang = acos(clamp(dot(d, c), -1.0, 1.0));
  vec3 t = normalize(cross(vec3(0.0, 1.0, 0.0), c));
  vec3 b = cross(c, t);
  vec3 q = d - c * dot(d, c);
  float a = atan(dot(q, b), dot(q, t));
  vec3 ring = vec3(cos(a), sin(a), seed);
  // many thin, uneven rays that fade with distance
  float streak = pow(noise(ring * 11.0), 4.0) * 1.6 + pow(noise(ring * 31.0 + 3.0), 6.0) * 1.8;
  streak *= 0.55 + 0.45 * noise(d * 40.0);
  float fall = exp(-ang / size);
  float halo = exp(-ang * ang / (size * size * 0.015));
  return streak * fall * smoothstep(0.0, 0.03, ang) + halo * 0.7;
}

void main(){
  vec3 d = dirFromUv(vUv);
  float edge = (fbm(d * 3.5) - 0.5) * 12.0 + (fbm(d * 11.0) - 0.5) * 4.0 + (fbm(d * 30.0) - 0.5) * 1.5;

  // Real near-side maria (selenographic lat, lon, radius in degrees)
  float m = 0.0;
  m = max(m, mare(d, 20.0, -57.0, 22.0, edge));   // Oceanus Procellarum
  m = max(m, mare(d,  4.0, -52.0, 15.0, edge));
  m = max(m, mare(d, 36.0, -50.0, 13.0, edge));
  m = max(m, mare(d, -6.0, -42.0, 11.0, edge));
  m = max(m, mare(d, 33.0, -16.0, 17.0, edge));   // Imbrium
  m = max(m, mare(d, 28.0,  17.5, 10.5, edge));   // Serenitatis
  m = max(m, mare(d,  8.5,  31.0, 12.0, edge));   // Tranquillitatis
  m = max(m, mare(d,  2.0,  23.0,  7.0, edge));
  m = max(m, mare(d, 17.0,  59.0,  7.5, edge));   // Crisium
  m = max(m, mare(d, -8.0,  51.0, 10.0, edge));   // Fecunditatis
  m = max(m, mare(d,-15.0,  35.0,  5.8, edge));   // Nectaris
  m = max(m, mare(d,-21.0, -17.0, 10.0, edge));   // Nubium
  m = max(m, mare(d,-10.0, -23.0,  6.0, edge));   // Cognitum
  m = max(m, mare(d,-24.0, -39.0,  5.8, edge));   // Humorum
  m = max(m, mare(d,  7.0, -30.0,  8.0, edge));   // Insularum
  m = max(m, mare(d, 13.0,   4.0,  4.8, edge));   // Vaporum
  m = max(m, mare(d, 56.0, -30.0,  6.0, edge));   // Frigoris (a long band)
  m = max(m, mare(d, 57.0,  -5.0,  6.0, edge));
  m = max(m, mare(d, 57.0,  20.0,  6.0, edge));
  m = max(m, mare(d, 45.0,  38.0,  5.0, edge));   // Lacus Somniorum / Mare Frigoris east
  m = max(m, mare(d, -1.0,  86.0,  6.0, edge));   // Smythii (limb)
  m = max(m, mare(d, 19.0,  86.0,  4.5, edge));   // Marginis

  // Albedo
  float highlands = 0.64 + (fbm(d * 4.0) - 0.5) * 0.14 + (fbm(d * 26.0) - 0.5) * 0.09;
  float mariaAlb  = 0.42 + (fbm(d * 4.5 + 3.0) - 0.5) * 0.14 + (fbm(d * 14.0) - 0.5) * 0.06 + (fbm(d * 40.0) - 0.5) * 0.03;
  float alb = mix(highlands, mariaAlb, m) - m * m * 0.05;

  // Craters at four scales (fewer, shallower in maria — like the real moon)
  vec2 c1 = craterLayer(d * 3.2, 0.28, 0.6);
  vec2 c2 = craterLayer(d * 8.5, 0.45, 0.55);
  vec2 c3 = craterLayer(d * 21.0, 0.42, 0.28);
  vec2 c4 = craterLayer(d * 52.0, 0.5, 0.13);
  vec2 c5 = uDetail > 1.5 ? craterLayer(d * 115.0, 0.72, 0.065) : vec2(0.0);
  vec2 c6 = uDetail > 2.5 ? craterLayer(d * 240.0, 0.78, 0.032) : vec2(0.0);
  float craterH = (c1.x * (1.0 - m * 0.8) + c2.x * (1.0 - m * 0.6) + c3.x + c4.x + c5.x + c6.x);
  float height = 0.5 + craterH * 0.16 + (fbm(d * 14.0) - 0.5) * 0.05 + (fbm(d * 90.0) - 0.5) * 0.012 - m * 0.05;
  alb += (c2.y * 0.06 + c3.y * 0.10 + c4.y * 0.08 + c5.y * 0.07 + c6.y * 0.05) * (1.0 - m * 0.4);
  // fine regolith grain and ejecta brightness
  alb += (fbm(d * 85.0) - 0.5) * 0.045 + (noise(d * 300.0) - 0.5) * 0.025;
  alb += max(c1.x, 0.0) * 0.05;

  // Bright ray systems
  alb += rays(d, -43.3, -11.2, 0.45, 1.0) * 0.17;   // Tycho
  alb += rays(d,   9.6, -20.1, 0.18, 2.0) * 0.12;   // Copernicus
  alb += rays(d,   8.1, -38.0, 0.10, 3.0) * 0.08;   // Kepler
  alb += rays(d,  23.7, -47.4, 0.03, 4.0) * 0.22;   // Aristarchus (brightest spot)
  alb += rays(d,  -5.0,  60.0, 0.08, 5.0) * 0.06;   // Langrenus

  gl_FragColor = vec4(clamp(alb, 0.0, 1.0), clamp(height, 0.0, 1.0), m, 1.0);
}
`

// ---------------------------------------------------------------- Sky bake (gradient, Milky Way, nebula)
export const SKY_BAKE_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 uTop, uBottom, uGal1, uGal2, uNeb;
uniform float uGalAmt, uNebAmt, uTilt, uOffset, uHorizon;
${NOISE}
void main(){
  vec3 d = dirFromUv(vUv);
  d.xz = -d.xz; // put the texture seam behind the camera
  vec3 col = mix(lin(uBottom), lin(uTop), smoothstep(-0.42, 0.38, d.y));
  // faint horizon glow
  col += lin(uBottom) * exp(-pow((d.y + 0.38) * 5.0, 2.0)) * uHorizon * 0.6;

  // Milky Way band (a great circle tilted across the view)
  vec3 gN = normalize(vec3(cos(uTilt), sin(uTilt), uOffset));
  float b = dot(d, gN);
  float n1 = fbm(d * 3.0);
  float n2 = fbm(d * 8.0 + 5.0);
  float core = exp(-b * b / 0.010);
  float wide = exp(-b * b / 0.055);
  float dust = smoothstep(0.42, 0.72, fbm(d * 7.0 + 11.0)) * exp(-b * b / 0.0035);
  vec3 gal = lin(uGal1) * core * (0.25 + n1 * 1.1) + lin(uGal2) * wide * 0.3 * (0.3 + n2);
  gal *= 1.0 - dust * 0.9;
  // star clouds: grainy texture inside the band
  float grain = pow(noise(d * 140.0), 6.0) * 3.0 + pow(noise(d * 320.0 + 9.0), 8.0) * 4.0;
  gal += lin(mix(uGal1, vec3(1.0), 0.6)) * grain * core * 0.25;
  col += gal * uGalAmt * 0.32;

  // Nebula clouds
  float neb = smoothstep(0.52, 0.92, fbm(d * 1.7 + 20.0)) * (0.6 + 0.4 * fbm(d * 6.0));
  col += lin(uNeb) * neb * uNebAmt * 0.14;

  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);
}
`

// ---------------------------------------------------------------- Per-frame shaders
export const DIR_VERT = /* glsl */ `
varying vec3 vPos;
void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

export const SKY_FRAG = /* glsl */ `
#define PI 3.14159265359
varying vec3 vPos;
uniform sampler2D uSky;
void main(){
  vec3 d = normalize(vPos);
  vec2 uv = vec2(atan(-d.x, -d.z) / (2.0 * PI) + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
  gl_FragColor = vec4(texture2D(uSky, uv).rgb, 1.0);
}
`

export const MOON_FRAG = /* glsl */ `
#define PI 3.14159265359
varying vec3 vPos;
uniform sampler2D uSurf;
uniform vec2 uTexel;
uniform vec3 uSun, uView, uTint, uEarthTint;
uniform float uEarthshine, uExposure, uBump, uReady, uContrast;
vec3 lin(vec3 c){ return pow(c, vec3(2.2)); }
void main(){
  vec3 n = normalize(vPos);
  float lon = atan(n.x, n.z);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  // seamless longitude (Tarini's trick): pick whichever wrap has the smaller derivative
  float uA = lon / (2.0 * PI) + 0.5;
  float uB = fract(uA + 0.5) - 0.5;
  vec2 uv = vec2(fwidth(uA) <= fwidth(uB) + 1e-6 ? uA : uB, lat / PI + 0.5);
  vec4 s = texture2D(uSurf, uv);
  float hE = texture2D(uSurf, uv + vec2(uTexel.x, 0.0)).g - texture2D(uSurf, uv - vec2(uTexel.x, 0.0)).g;
  float hN = texture2D(uSurf, uv + vec2(0.0, uTexel.y)).g - texture2D(uSurf, uv - vec2(0.0, uTexel.y)).g;
  vec3 east = normalize(vec3(n.z, 0.0, -n.x) + 1e-5);
  vec3 north = cross(n, east);
  float cl = max(cos(lat), 0.2);
  vec3 pn = normalize(n - uBump * (hE / cl * east + hN * north));

  float mu0 = dot(pn, uSun);
  float mu = max(dot(pn, uView), 0.0);
  float lambert = max(mu0, 0.0);
  float ls = mu0 > 0.0 ? mu0 / (mu0 + mu + 1e-3) : 0.0;   // Lommel–Seeliger: the flat look of the real moon
  float light = mix(lambert, ls * 1.7, 0.6);
  light *= smoothstep(-0.05, 0.10, dot(n, uSun));          // soft terminator

  float albedo = pow(s.r, uContrast);
  vec3 col = lin(uTint) * albedo * light * uExposure;
  float night = 1.0 - smoothstep(-0.12, 0.08, dot(n, uSun));
  col += lin(uEarthTint) * albedo * uEarthshine * night * (0.35 + 0.65 * max(dot(n, uView), 0.0));
  col = col / (1.0 + col * 0.12);
  gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), uReady);
}
`

export const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
export const GLOW_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uIntensity, uInner, uIll;
uniform vec2 uLit;
void main(){
  vec2 q = (vUv - 0.5) * 2.0;
  float d = length(q);
  float side = mix(1.0, 0.12 + 0.88 * smoothstep(-0.6, 0.9, dot(normalize(q + 1e-5), uLit)), 1.0 - uIll);
  float x = max(d - uInner, 0.0) / (1.0 - uInner);
  float a = exp(-x * 7.0) * 0.35 + exp(-x * 22.0) * 0.65;  // tight, realistic sheen
  a *= smoothstep(1.0, 0.75, d) * step(uInner * 0.98, d) * side;
  gl_FragColor = vec4(pow(uColor, vec3(2.2)) * a * uIntensity, 1.0);
}
`

export const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime, uScale, uTwinkle, uBright;
varying vec3 vColor;
varying float vSize;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.6 + aPhase * 2.2) + aPhase * 40.0)) * 0.55;
  vColor = aColor * tw * uBright;
  vSize = aSize;
  gl_PointSize = aSize * uScale;
  gl_Position = projectionMatrix * mv;
}
`
export const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vSize;
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float r2 = dot(p, p);
  float a = exp(-r2 * 38.0) + exp(-r2 * 9.0) * 0.18;
  // diffraction spikes on the brightest stars
  if (vSize > 2.6) a += (exp(-abs(p.x) * 60.0) * exp(-p.y * p.y * 30.0) + exp(-abs(p.y) * 60.0) * exp(-p.x * p.x * 30.0)) * 0.35;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor * a, 1.0);
}
`

export const SHOOT_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uLife;
void main(){
  float u = vUv.x, v = (vUv.y - 0.5) * 2.0;
  float tail = pow(u, 2.4);
  float width = exp(-v * v * mix(40.0, 6.0, u));
  float head = exp(-pow((u - 0.985) * 40.0, 2.0)) * exp(-v * v * 4.0) * 1.6;
  float fade = sin(clamp(uLife, 0.0, 1.0) * 3.14159);
  gl_FragColor = vec4(pow(uColor, vec3(2.2)) * (tail * width + head) * fade, 1.0);
}
`
