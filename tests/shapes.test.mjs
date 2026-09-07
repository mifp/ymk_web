import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSurface, sampleShape, SERVICES } from '../js/shapes.js';

const modes = ['home', ...SERVICES.map(service => service.id)];

test('every surface is finite, nondegenerate, and fits the camera envelope', () => {
  for (const mode of modes) {
    const positions = makeSurface(mode, 360, 42);
    assert.equal(positions.length, 360 * 42 * 3);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      assert.ok(Math.hypot(...positions.subarray(i, i + 3)) < 2.2, `${mode} exceeds camera envelope`);
      for (let axis = 0; axis < 3; axis++) {
        const value = positions[i + axis];
        assert.ok(Number.isFinite(value), `${mode}: non-finite vertex`);
        min[axis] = Math.min(min[axis], value);
        max[axis] = Math.max(max[axis], value);
      }
    }
    assert.ok(max.every((value, axis) => value - min[axis] > .4), `${mode} is degenerate`);
    assert.deepEqual(positions, makeSurface(mode, 360, 42));
  }
});

test('all seven forms differ and every interrupted morph remains bounded', () => {
  const surfaces = modes.map(mode => makeSurface(mode, 48, 18));
  for (let i = 0; i < surfaces.length; i++) {
    for (let j = i + 1; j < surfaces.length; j++) {
      assert.notDeepEqual(surfaces[i], surfaces[j]);
      for (const amount of [0, .13, .5, .91, 1]) {
        for (let offset = 0; offset < surfaces[i].length; offset += 3) {
          const interrupted = [0, 1, 2].map(axis => surfaces[i][offset + axis] * (1 - amount) + surfaces[j][offset + axis] * amount);
          assert.ok(interrupted.every(Number.isFinite));
          assert.ok(Math.hypot(...interrupted) < 2.2);
        }
      }
    }
  }
});

test('surface endpoints are finite, including exact parameter boundaries', () => {
  for (const mode of modes) {
    for (const u of [0, .5, 1]) {
      for (const v of [0, .5, 1]) {
        const output = new Float32Array(3);
        sampleShape(mode, u, v, output);
        assert.ok([...output].every(Number.isFinite), `${mode} at ${u},${v}`);
      }
    }
  }
});
