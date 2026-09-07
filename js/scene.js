import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SERVICES, makeSurface } from './shapes.js';

const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const smooth = value => value * value * (3 - 2 * value);

export function createScene({ canvas, stage, labels, reducedMotion, onError }) {
  function readTheme() {
    const styles = getComputedStyle(document.documentElement);
    const read = name => styles.getPropertyValue(name).trim();
    return {
      bg: read('--bg'), accent: read('--theme-accent'), orbit: read('--scene-orbit'), dust: read('--scene-dust'),
      services: Object.fromEntries(SERVICES.map(service => [service.id, read(`--service-${service.id}`)])),
    };
  }
  let theme = readTheme();
  const mobile = stage.clientWidth < 600;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(theme.bg, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.35 : 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(41, 1, .1, 50);
  camera.position.set(0, 0, 8.2);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(800, 700), .62, .55, .68);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const system = new THREE.Group();
  const sculpture = new THREE.Group();
  system.add(sculpture);
  scene.add(system);
  const color = new THREE.Color(theme.accent);
  const colorTarget = color.clone();
  const columns = mobile ? 360 : 560;
  const rows = mobile ? 42 : 64;
  const initialSurface = makeSurface('home', columns, rows);
  const surfaceCache = new Map([['home', initialSurface]]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(initialSurface.slice(), 3));
  geometry.setAttribute('target', new THREE.BufferAttribute(initialSurface.slice(), 3));
  const phases = new Float32Array(columns * rows);
  const sizes = new Float32Array(columns * rows);
  for (let i = 0; i < phases.length; i++) {
    phases[i] = (i % columns) / columns;
    sizes[i] = .6 + ((i * 17) % 29) / 29;
  }
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const uniforms = {
    uTime: { value: 0 }, uMorph: { value: 1 }, uColor: { value: color },
    uPixelRatio: { value: renderer.getPixelRatio() }, uOpacity: { value: 1 },
  };
  const vertexShader = `
    uniform float uTime;
    uniform float uMorph;
    uniform float uPixelRatio;
    attribute vec3 target;
    attribute float phase;
    attribute float size;
    varying float vPhase;
    varying float vDepth;
    void main() {
      vec3 p = mix(position, target, uMorph);
      p *= 1.0 + sin(uTime * 0.45) * 0.012;
      vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * viewPosition;
      gl_PointSize = clamp(size * uPixelRatio * 12.0 / -viewPosition.z, 0.7, 4.5);
      vPhase = phase;
      vDepth = clamp((viewPosition.z + 10.0) / 5.0, 0.2, 1.0);
    }
  `;
  const material = new THREE.ShaderMaterial({
    uniforms, vertexShader,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      varying float vPhase;
      varying float vDepth;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float pulse = pow(0.5 + 0.5 * sin(vPhase * 31.4159 - uTime * 0.65), 12.0);
        float alpha = (1.0 - smoothstep(0.08, 0.5, d)) * (0.25 + vDepth * 0.45 + pulse * 0.3);
        gl_FragColor = vec4(uColor * (0.8 + pulse * 0.9), alpha * uOpacity);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(geometry, material);
  particles.frustumCulled = false;
  sculpture.add(particles);

  // A separate hairline lattice makes the surface legible between luminous particles.
  const lineColumns = 260;
  const lineRows = 26;
  const lineSurface = makeSurface('home', lineColumns, lineRows);
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(lineSurface.slice(), 3));
  lineGeometry.setAttribute('target', new THREE.BufferAttribute(lineSurface.slice(), 3));
  const linePhase = new Float32Array(lineColumns * lineRows);
  const lineSize = new Float32Array(lineColumns * lineRows).fill(1);
  const indices = [];
  for (let row = 0; row < lineRows; row++) {
    for (let col = 0; col < lineColumns; col++) {
      const i = row * lineColumns + col;
      linePhase[i] = col / lineColumns;
      if (col < lineColumns - 1) indices.push(i, i + 1);
    }
  }
  lineGeometry.setIndex(indices);
  lineGeometry.setAttribute('phase', new THREE.BufferAttribute(linePhase, 1));
  lineGeometry.setAttribute('size', new THREE.BufferAttribute(lineSize, 1));
  const lineMaterial = new THREE.ShaderMaterial({
    uniforms, vertexShader,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      varying float vPhase;
      varying float vDepth;
      void main() {
        float flow = pow(0.5 + 0.5 * sin(vPhase * 18.8495 - uTime * 0.5), 18.0);
        gl_FragColor = vec4(uColor * (0.65 + flow), (0.075 + flow * 0.24) * vDepth * uOpacity);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const filaments = new THREE.LineSegments(lineGeometry, lineMaterial);
  filaments.frustumCulled = false;
  sculpture.add(filaments);

  const orbitMaterial = new THREE.LineBasicMaterial({ color: theme.orbit, transparent: true, opacity: .18, depthWrite: false });
  const orbitLines = [];
  function circle(radius, rotationX, rotationY, opacity = 1) {
    const positions = [];
    for (let i = 0; i <= 240; i++) {
      const a = i / 240 * TAU;
      positions.push(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    }
    const mat = orbitMaterial.clone();
    mat.opacity *= opacity;
    const line = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)), mat);
    line.rotation.set(rotationX, rotationY, 0);
    system.add(line);
    orbitLines.push(line);
    return line;
  }
  circle(2.16, .30, .13);
  circle(2.45, 1.00, -.48, .8);
  const orbital = circle(1.90, -.8, .50, .6);

  // Fine calibration marks give the freeform sculpture an architectural reference.
  const tickPositions = [];
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * TAU;
    const r = i % 8 === 0 ? 2.24 : 2.19;
    tickPositions.push(Math.cos(a) * 2.16, Math.sin(a) * 2.16, -.02, Math.cos(a) * r, Math.sin(a) * r, -.02);
  }
  const ticks = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tickPositions, 3)), new THREE.LineBasicMaterial({ color: theme.orbit, transparent: true, opacity: .2 }));
  ticks.rotation.set(.30, .13, 0);
  system.add(ticks);

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const context = glowCanvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.1, 'rgba(255,255,255,.7)');
  gradient.addColorStop(.35, 'rgba(255,255,255,.12)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const nodeGeometry = new THREE.IcosahedronGeometry(.05, 1);
  const nodeMaterial = new THREE.MeshBasicMaterial({ color: theme.accent });
  const nodes = SERVICES.map((service, i) => {
    const angle = Math.PI * .73 - i * TAU / 6;
    const position = new THREE.Vector3(Math.cos(angle) * 2.34, Math.sin(angle) * 1.88, .2 + Math.sin(angle * 2) * .35);
    const mesh = new THREE.Mesh(nodeGeometry, nodeMaterial.clone());
    mesh.position.copy(position);
    system.add(mesh);
    mesh.material.color.set(theme.services[service.id]);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: theme.services[service.id], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .75 }));
    glow.scale.setScalar(.45);
    mesh.add(glow);
    const inner = position.clone().multiplyScalar(.54);
    const control = position.clone().multiplyScalar(.8).add(new THREE.Vector3(.12 * Math.sin(angle), .13, .2));
    const curve = new THREE.QuadraticBezierCurve3(inner, control, position);
    const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(70)), new THREE.LineBasicMaterial({ color: theme.services[service.id], transparent: true, opacity: .2, depthWrite: false }));
    system.add(path);
    const packet = new THREE.Mesh(new THREE.SphereGeometry(.018, 6, 4), new THREE.MeshBasicMaterial({ color: theme.services[service.id], transparent: true, opacity: .8 }));
    const packetGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: theme.services[service.id], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .5 }));
    packetGlow.scale.setScalar(.15);
    packet.add(packetGlow);
    system.add(packet);
    const link = document.createElement('a');
    link.href = `#${service.id}`;
    link.className = 'node-label';
    const number = document.createElement('span');
    number.textContent = service.number;
    link.append(number, document.createTextNode(service.label));
    link.setAttribute('aria-label', `Udforsk ${service.label}`);
    labels.append(link);
    link.addEventListener('pointerenter', () => highlight(service.id));
    link.addEventListener('pointerleave', () => highlight(null));
    link.addEventListener('focus', () => highlight(service.id));
    link.addEventListener('blur', () => highlight(null));
    return { ...service, position, mesh, glow, path, curve, packet, packetGlow, link };
  });

  // Sparse depth particles use a seeded sequence so the composition is stable.
  let seed = 617;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const dustPositions = new Float32Array(300 * 3);
  for (let i = 0; i < dustPositions.length; i += 3) {
    dustPositions[i] = (random() - .5) * 10;
    dustPositions[i + 1] = (random() - .5) * 7;
    dustPositions[i + 2] = (random() - .5) * 5 - 2;
  }
  const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(dustPositions, 3)), new THREE.PointsMaterial({ color: theme.dust, size: .012, transparent: true, opacity: .32, depthWrite: false, sizeAttenuation: true }));
  scene.add(dust);

  let active = 'home';
  let hover = null;
  let paused = reducedMotion;
  let running = true;
  let raf = 0;
  let time = 0;
  let lastTime = performance.now();
  let transition = 1;
  let dragging = false;
  let pointerId = null;
  let pointerStart = null;
  let dragTravel = 0;
  let userRotation = new THREE.Vector2(0, 0);
  const targetRotation = new THREE.Vector2(0, 0);
  const pointer = new THREE.Vector2();
  const smoothPointer = new THREE.Vector2();
  const projected = new THREE.Vector3();
  let width = 1, height = 1;
  let cameraDistance = 8.2;
  let dirtyFrames = 2;
  let visible = true;
  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) { dirtyFrames = Math.max(dirtyFrames, 2); lastTime = performance.now(); }
  });
  visibilityObserver.observe(stage);

  function resize() {
    width = stage.clientWidth;
    height = stage.clientHeight;
    if (width < 1 || height < 1) return;
    camera.aspect = width / height;
    // Fit the complete system horizontally on narrow screens.
    cameraDistance = Math.max(7.5, 6.8 / camera.aspect);
    camera.position.z = cameraDistance;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    render();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);

  function surfaceFor(id) {
    if (!surfaceCache.has(id)) surfaceCache.set(id, makeSurface(id, columns, rows));
    return surfaceCache.get(id);
  }

  function morphGeometry(buffer, next) {
    const source = buffer.attributes.position;
    const target = buffer.attributes.target;
    const amount = uniforms.uMorph.value;
    for (let i = 0; i < source.array.length; i++) source.array[i] = lerp(source.array[i], target.array[i], amount);
    target.array.set(next);
    source.needsUpdate = target.needsUpdate = true;
  }

  function select(id) {
    const service = SERVICES.find(item => item.id === id);
    const shape = service ? id : 'home';
    if (shape !== active) {
      morphGeometry(geometry, surfaceFor(shape));
      morphGeometry(lineGeometry, makeSurface(shape, lineColumns, lineRows));
      transition = reducedMotion ? 1 : 0;
      uniforms.uMorph.value = transition;
      active = shape;
      targetRotation.set(0, 0);
      colorTarget.set(theme.services[shape] || theme.accent);
      dirtyFrames = reducedMotion ? 2 : 140;
    }
    document.getElementById('sceneCounter').textContent = service ? `${service.number} / 06` : '01—06';
    document.getElementById('sceneNote').textContent = service?.note || 'Et fælles system. Seks perspektiver.';
    updateHighlight();
    if (paused && reducedMotion) { color.copy(colorTarget); render(); }
  }

  function updateHighlight() {
    dirtyFrames = Math.max(dirtyFrames, 1);
    for (const node of nodes) {
      const selected = node.id === active;
      const emphasized = node.id === hover || selected;
      node.link.classList.toggle('is-active', selected);
      node.link.classList.toggle('is-muted', active !== 'home' && !emphasized);
      if (selected) node.link.setAttribute('aria-current', 'page');
      else node.link.removeAttribute('aria-current');
      node.path.material.opacity = emphasized ? .75 : active === 'home' ? .2 : .09;
      node.glow.material.opacity = emphasized ? 1 : .55;
      node.mesh.scale.setScalar(emphasized ? 1.5 : 1);
    }
  }

  function highlight(id) { hover = id; updateHighlight(); }
  function setTheme() {
    theme = readTheme();
    colorTarget.set(theme.services[active] || theme.accent);
    renderer.setClearColor(theme.bg, 0);
    orbitMaterial.color.set(theme.orbit);
    for (const orbit of orbitLines) orbit.material.color.set(theme.orbit);
    ticks.material.color.set(theme.orbit);
    dust.material.color.set(theme.dust);
    for (const node of nodes) {
      const tint = theme.services[node.id];
      for (const object of [node.mesh, node.glow, node.path, node.packet, node.packetGlow]) object.material.color.set(tint);
    }
    dirtyFrames = reducedMotion ? 2 : 100;
    if (reducedMotion) color.copy(colorTarget);
  }
  function reset() { targetRotation.set(0, 0); pointer.set(0, 0); dirtyFrames = reducedMotion ? 2 : 100; }
  function setPaused(value) { paused = value; dirtyFrames = Math.max(dirtyFrames, 2); }
  function setReducedMotion(value) {
    reducedMotion = value;
    if (value) {
      transition = uniforms.uMorph.value = 1;
      pointer.set(0, 0);
      smoothPointer.set(0, 0);
      color.copy(colorTarget);
    }
    dirtyFrames = 2;
  }

  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointerId = event.pointerId;
    pointerStart = { x: event.clientX, y: event.clientY };
    dragTravel = 0;
    dragging = true;
    canvas.setPointerCapture(pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    dirtyFrames = reducedMotion ? 2 : 70;
    const rect = canvas.getBoundingClientRect();
    if (!reducedMotion) pointer.set((event.clientX - rect.left) / width * 2 - 1, (event.clientY - rect.top) / height * 2 - 1);
    if (dragging && event.pointerId === pointerId && pointerStart) {
      const dx = event.clientX - pointerStart.x;
      const dy = event.clientY - pointerStart.y;
      targetRotation.x += dx * .005;
      targetRotation.y = clamp(targetRotation.y + dy * .0035, -.7, .7);
      dragTravel += Math.abs(dx) + Math.abs(dy);
      pointerStart = { x: event.clientX, y: event.clientY };
    }
  });
  function releasePointer(event) {
    if (event.pointerId !== pointerId) return;
    dragging = false;
    pointerStart = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    pointerId = null;
  }
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('lostpointercapture', () => { dragging = false; pointerStart = null; });
  canvas.addEventListener('pointerleave', () => {
    if (!dragging) { pointer.set(0, 0); dirtyFrames = reducedMotion ? 2 : 70; }
  });
  // Picking the luminous endpoints is an alternative to the accessible HTML labels.
  const raycaster = new THREE.Raycaster();
  canvas.addEventListener('click', event => {
    if (dragTravel > 6) return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / width * 2 - 1, -(event.clientY - rect.top) / height * 2 + 1), camera);
    const hit = raycaster.intersectObjects(nodes.map(node => node.mesh), false)[0];
    if (hit) nodes.find(node => node.mesh === hit.object).link.click();
  });

  function render() {
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    for (const node of nodes) {
      node.mesh.getWorldPosition(projected);
      projected.project(camera);
      const rawX = (projected.x * .5 + .5) * width;
      const rawY = (-projected.y * .5 + .5) * height;
      // The label sits just beyond its endpoint, staying inside the canvas on mobile.
      const labelWidth = node.link.offsetWidth || 105;
      const x = clamp(rawX + (rawX > width / 2 ? 15 : -labelWidth - 15), 8, width - labelWidth - 8);
      const y = clamp(rawY - 18, 56, height - 105);
      node.link.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    }
    composer.render();
  }

  function animate(now) {
    if (!running) return;
    raf = requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, .045);
    lastTime = now;
    if (document.hidden || !visible) return;
    if (paused && dirtyFrames <= 0 && transition >= 1) return;
    dirtyFrames = Math.max(0, dirtyFrames - 1);
    if (!paused) time += dt;
    const smoothing = reducedMotion ? 1 : 1 - Math.exp(-dt * 5);
    if (transition < 1) {
      transition = Math.min(1, transition + dt / 1.65);
      uniforms.uMorph.value = smooth(transition);
    }
    color.lerp(colorTarget, smoothing);
    userRotation.lerp(targetRotation, smoothing);
    smoothPointer.lerp(pointer, smoothing * .6);
    uniforms.uTime.value = time;
    sculpture.rotation.y = userRotation.x + Math.sin(time * .09) * .18;
    sculpture.rotation.x = userRotation.y + Math.sin(time * .11) * .12;
    sculpture.rotation.z = Math.sin(time * .07) * .06;
    system.rotation.y = smoothPointer.x * .065;
    system.rotation.x = smoothPointer.y * .035;
    const scale = active === 'home' ? 1 : 1.06;
    sculpture.scale.setScalar(lerp(sculpture.scale.x, scale, smoothing));
    camera.position.z = lerp(camera.position.z, cameraDistance + (active === 'home' ? 0 : -.25), smoothing);
    orbital.rotation.z = time * .025;
    dust.rotation.z = time * .003;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      node.curve.getPoint((time * .11 + i / 6) % 1, node.packet.position);
      node.packet.material.opacity = active === 'home' || active === node.id ? .8 : .15;
    }
    render();
  }
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    running = false;
    cancelAnimationFrame(raf);
    onError();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    running = true;
    lastTime = performance.now();
    document.body.classList.remove('scene-unavailable');
    document.body.classList.add('scene-ready');
    document.getElementById('sceneTools').hidden = false;
    select(active);
    raf = requestAnimationFrame(animate);
  });
  resize();
  updateHighlight();
  renderer.compile(scene, camera);
  raf = requestAnimationFrame(animate);
  return { select, highlight, reset, setPaused, setReducedMotion, setTheme, dispose() {
    running = false;
    cancelAnimationFrame(raf);
    observer.disconnect();
    visibilityObserver.disconnect();
    scene.traverse(object => {
      object.geometry?.dispose();
      if (object.material) {
        for (const item of Array.isArray(object.material) ? object.material : [object.material]) item.dispose();
      }
    });
    glowTexture.dispose();
    bloom.dispose();
    composer.dispose();
    renderer.dispose();
    labels.replaceChildren();
  } };
}
