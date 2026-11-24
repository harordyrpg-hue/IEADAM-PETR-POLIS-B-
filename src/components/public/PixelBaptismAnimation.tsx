import React, { useEffect, useRef } from 'react';

interface PixelBaptismAnimationProps {
  gender?: 'Masc.' | 'Fem.' | '' | string;
  candidateName?: string;
}

const LOGICAL_W = 240;
const LOGICAL_H = 135;
const WATER_Y = 82;

type RGB = readonly [number, number, number];

// Rich 16-bit daytime pixel-art palette
const CHAR_PALETTE: Record<string, RGB> = {
  // Skin tones
  '1': [255, 229, 204], // highlight
  '2': [242, 194, 158], // base
  '3': [214, 152, 114], // shadow
  '4': [174, 96, 82],   // mouth / lip
  '5': [242, 146, 134], // cheek blush
  // Eyes
  E: [255, 255, 255],
  e: [22, 34, 60],
  '-': [92, 56, 44],    // closed peaceful eyelid
  // Pastor hair & beard (salt & pepper dark slate)
  h: [36, 43, 61],
  H: [66, 77, 102],
  g: [152, 165, 188],
  // Male hair (deep espresso brown)
  m: [34, 21, 16],
  M: [64, 41, 30],
  n: [104, 68, 50],
  // Female hair (rich chestnut brown)
  f: [44, 22, 15],
  F: [92, 49, 32],
  r: [142, 82, 54],
  // Pastor shirt/robe & golden-white baptismal stole
  p: [28, 40, 62],
  P: [47, 65, 96],
  q: [74, 98, 136],
  C: [248, 250, 252],
  y: [217, 119, 6],
  Y: [251, 191, 36],
  // Candidate white baptismal robe
  w: [255, 255, 255],
  W: [232, 244, 254],
  b: [176, 212, 242],
  B: [122, 172, 214],
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function easeInOut(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ============================================================
// OFF-SCREEN PIXEL BUFFER WITH 1px ARTISAN OUTLINE PASS
// ============================================================

class PixelLayer {
  readonly w: number;
  readonly h: number;
  readonly buf: Uint8ClampedArray;
  readonly out: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.buf = new Uint8ClampedArray(w * h * 4);
    this.out = new Uint8ClampedArray(w * h * 4);
  }

  clear() {
    this.buf.fill(0);
  }

  set(x: number, y: number, rgb: RGB, alpha = 255) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || ix >= this.w || iy < 0 || iy >= this.h) return;
    const idx = (iy * this.w + ix) * 4;
    this.buf[idx] = rgb[0];
    this.buf[idx + 1] = rgb[1];
    this.buf[idx + 2] = rgb[2];
    this.buf[idx + 3] = alpha;
  }

  fillRect(x: number, y: number, rw: number, rh: number, rgb: RGB) {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    for (let dy = 0; dy < rh; dy++) {
      for (let dx = 0; dx < rw; dx++) {
        this.set(x0 + dx, y0 + dy, rgb);
      }
    }
  }

  drawMatrix(matrix: readonly string[], ox: number, oy: number) {
    for (let row = 0; row < matrix.length; row++) {
      const line = matrix[row];
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        if (ch === '.') continue;
        const rgb = CHAR_PALETTE[ch];
        if (!rgb) continue;
        this.set(ox + col, oy + row, rgb);
      }
    }
  }

  drawSegment(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    radius: number,
    coreColor: RGB,
    shadeColor: RGB
  ) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = x0 + (x1 - x0) * t;
      const cy = y0 + (y1 - y0) * t;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius + 0.35) {
            const c = dy > 0 || dx > 0 ? shadeColor : coreColor;
            this.set(cx + dx, cy + dy, c);
          }
        }
      }
    }
  }

  // Draws candidate local buffer rotated cleanly via inverse nearest-neighbor mapping (zero pixel holes!)
  blitRotated(
    src: PixelLayer,
    srcPivotX: number,
    srcPivotY: number,
    dstPivotX: number,
    dstPivotY: number,
    angleRad: number
  ) {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    // Compute safe bounding box in destination
    const bound = Math.ceil(Math.hypot(src.w, src.h)) + 2;
    const minX = Math.max(0, Math.floor(dstPivotX - bound));
    const maxX = Math.min(this.w - 1, Math.ceil(dstPivotX + bound));
    const minY = Math.max(0, Math.floor(dstPivotY - bound));
    const maxY = Math.min(this.h - 1, Math.ceil(dstPivotY + bound));

    for (let dy = minY; dy <= maxY; dy++) {
      const ry = dy - dstPivotY;
      for (let dx = minX; dx <= maxX; dx++) {
        const rx = dx - dstPivotX;
        // Inverse rotation
        const sx = Math.round(rx * cos + ry * sin + srcPivotX);
        const sy = Math.round(-rx * sin + ry * cos + srcPivotY);
        if (sx < 0 || sx >= src.w || sy < 0 || sy >= src.h) continue;
        const sIdx = (sy * src.w + sx) * 4;
        if (src.buf[sIdx + 3] === 0) continue;
        const dIdx = (dy * this.w + dx) * 4;
        this.buf[dIdx] = src.buf[sIdx];
        this.buf[dIdx + 1] = src.buf[sIdx + 1];
        this.buf[dIdx + 2] = src.buf[sIdx + 2];
        this.buf[dIdx + 3] = src.buf[sIdx + 3];
      }
    }
  }

  // Applies crisp 1px dark pixel-art outline around opaque regions & renders onto canvas
  flushOutlinedToCanvas(
    ctx: CanvasRenderingContext2D,
    scratchCanvas: HTMLCanvasElement,
    outlineRGB: RGB = [19, 30, 52],
    clipBottomY = LOGICAL_H
  ) {
    const w = this.w;
    const h = this.h;
    this.out.set(this.buf);

    for (let y = 1; y < h - 1; y++) {
      if (y >= clipBottomY) {
        for (let x = 0; x < w; x++) {
          this.out[(y * w + x) * 4 + 3] = 0;
        }
        continue;
      }
      for (let x = 1; x < w - 1; x++) {
        const idx = (y * w + x) * 4;
        if (this.buf[idx + 3] > 0) continue;
        const hasNeighbor =
          this.buf[((y - 1) * w + x) * 4 + 3] > 0 ||
          this.buf[((y + 1) * w + x) * 4 + 3] > 0 ||
          this.buf[(y * w + (x - 1)) * 4 + 3] > 0 ||
          this.buf[(y * w + (x + 1)) * 4 + 3] > 0;
        if (hasNeighbor) {
          this.out[idx] = outlineRGB[0];
          this.out[idx + 1] = outlineRGB[1];
          this.out[idx + 2] = outlineRGB[2];
          this.out[idx + 3] = 255;
        }
      }
    }

    const sCtx = scratchCanvas.getContext('2d');
    if (!sCtx) return;
    const imgData = new ImageData(this.out as unknown as Uint8ClampedArray<ArrayBuffer>, w, h);
    sCtx.putImageData(imgData, 0, 0);
    ctx.drawImage(scratchCanvas, 0, 0);
  }
}

// ============================================================
// HAND-CRAFTED 16-BIT CHARACTER HEADS (18px-22px detailed faces)
// ============================================================

const PASTOR_HEAD_OPEN: readonly string[] = [
  '....hhhhHHhh....',
  '..hhHHggHHHHhh..',
  '.hHHHHgHHHHHHhh.',
  '.hHH22222222hHh.',
  '.hH2111222223hh.',
  '.h211122222233h.',
  '.211Ee2222Ee232.',
  '.21122223222232.',
  '.2222223322423..',
  '..22222222223...',
  '..h33hh44hh3h...',
  '..hhhHHHHHHhh...',
  '...hhHHHHHhh....',
  '.....hhhhh......',
];

const PASTOR_HEAD_BLINK: readonly string[] = [
  '....hhhhHHhh....',
  '..hhHHggHHHHhh..',
  '.hHHHHgHHHHHHhh.',
  '.hHH22222222hHh.',
  '.hH2111222223hh.',
  '.h211122222233h.',
  '.211--2222--232.',
  '.21122223222232.',
  '.2222223322423..',
  '..22222222223...',
  '..h33hh44hh3h...',
  '..hhhHHHHHHhh...',
  '...hhHHHHHhh....',
  '.....hhhhh......',
];

const PASTOR_HEAD_SMILE: readonly string[] = [
  '....hhhhHHhh....',
  '..hhHHggHHHHhh..',
  '.hHHHHgHHHHHHhh.',
  '.hHH22222222hHh.',
  '.hH2111222223hh.',
  '.h211122222233h.',
  '.211Ee2222Ee232.',
  '.21122223222232.',
  '.22224EEE42223..',
  '..22224442223...',
  '..h33hh44hh3h...',
  '..hhhHHHHHHhh...',
  '...hhHHHHHhh....',
  '.....hhhhh......',
];

function getMaleHead(mode: 'open' | 'closed' | 'smile'): readonly string[] {
  if (mode === 'closed') {
    return [
      '....mmMMMMmm....',
      '..mmMMnnMMMMmm..',
      '.mMMMMnMMMMMMmm.',
      '.mMM22222222mMm.',
      '.m211112222223m.',
      '.m211--222--23m.',
      '.22112223222232.',
      '.22222233322232.',
      '..322224422233..',
      '...3222222233...',
      '....3322233.....',
    ];
  }
  if (mode === 'smile') {
    return [
      '....mmMMMMmm....',
      '..mmMMnnMMMMmm..',
      '.mMMMMnMMMMMMmm.',
      '.mMM22222222mMm.',
      '.m211112222223m.',
      '.m211eE222Ee23m.',
      '.22152223225232.',
      '.22224EEEE42232.',
      '..322244442233..',
      '...3222222233...',
      '....3322233.....',
    ];
  }
  return [
    '....mmMMMMmm....',
    '..mmMMnnMMMMmm..',
    '.mMMMMnMMMMMMmm.',
    '.mMM22222222mMm.',
    '.m211112222223m.',
    '.m211eE222Ee23m.',
    '.22112223222232.',
    '.22222233322232.',
    '..322244442233..',
    '...3222222233...',
    '....3322233.....',
  ];
}

function getFemaleHead(mode: 'open' | 'closed' | 'smile'): readonly string[] {
  if (mode === 'closed') {
    return [
      '.....ffFFFFff.....',
      '...ffFFrrFFFFff...',
      '..fFFFFrrFFFFFFf..',
      '.fFFF22222222FFFf.',
      '.fFF2111122222FFf.',
      '.fF211--222--22Ff.',
      '.fF215222322522Ff.',
      '.ff222223332222ff.',
      '.ff322224422233ff.',
      '.fff3222222233fff.',
      '.ffff3322233fffff.',
      '.fffff.....ffffff.',
      '.fffff.....ffffff.',
      '..ffff......ffff..',
    ];
  }
  if (mode === 'smile') {
    return [
      '.....ffFFFFff.....',
      '...ffFFrrFFFFff...',
      '..fFFFFrrFFFFFFf..',
      '.fFFF22222222FFFf.',
      '.fFF2111122222FFf.',
      '.fF211eE222Ee22Ff.',
      '.fF215222322522Ff.',
      '.ff2224EEEE4222ff.',
      '.ff322244442233ff.',
      '.fff3222222233fff.',
      '.ffff3322233fffff.',
      '.fffff.....ffffff.',
      '.fffff.....ffffff.',
      '..ffff......ffff..',
    ];
  }
  return [
    '.....ffFFFFff.....',
    '...ffFFrrFFFFff...',
    '..fFFFFrrFFFFFFf..',
    '.fFFF22222222FFFf.',
    '.fFF2111122222FFf.',
    '.fF211eE222Ee22Ff.',
    '.fF215222322522Ff.',
    '.ff222223332222ff.',
    '.ff322244442233ff.',
    '.fff3222222233fff.',
    '.ffff3322233fffff.',
    '.fffff.....ffffff.',
    '.fffff.....ffffff.',
    '..ffff......ffff..',
  ];
}

// ============================================================
// BUILD LOCAL CANDIDATE BUFFER (56 x 76) FOR SMOOTH ROTATION
// ============================================================

function drawCandidateToBuffer(
  buf: PixelLayer,
  isFemale: boolean,
  faceMode: 'open' | 'closed' | 'smile',
  handsMode: 'chest' | 'nose' | 'celebrate',
  hairDriftPx: number
) {
  buf.clear();
  // Pivot at (26, 56) inside 56x76 canvas
  const cx = 26;

  // Long hair behind neck/shoulders for Female candidate (smooth dynamic drift!)
  if (isFemale) {
    for (let hy = 25; hy <= 44; hy++) {
      const progress = (hy - 25) / 19;
      const drift = Math.round(hairDriftPx * progress);
      const halfW = hy < 34 ? 7 : 8;
      for (let hx = cx - halfW + drift; hx <= cx + halfW + drift; hx++) {
        const isEdge = hx === cx - halfW + drift || hx === cx + halfW + drift;
        const c = isEdge
          ? CHAR_PALETTE.f
          : (hx + hy) % 5 === 0
            ? CHAR_PALETTE.r
            : CHAR_PALETTE.F;
        buf.set(hx, hy, c);
      }
    }
  }

  // Legs below waist (partially underwater)
  buf.fillRect(cx - 5, 55, 4, 15, CHAR_PALETTE.b);
  buf.fillRect(cx + 1, 55, 4, 15, CHAR_PALETTE.B);

  // White Baptismal Robe / Tunic (torso + softly flared lower robe)
  for (let y = 29; y <= 58; y++) {
    const t = (y - 29) / 29;
    const halfW = isFemale ? Math.round(6 + t * 3.2) : Math.round(6.8 + t * 1.4);
    for (let dx = -halfW; dx <= halfW; dx++) {
      // Shaded white folds: left bright highlight, center soft white, vertical fold shadows
      const isRightShade = dx >= halfW - 2;
      const isFold = Math.abs(dx) === 2 && y > 36;
      const isDeepBottom = y > 54 && Math.abs(dx) % 3 === 0;
      const color =
        isDeepBottom
          ? CHAR_PALETTE.B
          : isRightShade || isFold
            ? CHAR_PALETTE.b
            : dx <= -2
              ? CHAR_PALETTE.w
              : CHAR_PALETTE.W;
      buf.set(cx + dx, y, color);
    }
  }

  // Soft collar / neckline V-shape
  buf.fillRect(cx - 2, 28, 4, 2, CHAR_PALETTE['2']);
  buf.set(cx - 1, 30, CHAR_PALETTE['2']);
  buf.set(cx, 30, CHAR_PALETTE['2']);
  buf.set(cx - 2, 30, CHAR_PALETTE.b);
  buf.set(cx + 1, 30, CHAR_PALETTE.b);

  // Neck
  buf.fillRect(cx - 2, 26, 4, 3, CHAR_PALETTE['2']);
  buf.set(cx + 1, 26, CHAR_PALETTE['3']);
  buf.set(cx + 1, 27, CHAR_PALETTE['3']);

  // Detailed Head / Face / Hair
  if (isFemale) {
    buf.drawMatrix(getFemaleHead(faceMode), cx - 9, 14);
  } else {
    buf.drawMatrix(getMaleHead(faceMode), cx - 8, 16);
  }

  // Arms & Hands Pose
  if (handsMode === 'chest') {
    // Peaceful folded arms over chest
    buf.drawSegment(cx - 7, 32, cx - 5, 39, 1.5, CHAR_PALETTE.w, CHAR_PALETTE.b);
    buf.drawSegment(cx - 5, 39, cx - 1, 37, 1.4, CHAR_PALETTE.W, CHAR_PALETTE.b);
    buf.drawSegment(cx + 6, 32, cx + 4, 39, 1.5, CHAR_PALETTE.W, CHAR_PALETTE.b);
    buf.drawSegment(cx + 4, 39, cx, 37, 1.4, CHAR_PALETTE.b, CHAR_PALETTE.B);
    // Clasped hands
    buf.fillRect(cx - 2, 36, 4, 3, CHAR_PALETTE['1']);
    buf.set(cx + 1, 38, CHAR_PALETTE['3']);
  } else if (handsMode === 'nose') {
    // Authentic baptism posture: right hand raised gently pinching nose, left hand crossing wrist
    buf.drawSegment(cx - 7, 32, cx - 6, 39, 1.5, CHAR_PALETTE.w, CHAR_PALETTE.b);
    buf.drawSegment(cx - 6, 39, cx - 1, 35, 1.3, CHAR_PALETTE.W, CHAR_PALETTE.b);
    buf.drawSegment(cx + 6, 32, cx + 3, 35, 1.5, CHAR_PALETTE.W, CHAR_PALETTE.b);
    buf.drawSegment(cx + 3, 35, cx - 1, 25, 1.2, CHAR_PALETTE.W, CHAR_PALETTE.b);
    // Hand near nose/face + supporting hand at wrist
    buf.fillRect(cx - 2, 23, 3, 3, CHAR_PALETTE['1']);
    buf.fillRect(cx - 2, 34, 3, 2, CHAR_PALETTE['2']);
  } else {
    // Joyful raised hands slightly open in celebration/gratitude!
    buf.drawSegment(cx - 7, 32, cx - 10, 35, 1.5, CHAR_PALETTE.w, CHAR_PALETTE.b);
    buf.drawSegment(cx - 10, 35, cx - 9, 27, 1.3, CHAR_PALETTE.w, CHAR_PALETTE.W);
    buf.fillRect(cx - 10, 25, 3, 2, CHAR_PALETTE['1']);

    buf.drawSegment(cx + 6, 32, cx + 10, 34, 1.5, CHAR_PALETTE.W, CHAR_PALETTE.b);
    buf.drawSegment(cx + 10, 34, cx + 9, 26, 1.3, CHAR_PALETTE.W, CHAR_PALETTE.b);
    buf.fillRect(cx + 8, 24, 3, 2, CHAR_PALETTE['1']);
  }
}

// ============================================================
// DAYTIME RIVERSIDE BAPTISM SCENE RENDERER (240 x 135)
// ============================================================

function drawDaytimeSkyAndScenery(ctx: CanvasRenderingContext2D, timeSec: number) {
  // 1. Radiant Daytime Sky Gradient (Crisp Pixel Bands with Bayer-style dither edges)
  const skyBands = [
    { y: 0, h: 14, c: '#2980d9' },
    { y: 14, h: 14, c: '#3fa2eb' },
    { y: 28, h: 16, c: '#65bdf5' },
    { y: 44, h: 16, c: '#96d7fa' },
    { y: 60, h: 14, c: '#c7ebfd' },
    { y: 74, h: 8, c: '#e3f5fe' },
  ];
  for (let i = 0; i < skyBands.length; i++) {
    const b = skyBands[i];
    ctx.fillStyle = b.c;
    ctx.fillRect(0, b.y, LOGICAL_W, b.h);
    // Crisp 1px checkerboard dither transition between adjacent sky bands
    if (i < skyBands.length - 1) {
      ctx.fillStyle = skyBands[i + 1].c;
      for (let x = 0; x < LOGICAL_W; x += 2) {
        ctx.fillRect(x, b.y + b.h - 1, 1, 1);
      }
    }
  }

  // 2. Warm Morning Sun in Upper-Left Sky + Gentle Sun Halo
  ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
  ctx.fillRect(14, 4, 26, 22);
  ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
  ctx.fillRect(18, 7, 18, 16);
  // Crisp pixel sun disc
  ctx.fillStyle = '#fde047';
  ctx.fillRect(21, 10, 12, 10);
  ctx.fillRect(23, 8, 8, 14);
  ctx.fillStyle = '#fef9c3';
  ctx.fillRect(23, 11, 8, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(25, 13, 4, 4);

  // Soft sunlit diagonal atmospheric glow over the baptism center (very subtle!)
  ctx.fillStyle = 'rgba(255, 251, 220, 0.14)';
  for (let y = 0; y < WATER_Y; y++) {
    const xStart = Math.round(92 + y * 0.22);
    const width = Math.round(28 + y * 0.45);
    ctx.fillRect(xStart, y, width, 1);
  }

  // 3. Fluffy Drifting Daytime Pixel Clouds
  const drawCloud = (cx: number, cy: number, scale: number) => {
    const x = Math.round(((cx + timeSec * (2.2 / scale)) % (LOGICAL_W + 64)) - 32);
    // Soft underside shadow
    ctx.fillStyle = '#cbe7fa';
    ctx.fillRect(x + 2, cy + 5, 28, 4);
    // Main bright cloud body
    ctx.fillStyle = '#f0f9ff';
    ctx.fillRect(x, cy + 3, 30, 5);
    ctx.fillRect(x + 4, cy, 18, 6);
    ctx.fillRect(x + 9, cy - 3, 10, 5);
    // Top crisp highlight
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 5, cy, 14, 3);
    ctx.fillRect(x + 10, cy - 3, 8, 2);
  };
  drawCloud(36, 16, 1.2);
  drawCloud(140, 11, 1.0);
  drawCloud(204, 24, 1.4);

  // 4. Distant Sunlit Hills Along Horizon
  const drawHill = (startX: number, endX: number, peakH: number, bodyC: string, topC: string) => {
    for (let x = startX; x <= endX; x++) {
      const p = (x - startX) / (endX - startX);
      const h = Math.round(Math.sin(p * Math.PI) * peakH);
      ctx.fillStyle = bodyC;
      ctx.fillRect(x, WATER_Y - 6 - h, 1, h + 6);
      ctx.fillStyle = topC;
      ctx.fillRect(x, WATER_Y - 6 - h, 1, 2);
    }
  };
  drawHill(-10, 105, 16, '#5ea89c', '#7ec4b6');
  drawHill(78, 195, 13, '#6db8a8', '#8cd4c3');
  drawHill(155, 260, 19, '#5ea89c', '#7ec4b6');

  // 5. Midground Lush Green Riverbank + Hand-Crafted Pixel Trees & Palm Fronds
  // Riverbank grassy ridge left & right
  ctx.fillStyle = '#2d7a4f';
  ctx.fillRect(0, WATER_Y - 7, 54, 7);
  ctx.fillRect(184, WATER_Y - 7, 56, 7);
  ctx.fillStyle = '#43a05d';
  ctx.fillRect(0, WATER_Y - 8, 52, 2);
  ctx.fillRect(186, WATER_Y - 8, 54, 2);

  // Smooth riverbank rocks along water edge
  const stones = [
    [6, WATER_Y - 3, 9, 4],
    [18, WATER_Y - 2, 11, 3],
    [34, WATER_Y - 3, 8, 4],
    [194, WATER_Y - 3, 9, 4],
    [208, WATER_Y - 2, 12, 3],
    [224, WATER_Y - 3, 10, 4],
  ];
  for (const [sx, sy, sw, sh] of stones) {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(sx + 1, sy, sw - 2, 1);
  }

  // Pixel leafy trees with shaded canopies on left & right banks
  const drawTree = (tx: number, baseY: number, tall: number) => {
    // Trunk
    ctx.fillStyle = '#5c3a24';
    ctx.fillRect(tx - 2, baseY - tall, 4, tall);
    ctx.fillStyle = '#7c5135';
    ctx.fillRect(tx - 1, baseY - tall, 2, tall);
    // Shaded foliage clusters
    const cy = baseY - tall - 4;
    ctx.fillStyle = '#1b5e3a';
    ctx.fillRect(tx - 11, cy - 3, 22, 12);
    ctx.fillRect(tx - 8, cy - 8, 16, 17);
    ctx.fillStyle = '#2c824c';
    ctx.fillRect(tx - 9, cy - 7, 16, 12);
    ctx.fillRect(tx - 11, cy - 2, 18, 8);
    ctx.fillStyle = '#4eb363';
    ctx.fillRect(tx - 7, cy - 7, 10, 6);
    ctx.fillRect(tx - 9, cy - 2, 8, 5);
    ctx.fillStyle = '#84d979';
    ctx.fillRect(tx - 6, cy - 7, 6, 3);
  };

  drawTree(15, WATER_Y - 7, 16);
  drawTree(34, WATER_Y - 6, 11);
  drawTree(222, WATER_Y - 7, 17);
  drawTree(203, WATER_Y - 6, 12);

  // Gentle swaying cattails / river reeds at edges
  const sway = Math.round(Math.sin(timeSec * 2.1) * 0.7);
  const reeds = [45, 49, 189, 193];
  for (const rx of reeds) {
    ctx.fillStyle = '#2f854e';
    ctx.fillRect(rx, WATER_Y - 8, 1, 8);
    ctx.fillRect(rx + sway, WATER_Y - 14, 1, 7);
    if (rx === 45 || rx === 193) {
      ctx.fillStyle = '#784628';
      ctx.fillRect(rx + sway, WATER_Y - 15, 2, 3);
    }
  }
}

function renderDaytimeBaptismScene(
  ctx: CanvasRenderingContext2D,
  charLayer: PixelLayer,
  candBuffer: PixelLayer,
  scratchCanvas: HTMLCanvasElement,
  timeSec: number,
  isFemale: boolean,
  reducedMotion: boolean
) {
  const cycle = 6.2;
  const t = reducedMotion ? 5.2 : timeSec % cycle;

  // Smooth timeline:
  // 0.0 - 1.3: Prayer & blessing (standing, gentle blink)
  // 1.3 - 2.4: Smoothly reclining back into water
  // 2.4 - 3.6: Totally immersed underwater + splashes & bubbles
  // 3.6 - 4.7: Smoothly lifted upright + dripping droplets
  // 4.7 - 6.2: Joyful celebration + gentle white dove + golden light

  let tiltDeg = 0;
  let sinkY = 0;
  let shiftX = 0;
  let faceMode: 'open' | 'closed' | 'smile' = 'open';
  let handsMode: 'chest' | 'nose' | 'celebrate' = 'chest';
  let pastorLeaning = 0; // 0..1
  let pastorArmAngle = 0; // 0 = raised blessing, 1 = guiding down, 2 = joyful raise
  let splashProgress = 0;
  let exitDropletsProgress = 0;
  let hairDriftPx = 0;

  if (t < 1.3) {
    // Stage 1: Standing prayer
    const p = t / 1.3;
    const blink = p > 0.45 && p < 0.56;
    faceMode = blink ? 'closed' : 'open';
    handsMode = p > 0.78 ? 'nose' : 'chest';
    pastorArmAngle = p > 0.75 ? lerp(0, 1, (p - 0.75) / 0.25) : 0;
  } else if (t < 2.4) {
    // Stage 2: Smooth reclined dip into water
    const p = easeInOut((t - 1.3) / 1.1);
    tiltDeg = lerp(0, 82, p);
    sinkY = lerp(0, 10, p * p);
    shiftX = lerp(0, 5, p);
    faceMode = 'closed';
    handsMode = 'nose';
    pastorLeaning = p;
    pastorArmAngle = 1;
    hairDriftPx = lerp(0, 3, p);
    if (p > 0.6) splashProgress = ((p - 0.6) / 0.4) * 0.45;
  } else if (t < 3.6) {
    // Stage 3: Full immersion beneath water
    const p = (t - 2.4) / 1.2;
    tiltDeg = 82 + Math.sin(p * Math.PI) * 3;
    sinkY = 10 + Math.sin(p * Math.PI) * 3.5;
    shiftX = 5;
    faceMode = 'closed';
    handsMode = 'nose';
    pastorLeaning = 1;
    pastorArmAngle = 1;
    hairDriftPx = 3 + Math.sin(p * Math.PI * 2) * 1.5;
    splashProgress = 0.45 + p * 0.55;
  } else if (t < 4.7) {
    // Stage 4: Lifting cleanly back upright
    const p = easeInOut((t - 3.6) / 1.1);
    tiltDeg = lerp(82, 0, p);
    sinkY = lerp(10, 0, Math.sqrt(p));
    shiftX = lerp(5, 0, p);
    faceMode = p > 0.72 ? 'smile' : 'closed';
    handsMode = p > 0.78 ? 'celebrate' : 'nose';
    pastorLeaning = 1 - p;
    pastorArmAngle = lerp(1, 2, p);
    hairDriftPx = lerp(3, 0, p);
    exitDropletsProgress = p;
  } else {
    // Stage 5: Rejoicing in new life!
    const p = (t - 4.7) / 1.5;
    tiltDeg = 0;
    sinkY = Math.sin(p * Math.PI * 2) * 0.5;
    faceMode = 'smile';
    handsMode = 'celebrate';
    pastorArmAngle = 2;
  }

  // 1. DAYTIME SKY, SUN, CLOUDS, HILLS, TREES & REEDS
  drawDaytimeSkyAndScenery(ctx, timeSec);

  // 2. BACK WATER LAYER (Sunlit crystal turquoise-blue river)
  const waterBands = [
    { y: WATER_Y, h: 6, c: '#38bdf8' },
    { y: WATER_Y + 6, h: 9, c: '#0ea5e9' },
    { y: WATER_Y + 15, h: 14, c: '#0284c7' },
    { y: WATER_Y + 29, h: 24, c: '#0369a1' },
  ];
  for (const wb of waterBands) {
    ctx.fillStyle = wb.c;
    ctx.fillRect(0, wb.y, LOGICAL_W, wb.h);
  }

  // Gentle back wave shimmer lines
  const waveShift = Math.floor(timeSec * 10);
  for (let x = 0; x < LOGICAL_W; x++) {
    if ((x + waveShift) % 9 < 3) {
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(x, WATER_Y + 1 + ((x % 3) === 0 ? 1 : 0), 1, 1);
    }
  }

  // 3. CHARACTERS LAYER (Articulated Pastor + Candidate into offscreen pixel buffer + crisp 1px outline)
  charLayer.clear();

  // --- PASTOR (Standing waist-deep on left, leaning naturally with candidate) ---
  const pastorBaseX = Math.round(92 + pastorLeaning * 5);
  const pastorBaseY = Math.round(35 + pastorLeaning * 4);
  const pHeadX = pastorBaseX - 8 + Math.round(pastorLeaning * 4);
  const pHeadY = pastorBaseY;

  // Pastor legs submerged cleanly below waist
  charLayer.fillRect(pastorBaseX - 5, pastorBaseY + 38, 4, 24, CHAR_PALETTE.p);
  charLayer.fillRect(pastorBaseX + 1, pastorBaseY + 38, 4, 24, CHAR_PALETTE.P);

  // Pastor's back-supporting arm (left arm reaching cleanly behind candidate's upper back!)
  const candPivotX = Math.round(132 + shiftX);
  const candPivotY = Math.round(88 + sinkY);
  const rad = (tiltDeg * Math.PI) / 180;
  // Candidate's back center in world coords: local offset (-2, -19) rotated around candPivot
  const backWorldX = candPivotX + (-2 * Math.cos(rad) + 19 * Math.sin(rad));
  const backWorldY = candPivotY + (-2 * Math.sin(rad) - 19 * Math.cos(rad));
  charLayer.drawSegment(
    pastorBaseX + 5,
    pastorBaseY + 18,
    backWorldX,
    backWorldY,
    2.0,
    CHAR_PALETTE.P,
    CHAR_PALETTE.p
  );
  // Pastor supporting hand at candidate's back
  charLayer.fillRect(backWorldX - 1, backWorldY - 1, 3, 3, CHAR_PALETTE['2']);

  // Pastor Neck connecting seamlessly from beard/jaw to collar
  charLayer.fillRect(pastorBaseX - 2 + Math.round(pastorLeaning * 3), pastorBaseY + 12, 5, 3, CHAR_PALETTE['3']);

  // Pastor Torso (natural rounded shoulders, navy tunic + golden-white baptismal stole)
  for (let ty = 14; ty <= 44; ty++) {
    const leanShift = Math.round((1 - (ty - 14) / 30) * pastorLeaning * 3);
    const halfW = ty < 18 ? 4 + (ty - 14) : 8;
    const txCenter = pastorBaseX + leanShift;
    for (let dx = -halfW; dx <= halfW; dx++) {
      let col = dx > 2 ? CHAR_PALETTE.q : dx < -3 ? CHAR_PALETTE.p : CHAR_PALETTE.P;
      // Golden baptismal stole down center front
      if (Math.abs(dx) <= 2 && ty >= 16) {
        col = Math.abs(dx) === 2 ? CHAR_PALETTE.y : CHAR_PALETTE.Y;
      }
      // Crisp white clerical collar
      if (ty <= 16 && Math.abs(dx) <= 2) {
        col = CHAR_PALETTE.C;
      }
      charLayer.set(txCenter + dx, pastorBaseY + ty, col);
    }
  }

  // Pastor Head
  const pastorFace =
    t < 1.3 && t > 0.6 && t < 0.72
      ? PASTOR_HEAD_BLINK
      : t >= 4.4
        ? PASTOR_HEAD_SMILE
        : PASTOR_HEAD_OPEN;
  charLayer.drawMatrix(pastorFace, pHeadX, pHeadY);

  // --- CANDIDATE (Homem or Mulher, smoothly rotated via inverse mapping) ---
  drawCandidateToBuffer(candBuffer, isFemale, faceMode, handsMode, hairDriftPx);
  charLayer.blitRotated(candBuffer, 26, 56, candPivotX, candPivotY, rad);

  // Pastor's front guiding arm (right arm: raised in prayer -> rests over candidate's hands during dip -> raised in joy)
  const pShoulderX = pastorBaseX + 6 + Math.round(pastorLeaning * 3);
  const pShoulderY = pastorBaseY + 19;
  if (pastorArmAngle <= 0.35) {
    // Raised gently in blessing
    const pElbowX = pShoulderX + 7;
    const pElbowY = pShoulderY - 4;
    const pHandX = pElbowX + 4;
    const pHandY = pElbowY - 8;
    charLayer.drawSegment(pShoulderX, pShoulderY, pElbowX, pElbowY, 1.9, CHAR_PALETTE.q, CHAR_PALETTE.P);
    charLayer.drawSegment(pElbowX, pElbowY, pHandX, pHandY, 1.6, CHAR_PALETTE.q, CHAR_PALETTE.P);
    charLayer.fillRect(pHandX - 1, pHandY - 3, 3, 4, CHAR_PALETTE['1']);
  } else if (pastorArmAngle <= 1.35) {
    // Guiding candidate's clasped hands gently down into the water
    const guideWorldX = candPivotX + (-1 * Math.cos(rad) + 21 * Math.sin(rad));
    const guideWorldY = candPivotY + (-1 * Math.sin(rad) - 21 * Math.cos(rad));
    const midX = (pShoulderX + guideWorldX) * 0.5;
    const midY = (pShoulderY + guideWorldY) * 0.5 + 3;
    charLayer.drawSegment(pShoulderX, pShoulderY, midX, midY, 1.9, CHAR_PALETTE.q, CHAR_PALETTE.P);
    charLayer.drawSegment(midX, midY, guideWorldX - 2, guideWorldY, 1.6, CHAR_PALETTE.q, CHAR_PALETTE.P);
    charLayer.fillRect(guideWorldX - 3, guideWorldY - 1, 3, 3, CHAR_PALETTE['1']);
  } else {
    // Celebratory raised blessing hand!
    const liftT = clamp01(pastorArmAngle - 1.35);
    const pHandX = Math.round(pShoulderX + lerp(11, 8, liftT));
    const pHandY = Math.round(pShoulderY + lerp(2, -13, liftT));
    const pElbowX = Math.round((pShoulderX + pHandX) * 0.5 + 2);
    const pElbowY = Math.round((pShoulderY + pHandY) * 0.5 + 2);
    charLayer.drawSegment(pShoulderX, pShoulderY, pElbowX, pElbowY, 1.9, CHAR_PALETTE.q, CHAR_PALETTE.P);
    charLayer.drawSegment(pElbowX, pElbowY, pHandX, pHandY, 1.6, CHAR_PALETTE.q, CHAR_PALETTE.P);
    charLayer.fillRect(pHandX - 1, pHandY - 3, 3, 4, CHAR_PALETTE['1']);
  }

  // Render Pastor + Candidate with razor-sharp 1px dark outline onto main canvas
  charLayer.flushOutlinedToCanvas(ctx, scratchCanvas, [19, 30, 52], LOGICAL_H - 6);

  // 4. FOREGROUND TRANSLUCENT WATER LAYER (Real Underwater Immersion!)
  ctx.fillStyle = 'rgba(56, 189, 248, 0.34)';
  ctx.fillRect(0, WATER_Y + 4, LOGICAL_W, 12);
  ctx.fillStyle = 'rgba(14, 165, 233, 0.48)';
  ctx.fillRect(0, WATER_Y + 16, LOGICAL_W, 16);
  ctx.fillStyle = 'rgba(2, 132, 199, 0.62)';
  ctx.fillRect(0, WATER_Y + 32, LOGICAL_W, LOGICAL_H - (WATER_Y + 32));

  // Sunlit foreground wave crests & sparkling water highlights
  for (let x = 0; x < LOGICAL_W; x++) {
    const waveY = WATER_Y + 5 + Math.round(Math.sin((x - waveShift * 1.3) * 0.19));
    ctx.fillStyle = '#7dd3fc';
    ctx.fillRect(x, waveY, 1, 1);
    if ((x + waveShift) % 13 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, waveY, 2, 1);
    }
    if ((x * 5 + waveShift) % 27 === 0) {
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(x, WATER_Y + 14 + (x % 5), 4, 1);
    }
    // Warm sunlit diamond reflections near left sun reflection column
    if (x > 22 && x < 70 && (x * 7 + waveShift * 2) % 17 === 0) {
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(x, WATER_Y + 11 + (x % 9), 3, 1);
    }
  }

  // Subtle waist foam rings around Pastor & upright Candidate
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillRect(pastorBaseX - 9, WATER_Y + 4, 18, 1);
  if (tiltDeg < 25) {
    ctx.fillRect(candPivotX - 9, WATER_Y + 4, 18, 1);
  }

  // 5. DYNAMIC WATER SPLASHES, CONCENTRIC FOAM RIPPLES & RISING BUBBLES (Immersion)
  if (splashProgress > 0) {
    const intensity = Math.sin(clamp01(splashProgress) * Math.PI);
    const splashCX = 138;
    // Expanding concentric foam rings on water surface
    const r1 = Math.round(8 + splashProgress * 28);
    const r2 = Math.round(4 + splashProgress * 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(splashCX - r1, WATER_Y + 5, 6, 1);
    ctx.fillRect(splashCX + r1 - 6, WATER_Y + 5, 6, 1);
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(splashCX - r2, WATER_Y + 8, 8, 1);
    ctx.fillRect(splashCX + r2 - 8, WATER_Y + 8, 8, 1);

    // Rising pixel splash plumes
    const plumes = [
      { vx: -18, vy: -19, delay: 0.0 },
      { vx: -10, vy: -24, delay: 0.08 },
      { vx: -3, vy: -21, delay: 0.03 },
      { vx: 7, vy: -26, delay: 0.12 },
      { vx: 15, vy: -20, delay: 0.06 },
      { vx: 22, vy: -15, delay: 0.16 },
    ];
    for (const pl of plumes) {
      const dp = clamp01((splashProgress - pl.delay) / (1 - pl.delay));
      if (dp <= 0 || dp >= 1) continue;
      const dx = Math.round(splashCX + pl.vx * dp);
      const dy = Math.round(WATER_Y + 4 + pl.vy * (4 * dp * (1 - dp)));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx, dy, 2, 2);
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(dx, dy + 2, 1, 1);
    }

    // Crisp underwater rising air bubbles
    if (intensity > 0.25) {
      const bubbles = [
        [142, 0.1],
        [148, 0.35],
        [134, 0.55],
        [145, 0.72],
      ];
      for (const [bx, delay] of bubbles) {
        const bp = (splashProgress + delay) % 1;
        const by = Math.round(WATER_Y + 18 - bp * 14);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx, by, 2, 2);
        ctx.fillStyle = '#7dd3fc';
        ctx.fillRect(bx + 1, by + 1, 1, 1);
      }
    }
  }

  // 6. CASCADING WATER DROPLETS WHEN EMERGING FROM THE WATER
  if (exitDropletsProgress > 0 && exitDropletsProgress < 0.95) {
    const dropSpecs = [
      [candPivotX - 7, 52],
      [candPivotX + 6, 48],
      [candPivotX - 2, 60],
      [candPivotX + 9, 58],
      [candPivotX - 10, 64],
    ];
    for (let i = 0; i < dropSpecs.length; i++) {
      const [dx, startY] = dropSpecs[i];
      const fallY = Math.round(startY + ((exitDropletsProgress * 26 + i * 5) % 24));
      if (fallY < WATER_Y + 4) {
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(dx, fallY, 1, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(dx, fallY, 1, 1);
      }
    }
  }

  // 7. GRACEFUL WHITE PIXEL DOVE & GOLDEN SUNLIGHT MOTES ON JOYFUL RISING / CELEBRATION
  if (t >= 4.2) {
    const joyP = (t - 4.2) / 2.0;
    const doveX = Math.round(192 - joyP * 38);
    const doveY = Math.round(24 + Math.sin(timeSec * 6.5) * 2);
    const wingUp = Math.floor(timeSec * 7) % 2 === 0;

    // Hand-drawn crisp 10x8 white dove with soft dark outline
    const dove = wingUp
      ? [
          '..OO......',
          '.OwwO.....',
          '..OwwOO...',
          '...OwwwOO.',
          '..OwwwwwYO',
          '...OOOOOO.',
        ]
      : [
          '..........',
          '...OO.....',
          '..OwwOO...',
          '.OwwwwwOO.',
          '..OwwwwwYO',
          '...OOOOOO.',
        ];
    for (let r = 0; r < dove.length; r++) {
      for (let c = 0; c < dove[r].length; c++) {
        const ch = dove[r][c];
        if (ch === '.') continue;
        ctx.fillStyle =
          ch === 'O' ? '#1e3a5f' : ch === 'Y' ? '#f59e0b' : '#ffffff';
        ctx.fillRect(doveX + c, doveY + r, 1, 1);
      }
    }

    // Soft golden sun motes twinkling in the light
    const motes = [
      [118, 42],
      [146, 36],
      [131, 28],
      [154, 48],
    ];
    motes.forEach(([mx, my], idx) => {
      const rise = Math.round((joyP * 14 + idx * 4) % 14);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(mx, my - rise, 1, 1);
      if ((Math.floor(timeSec * 5) + idx) % 2 === 0) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mx - 1, my - rise, 3, 1);
        ctx.fillRect(mx, my - rise - 1, 1, 3);
      }
    });
  }
}

export const PixelBaptismAnimation: React.FC<PixelBaptismAnimationProps> = ({
  gender,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isFemale = gender === 'Fem.';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scratchCanvas = document.createElement('canvas');
    scratchCanvas.width = LOGICAL_W;
    scratchCanvas.height = LOGICAL_H;

    const charLayer = new PixelLayer(LOGICAL_W, LOGICAL_H);
    const candBuffer = new PixelLayer(56, 76);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    const startTime = performance.now();
    let lastDraw = 0;

    const draw = (now: number) => {
      // Smooth 30 FPS pixel animation cadence
      if (now - lastDraw >= 33 || prefersReducedMotion) {
        lastDraw = now;
        const elapsed = (now - startTime) / 1000;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
        renderDaytimeBaptismScene(
          ctx,
          charLayer,
          candBuffer,
          scratchCanvas,
          elapsed,
          isFemale,
          prefersReducedMotion
        );
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
    <div className="w-full max-w-[528px] mx-auto rounded-2xl overflow-hidden border border-sky-300/35 shadow-xl bg-sky-900">
      <div className="relative w-full aspect-[16/9]">
        <canvas
          ref={canvasRef}
          width={LOGICAL_W}
          height={LOGICAL_H}
          aria-label={
            isFemale
              ? 'Animação em pixel art de dia mostrando um pastor batizando uma mulher nas águas'
              : 'Animação em pixel art de dia mostrando um pastor batizando um homem nas águas'
          }
          className="w-full h-full block"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
    </div>
  );
};
