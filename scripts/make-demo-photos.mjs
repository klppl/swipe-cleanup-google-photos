#!/usr/bin/env node
// Generates the illustrated sample photos for the bundled demo library: demo/photos/NNN.svg.
// Deterministic (seeded), so re-running produces the same files. Usage: node scripts/make-demo-photos.mjs
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COUNT = 72;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'demo', 'photos');

let seed = 20261027;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const between = (a, b) => a + rand() * (b - a);
const pick = (list) => list[Math.floor(rand() * list.length)];
const f = (n) => Math.round(n * 10) / 10;

const SKIES = [
  ['#ffb46b', '#ff6f91'], ['#7ec8f2', '#d9f1ff'], ['#2b2d6e', '#f07c6a'], ['#9fd3ff', '#fff3d6'],
  ['#1d2b53', '#7e4cc4'], ['#ffd27a', '#ff8a5c'], ['#a8e6ff', '#e8f7ff'], ['#5b3a8c', '#ffb07a'],
];
const HILLS = [
  ['#5a32d6', '#7b4dff', '#b07cff'], ['#1f6f5c', '#2f9b7a', '#7ccfa6'], ['#3b2a52', '#5e4378', '#8a6aa8'],
  ['#2c4a6e', '#4b7aa8', '#8db6d9'], ['#7a3b2e', '#a8573f', '#d98b5f'],
];

function sky(w, h, [top, bottom]) {
  return `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#s)"/>`;
}

function ridge(w, h, base, rough, color) {
  const pts = [`0,${h}`];
  const steps = 6 + Math.floor(rand() * 5);
  for (let i = 0; i <= steps; i++) pts.push(`${f((w / steps) * i)},${f(base - between(0, rough))}`);
  pts.push(`${w},${h}`);
  return `<polygon points="${pts.join(' ')}" fill="${color}"/>`;
}

const scenes = {
  mountains(w, h) {
    const hills = pick(HILLS);
    return sky(w, h, pick(SKIES)) +
      `<circle cx="${f(between(0.2, 0.8) * w)}" cy="${f(between(0.15, 0.35) * h)}" r="${f(between(0.05, 0.09) * w)}" fill="#fff3d6" opacity="0.9"/>` +
      ridge(w, h, h * 0.55, h * 0.3, hills[2]) + ridge(w, h, h * 0.7, h * 0.25, hills[1]) + ridge(w, h, h * 0.85, h * 0.15, hills[0]);
  },
  lake(w, h) {
    const hills = pick(HILLS);
    const water = h * between(0.6, 0.7);
    return sky(w, h, pick(SKIES)) +
      ridge(w, water, water, h * 0.25, hills[1]) + ridge(w, water, water, h * 0.12, hills[0]) +
      `<rect y="${f(water)}" width="${w}" height="${f(h - water)}" fill="${hills[2]}" opacity="0.85"/>` +
      Array.from({ length: 5 }, () => `<rect x="${f(between(0.1, 0.7) * w)}" y="${f(between(water + 8, h - 8))}" width="${f(between(0.1, 0.25) * w)}" height="2" rx="1" fill="#fff" opacity="0.5"/>`).join('');
  },
  beach(w, h) {
    const sea = h * between(0.5, 0.6);
    const sand = h * between(0.72, 0.8);
    return sky(w, h, pick(SKIES)) +
      `<circle cx="${f(between(0.3, 0.7) * w)}" cy="${f(sea)}" r="${f(between(0.08, 0.12) * w)}" fill="#ffe08a"/>` +
      `<rect y="${f(sea)}" width="${w}" height="${f(sand - sea)}" fill="${pick(['#2f8fc4', '#1f6fa8', '#3aa0b8'])}"/>` +
      `<path d="M0 ${f(sand)} Q ${f(w / 2)} ${f(sand - 14)} ${w} ${f(sand)} V ${h} H 0 Z" fill="${pick(['#f2d6a2', '#e8c48c', '#f5e1b8'])}"/>`;
  },
  forest(w, h) {
    const ground = h * 0.78;
    const greens = pick([['#1f5c46', '#2f7d5c'], ['#244f3a', '#3c7a4e'], ['#2d4f6e', '#3f6f8f']]);
    let trees = '';
    for (let row = 0; row < 2; row++) {
      for (let x = -20; x < w + 20; x += between(26, 42)) {
        const th = between(0.25, 0.45) * h;
        const base = ground + row * 16;
        trees += `<polygon points="${f(x)},${f(base - th)} ${f(x - th * 0.28)},${f(base)} ${f(x + th * 0.28)},${f(base)}" fill="${greens[row]}"/>`;
      }
    }
    return sky(w, h, pick(SKIES)) + trees + `<rect y="${f(ground + 16)}" width="${w}" height="${f(h)}" fill="${greens[1]}"/>`;
  },
  city(w, h) {
    let b = '';
    for (let x = 0; x < w; ) {
      const bw = between(28, 56);
      const bh = between(0.3, 0.7) * h;
      b += `<rect x="${f(x)}" y="${f(h - bh)}" width="${f(bw - 3)}" height="${f(bh)}" fill="${pick(['#241c3f', '#2e2450', '#1b2140'])}"/>`;
      for (let wy = h - bh + 8; wy < h - 10; wy += 14) {
        for (let wx = x + 6; wx < x + bw - 10; wx += 11) {
          if (rand() < 0.45) b += `<rect x="${f(wx)}" y="${f(wy)}" width="5" height="6" fill="#ffd27a" opacity="${f(between(0.5, 1))}"/>`;
        }
      }
      x += bw;
    }
    return sky(w, h, pick([['#1d2b53', '#7e4cc4'], ['#14143a', '#c0587a'], ['#0f1c3a', '#3a5a9c']])) +
      `<circle cx="${f(between(0.15, 0.85) * w)}" cy="${f(0.18 * h)}" r="${f(0.04 * w)}" fill="#fff8e0"/>` + b;
  },
  meadow(w, h) {
    const ground = h * between(0.55, 0.65);
    let flowers = '';
    for (let i = 0; i < 40; i++) {
      const y = between(ground + 6, h);
      const r = 2 + ((y - ground) / (h - ground)) * 7;
      flowers += `<circle cx="${f(between(0, w))}" cy="${f(y)}" r="${f(r)}" fill="${pick(['#ff5c7a', '#ffd27a', '#ffffff', '#b07cff', '#ff8a5c'])}"/>`;
    }
    return sky(w, h, pick(SKIES)) + ridge(w, ground + 10, ground, h * 0.12, '#7ccfa6') +
      `<rect y="${f(ground)}" width="${w}" height="${f(h - ground)}" fill="#4caf6e"/>` + flowers;
  },
};

mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) if (name.endsWith('.svg')) rmSync(join(out, name));

const kinds = Object.keys(scenes);
for (let i = 1; i <= COUNT; i++) {
  const portrait = rand() < 0.3;
  const [w, h] = portrait ? [300, 400] : [400, 300];
  const body = scenes[kinds[(i * 7 + Math.floor(rand() * 3)) % kinds.length]](w, h);
  writeFileSync(
    join(out, `${String(i).padStart(3, '0')}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`
  );
}
console.log(`Wrote ${COUNT} demo photos to ${out}`);
