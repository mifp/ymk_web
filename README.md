# YMK — Connected Systems (v6)

A standalone evolution of `threejs-v4`. All files for this version live in this folder; the existing versions are untouched.

## Preview

From this folder:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

Open http://127.0.0.1:8766. Serve it over HTTP rather than opening `index.html` directly, because the site uses JavaScript modules.

## Experience

- A procedural torus knot built from 35,840 GPU-rendered points, a fine filament lattice, orbital guides, and animated signals.
- Six service selections morph the same sculpture into a cube, double helix, sensor field, layered cloud, trust ring, and interlocking human connections.
- Drag to rotate, reset the view, pause the motion, or select a service using its floating label or the navigation. Escape returns to the overview.
- The footer theme picker switches between Signal, Hav, Kobber, Iris, and Mono. Each palette updates the page and the complete 3D scene, and the choice is remembered on this device.
- Danish content, browser history and direct section links, email and LinkedIn contact links, and a copy-email button.
- Responsive mobile composition, keyboard navigation, reduced-motion support, rendering suspended when hidden or offscreen, and a lower particle count on smaller screens.
- Content and navigation work independently of Three.js. A WebGL or CDN failure leaves the content available; the no-JavaScript view displays all sections.

## Files and dependencies

- `index.html`: semantic content, links, metadata and pinned Three.js import map.
- `css/style.css`: layout, typography, responsive states and transitions.
- `js/main.js`: navigation, contact actions and progressive loading.
- `js/scene.js`: rendering, shaders, camera, interactions and motion controls.
- `js/shapes.js`: pure parametric geometry and service metadata.

There is no build step, package installation, API key or AI backend. It uses Three.js **0.170.0** from jsDelivr, matching v4, and Google Fonts. Those external assets require a network connection; system fonts and the content view provide fallbacks.

Deploy the contents of this folder to a static web host. Relative paths support hosting under a subdirectory such as `/threejs-v6/`.

## Validation

```sh
node --check js/main.js
node --check js/scene.js
node --check js/shapes.js
node --test tests/shapes.test.mjs
```

The geometry tests check every surface for finite, bounded coordinates, deterministic output, distinct forms, and all pairwise interrupted morphs. Visual browser testing is separate from these checks.
# ymk_web
