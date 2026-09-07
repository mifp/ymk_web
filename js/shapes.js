// Shared parametric surfaces. Pure math keeps every morph deterministic.
export const SERVICES = [
  { id: 'arch', label: 'Arkitektur', number: '01', color: '#d5f3a1', note: 'Et klart fundament. Plads til at udvikle sig.' },
  { id: 'fhir', label: 'Sundheds-it', number: '02', color: '#a4e7df', note: 'Den rette information. På tværs af systemer.' },
  { id: 'iot', label: 'IoT', number: '03', color: '#efd5a0', note: 'Fra den fysiske verden. Til digitale muligheder.' },
  { id: 'cloud', label: 'Cloud', number: '04', color: '#b5cffa', note: 'En platform, der bærer. Også i morgen.' },
  { id: 'identity', label: 'Identitet', number: '05', color: '#d3c4f0', note: 'Sikker adgang. Sammenhængende oplevelser.' },
  { id: 'people', label: 'Samarbejde', number: '06', color: '#f0bca7', note: 'Forskellige perspektiver. Én fælles retning.' },
];
const TAU = Math.PI * 2;

export function sampleShape(mode, u, v, out, offset = 0) {
  const a = u * TAU;
  const b = v * TAU;
  let x, y, z;
  if (mode === 'arch') {
    // Continuous lines sweep the six faces of an architectural cube.
    const face = Math.min(5, Math.floor(v * 6));
    const edge = (v * 6 - face) * 2 - 1;
    const t = u * 2 - 1;
    const s = 1.05;
    if (face < 2) { x = face ? s : -s; y = t * s; z = edge * s; }
    else if (face < 4) { x = t * s; y = face === 3 ? s : -s; z = edge * s; }
    else { x = t * s; y = edge * s; z = face === 5 ? s : -s; }
    const xx = x * .88 + z * .48;
    z = -x * .48 + z * .88;
    x = xx;
    const yy = y * .94 - z * .34;
    z = y * .34 + z * .94;
    y = yy;
  } else if (mode === 'fhir') {
    const strand = v < .5 ? 0 : Math.PI;
    const tube = (v * 2 % 1) * TAU;
    const theta = a * 1.7 + strand;
    const radius = .76 + Math.cos(tube) * .14;
    x = Math.cos(theta) * radius;
    y = (u - .5) * 3.25 + Math.sin(tube) * .14;
    z = Math.sin(theta) * radius;
    const yy = y * .94 + x * .34;
    x = x * .94 - y * .34;
    y = yy;
  } else if (mode === 'iot') {
    const latitude = (v - .5) * Math.PI;
    const radius = 1.26 + .11 * Math.cos(a * 8) * Math.cos(latitude * 6);
    x = radius * Math.cos(latitude) * Math.cos(a);
    y = radius * Math.sin(latitude);
    z = radius * Math.cos(latitude) * Math.sin(a);
  } else if (mode === 'cloud') {
    const layer = Math.floor(v * 7);
    const radial = .2 + (v * 7 % 1) * 1.22;
    x = radial * Math.cos(a);
    z = radial * Math.sin(a);
    y = (layer - 3) * .28 + .16 * Math.sin(a * 3 + radial * 2);
  } else if (mode === 'identity') {
    const radius = 1.03 + .29 * Math.cos(b);
    x = radius * Math.cos(a);
    y = radius * Math.sin(a);
    z = .36 * Math.sin(b) + .14 * Math.sin(a * 4);
  } else if (mode === 'people') {
    const ring = Math.min(2, Math.floor(v * 3));
    const section = (v * 3 % 1) * TAU;
    const radius = .83 + .16 * Math.cos(section);
    x = radius * Math.cos(a) + (ring - 1) * .45;
    y = radius * Math.sin(a);
    z = .16 * Math.sin(section);
    const angle = (ring - 1) * .8;
    const xx = x * Math.cos(angle) + z * Math.sin(angle);
    z = -x * Math.sin(angle) + z * Math.cos(angle);
    x = xx;
  } else {
    // A (2, 3) torus knot, with an analytic moving frame around its spine.
    const r = 1 + .34 * Math.cos(3 * a);
    const cx = r * Math.cos(2 * a), cy = r * Math.sin(2 * a), cz = .44 * Math.sin(3 * a);
    let tx = -1.02 * Math.sin(3 * a) * Math.cos(2 * a) - 2 * r * Math.sin(2 * a);
    let ty = -1.02 * Math.sin(3 * a) * Math.sin(2 * a) + 2 * r * Math.cos(2 * a);
    let tz = 1.32 * Math.cos(3 * a);
    const length = Math.hypot(tx, ty, tz);
    tx /= length; ty /= length; tz /= length;
    let nx = -ty, ny = tx;
    const nl = Math.hypot(nx, ny);
    nx /= nl; ny /= nl;
    const bx = -tz * ny, by = tz * nx, bz = tx * ny - ty * nx;
    const tube = .205 + .035 * Math.cos(a * 3 + b * 2);
    x = cx + tube * (Math.cos(b) * nx + Math.sin(b) * bx);
    y = cy + tube * (Math.cos(b) * ny + Math.sin(b) * by);
    z = cz + tube * Math.sin(b) * bz;
    const yy = y * .86 - z * .5;
    z = y * .5 + z * .86;
    y = yy;
  }
  out[offset] = x; out[offset + 1] = y; out[offset + 2] = z;
  return out;
}

export function makeSurface(mode, columns, rows) {
  const positions = new Float32Array(columns * rows * 3);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      sampleShape(mode, column / (columns - 1), (row + .5) / rows, positions, (row * columns + column) * 3);
    }
  }
  return positions;
}
