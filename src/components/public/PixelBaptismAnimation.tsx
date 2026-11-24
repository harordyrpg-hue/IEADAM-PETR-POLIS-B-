import React, { useEffect, useRef, useState } from 'react';

interface PixelBaptismAnimationProps {
  gender?: 'Masc.' | 'Fem.' | '' | string;
  candidateName?: string;
}

const LOGICAL_W = 176;
const LOGICAL_H = 104;
const WATER_Y = 64;

const PALETTE: Record<string, string> = {
  '.': '',
  O: '#111827',
  // Warm skin ramp
  '1': '#fde0c4',
  '2': '#f1bfa0',
  '3': '#d49471',
  '4': '#b36153',
  '5': '#f09484',
  // Eyes
  E: '#ffffff',
  e: '#162038',
  '-': '#2b1e1b',
  // Pastor hair (dark slate + silver)
  h: '#252b3b',
  H: '#444e66',
  g: '#9aa5bc',
  // Male candidate hair (dark espresso brown)
  m: '#201410',
  M: '#3b261d',
  n: '#614133',
  // Female candidate hair (warm chestnut brown)
  f: '#2c1710',
  F: '#583021',
  r: '#864e36',
  // Pastor suit / shirt / stole
  p: '#1e293b',
  P: '#334155',
  q: '#4b5b73',
  C: '#f8fafc',
  y: '#d97706',
  Y: '#fbbf24',
  // Baptism white robe
  w: '#ffffff',
  W: '#e4f0fb',
  b: '#a8cbe9',
  B: '#6d99c4',
};

type SpriteMatrix = readonly string[];

function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteMatrix,
  ox: number,
  oy: number,
  clipBottomY?: number
) {
  const startX = Math.round(ox);
  const startY = Math.round(oy);
  for (let row = 0; row < sprite.length; row++) {
    const py = startY + row;
    if (py < 0 || py >= LOGICAL_H) continue;
    if (clipBottomY !== undefined && py >= clipBottomY) continue;
    const line = sprite[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === '.') continue;
      const color = PALETTE[ch];
      if (!color) continue;
      const px = startX + col;
      if (px < 0 || px >= LOGICAL_W) continue;
      ctx.fillStyle = color;
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

// ============================================================
// PASTOR SPRITES (32px wide x 54px tall)
// ============================================================

// Pastor standing with right arm raised in blessing & left arm extended toward candidate
const PASTOR_BLESSING: SpriteMatrix = [
  '..........OOOOOO................',
  '.........OhHHHHHO...............',
  '........OhHHgHHHHO..............',
  '.......OhHHHHHHHHHO.............',
  '.......OhH222222hHO.............',
  '.......Oh21112222hO.............',
  '.......O21eE222Ee2O.............',
  '.......O2122232222O.............',
  '.......O2222332242O.............',
  '........O32222223O..............',
  '........O33hh4hh3O.........OO...',
  '.........OhhHHHhhO........O12O..',
  '..........OOCCCOO........O122O..',
  '........OOPPYYYPPOO......O23O...',
  '.......OPPPpYYYPpPPO....OPpO....',
  '......OPPPPyYYYyPPPPO..OPpO.....',
  '.....OPPPPpYYYYYpPPPPOOPpO......',
  '.....OPPPpPYYYYYPpPPPPPPpO......',
  '.....OPPpPPyYYYyPPpPPPPpO.......',
  '.....OPpPPPYCCCYPPppPPpO........',
  '.....OPpPPPYYYYYPPPppPO.........',
  '......OOOPPPYYYPPPPPOO..........',
  '.......OPPPpYYYpPPPPpO..........',
  '.......OPPPpYYYpPPPPpO..........',
  '.......OPPPpYYYpPPPPpO..........',
  '.......OPPPpYYYpPPPPpO..........',
  '.......OPPPpYYYpPPPPpO..........',
  '.......OPPPpYYYpPPPPpO..........',
  '.......OPPPpYYYpPPPPpO..........',
  '.......OPPPpYYYpPPPPpO..........',
  '.......OPPPpYYYpPPPPpO..........',
  '.......OPPPpYYYpPPPPpO..........',
  '.......OPPPpYYYPpPPPpO..........',
  '.......OPPPpYYYPpPPPpO..........',
  '.......OPPPpPPPPPpPPpO..........',
  '.......OPPPpPPPPPpPPpO..........',
  '.......OPPPpPOOOppPPpO..........',
  '.......OPPPpO...OppPpO..........',
  '.......OPPPpO...OppPpO..........',
  '.......OPPPpO...OppPpO..........',
  '.......OPPPpO...OppPpO..........',
  '.......OPPPpO...OppPpO..........',
  '.......OOOOOO...OOOOOO..........',
];

// Pastor leaning forward gently to immerse candidate
const PASTOR_DIPPING: SpriteMatrix = [
  '................................',
  '................................',
  '...........OOOOOO...............',
  '..........OhHHHHHO..............',
  '.........OhHHgHHHHO.............',
  '........OhHHHHHHHHHO............',
  '........OhH222222hHO............',
  '........Oh21112222hO............',
  '........O21eE222Ee2O............',
  '........O2122232222O............',
  '........O2222332242O............',
  '.........O32222223O.............',
  '.........O33hh4hh3O.............',
  '..........OhhHHHhhO.............',
  '...........OOCCCOO..............',
  '.........OOPPYYYPPOO............',
  '........OPPPpYYYPpPPO...........',
  '.......OPPPPyYYYyPPPPO..........',
  '.......OPPPPpYYYYYpPPPPO........',
  '.......OPPPpPYYYYYPpPPPPPO......',
  '.......OPPpPPyYYYyPPpPPPPpOO....',
  '.......OPpPPPYCCCYPPPpPPPP12O...',
  '........OOOPPPYYYPPPPpPPPP23O...',
  '........OPPPpYYYpPPPPpPPPP3O....',
  '........OPPPpYYYpPPPPpOOOOO.....',
  '........OPPPpYYYpPPPPpO.........',
  '........OPPPpYYYpPPPPpO.........',
  '........OPPPpYYYpPPPPpO.........',
  '........OPPPpYYYpPPPPpO.........',
  '........OPPPpYYYpPPPPpO.........',
  '........OPPPpYYYpPPPPpO.........',
  '........OPPPpYYYpPPPPpO.........',
  '........OPPPpYYYpPPPPpO.........',
  '........OPPPpPPPPPpPPpO.........',
  '........OPPPpPPPPPpPPpO.........',
  '........OPPPpPOOOppPPpO.........',
  '........OPPPpO...OppPpO.........',
  '........OPPPpO...OppPpO.........',
  '........OPPPpO...OppPpO.........',
  '........OPPPpO...OppPpO.........',
  '........OPPPpO...OppPpO.........',
  '........OOOOOO...OOOOOO.........',
];

// ============================================================
// MALE CANDIDATE SPRITES (HOMEM)
// ============================================================

const MALE_STANDING: SpriteMatrix = [
  '.........OOOOOO.........',
  '........OmMMMMmO........',
  '.......OmMMnMMMmO.......',
  '.......OmMMMMMMMmO......',
  '.......Om2222222mO......',
  '.......O221111222O......',
  '.......O2eE222Ee2O......',
  '.......O222232222O......',
  '.......O222333222O......',
  '.......O322444223O......',
  '........O3222223O.......',
  '.........OO222OO........',
  '.......OOWwwwwwWOO......',
  '......OWwwwwwwwwWWO.....',
  '.....OWwwwWbbbWwwwWO....',
  '.....OWwwW12221WwwWO....',
  '.....OWwwW21112WwwWO....',
  '.....OWwwW22322WwwWO....',
  '......OWwwWbbbWwwWO.....',
  '......OWwwwwwwwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwWWbWWwwWO.....',
  '......OWwwWBBBWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '.......OOOOOOOOOOO......',
];

const MALE_JOYFUL: SpriteMatrix = [
  '.........OOOOOO.........',
  '........OmMMMMmO........',
  '.......OmMMnMMMmO.......',
  '.......OmMMMMMMMmO......',
  '.......Om2222222mO......',
  '.......O221111222O......',
  '.......O2eE222Ee2O......',
  '.......O252232252O......',
  '.......O224EE4422O......',
  '.......O322444223O......',
  '........O3222223O.......',
  '.........OO222OO........',
  '.......OOWwwwwwWOO......',
  '......OWwwwwwwwwWWO.....',
  '.....OWwwwWbbbWwwwWO....',
  '....O12WwwWbbbWwwW21O...',
  '....O22WwwwwwwwwwW22O...',
  '.....OOWwwwwwwwwwWOO....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwWWbWWwwWO.....',
  '......OWwwWBBBWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '......OWwwWbWbWwwWO.....',
  '.......OOOOOOOOOOO......',
];

// ============================================================
// FEMALE CANDIDATE SPRITES (MULHER)
// ============================================================

const FEMALE_STANDING: SpriteMatrix = [
  '.........OOOOOO.........',
  '........OfFFFFfO........',
  '.......OfFFrFFFfO.......',
  '......OfFFFFFFFFfO......',
  '......OfF222222FfO......',
  '.....OfF21111122FfO.....',
  '.....Of21eE22Ee12fO.....',
  '.....Of2222322222fO.....',
  '.....Of2252332522fO.....',
  '.....Of322444223fO......',
  '.....Off3222223ffO......',
  '.....OfffOO222OffO......',
  '.....OffOWwwwwwWOfO.....',
  '.....OfOWwwwwwwwWOfO....',
  '....OfOWwwWbbbWwwWO.....',
  '....OfOWwW12221WwWO.....',
  '....OfOWwW21112WwWO.....',
  '....OfOWwW22322WwWO.....',
  '.....OOWwwWbbbWwwWO.....',
  '......OWwwwwwwwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '.....OWwwwwWbWwwwwWO....',
  '.....OWwwwwWbWwwwwWO....',
  '.....OWwwwWWbWWwwwWO....',
  '.....OWwwwWBBBWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '......OOOOOOOOOOOO......',
];

const FEMALE_JOYFUL: SpriteMatrix = [
  '.........OOOOOO.........',
  '........OfFFFFfO........',
  '.......OfFFrFFFfO.......',
  '......OfFFFFFFFFfO......',
  '......OfF222222FfO......',
  '.....OfF21111122FfO.....',
  '.....Of21eE22Ee12fO.....',
  '.....Of2252322522fO.....',
  '.....Of224EE44222fO.....',
  '.....Of322444223fO......',
  '.....Off3222223ffO......',
  '.....OfffOO222OffO......',
  '.....OffOWwwwwwWOfO.....',
  '.....OfOWwwwwwwwWOfO....',
  '....OfOWwwWbbbWwwWO.....',
  '...O12OWwW1bbb1WwW21O...',
  '...O22OWwwwwwwwwwW22O...',
  '....OOOWwwwwwwwwwWOO....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '......OWwwwWbWwwwWO.....',
  '.....OWwwwwWbWwwwwWO....',
  '.....OWwwwwWbWwwwwWO....',
  '.....OWwwwWWbWWwwwWO....',
  '.....OWwwwWBBBWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '.....OWwwwWbWbWwwwWO....',
  '......OOOOOOOOOOOO......',
];

// ============================================================
// LEANING BACK / RECLINING INTO THE WATERS (MALE & FEMALE)
// ============================================================

const MALE_LEANING: SpriteMatrix = [
  '..................OOOOOO....',
  '.................OmMMMMmO...',
  '................OmMMnMMMmO..',
  '................Om222222mO..',
  '................O211--122O..',
  '................O22232222O..',
  '................O32244223O..',
  '.............OOOO3222223O...',
  '...........OOWwwwOO222OO....',
  '.........OOWwwwwwwWWOO......',
  '.......OOWwwwWbbbWwwWWO.....',
  '......OWwwwWW12221WWwwWO....',
  '.....OWwwwWbb21112bbWwwWO...',
  '....OWwwwWbWWWWWWWWWbWwwWO..',
  '...OWwwwWbWWWWWWWWWWbWwwwO..',
  '..OWwwwWbWWWWWWWWWWWbWwwwO..',
  '..OWwwWbWWWWWWWWWWWWbWwwwO..',
  '..OWwWbWWWWWWWWWWWWWbWwwO...',
  '..OWWbWWWWWWWWWWWWWWbWwO....',
  '...OOWWWWWWWWWWWWWWWWO......',
  '.....OOOOOOOOOOOOOOOO.......',
];

const FEMALE_LEANING: SpriteMatrix = [
  '..................OOOOOO....',
  '.................OfFFFFfO...',
  '................OfFFrFFFfO..',
  '................Of222222fO..',
  '...............Of211--122O..',
  '...............Of22232222fO.',
  '...............Of32244223fO.',
  '.............OOOff322223ffO.',
  '...........OOWwwwffOO22ffO..',
  '.........OOWwwwwwwffOOOO....',
  '.......OOWwwwWbbbWwwWWO.....',
  '......OWwwwWW12221WWwwWO....',
  '.....OWwwwWbb21112bbWwwWO...',
  '....OWwwwWbWWWWWWWWWbWwwWO..',
  '...OWwwwWbWWWWWWWWWWbWwwwO..',
  '..OWwwwWbWWWWWWWWWWWbWwwwO..',
  '..OWwwWbWWWWWWWWWWWWbWwwwO..',
  '..OWwWbWWWWWWWWWWWWWbWwwO...',
  '..OWWbWWWWWWWWWWWWWWbWwO....',
  '...OOWWWWWWWWWWWWWWWWO......',
  '.....OOOOOOOOOOOOOOOO.......',
];

// ============================================================
// SUBMERGED HORIZONTAL POSE IN THE WATER (MALE & FEMALE)
// ============================================================

const MALE_SUBMERGED: SpriteMatrix = [
  '..........................OOOOOO....',
  '.........................OmMMMMmO...',
  '................OOOOOOOOOmMM222mO...',
  '..........OOOOOOWwwwwwwwwOm2--22O...',
  '....OOOOOOWWWWWWWWWWWbbbbOO23422O...',
  '..OOWWWWWWWWWWWWWWbbbbbbbbOO222OO...',
  '.OWWWWWWWWWWWbbbbbbbbbbbbbWWWWWWWO..',
  '.ObbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbO..',
  '..OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO...',
];

const FEMALE_SUBMERGED: SpriteMatrix = [
  '..........................OOOOOO....',
  '.........................OfFFFFfO...',
  '................OOOOOOOOOfFF222fO...',
  '..........OOOOOOWwwwwwwwwOf2--22fO..',
  '....OOOOOOWWWWWWWWWWWbbbbOff2342ffO.',
  '..OOWWWWWWWWWWWWWWbbbbbbbbOff22ffO..',
  '.OWWWWWWWWWWWbbbbbbbbbbbbbWWWWWWWO..',
  '.ObbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbO..',
  '..OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO...',
];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeInOut(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

// Hand-drawn crisp 1px pixel art background & layered water scene
function renderScene(
  ctx: CanvasRenderingContext2D,
  frameTimeSec: number,
  isFemale: boolean,
  reducedMotion: boolean
) {
  const cycle = 5.4;
  const t = reducedMotion ? 4.5 : frameTimeSec % cycle;

  // Phase timings:
  // 0.0 - 1.1: Standing upright + Pastor blessing
  // 1.1 - 2.0: Leaning back smoothly into the waters
  // 2.0 - 3.1: Immersed beneath the water + splashes & ripples
  // 3.1 - 4.0: Pastor lifting back out of the water + dripping droplets
  // 4.0 - 5.4: Joyful reborn standing + golden light & dove sparkles

  let stageLabel = 'Preparação nas Águas';
  let phase: 'standing' | 'leaning' | 'submerged' | 'rising' | 'joyful' = 'standing';
  let localP = 0;

  if (t < 1.1) {
    phase = 'standing';
    localP = t / 1.1;
    stageLabel = 'Oração e Bênção do Pastor';
  } else if (t < 2.0) {
    phase = 'leaning';
    localP = (t - 1.1) / 0.9;
    stageLabel = 'Inclinando-se para o Batismo';
  } else if (t < 3.1) {
    phase = 'submerged';
    localP = (t - 2.0) / 1.1;
    stageLabel = 'Imersão nas Águas';
  } else if (t < 4.0) {
    phase = 'rising';
    localP = (t - 3.1) / 0.9;
    stageLabel = 'Levantando para uma Nova Vida';
  } else {
    phase = 'joyful';
    localP = (t - 4.0) / 1.4;
    stageLabel = 'Batizado(a) em Cristo!';
  }

  // 1. SKY & SANCTUARY DAWN BACKDROP (Pixel banded gradient)
  const skyBands = [
    { y: 0, h: 12, c: '#0d1b38' },
    { y: 12, h: 12, c: '#122952' },
    { y: 24, h: 12, c: '#183d6e' },
    { y: 36, h: 12, c: '#21578c' },
    { y: 48, h: 10, c: '#2f72a8' },
    { y: 58, h: 6, c: '#4893c4' },
  ];
  for (const band of skyBands) {
    ctx.fillStyle = band.c;
    ctx.fillRect(0, band.y, LOGICAL_W, band.h);
  }

  // Pixel stars / soft distant golden dawn clouds
  const stars = [
    [16, 8],
    [38, 14],
    [142, 10],
    [160, 18],
    [118, 7],
  ];
  for (const [sx, sy] of stars) {
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(sx, sy, 1, 1);
  }

  // Soft golden heavenly sunbeams descending over baptismal center
  const rayOpacity = phase === 'submerged' || phase === 'joyful' ? 0.22 : 0.12;
  ctx.fillStyle = `rgba(253, 224, 71, ${rayOpacity})`;
  for (let y = 0; y < WATER_Y; y++) {
    const spread = Math.floor(y * 0.42);
    ctx.fillRect(92 - Math.floor(spread / 2), y, 10 + spread, 1);
  }

  // Distant pixel hills / riverside greenery & baptistery stone ledge
  ctx.fillStyle = '#133148';
  ctx.fillRect(0, 52, LOGICAL_W, 12);
  // Subtle pixel foliage silhouettes on left & right banks
  const trees = [
    { x: 4, w: 18, h: 14, c: '#144150' },
    { x: 18, w: 14, h: 10, c: '#19525e' },
    { x: 146, w: 16, h: 12, c: '#144150' },
    { x: 158, w: 18, h: 16, c: '#103744' },
  ];
  for (const tr of trees) {
    ctx.fillStyle = tr.c;
    ctx.fillRect(tr.x, 60 - tr.h, tr.w, tr.h);
    ctx.fillStyle = '#206370';
    ctx.fillRect(tr.x + 2, 60 - tr.h + 2, tr.w - 6, 3);
  }

  // Stone baptistery rim along back edge of water
  ctx.fillStyle = '#36546e';
  ctx.fillRect(0, 60, LOGICAL_W, 4);
  ctx.fillStyle = '#537796';
  ctx.fillRect(0, 60, LOGICAL_W, 1);

  // 2. BACK WATER LAYER
  ctx.fillStyle = '#0c4a6e';
  ctx.fillRect(0, WATER_Y, LOGICAL_W, LOGICAL_H - WATER_Y);
  ctx.fillStyle = '#0369a1';
  ctx.fillRect(0, WATER_Y, LOGICAL_W, 18);
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, WATER_Y, LOGICAL_W, 7);

  // Gentle back wave shimmer lines
  const waveShift = Math.floor(frameTimeSec * 8);
  for (let x = 0; x < LOGICAL_W; x++) {
    const wy = WATER_Y + ((Math.sin((x + waveShift) * 0.16) > 0.35) ? 1 : 0);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x, wy, 1, 1);
  }

  // 3. CHARACTERS LAYER (Pastor + Candidate)
  // Positioned so Pastor stands at x=48..80 and Candidate stands at x=84..108 (or leaning right to x=122)
  const pastorDipping = phase === 'leaning' || phase === 'submerged' || phase === 'rising';
  const pastorSprite = pastorDipping ? PASTOR_DIPPING : PASTOR_BLESSING;
  const pastorX = pastorDipping ? 48 : 46;
  const pastorY = pastorDipping ? 35 : 32;

  // Draw Pastor's supporting hand bridge toward Candidate during leaning/submerged/rising
  drawSprite(ctx, pastorSprite, pastorX, pastorY);

  // Candidate pose & coordinates
  if (phase === 'standing') {
    const bob = Math.round(Math.sin(localP * Math.PI * 2) * 0.6);
    const sprite = isFemale ? FEMALE_STANDING : MALE_STANDING;
    drawSprite(ctx, sprite, 84, 34 + bob);
  } else if (phase === 'leaning') {
    const p = easeInOut(localP);
    if (p < 0.45) {
      // Transitioning from standing -> leaning
      const leanSprite = isFemale ? FEMALE_LEANING : MALE_LEANING;
      drawSprite(ctx, leanSprite, 86 + Math.round(p * 8), 44 + Math.round(p * 14));
    } else {
      // Deeper lean down toward waterline
      const leanSprite = isFemale ? FEMALE_LEANING : MALE_LEANING;
      drawSprite(ctx, leanSprite, 90 + Math.round((p - 0.45) * 6), 50 + Math.round((p - 0.45) * 20));
    }
  } else if (phase === 'submerged') {
    const subSprite = isFemale ? FEMALE_SUBMERGED : MALE_SUBMERGED;
    const subDepth = Math.round(Math.sin(localP * Math.PI) * 5);
    drawSprite(ctx, subSprite, 84, WATER_Y + 4 + subDepth);
  } else if (phase === 'rising') {
    const p = easeInOut(localP);
    const leanSprite = isFemale ? FEMALE_LEANING : MALE_LEANING;
    if (p < 0.65) {
      drawSprite(ctx, leanSprite, 92 - Math.round(p * 8), 62 - Math.round(p * 26));
    } else {
      const standSprite = isFemale ? FEMALE_JOYFUL : MALE_JOYFUL;
      drawSprite(ctx, standSprite, 84, 38 - Math.round((p - 0.65) * 11));
    }
  } else {
    // joyful
    const bob = Math.round(Math.sin(localP * Math.PI * 2) * 0.5);
    const joySprite = isFemale ? FEMALE_JOYFUL : MALE_JOYFUL;
    drawSprite(ctx, joySprite, 84, 35 + bob);
  }

  // 4. FOREGROUND TRANSLUCENT WATER LAYER (creates genuine underwater immersion!)
  // Subtle deep water overlay covering submerged lower bodies below WATER_Y + 6
  ctx.fillStyle = 'rgba(2, 132, 199, 0.52)';
  ctx.fillRect(0, WATER_Y + 4, LOGICAL_W, 12);
  ctx.fillStyle = 'rgba(7, 89, 133, 0.68)';
  ctx.fillRect(0, WATER_Y + 16, LOGICAL_W, LOGICAL_H - (WATER_Y + 16));

  // Foreground animated wave crest pixels across water surface (y = WATER_Y + 3..8)
  for (let x = 0; x < LOGICAL_W; x++) {
    const offset = Math.round(Math.sin((x - waveShift * 1.4) * 0.22));
    const sy = WATER_Y + 5 + offset;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x, sy, 1, 1);
    if ((x + waveShift) % 11 === 0) {
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(x, sy, 2, 1);
    }
    if ((x * 3 + waveShift) % 19 === 0) {
      ctx.fillStyle = '#7dd3fc';
      ctx.fillRect(x, WATER_Y + 14 + (x % 3), 3, 1);
    }
  }

  // 5. WATER SPLASH DROPLETS & CONCENTRIC RIPPLES (during leaning end, submerged, rising)
  if (phase === 'submerged' || (phase === 'leaning' && localP > 0.65) || (phase === 'rising' && localP < 0.75)) {
    const splashFactor =
      phase === 'submerged'
        ? Math.sin(localP * Math.PI)
        : phase === 'leaning'
          ? (localP - 0.65) / 0.35
          : 1 - localP / 0.75;

    // Expanding white/cyan pixel ripple rings on the water surface around x=102, y=WATER_Y+6
    const ringRadius = Math.round(8 + splashFactor * 22);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(102 - ringRadius, WATER_Y + 5, 5, 1);
    ctx.fillRect(102 + ringRadius - 4, WATER_Y + 5, 5, 1);
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(102 - Math.round(ringRadius * 0.65), WATER_Y + 8, 7, 1);
    ctx.fillRect(102 + Math.round(ringRadius * 0.65) - 6, WATER_Y + 8, 7, 1);

    // Arcing splash pixel droplets
    const droplets = [
      { vx: -14, vy: -15, delay: 0.0 },
      { vx: -8, vy: -19, delay: 0.1 },
      { vx: -2, vy: -16, delay: 0.05 },
      { vx: 6, vy: -20, delay: 0.15 },
      { vx: 13, vy: -14, delay: 0.08 },
      { vx: 19, vy: -11, delay: 0.2 },
    ];
    for (const d of droplets) {
      const dp = clamp01((splashFactor - d.delay) / (1 - d.delay));
      if (dp <= 0) continue;
      const dx = Math.round(102 + d.vx * dp);
      const arc = 4 * dp * (1 - dp);
      const dy = Math.round(WATER_Y + 4 + d.vy * arc);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx, dy, 2, 2);
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(dx, dy + 2, 1, 1);
    }
  }

  // 6. GOLDEN SPARKLES & LITTLE WHITE PIXEL DOVE IN JOYFUL EMERSION
  if (phase === 'joyful' || (phase === 'rising' && localP > 0.65)) {
    const joyP = phase === 'joyful' ? localP : (localP - 0.65) / 0.35;
    // Soft white pixel dove gliding gracefully in top-right sky
    const doveX = Math.round(128 - joyP * 18);
    const doveY = Math.round(14 + Math.sin(frameTimeSec * 8) * 1.5);
    const wingUp = Math.floor(frameTimeSec * 6) % 2 === 0;
    const doveSprite: SpriteMatrix = wingUp
      ? [
          '..OO....',
          '.OwwO...',
          '..OwwOO.',
          '...OwwwO',
          '..OwwwYO',
          '...OOOO.',
        ]
      : [
          '........',
          '...OO...',
          '..OwwOO.',
          '.OwwwwwO',
          '..OwwwYO',
          '...OOOO.',
        ];
    drawSprite(ctx, doveSprite, doveX, doveY);

    // Golden shimmer sparkles rising around candidate
    const sparks = [
      [78, 36],
      [114, 34],
      [96, 23],
      [108, 44],
    ];
    sparks.forEach(([sx, sy], idx) => {
      const rise = Math.round(((joyP * 14 + idx * 3) % 14));
      ctx.fillStyle = idx % 2 === 0 ? '#fde047' : '#ffffff';
      ctx.fillRect(sx, sy - rise, 1, 1);
      if ((Math.floor(frameTimeSec * 5) + idx) % 2 === 0) {
        ctx.fillRect(sx - 1, sy - rise, 3, 1);
        ctx.fillRect(sx, sy - rise - 1, 1, 3);
      }
    });
  }

  // Update accessible caption via canvas data attribute isn't needed; component handles label below.
  void stageLabel;
}

export const PixelBaptismAnimation: React.FC<PixelBaptismAnimationProps> = ({
  gender,
  candidateName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isFemale = gender === 'Fem.';
  const [stageText, setStageText] = useState('Oração e Bênção nas Águas');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let startTime = performance.now();
    let lastDraw = 0;
    let lastStageBucket = -1;

    const draw = (now: number) => {
      // Crisp 24fps pixel animation cadence
      if (now - lastDraw >= 42 || prefersReducedMotion) {
        lastDraw = now;
        const elapsed = (now - startTime) / 1000;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
        renderScene(ctx, elapsed, isFemale, prefersReducedMotion);

        const t = prefersReducedMotion ? 4.5 : elapsed % 5.4;
        const bucket =
          t < 1.1 ? 0 : t < 2.0 ? 1 : t < 3.1 ? 2 : t < 4.0 ? 3 : 4;
        if (bucket !== lastStageBucket) {
          lastStageBucket = bucket;
          const labels = [
            'Pastor em oração antes do batismo',
            'Descendo às águas do batismo...',
            'Imersão nas águas batismais',
            'Levantando para uma nova vida em Cristo!',
            'Batizado(a) nas águas — Nova Criatura!',
          ];
          setStageText(labels[bucket]);
        }
      }

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    rafId = window.requestAnimationFrame(draw);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isFemale]);

  return (
    <div className="w-full max-w-[528px] mx-auto rounded-2xl overflow-hidden border border-sky-400/30 bg-slate-950 shadow-xl">
      <div className="relative w-full aspect-[176/104] bg-[#0d1b38]">
        <canvas
          ref={canvasRef}
          width={LOGICAL_W}
          height={LOGICAL_H}
          aria-label={
            isFemale
              ? 'Animação em pixel art de um pastor batizando uma mulher nas águas'
              : 'Animação em pixel art de um pastor batizando um homem nas águas'
          }
          className="w-full h-full block"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <div className="px-4 py-2.5 bg-sky-950/80 border-t border-sky-400/20 flex items-center justify-between gap-2 text-[11px]">
        <span className="font-semibold text-sky-200 truncate">{stageText}</span>
        <span className="text-sky-300/80 shrink-0 font-medium">
          {candidateName ? candidateName.split(/\s+/)[0] : isFemale ? 'Candidata' : 'Candidato'}
        </span>
      </div>
    </div>
  );
};
