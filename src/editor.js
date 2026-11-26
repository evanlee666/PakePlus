"use strict";

const byId = (id) => document.getElementById(id);
const settings = byId("settings");
const film = byId("film");
const stage = byId("stage");
const scanViewport = byId("scan-viewport");
const carrier = byId("carrier");
const histogram = byId("histogram");
const histogramSample = document.createElement("canvas");
histogramSample.width = 104;
histogramSample.height = 88;
const histogramPixels = histogramSample.getContext("2d",{willReadFrequently:true});
const date = byId("date");
const frame = byId("frame");
const stock = byId("stock");
const stockSearch = byId("stock-search");
const stockResults = byId("stock-results");
const stockMatchList = byId("stock-matches");
const imprintHalo = byId("imprint-halo");
const customImprint = byId("custom-imprint");
const imprintName = byId("imprint-name");
const imprintColor = byId("imprint-color");
const resetImprintColor = byId("imprint-color-reset");
const gate = byId("gate");
const gate135 = byId("gate-135");
const paperSize = byId("paper-size");
const paperFinish = byId("paper-finish");
const paperColor = byId("paper-color");
const paperSpacing = byId("paper-spacing");
const paperSpacingCenter = byId("paper-spacing-center");
const patternColor = byId("pattern-color");
const paperSwatchGrid = byId("paper-swatches");
let paperSwatchTarget = paperColor;
const paperImageInput = byId("paper-image");
const outerRadius = byId("outer-radius");
const zoom = byId("zoom");
const exportDialog = byId("export-dialog");
const backingColors = { dark: "#090909", light: "#ffffff" };
const themeColor = byId("theme-color");
function rgbLuminance(channels) {
  const linear = channels.map(channel => {
    const value = channel/255;
    return value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4;
  });
  return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
}

function showAccent(color) {
  const channels = color.slice(1).match(/../g).map(part => parseInt(part,16));
  const swatch = document.documentElement.style;
  const luminance = rgbLuminance(channels);
  swatch.setProperty("--accent",color);
  swatch.setProperty("--on-accent",luminance < .179 ? "#ffffff" : "#000000");
  const backdrop = rgbLuminance([68,68,72]);
  const minInk = (backdrop+.05)*4.5-.05;
  let ink = channels;
  for (let i=1; rgbLuminance(ink)<minInk && i<=20; i++) {
    ink = channels.map(value => Math.round(value+(255-value)*i/20));
  }
  swatch.setProperty("--accent-ink","rgb("+ink.join(",")+")");
  byId("theme-color-value").value = color.toUpperCase();
}

showAccent(themeColor.value);
themeColor.addEventListener("input", () => showAccent(themeColor.value));
byId("theme-reset").addEventListener("click", () => {
  themeColor.value = themeColor.defaultValue;
  showAccent(themeColor.value);
  scheduleHistory();
});

// Measurements are in millimetres. Medium-format gates vary slightly by camera.
const gates = {
  "135": { width: 36, height: 24, pitch: 38, roll: 35, frames: 36 },
  "half": { width: 18, height: 24, pitch: 19, roll: 35, frames: 72 },
  "xpan": { width: 65, height: 24, pitch: 66.5, roll: 35, frames: 21 },
  "645": { width: 41.5, height: 56, pitch: 44, roll: 61.5, frames: 16 },
  "66": { width: 56, height: 56, pitch: 59, roll: 61.5, frames: 12 },
  "67": { width: 69, height: 56, pitch: 73, roll: 61.5, frames: 10 },
  "69": { width: 84, height: 56, pitch: 88, roll: 61.5, frames: 8 },
  "instant-classic": { label:"Polaroid", width:76.8, height:78.9, paperWidth:88.5, paperHeight:107.5, top:5.9, frames:1 },
  "instant-round": { label:"Polaroid Round", width:76.8, height:76.8, paperWidth:88.5, paperHeight:107.5, top:7, round:true, frames:1 },
  "instant-go": { label:"Polaroid Go", width:46, height:47, paperWidth:53.9, paperHeight:66.6, top:4.2, frames:1 },
  "instant-mini": { label:"instax Mini", width:46, height:62, paperWidth:54, paperHeight:86, top:4, frames:1 },
  "instant-square": { label:"instax Square", width:62, height:62, paperWidth:72, paperHeight:86, top:5, frames:1 },
  "instant-wide": { label:"instax Wide", width:99, height:62, paperWidth:108, paperHeight:86, top:4.5, frames:1 }
};
let catalogFormat;
let catalogQuery;
let stockMatches = [];
const normalizeSearch = text => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const stockSearchNames = stocks.map(preset => normalizeSearch([
  preset.name, preset.imprint, preset.group.includes(" / ") ? "" : preset.group,
  /^fuji/i.test(preset.name) ? "富士" : "",
  /^kodak/i.test(preset.name) ? "柯达" : "",
  /^agfa/i.test(preset.name) ? "爱克发" : "",
  /^lomo/i.test(preset.name) ? "乐魔 洛莫" : "",
  preset.family.toLowerCase().includes("silver") ? "黑白" : preset.family === "slide" ? "反转 正片" : "彩负"
].join(" ")));

function updateCatalog(is135, force = false) {
  const query = stockSearch.value.trim();
  if (!force && catalogFormat === is135 && catalogQuery === query) return;
  const resultsScroll = catalogQuery === query ? stockMatchList.scrollTop : 0;
  const terms = query.normalize("NFKC").replace(/(\p{Script=Han})(?=[a-z0-9])/giu, "$1 ")
    .replace(/([a-z0-9])(?=\p{Script=Han})/giu, "$1 ").split(/\s+/).map(normalizeSearch).filter(Boolean);
  let selected = stock.value || "0";
  if (stocks[Number(selected)]?.only35 && !is135) {
    selected = "0";
    byId("age").value = "0";
  }
  stock.replaceChildren();
  stockMatches = stocks.flatMap((_, index) => terms.every(term => stockSearchNames[index].includes(term)) ? [index] : []);
  const compatibleMatches = stockMatches.filter(index => is135 || !stocks[index].only35);
  if (!compatibleMatches.includes(Number(selected))) {
    const current = document.createElement("optgroup");
    current.label = "当前胶卷";
    current.append(new Option(stocks[Number(selected)].name, selected));
    stock.append(current);
  }
  let group;
  for (const index of compatibleMatches) {
    const preset = stocks[index];
    if (group?.label !== preset.group) {
      group = document.createElement("optgroup");
      group.label = preset.group;
      stock.append(group);
    }
    group.append(new Option(preset.name, index));
  }
  stock.value = selected;
  catalogFormat = is135;
  catalogQuery = query;
  stockResults.hidden = !query;
  stockResults.textContent = stockMatches.length ? stockMatches.length + " 款匹配 · Enter 选第一款" : "没有匹配的胶卷";
  stockMatchList.hidden = !query || !stockMatches.length;
  stockMatchList.replaceChildren();
  if (stockMatchList.hidden) return;
  for (const index of stockMatches) {
    const preset = stocks[index];
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.stock = index;
    button.setAttribute("aria-pressed", String(String(index) === selected));
    const name = document.createElement("span");
    name.textContent = preset.name;
    button.append(name);
    if (preset.only35) {
      const format = document.createElement("small");
      format.textContent = is135 ? "135 专用" : "切换至 135";
      button.append(format);
    }
    item.append(button);
    stockMatchList.append(item);
  }
  stockMatchList.scrollTop = resultsScroll;
}

const leakPalettes = {
  amber: { core: "255,200,117", warm: "255,94,29", fringe: "198,27,8" },
  gold: { core: "255,231,154", warm: "255,181,47", fringe: "224,93,13" },
  rose: { core: "255,197,137", warm: "250,71,129", fringe: "188,27,74" }
};
const initialFrames = { "135": 12, half: 1, xpan: 1, "645": 6, "66": 6, "67": 6, "69": 6,
  "instant-classic":1, "instant-round":1, "instant-go":1, "instant-mini":1, "instant-square":1, "instant-wide":1 };
const frameNumbers = { ...initialFrames };
const clamp = (value, low, high) => Math.max(low, Math.min(value, high));
const pad = (value) => String(value).padStart(2, "0");
let photo;
let photoName;
let importedPhotos = [];
let filmstripBatch;
let importQueue = Promise.resolve();
let activePhoto;
let loadingPhoto = false;
let cropX = 0.5;
let cropY = 0.5;
let gateKey = "135";
let photoRequest = 0;
let pendingRender = 0;
let previewZoom = 100;
let previewFocus;
let wheelTravel = 0;
let lastWheelTime = 0;
let spacingPointer;
let customInk = false;
let paperAsset = {};
let activeFormat = "135";
const formatStates = new Map();
let noticeTimer;
let drag;
let cropMode = false;
const brushEnabled = byId("brush-enabled");
const brushColor = byId("brush-color");
const brushSize = byId("brush-size");
const brushStrokes = byId("brush-strokes");
let cachedBrushValue;
let cachedBrushStrokes = [];

function today() {
  const now = new Date();
  return [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("-");
}

function layout(image = photo) {
  const dimensions = gates[gateKey];
  if (dimensions.paperWidth) {
    const {width, height, paperWidth, paperHeight, top} = dimensions;
    const side = (paperWidth-width)/2;
    const change = Number(paperSpacing.value)/100;
    const cornerClearance = .8 + .29*cornerRadius({canvasW:paperWidth,canvasH:paperHeight});
    const growth = Math.max(0,Math.min(
      2*(side-cornerClearance)/width, 2*(top-cornerClearance)/height,
      2*(paperHeight-top-height-cornerClearance)/height
    ));
    const scale = 1-change*(change < 0 ? growth : .35);
    return {...dimensions, paper:true, perforated:false, canvasW:paperWidth * (byId("paper-duplex").checked ? 2 : 1), canvasH:paperHeight, duplex:byId("paper-duplex").checked,
      picture:{x:(paperWidth-width*scale)/2, y:top+height*(1-scale)/2, w:width*scale, h:height*scale}};
  }
  const orientation = byId("orientation").value;
  const portrait = orientation === "portrait" ||
    (orientation === "auto" && (gateKey === "half" || imageHeight(image) > imageWidth(image)));
  const square = dimensions.width === dimensions.height;
  const rotate = square ? orientation === "portrait" : portrait !== (dimensions.height > dimensions.width);
  const marginX = (dimensions.pitch - dimensions.width) / 2;
  const marginY = (dimensions.roll - dimensions.height) / 2;
  return {
    ...dimensions, rotate, half: gateKey === "half", wide: gateKey === "xpan", perforated: dimensions.roll === 35, marginX, marginY,
    canvasW: rotate ? dimensions.roll : dimensions.pitch,
    canvasH: rotate ? dimensions.pitch : dimensions.roll,
    picture: rotate
      ? { x: marginY, y: marginX, w: dimensions.height, h: dimensions.width }
      : { x: marginX, y: marginY, w: dimensions.width, h: dimensions.height }
  };
}

function currentSource() {
  return {image:photo, x:cropX, y:cropY, zoom:Number(zoom.value)};
}

function cropFor(picture, source = currentSource()) {
  const naturalWidth = imageWidth(source.image);
  const naturalHeight = imageHeight(source.image);
  const scale = Math.max(picture.w / naturalWidth, picture.h / naturalHeight) * source.zoom / 100;
  const w = Math.min(naturalWidth, picture.w / scale);
  const h = Math.min(naturalHeight, picture.h / scale);
  return {
    x: clamp(source.x * naturalWidth - w / 2, 0, naturalWidth - w),
    y: clamp(source.y * naturalHeight - h / 2, 0, naturalHeight - h),
    w, h
  };
}

function pathRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function cornerRadius(geometry) {
  return Math.min(geometry.canvasW, geometry.canvasH) * .095 * Number(outerRadius.value) / 100;
}

function filmTransform(ctx, geometry) {
  if (geometry.rotate) {
    ctx.translate(geometry.roll, 0);
    ctx.rotate(Math.PI / 2);
  }
}

const perforations = Array.from({ length: 14 }, (_, index) => 2.375 + index * 4.75);
const hole = { halfWidth: 1.98 / 2, height: 2.8, fromEdge: 2, radius: 0.5 };
const xpanHoles = perforations.flatMap((x) => [
  { x, y: hole.fromEdge + hole.height / 2 },
  { x, y: 35 - hole.fromEdge - hole.height / 2 }
]);
const holeCenters = xpanHoles.slice(0,16);
const xpanCinemaHoles = xpanHoles.map(({x,y}) => ({x: 33.25+(x-33.25)*4.74/4.75, y}));
const cinemaHoles = holeCenters.map(({x,y}) => ({x: 19+(x-19)*4.74/4.75, y}));
const halfHoles = holeCenters.slice(0, 8);
const halfCinemaHoles = halfHoles.map(({x,y}) => ({x: 9.5+(x-9.5)*4.74/4.75, y}));

function holesFor(preset, geometry) {
  if (geometry.wide) return preset.bh ? xpanCinemaHoles : xpanHoles;
  if (geometry.half) return preset.bh ? halfCinemaHoles : halfHoles;
  return preset.bh ? cinemaHoles : holeCenters;
}

function makeGrain() {
  const tile = document.createElement("canvas");
  tile.width = tile.height = 192;
  const ctx = tile.getContext("2d");
  const pixels = ctx.createImageData(tile.width, tile.height);
  let seed = 1887;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = seed >>> 31 ? 255 : 0;
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = white;
    pixels.data[i + 3] = (seed >>> 24 & 31) * 0.43;
  }
  ctx.putImageData(pixels, 0, 0);
  return tile;
}
const grain = makeGrain();

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Keep the scanner noise finer than the patchy density of the emulsion.
function makeRebateTexture() {
  const canvas = document.createElement("canvas");
  const width = canvas.width = 720;
  const height = canvas.height = 480;
  const ctx = canvas.getContext("2d");
  const texture = ctx.createImageData(width, height);
  const random = seeded(26891);
  const columns = 23;
  const rows = 29;
  const density = Float32Array.from({ length: columns * rows }, () => random() - .5);
  for (let y = 0; y < height; y++) {
    const row = y / height * (rows-1);
    const j = Math.floor(row);
    const ty = row-j;
    for (let x = 0; x < width; x++) {
      const col = x / width * (columns-1);
      const i = Math.floor(col);
      const tx = col-i;
      const a = j*columns+i;
      const upper = density[a]*(1-tx) + density[a+1]*tx;
      const lower = density[a+columns]*(1-tx) + density[a+columns+1]*tx;
      const cloud = upper*(1-ty) + lower*ty;
      const value = cloud*.64 + (random()+random()-1)*.36;
      const index = 4 * (y*width+x);
      texture.data[index] = value > 0 ? 147 : 7;
      texture.data[index+1] = value > 0 ? 126 : 8;
      texture.data[index+2] = value > 0 ? 110 : 10;
      texture.data[index+3] = Math.abs(value)*46;
    }
  }
  ctx.putImageData(texture, 0, 0);
  return canvas;
}
const rebateTexture = makeRebateTexture();

// Model the soft density edge of an exposed mark, keeping the glyph itself continuous.
const printCache = new Map();
const edgeType = {
  kodak: {face:"Arial", spacing:1.25, width:1.08, blur:.24, density:1, spread:.29},
  fuji: {face:"Arial", spacing:.65, width:.90, blur:.28, density:.94, spread:.27},
  cinema: {face:"Consolas", spacing:1.2, width:1, blur:.32, density:.93, spread:.24},
  monochrome: {face:"Arial", spacing:.85, width:.94, blur:.29, density:.92, spread:.23},
  standard: {face:"Arial", spacing:.85, width:1, blur:.28, density:.96, spread:.25}
};

function printEdge(ctx, text, x, y, height, color, style, halo, maxWidth = Infinity) {
  const key = color + ":" + style.face + ":" + style.width + ":" + style.spacing + ":" + text;
  let plate = printCache.get(key);
  if (!plate) {
    const mask = document.createElement("canvas");
    const m = mask.getContext("2d");
    const font = '700 24px ' + style.face + ', "Microsoft YaHei UI", "PingFang SC", sans-serif';
    m.font = font;
    m.letterSpacing = style.spacing + "px";
    const metrics = m.measureText(text);
    const left = Math.max(1, Math.ceil(metrics.actualBoundingBoxLeft) + 1);
    const baseline = Math.max(22, Math.ceil(metrics.actualBoundingBoxAscent) + 2);
    mask.width = left + Math.ceil(Math.max(metrics.width, metrics.actualBoundingBoxRight)) + 1;
    mask.height = baseline + Math.max(2, Math.ceil(metrics.actualBoundingBoxDescent) + 1);
    m.font = font;
    m.letterSpacing = style.spacing + "px";
    m.fillText(text, left, baseline);
    plate = document.createElement("canvas");
    plate.width = mask.width;
    plate.height = mask.height;
    const ink = plate.getContext("2d");
    ink.filter = "blur(" + style.blur + "px)";
    ink.drawImage(mask, 0, 0);
    ink.filter = "none";
    const density = ink.getImageData(0, 0, plate.width, plate.height);
    const source = density.data.slice();
    const random = seeded(1871);
    const rowBytes = plate.width*4;
    for (let i = 3; i < density.data.length; i += 4) {
      const x = ((i-3)/4) % plate.width;
      const nearby = Math.max(
        x > 0 ? source[i-4] : 0,
        x < plate.width-1 ? source[i+4] : 0,
        source[i-rowBytes] ?? 0,
        source[i+rowBytes] ?? 0
      );
      // A small spread rounds the stroke edges while keeping the core dense.
      const alpha = source[i] + Math.max(0, nearby-source[i])*style.spread;
      const fluctuation = .97 + .03*Math.sin(x*.25);
      density.data[i] = alpha * style.density * fluctuation * (.9 + .1*random());
    }
    ink.putImageData(density, 0, 0);
    ink.globalCompositeOperation = "source-in";
    ink.fillStyle = color;
    ink.fillRect(0,0,plate.width,plate.height);
    if (printCache.size >= 192) printCache.delete(printCache.keys().next().value);
    printCache.set(key, plate);
  }
  const naturalWidth = height * plate.width / plate.height * style.width;
  const width = Math.min(maxWidth, naturalWidth);
  const fittedHeight = height * width / naturalWidth;
  ctx.save();
  if (halo) {
    const transform = ctx.getTransform();
    const scale = Math.hypot(transform.a, transform.b);
    ctx.shadowBlur = (.09 + .61*halo) * scale;
    ctx.shadowColor = color + Math.round(180*halo).toString(16).padStart(2, "0");
  }
  ctx.drawImage(plate, x, y - fittedHeight / 2, width, fittedHeight);
  ctx.restore();
}

function negativeAperture(ctx, rect, seed) {
  const {x, y, w, h} = rect;
  const random = seeded(seed);
  const r = Math.min(w,h) * .007;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  function side(ax, ay, bx, by, nx, ny) {
    const count = Math.ceil(Math.hypot(bx-ax, by-ay) * 2);
    let offset = 0;
    const slope = (random()-.5)*.28;
    const bow = (random()-.5)*.20;
    for (let i=1; i<=count; i++) {
      const t = i/count;
      offset = offset*.56 + (random()-.5)*.063;
      const displacement = (offset + bow + slope*t)*Math.sin(Math.PI*t);
      ctx.lineTo(ax+(bx-ax)*t + nx*displacement, ay+(by-ay)*t + ny*displacement);
    }
  }
  side(x+r,y,x+w-r,y,0,1);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  side(x+w,y+r,x+w,y+h-r,1,0);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  side(x+w-r,y+h,x+r,y+h,0,1);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  side(x,y+h-r,x,y+r,1,0);
  ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

function punchPath(ctx, point, bh) {
  const {x, y} = point;
  if (!bh) {
    pathRect(ctx, x-hole.halfWidth, y-hole.height/2, 2*hole.halfWidth, hole.height, hole.radius);
    return;
  }
  // A BH negative punch has flat parallel sides and curved ends when
  // viewed along a horizontally travelling strip.
  ctx.beginPath();
  ctx.moveTo(x-.925,y-.90);
  ctx.bezierCurveTo(x-.64,y-1.57,x+.64,y-1.57,x+.925,y-.90);
  ctx.lineTo(x+.925,y+.90);
  ctx.bezierCurveTo(x+.64,y+1.57,x-.64,y+1.57,x-.925,y+.90);
  ctx.closePath();
}

function scanPerforations(ctx, preset, geometry, backing, frameNumber) {
  const random = seeded(1409 + frameNumber * 127);
  const points = holesFor(preset, geometry);
  for (const point of points) {
    ctx.save();
    ctx.translate(point.x + (random()-.5)*.045, point.y + (random()-.5)*.044);
    ctx.rotate((random()-.5)*.022);
    ctx.scale(.987+random()*.027, .989+random()*.023);
    punchPath(ctx, {x:0, y:0}, preset.bh);
    const rim = ctx.createLinearGradient(-1.1,-1.1,1.05,1.25);
    rim.addColorStop(0,"#84b8a66b");
    rim.addColorStop(.26,"#70968940");
    rim.addColorStop(.48,"#17262420");
    rim.addColorStop(.76,"#24443b49");
    rim.addColorStop(1,"#739e8c77");
    ctx.strokeStyle = rim;
    ctx.lineWidth = .19;
    ctx.stroke();
    ctx.strokeStyle = "#8daea031";
    ctx.lineWidth = .065;
    ctx.stroke();

    ctx.globalCompositeOperation = backing ? "source-over" : "destination-out";
    ctx.strokeStyle = ctx.fillStyle = backing || "#000";
    ctx.globalAlpha = .28;
    ctx.lineWidth = .11;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.restore();
  }
}

function stockInk(preset) {
  if (preset.family.toLowerCase().includes("silver")) return preset.edge;
  if (preset.imprint === "KODAK 5294") return "#d0a0ba";
  if (preset.bh) return "#d49b78";
  return preset.imprint.startsWith("FUJI") ? "#e1a67d" : preset.edge;
}

function drawRebate(ctx, geometry, preset, number, options) {
  const { pitch, roll, marginY, perforated } = geometry;
  const age = (options?.age ?? Number(byId("age").value)) / 100;
  const random = seeded(931 + number * 71 + (options?.stock ?? Number(stock.value)) * 317);
  const strip = ctx.createLinearGradient(0, 0, 0, roll);
  strip.addColorStop(0, "#010203");
  strip.addColorStop(.11, "#020504");
  strip.addColorStop(.42, "#020203");
  strip.addColorStop(.9, "#020403");
  strip.addColorStop(1, "#010102");
  ctx.fillStyle = strip;
  ctx.fillRect(0, 0, pitch, roll);
  const neutral = preset.family.toLowerCase().includes("silver");
  ctx.globalAlpha = .045;
  ctx.fillStyle = preset.base;
  ctx.fillRect(0, 0, pitch, roll);
  ctx.globalAlpha = 1;
  const warm = neutral ? "67,79,82" : "42,79,74";
  for (let i=0; i<18; i++) {
    const x = random()*pitch;
    const y = i%2 ? random()*marginY : roll-random()*marginY;
    glow(ctx, x, y, 2+random()*11, .35+random()*2.5, [
      [0, "rgba("+warm+"," + (.016+age*.08) + ")"], [1, "rgba("+warm+",0)"]
    ]);
  }
  ctx.globalAlpha = .36;
  ctx.drawImage(rebateTexture, 0, 0, pitch, roll);
  ctx.globalAlpha = 1;
  for (let i=0; i<24; i++) {
    const x = random()*pitch;
    const y = i%2 ? random()*marginY : roll-random()*marginY;
    ctx.strokeStyle = "rgba(196,201,192," + (.08 + random()*.18) + ")";
    ctx.lineWidth = .018 + random()*.035;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.quadraticCurveTo(x+.055,y-.035,x+.015+random()*.21,y+random()*.07);
    ctx.stroke();
  }

  const kodak = preset.imprint.startsWith("KODAK");
  const fuji = preset.imprint.startsWith("FUJI");
  const pro400h = preset.imprint === "FUJI PRO400H";
  const type = preset.bh ? edgeType.cinema : fuji ? edgeType.fuji : neutral ? edgeType.monochrome :
    kodak ? edgeType.kodak : edgeType.standard;
  const mid = perforated ? .83 : marginY*.47;
  const size = perforated ? (preset.bh ? 1.49 : 1.67) : 1.78;
  const ink = (options ? options.ink : customInk ? imprintColor.value : null) || stockInk(preset);
  const halo = (options?.halo ?? Number(imprintHalo.value)) / 100;
  const mark = (text, x, y, height, limit) => printEdge(ctx, text, x, y, height, ink, type, halo, limit);
  const customName = options?.name ?? (customImprint.checked ? imprintName.value.trim() : "");
  const upperImprint = customName || (pro400h ? (perforated ? "PRO400H" : "◂ PRO400H") : preset.imprint);
  const offset = (perforated ? (fuji ? 4.2 : 2.5) : 2.1) + random()*.45;
  mark(upperImprint, offset, mid, size, pitch - 5.2 - offset);
  const halfFrame = Math.ceil(number/2) + (number % 2 === 0 ? "A" : "");
  const upperFrame = geometry.half ? halfFrame : !perforated && kodak ? 41 + Math.floor((number-.5)*16/geometry.frames) : number;
  mark(String(upperFrame), pitch-3.55, mid, size*(fuji ? 1 : 1.09), 3.1);
  if (geometry.half) {
    mark(preset.bh ? preset.imprint.slice(-4) : halfFrame, 2.8, roll-mid, size, pitch - 5);
  } else if (perforated) {
    const kodakCode = preset.group === "柯达 Kodak" && !neutral;
    const half = preset.bh ? preset.imprint.slice(-4) : number+"A";
    mark(half, pitch*(fuji ? .47 : .36), roll-mid, size*.87, 4.15);
    mark(String(number), pitch-3.6, roll-mid, size*1.12, 3.1);
    if (pro400h && !customName) mark("FUJI", 2.8, roll-mid, size*.88);
    if (kodakCode || preset.bh) {
      // Stylized edge codes use two tracks with alternating runs of dark and exposed cells.
      ctx.fillStyle = ink;
      const sections = geometry.wide ? [[0, pitch*.343],[pitch*.49, pitch-5.3]] :
        kodakCode ? [[0, 12.9],[18.8, 32.3]] : [[.34, 10.8],[20, 31.2]];
      const unit = kodakCode ? .42 : .27;
      const inset = kodakCode ? 1.57 : 1.07;
      ctx.beginPath();
      for (const [start, end] of sections) {
        for (let x=start; x+unit<end; x+=unit) {
          const width = unit + .027;
          if (random()>.33) ctx.rect(x, roll-inset+random()*.035, width, inset*.55);
          if (random()>.28) ctx.rect(x, roll-inset*.49, width, inset*.49+.05);
        }
      }
      ctx.globalAlpha = .62;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else {
    mark(kodak ? "▸ " + number : String(number), offset+.35, roll-mid, size);
    const lowerImprint = customName || (fuji ? "FUJI" : preset.imprint);
    mark(lowerImprint, pitch*.50, roll-mid+.10, size*.85, pitch*.50 - 1);
  }
}

function glow(ctx, x, y, spreadX, spreadY, stops, rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  ctx.scale(spreadX, spreadY);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const [at, color] of stops) gradient.addColorStop(at, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

function drawLeak(ctx, geometry) {
  const strength = Number(byId("leak").value) / 100;
  if (!strength) return;

  const { canvasW: width, canvasH: height, rotate, roll, perforated } = geometry;
  const side = byId("leak-side").value;
  const customPosition = side === "angle";
  const palette = leakPalettes[byId("leak-tone").value];
  const alpha = (color, opacity) => "rgba(" + color + "," + opacity * strength + ")";
  const vertical = side === "top" || side === "bottom";
  const far = side === "right" || side === "bottom";
  let x = vertical ? width * 0.58 : far ? width * 0.975 : width * 0.025;
  let y = vertical ? far ? height * 0.985 : height * 0.015 : height * 0.45;
  const reach = 0.24 + strength * 0.26;
  let rotation = 0;
  let bandWidth = width * (vertical ? 0.68 : reach);
  let bandHeight = height * (vertical ? reach : 0.67);
  let coreWidth = width * (vertical ? 0.49 : 0.13);
  let coreHeight = height * (vertical ? 0.13 : 0.64);
  let coreOffsetX = 0;
  let coreOffsetY = vertical ? 0 : height * 0.21;
  if (customPosition) {
    rotation = (Number(byId("leak-angle").value) % 360) * Math.PI / 180;
    const dx = Math.sin(rotation);
    const dy = -Math.cos(rotation);
    const edge = 0.97 * Math.min(width / (2 * Math.abs(dx)), height / (2 * Math.abs(dy)));
    const size = Math.min(width, height);
    x = width / 2 + dx * edge;
    y = height / 2 + dy * edge;
    bandWidth = size * 0.68;
    bandHeight = size * reach;
    coreWidth = size * 0.58;
    coreHeight = size * 0.13;
    coreOffsetX = -dy * size * 0.17;
    coreOffsetY = dx * size * 0.17;
  }
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  glow(ctx, x, y, bandWidth, bandHeight, [
    [0, alpha(palette.core, 0.9)], [0.23, alpha(palette.warm, 0.88)],
    [0.55, alpha(palette.fringe, 0.62)], [1, alpha(palette.fringe, 0)]
  ], rotation);
  glow(ctx, x + coreOffsetX, y + coreOffsetY, coreWidth, coreHeight, [
    [0, alpha(palette.core, 0.78)], [0.35, alpha(palette.warm, 0.46)], [1, alpha(palette.warm, 0)]
  ], rotation);

  if (perforated) {
    for (const point of holesFor(stocks[Number(stock.value)], geometry)) {
      const hx = rotate ? roll - point.y : point.x;
      const hy = rotate ? point.x : point.y;
      const distanceX = Math.abs(hx - x) / width;
      const distanceY = Math.abs(hy - y) / height;
      const edgeDistance = customPosition ? Math.hypot(distanceX, distanceY) : vertical ? distanceY : distanceX;
      const influence = Math.max(0, 1 - edgeDistance / 0.43);
      if (!influence) continue;
      const inward = point.y < roll / 2 ? 1.65 : -1.65;
      glow(ctx, hx + (rotate ? -inward : 0), hy + (rotate ? 0 : inward), rotate ? 4.7 : 1.8, rotate ? 1.8 : 4.7, [
        [0, alpha(palette.core, influence * 0.74)],
        [0.44, alpha(palette.warm, influence * 0.31)], [1, alpha(palette.warm, 0)]
      ]);
    }
  }
  ctx.restore();
}

const segments = [
  [0.16, 0.08, 0.54, 0.08], [0.62, 0.15, 0.62, 0.43],
  [0.62, 0.57, 0.62, 0.85], [0.16, 0.92, 0.54, 0.92],
  [0.08, 0.57, 0.08, 0.85], [0.08, 0.15, 0.08, 0.43],
  [0.16, 0.5, 0.54, 0.5]
];
const digitSegments = ["012345", "12", "01643", "01236", "5612", "05623", "056432", "012", "0123456", "012356"];
const dateDots = {
  "0":"111 101 101 101 111", "1":"010 110 010 010 111",
  "2":"111 001 111 100 111", "3":"111 001 111 001 111",
  "4":"101 101 111 001 001", "5":"111 100 111 001 111",
  "6":"111 100 111 101 111", "7":"111 001 010 010 010",
  "8":"111 101 111 101 111", "9":"111 101 111 001 111",
  "-":"000 000 111 000 000", ".":"000 000 000 000 010",
  "/":"001 001 010 100 100"
};

function drawDate(ctx, picture, scale) {
  if (!byId("date-enabled").checked || !date.value || !date.validity.valid) return;
  const [year, month, day] = date.value.split("-");
  const stampParts = { Y: year, y: year.slice(-2), m: month, d: day };
  const format = byId("date-format").value;
  const pattern = /^[ymd]{3}$/.test(format) ? [...format].join(" ") : format;
  const stamp = pattern.replace(/[Yymd]/g, part => stampParts[part]);
  const style = byId("date-style").value;
  const size = Math.min(picture.w, picture.h) * 0.060 * Number(byId("date-size").value) / 100;
  const gap = size * 0.06;
  const advance = (character) => size * (/\d/.test(character) ? .8 : .46);
  const inset = size * 0.92;
  const left = byId("date-position").value === "left";
  const y = picture.y + picture.h - size - inset;

  const color = byId("date-color");
  const originalOrange = color.value === color.defaultValue;
  ctx.save();
  ctx.fillStyle = color.value;
  ctx.strokeStyle = color.value;
  ctx.shadowColor = originalOrange ? "#ff490d" : color.value;
  ctx.shadowBlur = size * scale * (style === "lab" ? .10 : .29);
  if (style === "camera" || style === "lab") {
    ctx.font = style === "camera" ? "700 " + size * 1.23 + "px Arial, sans-serif" :
      "700 " + size * 1.2 + "px 'Courier New', monospace";
    const length = ctx.measureText(stamp).width;
    const x = left ? picture.x + inset : picture.x + picture.w - inset - length;
    ctx.fillText(stamp, x, y + size);
    ctx.restore();
    return;
  }

  const length = [...stamp].reduce((total, character) => total + advance(character), 0) - gap;
  let cursor = left ? picture.x + inset : picture.x + picture.w - inset - length;
  ctx.lineWidth = size * 0.095;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const character of stamp) {
    if (style === "matrix" && dateDots[character]) {
      for (const [row, dots] of dateDots[character].split(" ").entries()) {
        for (let col = 0; col < 3; col++) {
          if (dots[col] !== "1") continue;
          const x = cursor + (.1 + col * .20) * size;
          const dotY = y + (.1 + row * .20) * size;
          const radius = size * .078;
          ctx.moveTo(x + radius, dotY);
          ctx.arc(x, dotY, radius, 0, Math.PI * 2);
        }
      }
    } else if (/\d/.test(character)) {
      for (const segment of digitSegments[Number(character)]) {
        const [x1, y1, x2, y2] = segments[Number(segment)];
        ctx.moveTo(cursor + x1 * size, y + y1 * size);
        ctx.lineTo(cursor + x2 * size, y + y2 * size);
      }
    } else if (character === "-") {
      ctx.moveTo(cursor + .05*size, y + .50*size);
      ctx.lineTo(cursor + .33*size, y + .50*size);
    } else if (character === ".") {
      ctx.moveTo(cursor + .13*size, y + .89*size);
      ctx.lineTo(cursor + .18*size, y + .89*size);
    } else if (character === "/") {
      ctx.moveTo(cursor + .05*size, y + .89*size);
      ctx.lineTo(cursor + .33*size, y + .10*size);
    }
    cursor += advance(character);
  }
  if (style === "matrix") {
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = originalOrange ? "#ffd18d" : `color-mix(in srgb, ${color.value} 85%, white)`;
  ctx.lineWidth = size * 0.042;
  ctx.stroke();
  ctx.restore();
}

function instantAperture(ctx, geometry, inset = 0) {
  const {picture} = geometry;
  if (geometry.round) {
    ctx.beginPath();
    ctx.arc(picture.x + picture.w/2, picture.y + picture.h/2, picture.w/2+inset, 0, Math.PI*2);
  } else {
    pathRect(ctx, picture.x-inset, picture.y-inset, picture.w+2*inset, picture.h+2*inset, .17);
  }
}

function paperPattern(ctx, style, step, color = patternColor.value) {
  const tile = document.createElement("canvas");
  tile.width = tile.height = 96;
  const paint = tile.getContext("2d");
  paint.fillStyle = color;
  if (style === "checker") {
    paint.fillRect(0, 0, 48, 48);
    paint.fillRect(48, 48, 48, 48);
  } else if (style === "stripe") {
    for (const x of [-96, -48, 0, 48]) {
      paint.beginPath();
      paint.moveTo(x,0);
      paint.lineTo(x+22,0);
      paint.lineTo(x+118,96);
      paint.lineTo(x+96,96);
      paint.fill();
    }
  } else if (style === "grid") {
    paint.fillRect(0,0,96,2);
    paint.fillRect(0,0,2,96);
  } else {
    for (const [x,y] of [[24,24],[72,72]]) {
      if (style === "dots") {
        paint.beginPath();
        paint.arc(x,y,9,0,Math.PI*2);
        paint.fill();
      } else if (style === "stars") {
        paint.beginPath();
        for (let point=0; point<10; point++) {
          const angle = Math.PI*point/5-Math.PI/2;
          const radius = point%2 ? 7 : 16;
          paint.lineTo(x+radius*Math.cos(angle),y+radius*Math.sin(angle));
        }
        paint.fill();
      } else if (style === "flowers") {
        for (let petal=0; petal<6; petal++) {
          const angle = Math.PI*petal/3;
          paint.beginPath();
          paint.ellipse(x+11*Math.cos(angle),y+11*Math.sin(angle),8,4.3,angle,0,Math.PI*2);
          paint.fill();
        }
        paint.beginPath();
        paint.arc(x,y,3.3,0,Math.PI*2);
        paint.fill();
      }
    }
  }
  const pattern = ctx.createPattern(tile,"repeat");
  pattern.setTransform(new DOMMatrix().scale(step/96));
  return pattern;
}

function drawInstantPaper(ctx, geometry) {
  const {canvasW, canvasH} = geometry;
  const finish = paperFinish.value;
  ctx.save();
  instantAperture(ctx, geometry);
  ctx.rect(0,0,canvasW,canvasH);
  ctx.clip("evenodd");
  ctx.fillStyle = paperColor.value;
  ctx.fillRect(0, 0, canvasW, canvasH);
  if (finish === "image" && paperAsset.art) {
    const art = paperAsset.art.image;
    const iw = imageWidth(art);
    const ih = imageHeight(art);
    if (byId("paper-image-layout").value === "tile") {
      const pattern = ctx.createPattern(art, "repeat");
      pattern.setTransform(new DOMMatrix().scale(Math.min(canvasW,canvasH)/(3*Math.max(iw,ih))));
      ctx.fillStyle = pattern;
      ctx.fillRect(0,0,canvasW,canvasH);
    } else {
      const fit = Math.max(canvasW/iw, canvasH/ih);
      ctx.drawImage(art, (canvasW-iw*fit)/2, (canvasH-ih*fit)/2, iw*fit, ih*fit);
    }
  } else if (Object.hasOwn(instantStyleColors, finish)) {
    ctx.save();
    drawInstantStyle(ctx, geometry, finish, paperColor.value, patternColor.value);
    ctx.restore();
  } else if (finish !== "solid" && finish !== "image") {
    ctx.fillStyle = paperPattern(ctx, finish, Math.min(canvasW,canvasH)/6);
    ctx.fillRect(0,0,canvasW,canvasH);
  }
  const paper = ctx.createLinearGradient(0, 0, canvasW*.28, canvasH);
  paper.addColorStop(0, "#ffffff04");
  paper.addColorStop(.52, "#00000000");
  paper.addColorStop(1, "#4b3b2420");
  ctx.fillStyle = paper;
  ctx.fillRect(0,0,canvasW,canvasH);
  const texture = ctx.createPattern(grain, "repeat");
  texture.setTransform(new DOMMatrix().scale(.057));
  ctx.globalAlpha = .20;
  ctx.fillStyle = texture;
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.restore();
  instantAperture(ctx, geometry, .14);
  ctx.lineWidth = .26;
  ctx.strokeStyle = "#79726742";
  ctx.stroke();
}

function render(target, geometry, width, height, opaqueHoles = false, source = currentSource()) {
  if (target.width !== width) target.width = width;
  if (target.height !== height) target.height = height;
  const ctx = target.getContext("2d");
  const scale = width / geometry.canvasW;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(scale, 0, 0, height / geometry.canvasH, 0, 0);
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  const radius = cornerRadius(geometry);
  if (radius) {
    if (opaqueHoles) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, geometry.canvasW, geometry.canvasH);
    }
    pathRect(ctx, 0, 0, geometry.canvasW, geometry.canvasH, radius);
    ctx.clip();
  }
  const preset = stocks[Number(stock.value)];
  const age = geometry.paper ? 0 : Number(byId("age").value) / 100;
  const useFilmColor = !geometry.paper && byId("grading").value === "film";
  const exposureSeed = 487 + frameNumbers[gateKey] * 59;
  if (geometry.paper) {
    drawInstantPaper(ctx, {...geometry, canvasW:geometry.paperWidth});
    if (geometry.duplex) drawInstantBack(ctx, geometry);
  } else {
    ctx.save();
    filmTransform(ctx, geometry);
    drawRebate(ctx, geometry, preset, frameNumbers[gateKey]);
    ctx.restore();
  }

  const { picture } = geometry;
  const crop = cropFor(picture, source);
  ctx.save();
  if (geometry.paper) instantAperture(ctx, geometry);
  else negativeAperture(ctx, picture, exposureSeed);
  ctx.clip();
  ctx.fillStyle = "#11100e";
  ctx.fillRect(picture.x, picture.y, picture.w, picture.h);
  ctx.filter = [
    useFilmColor ? preset.filter : "",
    age ? "contrast(" + (1-age*.22) + ") saturate(" + (1-age*.26) + ")" : ""
  ].filter(Boolean).join(" ") || "none";
  ctx.drawImage(source.image, crop.x, crop.y, crop.w, crop.h, picture.x, picture.y, picture.w, picture.h);
  for (const layer of exposureLayers) drawExposureLayer(ctx, picture, layer);
  ctx.filter = "none";
  if (age) {
    const neutral = preset.family.toLowerCase().includes("silver");
    const fog = neutral ? "177,177,177" : preset.family === "fuji" ? "156,179,119" : "198,138,116";
    ctx.fillStyle = "rgba("+fog+"," + age*.14 + ")";
    ctx.fillRect(picture.x,picture.y,picture.w,picture.h);
    glow(ctx, picture.x+picture.w*.24, picture.y+picture.h*.98, picture.w*.88, picture.h*.78, [
      [0,"rgba("+fog+"," + age*.27 + ")"], [1,"rgba("+fog+",0)"]
    ]);
  }
  if (useFilmColor || age) {
    const iso = preset.iso ?? Number(preset.name.match(/\b(50|80|100|125|160|200|250|400|500|800|3200)(?=[DT\s]|$)/)?.[1] || 250);
    const sensitivity = Math.max(0, Math.log2(iso / 50));
    const texture = ctx.createPattern(grain, "repeat");
    texture.setTransform(new DOMMatrix().translate(exposureSeed*.1,0).scale(.027+.008*sensitivity+.045*age));
    ctx.fillStyle = texture;
    ctx.globalAlpha = Math.min(1, .12 + sensitivity*.09 + .55*age);
    ctx.fillRect(picture.x,picture.y,picture.w,picture.h);
    ctx.globalAlpha = 1;
  }
  // A slight fall-off at the film gate softens the boundary of the exposure.
  ctx.strokeStyle = "#1e191629";
  ctx.lineWidth = .23;
  ctx.stroke();
  ctx.strokeStyle = "#16131565";
  ctx.lineWidth = .095;
  ctx.stroke();
  ctx.restore();
  if (!geometry.paper) drawLeak(ctx, geometry);
  drawDate(ctx, picture, scale);
  drawBrushStrokes(ctx, geometry, exposureSeed, target === film ? drag?.stroke : null);
  if (byId("caption-enabled").checked) {
    drawCaption(ctx, byId("caption-text").value, picture,
      byId("caption-color").value, "top", true, "caption-position");
  }
  if (geometry.paper) {
    const bottom = picture.y + picture.h;
    drawCaption(ctx, byId("paper-front-text").value, {
      x:geometry.paperWidth * .07, y:bottom, w:geometry.paperWidth * .86,
      h:geometry.canvasH - bottom
    }, byId("paper-caption-color").value, "middle", false, "paper-front-position");
  }

  if (geometry.perforated) {
    ctx.save();
    filmTransform(ctx, geometry);
    const backing = opaqueHoles ? backingColors[byId("backing").value] : null;
    scanPerforations(ctx, preset, geometry, backing, frameNumbers[gateKey]);
    ctx.restore();
  }
  ctx.restore();
}

function preview() {
  pendingRender = 0;
  if (!photo) return;
  const last = restoredPreview;
  const geometry = last ? {canvasW:last.image.width, canvasH:last.image.height,
    picture:{x:0, y:0, w:last.image.width, h:last.image.height}} : layout();
  const padding = stage.clientWidth < 500 ? 46 : 80;
  const compare = byId("compare-enabled").checked;
  const split = compare && byId("compare-mode").value === "split";
  const fit = Math.min((stage.clientWidth - padding) / geometry.canvasW / (compare && !split ? 2 : 1), (stage.clientHeight - padding) / geometry.canvasH);
  const scale = fit * previewZoom / 100;
  const width = Math.max(1, Math.round(geometry.canvasW * scale));
  const height = Math.max(1, Math.round(geometry.canvasH * scale));
  film.style.width = width + "px";
  film.style.height = height + "px";
  carrier.style.borderRadius = (last ? 0 : cornerRadius(geometry)*scale) + "px";
  const dpr = Math.min(window.devicePixelRatio || 1, 2, 3000 / Math.max(width, height));
  captionHitBoxes = [];
  try {
    if (last) {
      film.width = Math.round(width * dpr);
      film.height = Math.round(height * dpr);
      film.getContext("2d").drawImage(last.image, 0, 0, film.width, film.height);
    } else {
      render(film, geometry, Math.round(width * dpr), Math.round(height * dpr));
    }
  } finally {
    previewCaptionHitBoxes = captionHitBoxes;
    captionHitBoxes = null;
  }
  drawCaptionControls(geometry, width);
  if (cropMode && !last) drawCropGuide(geometry, width);
  drawComparison(geometry, width, height, compare, split);
  updateHistogram(geometry);
  if (previewFocus) {
    const view = scanViewport.getBoundingClientRect();
    const image = carrier.getBoundingClientRect();
    scanViewport.scrollLeft += image.left - view.left + previewFocus.x*image.width - previewFocus.offsetX;
    scanViewport.scrollTop += image.top - view.top + previewFocus.y*height - previewFocus.offsetY;
    previewFocus = null;
  }
  byId("preview-format").textContent = last ? "上次预览" : geometry.paper
    ? geometry.label + " / " + geometry.canvasW + " × " + geometry.canvasH + " MM"
    : (geometry.wide ? "135 XPan" : geometry.half ? "135 半格" : geometry.perforated ? "135" : "120") + " / " +
      (geometry.rotate ? geometry.height : geometry.width) + " × " + (geometry.rotate ? geometry.width : geometry.height) + " MM";
}

function updateHistogram(geometry) {
  const {picture} = geometry;
  const width = histogramSample.width;
  const height = histogramSample.height;
  const sx = film.width/geometry.canvasW;
  const sy = film.height/geometry.canvasH;
  histogramPixels.drawImage(film,picture.x*sx,picture.y*sy,picture.w*sx,picture.h*sy,0,0,width,height);
  const pixels = histogramPixels.getImageData(0,0,width,height).data;
  const channels = Array.from({length:3}, () => new Uint32Array(64));
  let peak = 1;
  for (let i=0;i<pixels.length;i+=4) {
    if (geometry.round) {
      const x = ((i/4)%width+.5)/width-.5;
      const y = (Math.floor(i/4/width)+.5)/height-.5;
      if (x*x+y*y > .24) continue;
    }
    for (let c=0;c<3;c++) peak = Math.max(peak, ++channels[c][pixels[i+c] >> 2]);
  }
  const ctx = histogram.getContext("2d");
  const w = histogram.width;
  const h = histogram.height;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle = "#9ca0a431";
  ctx.lineWidth = 2;
  for (const x of [w*.25,w*.5,w*.75]) {
    ctx.beginPath();
    ctx.moveTo(x,0);
    ctx.lineTo(x,h);
    ctx.stroke();
  }
  const colors = ["#e27678","#80c89a","#77a6ed"];
  for (const [channel,counts] of channels.entries()) {
    ctx.beginPath();
    ctx.moveTo(0,h);
    for (const [i,count] of counts.entries()) {
      ctx.lineTo(i*w/(counts.length-1), h-2-Math.sqrt(count/peak)*(h-8));
    }
    ctx.strokeStyle = colors[channel];
    ctx.stroke();
    ctx.lineTo(w,h);
    ctx.closePath();
    ctx.fillStyle = colors[channel]+"32";
    ctx.fill();
  }
}

function queuePreview() {
  if (!pendingRender) pendingRender = requestAnimationFrame(preview);
}

function setPreviewZoom(percent, pointer) {
  const next = clamp(percent, 50, 300);
  if (next === previewZoom) return;
  const view = scanViewport.getBoundingClientRect();
  const image = carrier.getBoundingClientRect();
  const offsetX = pointer ? pointer.clientX - view.left : scanViewport.clientWidth/2;
  const offsetY = pointer ? pointer.clientY - view.top : scanViewport.clientHeight/2;
  const center = (!pointer && next === 100) || !image.width;
  previewFocus = {
    x: center ? .5 : clamp((view.left + offsetX - image.left)/image.width, 0, 1),
    y: center ? .5 : clamp((view.top + offsetY - image.top)/image.height, 0, 1),
    offsetX, offsetY
  };
  previewZoom = next;
  scheduleHistory();
  byId("preview-zoom-fit").textContent = previewZoom + "%";
  byId("preview-zoom-out").disabled = previewZoom === 50;
  byId("preview-zoom-in").disabled = previewZoom === 300;
  queuePreview();
}

byId("preview-zoom-out").addEventListener("click", () => setPreviewZoom(previewZoom - 25));
byId("preview-zoom-in").addEventListener("click", () => setPreviewZoom(previewZoom + 25));
byId("preview-zoom-fit").addEventListener("click", () => setPreviewZoom(100));
scanViewport.addEventListener("wheel", event => {
  if (!photo || event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX) || !event.deltaY) return;
  event.preventDefault();
  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 :
    event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? scanViewport.clientHeight : 1;
  const travel = event.deltaY*unit;
  if (event.timeStamp-lastWheelTime > 180 || Math.sign(travel) !== Math.sign(wheelTravel)) wheelTravel = 0;
  lastWheelTime = event.timeStamp;
  wheelTravel += travel;
  const steps = Math.trunc(wheelTravel/48);
  if (!steps) return;
  wheelTravel -= steps*48;
  setPreviewZoom(previewZoom - clamp(steps,-3,3)*10, event);
}, {passive:false});

function updateControls() {
  updateBrushControls();
  if (!restoringSession && !loadingPhoto) restoredPreview = null;
  byId("preset-delete").disabled = !byId("preset-select").value;
  const format = settings.elements["film-format"].value;
  const is135 = format === "135";
  const isPaper = format === "instant";
  if (!isPaper) updateCatalog(is135);
  byId("instant-captions").hidden = !isPaper;
  for (const prefix of ["caption", "paper-front", "paper-back"]) {
    for (const [setting, unit] of [["angle", "°"], ["density", "%"]]) {
      const id = prefix + "-" + setting;
      const slider = byId(id);
      setDetentMark(slider);
      setRangeFill(slider);
      byId(id + "-value").value = slider.value + unit;
    }
  }
  byId("date-size-value").value = byId("date-size").value + "%";
  refreshExposure();
  showExposureLayers();
  persistSession();
  byId("film-options").hidden = isPaper;
  byId("paper-field").hidden = !isPaper;
  byId("paper-options").hidden = !isPaper;
  const finish = paperFinish.value;
  const spacing = Number(paperSpacing.value);
  byId("paper-spacing-value").value = spacing === 0 ? "标准" :
    (spacing < 0 ? "收窄 " : "加宽 ") + Math.abs(spacing) + "%";
  paperSpacingCenter.setAttribute("aria-pressed", String(spacing === 0));
  paperSpacing.style.setProperty("--fill",(spacing+100)/2 + "%");
  byId("pattern-color-field").hidden = finish === "solid" || finish === "image";
  if (byId("pattern-color-field").hidden) paperSwatchTarget = paperColor;
  updatePaperSwatchTarget();
  byId("paper-image-field").hidden = finish !== "image";
  byId("paper-image-clear").hidden = !paperAsset.art && !paperAsset.loading;
  byId("paper-image-name").textContent = paperAsset.loading ? "正在读取图片…" : paperAsset.art?.name || "尚未选择边框图片";
  byId("leak-section").hidden = isPaper;
  byId("outer-radius-value").value = Number(outerRadius.value) ? outerRadius.value + "%" : "直角";
  outerRadius.style.setProperty("--fill", outerRadius.value + "%");
  byId("imprint-halo-value").value = imprintHalo.value + "%";
  imprintHalo.style.setProperty("--fill", imprintHalo.value + "%");
  if (!customInk) imprintColor.value = stockInk(stocks[Number(stock.value)]);
  resetImprintColor.disabled = !customInk;
  byId("imprint-field").hidden = !customImprint.checked;
  imprintName.disabled = !customImprint.checked;
  byId("backing").disabled = !is135;
  carrier.style.background = isPaper ? "transparent" : backingColors[byId("backing").value];
  const age = byId("age").value;
  byId("age-value").value = Number(age) ? age + "%" : "新卷";
  byId("age").style.setProperty("--fill", age + "%");
  const nextGate = isPaper ? paperSize.value : is135 ? gate135.value : gate.value;
  if (nextGate !== gateKey) {
    gateKey = nextGate;
    frame.value = frameNumbers[gateKey];
  }
  byId("gate-field").hidden = is135;
  gate135.closest(".field").hidden = !is135;
  byId("leak-label").textContent = is135 ? "片孔漏光" : "片边漏光";
  frame.max = gates[gateKey].frames;
  byId("frame-prev").disabled = frameNumbers[gateKey] <= 1;
  byId("frame-next").disabled = frameNumbers[gateKey] >= Number(frame.max);
  byId("date-fields").disabled = !byId("date-enabled").checked;
  const intensity = byId("leak").value;
  byId("leak-value").value = intensity + "%";
  byId("leak").style.setProperty("--fill", intensity + "%");
  const leakAngle = byId("leak-angle");
  byId("leak-angle-field").hidden = byId("leak-side").value !== "angle";
  byId("leak-angle-value").value = leakAngle.value + "°";
  setDetentMark(leakAngle);
  setRangeFill(leakAngle);
  byId("zoom-value").value = zoom.value + "%";
  zoom.style.setProperty("--fill", (zoom.value - 100) / 1.5 + "%");
  queuePreview();
}

function resetCrop() {
  cropX = cropY = 0.5;
  zoom.value = 100;
}

function setFrame(value) {
  frameNumbers[gateKey] = clamp(Math.trunc(value), 1, Number(frame.max));
}

settings.addEventListener("submit", (event) => event.preventDefault());
settings.addEventListener("input", (event) => {
  if (event.target.name === "film-format") {
    switchFormat(settings.elements["film-format"].value, true);
    updateControls();
    return;
  }
  if (event.target === stockSearch) {
    persistSession();
    updateCatalog(settings.elements["film-format"].value === "135");
    return;
  }
  if (event.target.id !== "preset-select") byId("preset-select").value = "";
  if (event.target === paperFinish && Object.hasOwn(instantStyleColors, paperFinish.value)) {
    [paperColor.value, patternColor.value] = instantStyleColors[paperFinish.value];
  }
  if (event.target === imprintColor) customInk = true;
  if (event.target === stock) {
    byId("age").value = stocks[Number(stock.value)].expired ?? 0;
    if (catalogQuery) updateCatalog(catalogFormat, true);
  }
  if (event.target === frame && Number.isFinite(frame.valueAsNumber)) setFrame(frame.valueAsNumber);
  updateControls();
});
paperSpacingCenter.addEventListener("click", () => {
  if (paperSpacing.value === "0") return;
  paperSpacing.value = "0";
  paperSpacing.dispatchEvent(new Event("input",{bubbles:true}));
});
paperSpacing.addEventListener("pointerdown", event => {
  if (event.isPrimary && event.button === 0) spacingPointer = event.pointerId;
});
for (const type of ["pointerup","pointercancel"]) {
  window.addEventListener(type,event => {
    if (event.pointerId === spacingPointer) spacingPointer = undefined;
  });
}
paperSpacing.addEventListener("input", event => {
  if (event.isTrusted && spacingPointer !== undefined && Math.abs(Number(paperSpacing.value)) <= 6) {
    paperSpacing.value = "0";
  }
});
function updatePaperSwatchTarget() {
  for (const input of [paperColor, patternColor]) {
    const button = byId(input.id + "-target");
    button.style.setProperty("--swatch", input.value);
    button.setAttribute("aria-pressed", String(paperSwatchTarget === input));
  }
  byId("paper-swatch-target").textContent =
    "色板应用到" + (paperSwatchTarget === paperColor ? "边框颜色" : "图案颜色");
  for (const swatch of paperSwatchGrid.children) {
    swatch.setAttribute("aria-pressed", String(swatch.dataset.color === paperSwatchTarget.value));
  }
}

for (const input of [paperColor, patternColor]) {
  const button = byId(input.id + "-target");
  const select = () => {
    paperSwatchTarget = input;
    updatePaperSwatchTarget();
  };
  const openPicker = () => {
    select();
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch {}
    input.click();
  };
  button.addEventListener("click", select);
  button.addEventListener("dblclick", openPicker);
  button.addEventListener("keydown", event => {
    if (event.key !== "F4" && !(event.altKey && event.key === "ArrowDown")) return;
    event.preventDefault();
    openPicker();
  });
}

for (const [name,color] of paperSwatches) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "paper-swatch";
  button.dataset.color = color;
  button.style.setProperty("--swatch",color);
  const swatch = document.createElement("span");
  swatch.setAttribute("aria-hidden","true");
  button.append(swatch,name);
  button.addEventListener("click", () => {
    paperSwatchTarget.value = color;
    paperSwatchTarget.dispatchEvent(new Event("input",{bubbles:true}));
  });
  paperSwatchGrid.append(button);
}
function selectStockMatch(index) {
  if (stocks[index].only35 && catalogFormat !== true) {
    switchFormat("135", true);
  }
  stock.value = String(index);
  stock.dispatchEvent(new Event("input", {bubbles:true}));
  stock.focus();
}

stockMatchList.addEventListener("click", event => {
  const button = event.target.closest("button[data-stock]");
  if (button) selectStockMatch(Number(button.dataset.stock));
});
stockSearch.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.isComposing || !stockSearch.value.trim()) return;
  event.preventDefault();
  if (stockMatches.length) selectStockMatch(stockMatches[0]);
});
resetImprintColor.addEventListener("click", () => {
  customInk = false;
  byId("preset-select").value = "";
  updateControls();
});
frame.addEventListener("change", () => {
  frame.value = frameNumbers[gateKey];
  updateControls();
});
for (const [id, delta] of [["frame-prev", -1], ["frame-next", 1]]) {
  byId(id).addEventListener("click", () => {
    byId("preset-select").value = "";
    setFrame(frameNumbers[gateKey] + delta);
    frame.value = frameNumbers[gateKey];
    updateControls();
  });
}
zoom.addEventListener("input", updateControls);
byId("crop-reset").addEventListener("click", () => {
  resetCrop();
  updateControls();
});
byId("reset-settings").addEventListener("click", () => {
  restoreFormatControls(defaultFormatState);
  exposureLayers = [];
  const keys = formatGates[activeFormat];
  for (const key of keys) frameNumbers[key] = initialFrames[key];
  if (activeFormat === "135") gate135.value = "135";
  else if (activeFormat === "120") gate.value = "66";
  else {
    paperSize.value = "instant-classic";
    for (const [id,value] of Object.entries(defaultPaperFields)) byId(id).value = value;
    clearPaperArt();
    byId("paper-duplex").checked = false;
  }
  updateControls();
  frame.value = frameNumbers[gateKey];
  notice("已重置" + (activeFormat === "instant" ? "拍立得" : " " + activeFormat) + "设置");
});

const sharedFields = ["backing", "grading", "age", "orientation", "imprint-name", "imprint-halo", "outer-radius",
  "date-size", "caption-text", "caption-font", "caption-size", "caption-color",
  "caption-position", "caption-angle", "caption-density", "brush-color", "brush-size", "brush-strokes",
  "leak", "leak-side", "leak-tone", "leak-angle", "date", "date-format", "date-position", "date-color", "date-style"];
const defaultPaperFields = {"paper-finish":"solid", "paper-color":paperColor.defaultValue,
  "pattern-color":patternColor.defaultValue, "paper-image-layout":"cover", "paper-spacing":"0", "paper-front-text":"", "paper-back-text":"", "paper-caption-color":"#292729", "paper-back-position":"", "paper-back-font":"sans-serif", "paper-back-size":"5", "paper-back-color":"#f2eee7", "paper-front-position":"",
  "paper-front-angle":"0", "paper-back-angle":"0", "paper-front-density":"84", "paper-back-density":"84"};
const presetFields = [...sharedFields.filter(id => id !== "brush-strokes"), ...Object.keys(defaultPaperFields)];
const formatGates = {
  "135":["135","half","xpan"], "120":["645","66","67","69"],
  instant:Object.keys(gates).filter(key => gates[key].paperWidth)
};
const presetSelect = byId("preset-select");
const presetDialog = byId("preset-dialog");
const defaultFormatState = {
  fields:Object.fromEntries(sharedFields.map(id => [id,id === "date" ? today() : byId(id).value])),
  stock:"0", ink:null, customImprint:false, dateEnabled:false, captionEnabled:false, preset:""
};

function captureFormatControls() {
  return {
    fields:Object.fromEntries(sharedFields.map(id => [id,byId(id).value])),
    stock:stock.value, ink:customInk ? imprintColor.value : null, customImprint:customImprint.checked,
    dateEnabled:byId("date-enabled").checked, captionEnabled:byId("caption-enabled").checked, preset:presetSelect.value
  };
}

function restoreFormatControls(state, search = "") {
  stockSearch.value = "";
  updateCatalog(activeFormat !== "120");
  stock.value = state.stock;
  if (!stock.value) stock.value = "0";
  for (const id of sharedFields) byId(id).value = state.fields[id] ?? defaultFormatState.fields[id];
  customInk = Boolean(state.ink);
  if (customInk) imprintColor.value = state.ink;
  customImprint.checked = state.customImprint;
  byId("date-enabled").checked = state.dateEnabled;
  byId("caption-enabled").checked = Boolean(state.captionEnabled);
  presetSelect.value = state.preset;
  if (presetSelect.selectedIndex < 0) presetSelect.value = "";
  stockSearch.value = search;
  if (search) updateCatalog(activeFormat !== "120");
}

function switchFormat(next, keepSearch = false) {
  if (next === activeFormat) return;
  formatStates.set(activeFormat, captureFormatControls());
  activeFormat = next;
  settings.elements["film-format"].value = next;
  restoreFormatControls(formatStates.get(next) || defaultFormatState, keepSearch ? stockSearch.value : "");
}

const gateControls = [gate135, gate, paperSize];
const paperFields = Object.keys(defaultPaperFields);

function capturePhotoSettings() {
  return {
    format:activeFormat, gateKey, controls:captureFormatControls(), search:stockSearch.value,
    gates:gateControls.map(control => control.value), frames:{...frameNumbers},
    formats:new Map(formatStates), paper:Object.fromEntries(paperFields.map(id => [id,byId(id).value])), paperAsset, exposures:exposureLayers.map(layer => ({...layer})), duplex:byId("paper-duplex").checked
  };
}

function restorePhotoSettings(state) {
  activeFormat = state.format;
  settings.elements["film-format"].value = state.format;
  gateKey = state.gateKey;
  gateControls.forEach((control, index) => { control.value = state.gates[index]; });
  Object.assign(frameNumbers, state.frames);
  frame.value = frameNumbers[gateKey];
  formatStates.clear();
  for (const [format, value] of state.formats) formatStates.set(format, value);
  restoreFormatControls(state.controls, state.search);
  for (const id of paperFields) byId(id).value = state.paper[id] ?? defaultPaperFields[id];
  paperAsset = state.paperAsset;
  exposureLayers = (state.exposures ?? legacyExposure(state.controls.fields)).map(layer => ({...layer}));
  byId("paper-duplex").checked = Boolean(state.duplex);
}
function validPreset(item) {
  return typeof item?.name === "string" && item.name.trim() && Object.hasOwn(gates, item.gate);
}

let savedPresets = [];
byId("preset-export").disabled = true;

byId("preset-export").addEventListener("click", () => {
  download(new Blob([JSON.stringify(savedPresets)], {type:"application/json"}), "片边_预设备份.json");
});
byId("preset-import").addEventListener("click", () => byId("preset-file").click());
byId("preset-file").addEventListener("change", async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    if (!Array.isArray(backup) || !backup.every(validPreset)) throw new Error();
    const names = new Set(savedPresets.map(item => item.name));
    const added = backup.filter(item => {
      if (names.has(item.name)) return false;
      names.add(item.name);
      return true;
    });
    if (!added.length) {
      notice("备份里没有新的预设。");
      return;
    }
    const combined = [...savedPresets, ...added];
    savedPresets = combined;
    scheduleHistory();
    for (const item of added) presetSelect.add(new Option(item.name, item.name));
    byId("preset-export").disabled = false;
    notice("已导入 " + added.length + " 个预设。");
  } catch {
    notice("无法导入预设备份，请检查文件与浏览器存储。");
  }
});

presetSelect.addEventListener("change", () => {
  byId("preset-delete").disabled = !presetSelect.value;
  const item = savedPresets.find(entry => entry.name === presetSelect.value);
  if (!item) return;
  const is135 = formatGates["135"].includes(item.gate);
  const isPaper = Boolean(gates[item.gate].paperWidth);
  switchFormat(isPaper ? "instant" : is135 ? "135" : "120");
  presetSelect.value = item.name;
  (isPaper ? paperSize : is135 ? gate135 : gate).value = item.gate;
  stockSearch.value = "";
  imprintHalo.value = "0";
  outerRadius.value = "0";
  byId("leak-angle").value = byId("leak-angle").defaultValue;
  byId("date-color").value = byId("date-color").defaultValue;
  byId("date-style").selectedIndex = 0;
  if (isPaper) {
    for (const [id,value] of Object.entries(defaultPaperFields)) byId(id).value = value;
    clearPaperArt();
  }
  updateCatalog(isPaper || is135);
  const stockIndex = stocks.findIndex(preset => preset.name === item.stock);
  stock.value = String(stockIndex);
  if (!stock.value) stock.value = "0";
  for (const id of presetFields) {
    if (typeof item.fields?.[id] !== "string") continue;
    const control = byId(id);
    const old = control.value;
    control.value = item.fields[id];
    if (control.tagName === "SELECT" && !control.value) control.value = old;
  }
  customImprint.checked = Boolean(item.customImprint);
  customInk = /^#[0-9a-f]{6}$/i.test(item.ink);
  if (customInk) imprintColor.value = item.ink;
  byId("date-enabled").checked = Boolean(item.dateEnabled);
  byId("caption-enabled").checked = Boolean(item.captionEnabled);
  byId("paper-duplex").checked = isPaper && Boolean(item.duplex);
  frameNumbers[item.gate] = clamp(Math.trunc(Number(item.frame) || 1), 1, gates[item.gate].frames);
  frame.value = frameNumbers[item.gate];
  updateControls();
  if (isPaper && paperFinish.value === "image" && typeof item.paperArt?.src === "string" &&
      /^data:image\/(webp|png);base64,/.test(item.paperArt.src)) {
    loadPaperArt(item.paperArt.name || "预设边框图片", async () => {
      const image = new Image();
      image.src = item.paperArt.src;
      await image.decode();
      return image;
    });
  }
  notice("已应用预设「" + item.name + "」");
});

byId("preset-save").addEventListener("click", () => {
  if (layout().paper && paperAsset.loading) {
    notice("正在读取边框图片，请稍候。");
    return;
  }
  if (byId("date-enabled").checked && !date.reportValidity()) return;
  byId("preset-name").value = "";
  byId("preset-status").textContent = "";
  presetDialog.showModal();
});
byId("preset-cancel").addEventListener("click", () => presetDialog.close());
byId("preset-form").addEventListener("submit", event => {
  event.preventDefault();
  const name = byId("preset-name").value.trim();
  const status = byId("preset-status");
  if (!name || savedPresets.some(item => item.name === name)) {
    status.textContent = name ? "已有同名预设，请换个名字。" : "请输入预设名称。";
    return;
  }
  const item = {
    name, gate:gateKey, stock:stocks[Number(stock.value)].name, frame:frameNumbers[gateKey],
    fields:Object.fromEntries(presetFields.map(id => [id, byId(id).value])),
    ink:customInk ? imprintColor.value : null,
    customImprint:customImprint.checked, dateEnabled:byId("date-enabled").checked,
    captionEnabled:byId("caption-enabled").checked, duplex:byId("paper-duplex").checked
  };
  try {
    if (layout().paper && paperFinish.value === "image" && paperAsset.art) {
      item.paperArt = {name:paperAsset.art.name, src:paperArtForPreset(paperAsset.art.image)};
    }
  } catch {
    status.textContent = "无法读取预设用的边框图片。";
    return;
  }
  savedPresets.push(item);
  scheduleHistory();
  presetSelect.add(new Option(name, name, false, true));
  byId("preset-delete").disabled = false;
  byId("preset-export").disabled = false;
  presetDialog.close();
  notice("已保存预设「" + name + "」");
});

byId("preset-delete").addEventListener("click", () => {
  const name = presetSelect.value;
  if (!name || !confirm("删除自定义预设「" + name + "」？")) return;
  const remaining = savedPresets.filter(item => item.name !== name);
  savedPresets = remaining;
  scheduleHistory();
  byId("preset-export").disabled = !remaining.length;
  presetSelect.remove(presetSelect.selectedIndex);
  presetSelect.value = "";
  byId("preset-delete").disabled = true;
  for (const state of formatStates.values()) {
    if (state.preset === name) state.preset = "";
  }
  notice("已删除预设「" + name + "」");
});

function readBrushStrokes() {
  const value = brushStrokes.value;
  if (cachedBrushValue !== value) {
    cachedBrushValue = value;
    cachedBrushStrokes = value ? JSON.parse(value) : [];
  }
  return cachedBrushStrokes;
}

function updateBrushControls() {
  brushEnabled.disabled = !photo;
  film.classList.toggle("brush-mode", Boolean(photo && brushEnabled.checked));
  byId("brush-size-value").value = brushSize.value;
  setRangeFill(brushSize);
  byId("brush-clear").disabled = !brushStrokes.value;
}

function stopBrush() {
  brushEnabled.checked = false;
  film.classList.remove("brush-mode");
}

brushEnabled.addEventListener("input", () => {
  if (brushEnabled.checked) {
    setCropMode(false);
    selectedCaption = null;
  }
});
byId("brush-clear").addEventListener("click", () => {
  brushStrokes.value = "";
  brushStrokes.dispatchEvent(new Event("input", {bubbles:true}));
});

function addBrushPoint(event, stroke) {
  const geometry = layout();
  const point = captionPoint(event);
  const x = Math.round(clamp(point.x/geometry.canvasW, -1, 2) * 10000);
  const y = Math.round(clamp(point.y/geometry.canvasH, -1, 2) * 10000);
  const points = stroke.points;
  if (points.length && Math.hypot(x-points.at(-2), y-points.at(-1)) < 8) return;
  points.push(x, y);
}

function drawBrushStrokes(ctx, geometry, seed, draft) {
  const strokes = readBrushStrokes();
  if (!strokes.length && !draft) return;
  const p = geometry.picture;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of draft ? [...strokes, draft] : strokes) {
    const {color, size, points} = stroke;
    if (points.length < 2) continue;
    ctx.save();
    if (stroke.space !== "canvas") {
      if (geometry.paper) instantAperture(ctx, geometry);
      else negativeAperture(ctx, p, seed);
      ctx.clip();
      ctx.translate(p.x, p.y);
    }
    const sx = (stroke.space === "canvas" ? geometry.canvasW : p.w) / 10000;
    const sy = (stroke.space === "canvas" ? geometry.canvasH : p.h) / 10000;
    ctx.lineWidth = size * Math.min(p.w, p.h) / 1000;
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.beginPath();
    if (points.length === 2) {
      ctx.arc(points[0]*sx, points[1]*sy, ctx.lineWidth/2, 0, 2*Math.PI);
      ctx.fill();
    } else {
      ctx.moveTo(points[0]*sx, points[1]*sy);
      for (let i = 2; i < points.length-2; i += 2) {
        ctx.quadraticCurveTo(points[i]*sx, points[i+1]*sy,
          (points[i]+points[i+2])*sx/2, (points[i+1]+points[i+3])*sy/2);
      }
      ctx.lineTo(points.at(-2)*sx, points.at(-1)*sy);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function setCropMode(on) {
  if (cropMode === on) return;
  cropMode = on;
  byId("crop-mode-hint").hidden = !on;
  film.classList.toggle("crop-mode", on);
  if (on) {
    selectedCaption = null;
    film.classList.remove("caption-grab");
    film.focus({preventScroll:true});
  }
  queuePreview();
}

function overPreviewPicture(event, geometry) {
  if (event.target !== film) return false;
  const {x,y} = captionPoint(event);
  const p = geometry.picture;
  if (geometry.round) {
    return Math.hypot((x-p.x)/p.w-.5, (y-p.y)/p.h-.5) <= .5;
  }
  return x >= p.x && x <= p.x+p.w && y >= p.y && y <= p.y+p.h;
}

function drawCropGuide(geometry, displayWidth) {
  const ctx = film.getContext("2d");
  const unit = geometry.canvasW / displayWidth;
  ctx.save();
  ctx.setTransform(film.width / geometry.canvasW, 0, 0, film.height / geometry.canvasH, 0, 0);
  if (geometry.paper) instantAperture(ctx, geometry);
  else negativeAperture(ctx, geometry.picture, 487 + frameNumbers[gateKey] * 59);
  ctx.lineWidth = unit * 2.5;
  ctx.strokeStyle = "#080c0bd4";
  ctx.stroke();
  ctx.setLineDash([5 * unit, 4 * unit]);
  ctx.strokeStyle = "#91fff0";
  ctx.lineWidth = unit * 1.35;
  ctx.stroke();
  ctx.restore();
}

stage.addEventListener("pointerdown", event => {
  if (cropMode && photo && event.isPrimary && event.button === 0 &&
      !overPreviewPicture(event, layout())) setCropMode(false);
}, true);

film.addEventListener("dblclick", event => {
  if (!photo || brushEnabled.checked || event.button !== 0 || !overPreviewPicture(event, layout())) return;
  event.preventDefault();
  setCropMode(true);
});

film.addEventListener("pointerdown", (event) => {
  if (!photo || !event.isPrimary || event.button !== 0) return;
  if (restoredPreview) {
    restoredPreview = null;
    previewCaptionHitBoxes = [];
    queuePreview();
    persistSession();
  }
  const geometry = layout();
  const inside = overPreviewPicture(event, geometry);
  if (brushEnabled.checked) {
    event.preventDefault();
    film.focus({preventScroll:true});
    selectedCaption = null;
    const stroke = {space:"canvas", color:brushColor.value, size:Number(brushSize.value), points:[]};
    addBrushPoint(event, stroke);
    drag = {id:event.pointerId, stroke, entry:activePhoto, format:activeFormat};
    film.setPointerCapture(event.pointerId);
    queuePreview();
    return;
  }
  const crop = cropMode && inside;
  const box = cropMode || brushEnabled.checked ? null : captionTarget(event);
  if (box) {
    event.preventDefault();
    film.focus({preventScroll:true});
    selectedCaption = box.id;
    drag = {id:event.pointerId, caption:box};
    film.setPointerCapture(event.pointerId);
    queuePreview();
    return;
  }
  selectedCaption = null;
  queuePreview();
  const pan = !crop && previewZoom > 100;
  if (!crop && !pan) return;
  drag = {id:event.pointerId, x:event.clientX, y:event.clientY, pan};
  film.setPointerCapture(event.pointerId);
  film.classList.add("dragging");
});
film.addEventListener("keydown", event => {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.metaKey ||
      event.shiftKey || !photo || document.querySelector("dialog[open]")) return;
  if (event.key === "Escape" && (cropMode || brushEnabled.checked)) {
    setCropMode(false);
    stopBrush();
    event.preventDefault();
    return;
  }
  if (event.key !== "Delete" || event.ctrlKey ||
      !previewCaptionHitBoxes.some(box => box.id === selectedCaption)) return;

  event.preventDefault();
  const field = byId(selectedCaption.replace("-position", "-text"));
  selectedCaption = null;
  if (drag?.caption && film.hasPointerCapture(drag.id)) film.releasePointerCapture(drag.id);
  field.value = "";
  film.classList.remove("caption-grab");
  field.dispatchEvent(new Event("input", {bubbles:true}));
});
film.addEventListener("pointermove", (event) => {
  if (!drag) {
    film.classList.toggle("caption-grab", Boolean(!cropMode && !brushEnabled.checked && photo && captionTarget(event)));
    return;
  }
  if (event.pointerId !== drag.id) return;
  if (drag.stroke) {
    const events = event.getCoalescedEvents?.();
    for (const point of events?.length ? events : [event]) addBrushPoint(point, drag.stroke);
    queuePreview();
    return;
  }
  if (drag.caption) {
    moveCaption(event, drag.caption);
    byId("preset-select").value = "";
    queuePreview();
    persistSession();
    return;
  }
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  drag.x = event.clientX;
  drag.y = event.clientY;
  if (drag.pan) {
    scanViewport.scrollBy(dx * -1, dy * -1);
    return;
  }
  const geometry = layout();
  const crop = cropFor(geometry.picture);
  const px = film.clientWidth * geometry.picture.w / geometry.canvasW;
  const py = film.clientHeight * geometry.picture.h / geometry.canvasH;
  const halfX = crop.w / imageWidth(photo) / 2;
  const halfY = crop.h / imageHeight(photo) / 2;
  const centerX = (crop.x + crop.w / 2) / imageWidth(photo);
  const centerY = (crop.y + crop.h / 2) / imageHeight(photo);
  cropX = clamp(centerX - dx / px * halfX * 2, halfX, 1 - halfX);
  cropY = clamp(centerY - dy / py * halfY * 2, halfY, 1 - halfY);
  queuePreview();
  persistSession();
});
film.addEventListener("lostpointercapture", () => {
  const finished = drag;
  drag = undefined;
  if (finished?.stroke && finished.entry === activePhoto && finished.format === activeFormat) {
    brushStrokes.value = JSON.stringify([...readBrushStrokes(), finished.stroke]);
    brushStrokes.dispatchEvent(new Event("input", {bubbles:true}));
  }
  if (finished?.caption || finished?.stroke) queuePreview();
  film.classList.remove("dragging");
});
new ResizeObserver(queuePreview).observe(stage);

function notice(message) {
  const box = byId("notice");
  box.textContent = message;
  box.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { box.hidden = true; }, 3800);
}

function clearPaperArt() {
  paperAsset = {};
}

async function loadPaperArt(name, decode) {
  const asset = {art:paperAsset.art, loading:true};
  paperAsset = asset;
  updateControls();
  try {
    asset.art = {name, image:await decode()};
  } catch {
    if (paperAsset === asset) notice("无法读取所选的边框图片。");
  } finally {
    asset.loading = false;
    if (paperAsset === asset) updateControls();
  }
}

function paperArtForPreset(image) {
  const w = imageWidth(image);
  const h = imageHeight(image);
  const fit = Math.min(1, 1280/Math.max(w,h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1,Math.round(w*fit));
  canvas.height = Math.max(1,Math.round(h*fit));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL("image/webp",.88);
}

byId("paper-image-open").addEventListener("click", () => paperImageInput.click());
paperFinish.addEventListener("change", event => {
  if (event.isTrusted && paperFinish.value === "image") paperImageInput.click();
});
byId("paper-image-clear").addEventListener("click", () => {
  clearPaperArt();
  byId("preset-select").value = "";
  updateControls();
});
paperImageInput.addEventListener("change", () => {
  const file = paperImageInput.files[0];
  if (file) loadPaperArt(file.name, () => decodePhoto(file));
  paperImageInput.value = "";
});

async function decodePhoto(file) {
  if (/\.tiff?$/i.test(file.name)) return decodeTiff(file);
  if (cameraRawExtension.test(file.name)) return decodeCameraRaw(file);
  const source = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = source;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(source);
  }
}

function photoThumbnail(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 104;
  const width = imageWidth(image);
  const height = imageHeight(image);
  const scale = Math.min(canvas.width/width,canvas.height/height);
  canvas.getContext("2d").drawImage(image,(canvas.width-width*scale)/2,(canvas.height-height*scale)/2,width*scale,height*scale);
  return canvas.toDataURL("image/webp",.84);
}

async function prepareFilmstrip(entries, track) {
  if (filmstripBatch === entries) return;
  filmstripBatch = entries;
  for (const [index, entry] of entries.entries()) {
    if (importedPhotos !== entries) return;
    if (entry.thumb) continue;
    try {
      const image = /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(entry.file.name)
        ? await createImageBitmap(entry.file,{resizeWidth:160}).catch(() => decodePhoto(entry.file))
        : await decodePhoto(entry.file);
      try {
        if (importedPhotos !== entries) return;
        entry.thumb ||= photoThumbnail(image);
      } finally {
        image.close?.();
      }
      track.children[index]?.querySelector("img")?.setAttribute("src",entry.thumb);
    } catch {
      // The format label stays visible until a full decode succeeds.
    }
  }
}

function updatePhotoSelectionCount() {
  persistSession();
  const count = importedPhotos.filter(entry => entry.selected).length;
  const selection = byId("photo-selected-count");
  selection.hidden = !count;
  selection.value = "已选 " + count + " 张";
}

document.addEventListener("keydown", event => {
  if (!projectId || !event.ctrlKey || event.altKey || event.shiftKey || event.metaKey ||
      event.key.toLowerCase() !== "a" || event.defaultPrevented || event.isComposing ||
      !importedPhotos.length || loadingPhoto || document.querySelector("dialog[open]")) return;
  const focused = document.activeElement;
  if (focused?.isContentEditable ||
      focused?.matches('textarea, select, input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"])')) return;
  event.preventDefault();
  if (event.repeat) return;
  const checked = !importedPhotos.every(entry => entry.selected);
  for (const entry of importedPhotos) entry.selected = checked;
  for (const checkbox of byId("filmstrip").querySelectorAll(".film-select")) checkbox.checked = checked;
  updatePhotoSelectionCount();
});

function updatePhotoQueue() {
  updateExposureOptions();
  persistSession();
  const select = byId("photo-select");
  const track = byId("filmstrip");
  byId("photo-queue").hidden = !importedPhotos.length;
  const batch = importedPhotos.length > 1;
  byId("settings-title").textContent = batch && photo ? "编辑当前照片" : "编辑设置";
  byId("apply-to-all").hidden = !batch || !photo;
  byId("apply-to-all").disabled = loadingPhoto;
  byId("preview-import").hidden = Boolean(photo);
  byId("preview-tools").hidden = !photo;
  byId("preview-footer").hidden = !photo;
  scanViewport.hidden = !photo;
  carrier.classList.toggle("ready", Boolean(photo));
  byId("photo-count").textContent = importedPhotos.length + " 张";
  updatePhotoSelectionCount();
  select.replaceChildren(...importedPhotos.map((entry, i) => new Option((i+1) + " · " + entry.file.name, i)));
  if (activePhoto) select.value = String(importedPhotos.indexOf(activePhoto));
  select.disabled = loadingPhoto;
  if (importedPhotos.length) {
    const entries = importedPhotos;
    const scroll = track.scrollLeft;
    track.replaceChildren(...entries.map((entry,index) => {
      const name = entry.file.name;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "film-thumb";
      button.title = name;
      button.setAttribute("aria-label",name);
      button.setAttribute("aria-pressed",String(entry === activePhoto));
      button.disabled = loadingPhoto;
      const label = document.createElement("span");
      label.textContent = name.match(/\.([^.]+)$/)?.[1].toUpperCase() || "照片";
      const image = document.createElement("img");
      image.alt = "";
      if (entry.thumb) image.src = entry.thumb;
      button.append(label,image);
      const checkbox = document.createElement("input");
      checkbox.className = "film-select";
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(entry.selected);
      checkbox.disabled = loadingPhoto;
      checkbox.title = "勾选导出";
      checkbox.setAttribute("aria-label","勾选导出 " + name);
      checkbox.addEventListener("change", () => {
        entry.selected = checkbox.checked;
        updatePhotoSelectionCount();
      });
      button.addEventListener("click",event => {
        if (event.ctrlKey || event.metaKey) {
          checkbox.click();
          return;
        }
        if (entry === activePhoto) return;
        select.value = String(index);
        select.dispatchEvent(new Event("change"));
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "film-remove";
      remove.textContent = "×";
      remove.title = "从照片条移除";
      remove.setAttribute("aria-label","移除 " + name);
      remove.disabled = loadingPhoto;
      remove.addEventListener("click", () => removePhoto(entry));
      const item = document.createElement("div");
      item.className = "film-item";
      item.append(button, checkbox, remove);
      return item;
    }));
    track.scrollLeft = scroll;
    prepareFilmstrip(entries,track);
  } else {
    track.replaceChildren();
  }
  byId("export-open").disabled = loadingPhoto || !photo;
  byId("collage-open").disabled = loadingPhoto;
}

function activatePhoto(image, entry) {
  if (entry.id !== activePhoto?.id) {
    restoredPreview = null;
    setCropMode(false);
    stopBrush();
  }
  if (activePhoto) {
    const {x, y, zoom:scale} = currentSource();
    activePhoto.crop = {x, y, zoom:scale};
    activePhoto.edit = capturePhotoSettings();
  }
  if (photo && photo !== image) photo.close?.();
  selectedCaption = null;
  activePhoto = entry;
  updateExposureOptions();
  photo = image;
  entry.thumb ||= photoThumbnail(image);
  const saved = entry.crop;
  cropX = saved?.x ?? .5;
  cropY = saved?.y ?? .5;
  zoom.value = saved?.zoom ?? 100;
  restorePhotoSettings(entry.edit);
  photoName = entry.file.name;
  byId("file-name").textContent = photoName;
  byId("file-name").title = photoName;
  byId("file-size").textContent = imageWidth(image) + " × " + imageHeight(image) + " PX";
  updateControls();
}

byId("apply-to-all").addEventListener("click", () => {
  if (!activePhoto || loadingPhoto || importedPhotos.length < 2) return;
  const edit = capturePhotoSettings();
  for (const entry of importedPhotos) entry.edit = edit;
  persistSession();
  notice("已将当前边框设置应用到 " + importedPhotos.length + " 张照片。");
});

function removePhoto(entry) {
  if (loadingPhoto || exportDialog.open || replayingHistory) return;
  commitHistory();
  const index = importedPhotos.indexOf(entry);
  if (index < 0) return;
  importedPhotos = importedPhotos.filter(item => item !== entry);
  if (entry !== activePhoto) {
    updatePhotoQueue();
    return;
  }
  photo?.close?.();
  setCropMode(false);
  stopBrush();
  restoredPreview = null;
  activePhoto = photo = undefined;
  photoName = undefined;
  histogram.getContext("2d").clearRect(0, 0, histogram.width, histogram.height);
  if (importedPhotos.length) {
    selectPhoto([...importedPhotos.slice(index), ...importedPhotos.slice(0, index).reverse()]);
  } else {
    setPreviewZoom(100);
    updatePhotoQueue();
  }
}

function importFiles(files) {
  if (!files.length || exportDialog.open || replayingHistory || switchingProject) return;
  commitHistory();
  const entries = Array.from(files, file => ({file,id:crypto.randomUUID()}));
  const append = async () => {
    if (!projectId) await startNewProject();
    if (projectId) await appendPhotos(entries);
  };
  importQueue = importQueue.then(append, append);
  return importQueue;
}

async function appendPhotos(entries) {
  commitHistory();
  const request = ++photoRequest;
  loadingPhoto = true;
  updatePhotoQueue();
  let rejected = 0;
  try {
    for (const entry of entries) {
      let image;
      try {
        image = await decodePhoto(entry.file);
        entry.thumb = photoThumbnail(image);
      } catch {
        image?.close?.();
        rejected++;
        continue;
      }
      if (request !== photoRequest) {
        image.close?.();
        return;
      }
      const added = entries.slice(rejected);
      const edit = capturePhotoSettings();
      for (const item of added) item.edit = edit;
      importedPhotos = [...importedPhotos, ...added];
      if (photo) image.close?.();
      else activatePhoto(image, entry);
      if (rejected) notice("已跳过 " + rejected + " 张无法读取的图片。");
      return;
    }
    if (request === photoRequest) notice("无法读取所选图片，文件可能已损坏或使用了当前解码器不支持的编码。");
  } finally {
    if (request === photoRequest) {
      loadingPhoto = false;
      updatePhotoQueue();
      commitHistory();
    }
  }
}

async function selectPhoto(entries) {
  const request = ++photoRequest;
  loadingPhoto = true;
  updatePhotoQueue();
  try {
    for (const entry of entries) {
      if (request !== photoRequest) return;
      let image;
      try {
        image = await decodePhoto(entry.file);
      } catch {
        continue;
      }
      if (request === photoRequest) activatePhoto(image, entry);
      return;
    }
    if (request === photoRequest) notice("无法读取「" + entries[0].file.name + "」。");
  } finally {
    if (request === photoRequest) {
      loadingPhoto = false;
      updatePhotoQueue();
      commitHistory();
    }
  }
}

byId("photo-select").addEventListener("change", event => {
  const entry = importedPhotos[Number(event.target.value)];
  if (entry && entry !== activePhoto) selectPhoto([entry]);
});

byId("open").addEventListener("click", () => byId("file").click());
byId("open-more").addEventListener("click", () => byId("file").click());
byId("file").addEventListener("change", event => {
  importFiles(event.target.files);
  event.target.value = "";
});
window.addEventListener("dragover", (event) => {
  if (!event.dataTransfer.types.includes("Files")) return;
  event.preventDefault();
  stage.classList.toggle("drop-active", stage.contains(event.target));
});
stage.addEventListener("dragleave", (event) => {
  if (!stage.contains(event.relatedTarget)) stage.classList.remove("drop-active");
});
window.addEventListener("drop", (event) => {
  if (!event.dataTransfer.files.length) return;
  event.preventDefault();
  stage.classList.remove("drop-active");
  if (stage.contains(event.target)) importFiles(event.dataTransfer.files);
});

function exportDimensions(geometry, source = currentSource()) {
  const crop = cropFor(geometry.picture, source);
  const outputScale = Math.min(crop.w / geometry.picture.w, crop.h / geometry.picture.h);
  return {
    width: Math.max(1, Math.round(geometry.canvasW * outputScale)),
    height: Math.max(1, Math.round(geometry.canvasH * outputScale))
  };
}

const jpgCompression = byId("jpg-compression");
function updateJpgCompression() {
  byId("jpg-compression-value").value = Number(jpgCompression.value) ? jpgCompression.value + "%" : "原图画质";
  jpgCompression.style.setProperty("--fill", jpgCompression.value + "%");
}

function updateExportNote() {
  const type = byId("export-type").value;
  const transparent = type === "png" || type === "tiff";
  byId("jpg-compression-field").hidden = type !== "jpg";
  updateJpgCompression();
  const entries = exportEntries(byId("export-scope").value);
  if (entries.length > 1 || entries[0] !== activePhoto) {
    byId("export-size").textContent = entries.length + " 张照片" + (entries.length > 1 ? " · ZIP" : "");
  } else {
    const {width, height} = exportDimensions(layout());
    byId("export-size").textContent = width + " × " + height + " PX";
  }
  const formatNote = {
    png: "PNG 无损保存。",
    tiff: "TIFF 无损保存，含透明通道。",
    jpg: "0% 压缩量以最高 JPG 质量编码，滑块只调整编码质量。",
    dng: "将编辑后的画面保存为 16 位线性 DNG。",
    bmp: "BMP 以 24 位 RGB 无压缩保存。"
  }[type];
  const hasHoles = entries.some(entry => gates[entry === activePhoto ? gateKey : entry.edit.gateKey].roll === 35);
  const hasRoundedCorners = entries.some(entry => Number(entry === activePhoto ? outerRadius.value :
    entry.edit.controls.fields["outer-radius"]));
  const holeNote = hasHoles ? (transparent ? "片孔保留透明。" : "片孔使用各照片的扫描底色。") : "";
  const cornerNote = hasRoundedCorners ? (transparent ? "圆角外侧透明。" : "圆角外侧填白。") : "";
  byId("export-note").textContent = formatNote + holeNote + cornerNote;
}

function exportEntries(scope) {
  if (scope === "all") return importedPhotos;
  if (scope === "selected") return importedPhotos.filter(entry => entry.selected);
  return [activePhoto];
}

byId("export-open").addEventListener("click", () => {
  if (restoredPreview) updateControls();
  const selected = exportEntries("selected").length;
  const option = byId("export-selected");
  option.disabled = !selected;
  option.textContent = "勾选的照片" + (selected ? " · " + selected + " 张" : "");
  byId("export-scope-field").hidden = importedPhotos.length < 2;
  byId("export-scope").value = selected ? "selected" : importedPhotos.length < 2 ? "current" : "all";
  byId("export-save").textContent = typeof window.showSaveFilePicker === "function" ? "选择位置并保存" : "下载图片";
  updateExportNote();
  exportDialog.showModal();
});
byId("export-type").addEventListener("change", () => {
  updateExportNote();
  scheduleProjectSave();
});
byId("export-scope").addEventListener("change", updateExportNote);
jpgCompression.addEventListener("input", updateJpgCompression);
function createExportJob(pause, stop, status) {
  let next;
  let paused = false;
  let stopped = false;
  let writing = false;
  let progress = "准备导出…";
  function show() {
    pause.textContent = paused ? "继续导出" : "暂停导出";
    pause.disabled = writing || stopped;
    stop.hidden = !paused || stopped;
    status.textContent = stopped ? "正在结束导出…" : paused ? "已暂停 · " + progress : progress;
  }
  function toggle() {
    if (writing || stopped) return;
    paused = !paused;
    show();
    if (!paused) next?.();
  }
  function cancel() {
    if (!paused || writing) return;
    stopped = true;
    show();
    next?.();
  }
  pause.onclick = toggle;
  stop.onclick = cancel;
  show();
  return {
    pause() {
      if (!paused) toggle();
    },
    async checkpoint(message) {
      if (message) {
        progress = message;
        show();
      }
      // Yield to the UI before starting another image or writing the file.
      await new Promise(resolve => setTimeout(resolve, 0));
      while (paused && !stopped) {
        await new Promise(resolve => {next = resolve;});
        next = null;
      }
      if (stopped) throw new DOMException("导出已结束", "AbortError");
    },
    async write(message, action) {
      await this.checkpoint(message);
      writing = true;
      show();
      await action();
    },
    dispose() {
      pause.onclick = stop.onclick = null;
      stop.hidden = true;
      pause.disabled = false;
    }
  };
}

let photoExportJob;
byId("export-cancel").addEventListener("click", () => {
  if (!photoExportJob && !byId("export-save").disabled) exportDialog.close();
});
exportDialog.addEventListener("cancel", (event) => {
  if (!byId("export-save").disabled) return;
  event.preventDefault();
  photoExportJob?.pause();
});

function outputName(name, type, edit) {
  const key = edit?.gateKey ?? gateKey;
  const label = gates[key].paperWidth ? key : key === "xpan" ? "135-xpan" :
    key === "half" ? "135-half" : key === "135" ? "135" : "120";
  const number = (edit?.frames ?? frameNumbers)[key];
  return name.replace(/\.[^.]+$/, "") + "_" + label + "_" + pad(number) + "." + type;
}

function renderExport(canvas, source, type, edit) {
  const previous = edit && capturePhotoSettings();
  try {
    if (edit) restorePhotoSettings(edit);
    const geometry = layout(source.image);
    const {width, height} = exportDimensions(geometry, source);
    if (width > 16384 || height > 16384 || width*height > 100000000) {
      throw new RangeError("成片尺寸过大，请适当增加裁切缩放后再导出。");
    }
    render(canvas, geometry, width, height, type !== "png" && type !== "tiff", source);
  } finally {
    if (previous) restorePhotoSettings(previous);
  }
}

async function encodeCanvas(canvas, type) {
  const jpeg = type === "jpg";
  if (type === "bmp" || type === "tiff" || type === "dng") {
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    return type === "bmp" ? encodeBmp(pixels) : encodeTiff(pixels, type === "dng");
  }
  const quality = 1 - .85*Number(jpgCompression.value)/100;
  const blob = await new Promise(resolve => canvas.toBlob(resolve, jpeg ? "image/jpeg" : "image/png", quality));
  if (!blob) throw new Error("图片编码失败");
  return blob;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const exportMimeTypes = {
  png: "image/png", jpg: "image/jpeg", tiff: "image/tiff", bmp: "image/bmp",
  dng: "image/x-adobe-dng", zip: "application/zip"
};

async function saveExport(blob, filename, handle) {
  if (!handle) {
    download(blob, filename);
    return;
  }
  const writer = await handle.createWritable();
  try {
    await writer.write(blob);
    await writer.close();
  } catch (error) {
    await writer.abort().catch(() => {});
    throw error;
  }
}

async function sourceForExport(entry) {
  if (entry === activePhoto) return currentSource();
  return {image:await decodePhoto(entry.file), x:.5, y:.5, zoom:100, ...entry.crop};
}

byId("export-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const save = byId("export-save");
  if (save.disabled) return;
  const cancel = byId("export-cancel");
  const format = byId("export-type");
  const scope = byId("export-scope");
  const type = format.value;
  const entries = exportEntries(scope.value);
  if (!entries.length) return;
  const currentEdit = capturePhotoSettings();
  const editFor = entry => entry === activePhoto ? currentEdit : entry.edit;
  for (const entry of entries) {
    const edit = editFor(entry);
    if (edit.format === "instant" && edit.paper["paper-finish"] === "image" && edit.paperAsset.loading) {
      notice("正在读取「" + entry.file.name + "」的边框图片，请稍候。");
      return;
    }
    const stamp = edit.controls.fields.date;
    if (edit.controls.dateEnabled && (!stamp || stamp < date.min || stamp > date.max)) {
      notice("请填写「" + entry.file.name + "」的有效打印日期。");
      return;
    }
  }
  const batch = entries.length > 1;
  const destination = savedFolders.get(byId("export-folder").value);
  const extension = batch ? "zip" : type;
  const filename = batch ? "片边_" + entries.length + "张.zip" : outputName(entries[0].file.name, type, editFor(entries[0]));
  const nativeSave = typeof window.showSaveFilePicker === "function";
  const locked = [format, scope, jpgCompression, ...["export-folder","folder-add","folder-remove"].map(byId)]
    .map(control => [control, control.disabled]);
  for (const [control] of locked) control.disabled = true;
  save.disabled = cancel.disabled = true;
  const target = document.createElement("canvas");
  const progress = byId("export-progress");
  progress.hidden = false;
  progress.textContent = "正在选择保存位置…";
  let choosingLocation = nativeSave || Boolean(destination);
  try {
    // Pick a location before starting asynchronous encoding.
    if (destination && await destination.requestPermission({mode:"readwrite"}) !== "granted") {
      throw new Error("没有保存位置的写入权限。");
    }
    const handle = !destination && nativeSave ? await window.showSaveFilePicker({
      id: "film-rebate-export", suggestedName: filename,
      types: [{accept:{[exportMimeTypes[extension]]:["." + extension]}}]
    }) : null;
    choosingLocation = false;
    photoExportJob = createExportJob(cancel, byId("export-stop"), progress);
    const job = photoExportJob;
    save.textContent = "导出进行中";
    let message;
    let output;
    if (batch) {
      const archive = new ImageZip();
      let skipped = 0;
      for (const [index, entry] of entries.entries()) {
        await job.checkpoint("已处理 " + index + " / " + entries.length + " 张");
        let image;
        try {
          image = await encodePhoto(target, await sourceForExport(entry), type, entry === activePhoto ? null : entry.edit);
        } catch {
          skipped++;
          continue;
        }
        const prefix = String(index+1).padStart(String(entries.length).length, "0");
        await archive.add(prefix + "_" + outputName(entry.file.name, type, editFor(entry)), image);
      }
      await job.checkpoint("已处理 " + entries.length + " / " + entries.length + " 张，准备打包");
      if (!archive.count) throw new Error("所选照片无法导出。");
      output = archive.finish();
      message = "已导出 " + archive.count + " 张照片" + (skipped ? "，跳过 " + skipped + " 张读取或编码失败的照片" : "");
    } else {
      const [entry] = entries;
      await job.checkpoint("正在处理照片");
      output = await encodePhoto(target, await sourceForExport(entry), type, entry === activePhoto ? null : entry.edit);
      message = "已生成 " + type.toUpperCase() + " 图片";
    }
    await job.write("正在准备写入文件…", async () => {
      progress.textContent = "正在写入文件…";
      const outputHandle = destination ? await chooseSavedFile(destination, filename) : handle;
      await saveExport(output, filename, outputHandle);
    });
    exportDialog.close();
    notice(message);
  } catch (error) {
    if (error.name === "AbortError") {
      if (!choosingLocation) notice("已结束本次导出。");
      return;
    }
    notice(error instanceof RangeError || destination ? error.message : "导出失败，请检查图片后重试。");
  } finally {
    target.width = target.height = 1;
    photoExportJob?.dispose();
    photoExportJob = null;
    cancel.textContent = "取消";
    save.disabled = cancel.disabled = false;
    for (const [control, disabled] of locked) control.disabled = disabled;
    progress.hidden = true;
    save.textContent = nativeSave ? "选择位置并保存" : "下载图片";
  }

});



const captionInkTile = document.createElement("canvas");
captionInkTile.width = captionInkTile.height = 96;
let lastCaptionInkColor;

function captionInk(ctx, color, pointSize) {
  const rgb = color.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16));
  if (lastCaptionInkColor !== color) {
    const ink = captionInkTile.getContext("2d");
    const pixels = ink.createImageData(96, 96);
    const random = seeded(879);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const density = random();
      pixels.data.set([...rgb, Math.round(density < .09 ? 95 : 182 + 70 * density)], i);
    }
    ink.putImageData(pixels, 0, 0);
    lastCaptionInkColor = color;
  }
  const pattern = ctx.createPattern(captionInkTile, "repeat");
  const grainScale = Math.max(.028, pointSize * .023);
  pattern.setTransform(new DOMMatrix().scale(grainScale));
  ctx.fillStyle = pattern;
  const luminosity = rgbLuminance(rgb);
  ctx.globalCompositeOperation = luminosity > .76 ? "screen" : luminosity < .12 ? "multiply" : "source-over";
}

function drawCaption(ctx, text, box, color, align, printed = false, positionId = "") {
  if (!text.trim()) return;
  const back = positionId === "paper-back-position";
  const density = positionId ? Number(byId(positionId.replace("-position", "-density")).value) / 100 : 1;
  if (!density) return;
  const size = box.w * Number(byId(back ? "paper-back-size" : "caption-size").value) / 100;
  const lineHeight = size * 1.3;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();
  ctx.font = size + "px " + byId(back ? "paper-back-font" : "caption-font").value;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const character of paragraph) {
      if (line && ctx.measureText(line + character).width > box.w) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
    lines.push(line);
  }
  const count = Math.min(lines.length, Math.max(1, Math.floor(box.h / lineHeight)));
  const blockHeight = count * lineHeight;
  const blockWidth = Math.min(box.w, Math.max(...lines.slice(0, count).map(line => ctx.measureText(line).width)));
  const [px, py, scaleX, scaleY] = positionId ? captionPosition(positionId, align) : [.5, .5, 1, 1];
  const angle = positionId ? Number(byId(positionId.replace("-position", "-angle")).value) * Math.PI / 180 : 0;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const rotatedWidth = blockWidth * scaleX * cos + blockHeight * scaleY * sin;
  const rotatedHeight = blockWidth * scaleX * sin + blockHeight * scaleY * cos;
  const fit = Math.min(1, box.w / rotatedWidth, box.h / rotatedHeight);
  const halfW = rotatedWidth * fit / 2;
  const halfH = rotatedHeight * fit / 2;
  const centerX = clamp(box.x + box.w * px, box.x + halfW, box.x + box.w - halfW);
  const centerY = clamp(box.y + box.h * py, box.y + halfH, box.y + box.h - halfH);
  if (positionId && captionHitBoxes) captionHitBoxes.push({...box, id:positionId, centerX, centerY,
    angle, width:blockWidth * fit * scaleX, height:blockHeight * fit * scaleY, scaleX, scaleY});
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);
  ctx.scale(fit * scaleX, fit * scaleY);
  ctx.globalAlpha = density;
  if (printed) captionInk(ctx, color, size);
  for (let i = 0; i < count; i++) {
    ctx.fillText(lines[i], 0, (i + .5) * lineHeight - blockHeight / 2, box.w);
  }
  ctx.restore();
}

function drawComparison(geometry, width, height, enabled, split) {
  const original = byId("original-preview");
  carrier.classList.toggle("compare-side", enabled && !split);
  carrier.classList.toggle("compare-split", split);
  original.hidden = !enabled;
  byId("compare-divider").hidden = !split;
  if (!enabled) return;
  original.width = film.width;
  original.height = film.height;
  original.style.width = width + "px";
  original.style.height = height + "px";
  const ctx = original.getContext("2d");
  ctx.fillStyle = "#29292b";
  ctx.fillRect(0, 0, original.width, original.height);
  ctx.imageSmoothingQuality = "high";
  if (split) {
    const {picture} = geometry;
    const crop = cropFor(picture);
    const sx = original.width / geometry.canvasW;
    const sy = original.height / geometry.canvasH;
    ctx.drawImage(photo, crop.x, crop.y, crop.w, crop.h,
      picture.x*sx, picture.y*sy, picture.w*sx, picture.h*sy);
  } else {
    const fit = Math.min(original.width / imageWidth(photo), original.height / imageHeight(photo));
    const w = imageWidth(photo) * fit;
    const h = imageHeight(photo) * fit;
    ctx.drawImage(photo, (original.width - w) / 2, (original.height - h) / 2, w, h);
  }
}

for (const id of ["compare-enabled", "compare-mode", "compare-split"]) {
  byId(id).addEventListener("input", () => {
    const enabled = byId("compare-enabled").checked;
    if (enabled && restoredPreview) updateControls();
    byId("compare-mode").hidden = !enabled;
    byId("compare-split").hidden = !enabled || byId("compare-mode").value !== "split";
    carrier.style.setProperty("--split", byId("compare-split").value + "%");
    if (id !== "compare-split") queuePreview();
  });
}

const compareDivider = byId("compare-divider");
function moveComparison(event) {
  const bounds = carrier.getBoundingClientRect();
  const slider = byId("compare-split");
  slider.value = clamp(Math.round((event.clientX - bounds.left) / bounds.width * 100), 0, 100);
  slider.dispatchEvent(new Event("input"));
}
compareDivider.addEventListener("pointerdown", event => {
  compareDivider.setPointerCapture(event.pointerId);
  moveComparison(event);
});
compareDivider.addEventListener("pointermove", event => {
  if (compareDivider.hasPointerCapture(event.pointerId)) moveComparison(event);
});

const exposureLimit = 8;
let exposureLayers = [];
const exposureImages = new WeakMap();
let captionHitBoxes = null;
let previewCaptionHitBoxes = [];
let selectedCaption = null;

function legacyExposure(fields) {
  return fields["exposure-photo"] ? [{
    id:fields["exposure-photo"], mode:fields["exposure-mode"],
    opacity:Number(fields["exposure-opacity"]), angle:0
  }] : [];
}

function exposureFile(layer) {
  return layer.file ?? importedPhotos.find(entry => entry.id === layer.id)?.file;
}

function loadExposure(layer) {
  const file = exposureFile(layer);
  if (!file) return Promise.resolve();
  if (!exposureImages.has(file)) {
    const item = {};
    item.pending = decodePhoto(file).then(image => {
      item.image = image;
      return image;
    });
    exposureImages.set(file, item);
  }
  return exposureImages.get(file).pending;
}

function refreshExposure() {
  for (const layer of exposureLayers) {
    const file = exposureFile(layer);
    if (file && !exposureImages.has(file)) {
      loadExposure(layer).then(() => {queuePreview(); persistSession();}, () => notice("无法读取「" + file.name + "」。"));
    }
  }
}

function drawExposureLayer(ctx, picture, layer) {
  if (!layer.opacity) return;
  const image = exposureImages.get(exposureFile(layer))?.image;
  if (!image) return;
  const angle = layer.angle * Math.PI / 180;
  const sin = Math.abs(Math.sin(angle));
  const cos = Math.abs(Math.cos(angle));
  const bounds = {w:picture.w*cos + picture.h*sin, h:picture.w*sin + picture.h*cos};
  const crop = cropFor(bounds, {image, x:.5, y:.5, zoom:100});
  ctx.save();
  const offsetX = (layer.offsetX ?? 0) * picture.w / 100;
  const offsetY = (layer.offsetY ?? 0) * picture.h / 100;
  ctx.translate(picture.x + picture.w/2 + offsetX, picture.y + picture.h/2 + offsetY);
  ctx.rotate(angle);
  const scale = (layer.zoom ?? 100) / 100;
  ctx.scale(scale, scale);
  ctx.globalCompositeOperation = layer.mode;
  ctx.globalAlpha = layer.opacity / 100;
  ctx.drawImage(image, crop.x, crop.y, crop.w, crop.h, -bounds.w/2, -bounds.h/2, bounds.w, bounds.h);
  ctx.restore();
}

function updateExposureOptions() {
  const picker = byId("exposure-pick");
  picker.replaceChildren(new Option("选择照片", ""), ...importedPhotos.filter(entry => entry !== activePhoto)
    .map(entry => new Option(entry.file.name, entry.id)));
  picker.disabled = !photo || exposureLayers.length >= exposureLimit || picker.options.length === 1;
}

function commitExposureChange() {
  byId("preset-select").value = "";
  queuePreview();
  persistSession();
}

function showExposureLayers() {
  updateExposureOptions();
  const add = byId("exposure-import");
  add.disabled = !photo || exposureLayers.length >= exposureLimit;
  byId("exposure-count").value = exposureLayers.length ? exposureLayers.length + " 层" : "";
  add.textContent = "导入叠加图片 · " + exposureLayers.length + " / " + exposureLimit;
  const rows = exposureLayers.map(layer => {
    const row = document.createElement("div");
    row.className = "exposure-row extra-tools";
    const header = document.createElement("div");
    header.className = "exposure-heading";
    const title = document.createElement("strong");
    title.textContent = exposureFile(layer)?.name ?? "原叠加图已移除";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "quiet";
    remove.textContent = "移除";
    remove.onclick = () => {
      exposureLayers = exposureLayers.filter(item => item !== layer);
      showExposureLayers();
      commitExposureChange();
    };
    header.append(title, remove);

    const blendLabel = document.createElement("label");
    blendLabel.textContent = "混合方式";
    const blend = document.createElement("select");
    for (const [value, name] of Object.entries({screen:"滤色", multiply:"正片叠底", overlay:"叠加", "source-over":"正常"})) {
      blend.add(new Option(name, value, false, value === layer.mode));
    }
    blend.oninput = event => {
      event.stopPropagation();
      layer.mode = blend.value;
      commitExposureChange();
    };
    blendLabel.append(blend);
    row.append(header, blendLabel);

    for (const [key, name, min, max, unit, standard] of [
      ["opacity", "强度", 0, 100, "%"], ["angle", "旋转", -180, 180, "°", 0],
      ["zoom", "缩放", 25, 300, "%", 100],
      ["offsetX", "左右移动", -100, 100, "%", 0], ["offsetY", "上下移动", -100, 100, "%", 0]
    ]) {
      const label = document.createElement("label");
      const output = document.createElement("span");
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = min;
      slider.max = max;
      if (standard !== undefined) {
        slider.dataset.detent = String(standard);
        setDetentMark(slider);
        slider.title = "原始值 " + standard + unit;
      }
      const value = layer[key] ?? standard ?? 50;
      slider.value = value;
      output.textContent = name + " " + value + unit;
      slider.oninput = event => {
        event.stopPropagation();
        layer[key] = slider.valueAsNumber;
        output.textContent = name + " " + layer[key] + unit;
        setRangeFill(slider);
        commitExposureChange();
      };
      setRangeFill(slider);
      label.append(output, slider);
      row.append(label);
    }
    return row;
  });
  byId("exposure-layers").replaceChildren(...rows);
}

async function addExposures(files) {
  const entry = activePhoto;
  if (!entry) return;
  const available = exposureLimit - exposureLayers.length;
  let failed = 0;
  for (const file of files.slice(0, available)) {
    const layer = {file, mode:"screen", opacity:50, angle:0};
    try {
      await loadExposure(layer);
    } catch {
      failed++;
      continue;
    }
    if (activePhoto === entry && exposureLayers.length < exposureLimit) exposureLayers.push(layer);
    else break;
    showExposureLayers();
    commitExposureChange();
  }
  if (failed) notice(failed + " 张叠加图无法读取。");
  else if (files.length > available) notice("每张照片最多叠加 " + exposureLimit + " 张图。");
}

byId("exposure-import").onclick = () => byId("exposure-files").click();
byId("exposure-files").onchange = event => {
  const files = Array.from(event.target.files);
  event.target.value = "";
  addExposures(files);
};
byId("exposure-pick").oninput = event => {
  event.stopPropagation();
  const entry = importedPhotos.find(item => item.id === event.target.value);
  if (entry) addExposures([entry.file]);
  event.target.value = "";
};

function captionPosition(id, alignment) {
  try {
    const position = JSON.parse(byId(id).value);
    if (Array.isArray(position) && position.length >= 2 && position.every(Number.isFinite)) {
      return [position[0], position[1], clamp(position[2] ?? 1, .2, 5), clamp(position[3] ?? 1, .2, 5)];
    }
  } catch {}
  return [.5, alignment === "top" ? .12 : .55, 1, 1];
}

function captionPoint(event) {
  const geometry = layout();
  const bounds = film.getBoundingClientRect();
  return {
    x:(event.clientX - bounds.left) * geometry.canvasW / bounds.width,
    y:(event.clientY - bounds.top) * geometry.canvasH / bounds.height
  };
}

const captionHandles = [[-1,-1], [0,-1], [1,-1], [-1,0], [1,0], [-1,1], [0,1], [1,1]];

function captionLocal(point, box) {
  const dx = point.x - box.centerX;
  const dy = point.y - box.centerY;
  const cos = Math.cos(box.angle);
  const sin = Math.sin(box.angle);
  return {x:dx * cos + dy * sin, y:-dx * sin + dy * cos};
}

function captionTarget(event) {
  const point = captionPoint(event);
  const radius = 7 * layout().canvasW / film.getBoundingClientRect().width;
  const selected = previewCaptionHitBoxes.find(box => box.id === selectedCaption);
  if (selected) {
    const start = captionLocal(point, selected);
    const handle = captionHandles.find(([x,y]) =>
      Math.hypot(start.x - x * selected.width / 2, start.y - y * selected.height / 2) <= radius);
    if (handle) return {...selected, handle, start};
  }
  const box = previewCaptionHitBoxes.find(box => {
    const local = captionLocal(point, box);
    return Math.abs(local.x) <= box.width / 2 + 1 && Math.abs(local.y) <= box.height / 2 + 1;
  });
  return box && {...box, offsetX:point.x - box.centerX, offsetY:point.y - box.centerY};
}

function moveCaption(event, box) {
  const point = captionPoint(event);
  let [x, y, sx, sy] = captionPosition(box.id, box.id === "caption-position" ? "top" : "middle");
  if (box.handle) {
    const current = captionLocal(point, box);
    const [hx, hy] = box.handle;
    const width = Math.max(.1, box.width);
    const height = Math.max(.1, box.height);
    sx = clamp(box.scaleX * (1 + hx * 2 * (current.x - box.start.x) / width), .2, 5);
    sy = clamp(box.scaleY * (1 + hy * 2 * (current.y - box.start.y) / height), .2, 5);
  } else {
    const threshold = 7 * layout().canvasW / film.getBoundingClientRect().width;
    const px = point.x - box.offsetX - box.x;
    const py = point.y - box.offsetY - box.y;
    box.snapX = Math.abs(px - box.w / 2) <= threshold;
    box.snapY = Math.abs(py - box.h / 2) <= threshold;
    x = box.snapX ? .5 : clamp(px / box.w, 0, 1);
    y = box.snapY ? .5 : clamp(py / box.h, 0, 1);
  }
  byId(box.id).value = JSON.stringify([x, y, sx, sy]);
}

function drawCaptionControls(geometry, displayWidth) {
  const box = previewCaptionHitBoxes.find(item => item.id === selectedCaption);
  if (!box) return;
  const ctx = film.getContext("2d");
  const unit = geometry.canvasW / displayWidth;
  ctx.save();
  ctx.setTransform(film.width / geometry.canvasW, 0, 0, film.height / geometry.canvasH, 0, 0);
  ctx.lineWidth = unit;
  const moving = drag?.caption;
  if (moving && !moving.handle) {
    ctx.setLineDash([5 * unit, 4 * unit]);
    for (const [axis, x1, y1, x2, y2] of [
      ["snapX", box.x + box.w/2, box.y, box.x + box.w/2, box.y + box.h],
      ["snapY", box.x, box.y + box.h/2, box.x + box.w, box.y + box.h/2]
    ]) {
      ctx.strokeStyle = moving[axis] ? "#68f6e4" : "#ffffff9c";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.translate(box.centerX, box.centerY);
  ctx.rotate(box.angle);
  ctx.strokeStyle = "#74ecdf";
  ctx.strokeRect(-box.width/2, -box.height/2, box.width, box.height);
  ctx.fillStyle = "#f4fffd";
  for (const [x,y] of captionHandles) {
    const left = x * box.width / 2 - 3 * unit;
    const top = y * box.height / 2 - 3 * unit;
    ctx.fillRect(left, top, 6 * unit, 6 * unit);
    ctx.strokeRect(left, top, 6 * unit, 6 * unit);
  }
  ctx.restore();
}

function initializeCaptionFonts() {
  const fonts = byId("caption-font");
  for (const [name, stack] of [
    ["舒体", "STShuti, KaiTi, serif"], ["琥珀体", "STHupo, Microsoft YaHei, sans-serif"],
    ["华文新魏", "STXinwei, KaiTi, serif"], ["华文中宋", "STZhongsong, SimSun, serif"],
    ["方正姚体", "FZYaoTi, SimSun, serif"], ["方正舒体", "FZShuTi, KaiTi, serif"],
    ["毛笔行书 · 马善政", "Ma Shan Zheng, KaiTi, cursive"],
    ["龙藏体 · 手写中文", "Long Cang, KaiTi, cursive"],
    ["志莽行书 · 飞白", "Zhi Mang Xing, KaiTi, cursive"],
    ["刘建毛草 · 草写", "Liu Jian Mao Cao, KaiTi, cursive"],
    ["细线签名 · Mrs Saint Delafield", "Mrs Saint Delafield, cursive"],
    ["旧式招牌 · Yesteryear", "Yesteryear, cursive"],
    ["站酷快乐体 · 手写", "ZCOOL KuaiLe, KaiTi, cursive"],
    ["站酷庆科黄油体 · 圆体", "ZCOOL QingKe HuangYou, Microsoft YaHei, sans-serif"],
    ["流水手写 · Allura", "Allura, cursive"],
    ["复古签名 · Sacramento", "Sacramento, cursive"],
    ["古典花体 · Pinyon Script", "Pinyon Script, cursive"],
    ["随手笔记 · Caveat", "Caveat, cursive"],
    ["细笔花体 · Great Vibes", "Great Vibes, cursive"],
    ["复古签名 · Satisfy", "Satisfy, cursive"],
    ["跳跃手写 · Dancing Script", "Dancing Script, cursive"],
    ["华丽手写 · Edwardian", "Edwardian Script ITC, Segoe Script, cursive"],
    ["婚礼手写 · French Script", "French Script MT, Segoe Script, cursive"],
    ["古典花体 · Vivaldi", "Vivaldi, Segoe Script, cursive"],
    ["复古招牌 · Cooper", "Cooper Black, Georgia, serif"],
    ["杂志衬线 · Bodoni", "Bodoni MT, Georgia, serif"],
    ["装饰几何 · Bauhaus", "Bauhaus 93, Century Gothic, sans-serif"],
    ["复古电影 · Broadway", "Broadway, Impact, sans-serif"]
  ]) fonts.add(new Option(name, stack));
  byId("paper-back-font").replaceChildren(...Array.from(fonts.options, option => option.cloneNode(true)));
}

function drawInstaxBackPrint(ctx, w, h, top, bottom, seal) {
  const warning = "Don’t put in mouth.";
  const upper = ctx.createLinearGradient(0, 0, 0, top);
  upper.addColorStop(0, "#a4a297");
  upper.addColorStop(.16, "#858276");
  upper.addColorStop(.84, "#514f49");
  upper.addColorStop(1, "#777468");
  ctx.fillStyle = upper;
  ctx.fillRect(0, 0, w, top);
  ctx.fillStyle = "#d4cfc185";
  ctx.fillRect(0, seal * .55, w, seal * .65);
  ctx.fillRect(0, top - seal * .85, w, seal * .55);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, seal * 1.4, w, top - seal * 2.6);
  ctx.clip();
  const warningSize = top * .45;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "600 " + warningSize + "px Arial, sans-serif";
  ctx.fillStyle = "#ddd9ca";
  ctx.strokeStyle = "#ddd9cabb";
  ctx.lineWidth = warningSize * .08;
  const warningWidth = ctx.measureText(warning).width;
  const rowY = top * .53;
  for (let x = -warningWidth * .28; x < w; x += warningWidth + warningSize * 2.1) {
    ctx.fillText(warning, x, rowY);
    const iconX = x + warningWidth + warningSize * .95;
    const radius = warningSize * .38;
    ctx.beginPath();
    ctx.arc(iconX, rowY, radius, 0, Math.PI * 2);
    ctx.moveTo(iconX - radius * .72, rowY + radius * .72);
    ctx.lineTo(iconX + radius * .72, rowY - radius * .72);
    ctx.stroke();
  }
  ctx.restore();

  const height = h - bottom;
  const lower = ctx.createLinearGradient(0, bottom, w * .24, h);
  lower.addColorStop(0, "#70737a");
  lower.addColorStop(.16, "#54565a");
  lower.addColorStop(.74, "#45464a");
  lower.addColorStop(1, "#5c5e61");
  ctx.fillStyle = lower;
  ctx.fillRect(0, bottom, w, height);
  ctx.fillStyle = "#c5c6bf46";
  ctx.fillRect(0, bottom + seal * .5, w, seal * .45);
  ctx.fillStyle = "#222328a1";
  ctx.fillRect(0, h - seal, w, seal);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e4e1d9";
  // The repeated marks each occupy their own column in the bottom seal.
  for (const center of [w * .35, w * .85]) {
    ctx.font = "700 " + height * .40 + "px Arial, sans-serif";
    ctx.fillText("instax", center, bottom + height * .42, w * .25);
    ctx.font = "700 " + height * .18 + "px Arial, sans-serif";
    ctx.fillText("FUJIFILM", center, bottom + height * .73, w * .24);
  }
}

function drawInstantBack(ctx, geometry) {
  const w = geometry.paperWidth;
  const h = geometry.canvasH;
  ctx.save();
  ctx.translate(w, 0);
  const instax = geometry.label.startsWith("instax");
  const edge = Math.min(w, h) * (instax ? .022 : .037);
  const top = h * (instax ? .071 : .044);
  const bottom = h * (instax ? .848 : .822);
  const right = w - edge;
  const seal = Math.min(w, h) * .006;
  const random = seeded(8731 + Math.round(w * 13));
  const band = ctx.createLinearGradient(0, 0, w * .14, h);
  band.addColorStop(0, instax ? "#77746d" : "#47443b");
  band.addColorStop(.12, "#353335");
  band.addColorStop(.83, "#252427");
  band.addColorStop(1, instax ? "#56595a" : "#393630");
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(edge + seal, top);
  ctx.bezierCurveTo(w * .32, top + seal, w * .74, top - seal, right - seal, top);
  ctx.lineTo(right - seal * 1.3, bottom - seal * .8);
  ctx.quadraticCurveTo(w * .63, bottom + seal * .7, edge + seal * 1.4, bottom);
  ctx.closePath();
  ctx.clip();
  const backing = ctx.createLinearGradient(0, top, w * .8, bottom);
  backing.addColorStop(0, instax ? "#332c32" : "#2c2a25");
  backing.addColorStop(.47, instax ? "#252225" : "#252320");
  backing.addColorStop(1, "#151416");
  ctx.fillStyle = backing;
  ctx.fillRect(edge, top-seal, right-edge, bottom-top+seal*2);

  const bloom = ctx.createRadialGradient(w*.20, bottom-h*.13, 0, w*.20, bottom-h*.13, w*.6);
  bloom.addColorStop(0, instax ? "#aba7bd27" : "#ab9d8122");
  bloom.addColorStop(.52, "#7673740b");
  bloom.addColorStop(1, "#0000");
  ctx.fillStyle = bloom;
  ctx.fillRect(edge, top, right-edge, bottom-top);

  const texture = ctx.createPattern(grain, "repeat");
  texture.setTransform(new DOMMatrix().scale(.038));
  ctx.globalAlpha = .19;
  ctx.fillStyle = texture;
  ctx.fillRect(edge, top, right-edge, bottom-top);
  ctx.globalAlpha = 1;
  if (instax) {
    const reflectionY = bottom - (bottom - top) * .12;
    const reflection = ctx.createLinearGradient(0, reflectionY - h*.08, 0, bottom);
    reflection.addColorStop(0, "#99a5d000");
    reflection.addColorStop(.47, "#9baccc1c");
    reflection.addColorStop(.71, "#121a3180");
    reflection.addColorStop(1, "#0a0c16b0");
    ctx.beginPath();
    ctx.moveTo(0, reflectionY - h*.03);
    ctx.bezierCurveTo(w*.17, reflectionY - h*.09, w*.23, reflectionY + h*.06, w*.48, reflectionY);
    ctx.quadraticCurveTo(w*.74, reflectionY - h*.035, w, reflectionY + h*.025);
    ctx.lineTo(w, bottom + seal);
    ctx.lineTo(0, bottom + seal);
    ctx.closePath();
    ctx.fillStyle = reflection;
    ctx.fill();
  }
  for (let i = 0; i < 185; i++) {
    const x = edge + random() * (right-edge);
    const y = top + random() * (bottom-top);
    const fleck = seal * (.08 + random() * .28);
    ctx.fillStyle = random() > .52 ? "#dbd0bd29" : "#09070a3d";
    ctx.fillRect(x, y, fleck * (1 + random()), fleck);
  }
  ctx.restore();

  for (const y of instax ? [top - seal, bottom] : [edge + seal, top - seal, bottom, h - edge - seal]) {
    ctx.fillStyle = "#e9e2ce44";
    ctx.fillRect(edge, y, right-edge, seal*.32);
    ctx.fillStyle = "#08070970";
    ctx.fillRect(edge, y + seal*.42, right-edge, seal*.65);
    for (let i = 0; i < 75; i++) {
      const x = edge + random() * (right-edge);
      ctx.fillStyle = random() > .46 ? "#f0e5cc3d" : "#100d0e37";
      ctx.fillRect(x, y + random()*seal, Math.min(right-x, seal*(.3+random()*3)), seal*.3);
    }
  }
  for (const x of [edge, right - seal]) {
    ctx.fillStyle = instax ? "#77606f80" : "#6d615666";
    ctx.fillRect(x, top, seal, bottom-top);
    ctx.fillStyle = "#09080a89";
    ctx.fillRect(x + seal*.52, top, seal*.3, bottom-top);
  }
  if (instax) {
    drawInstaxBackPrint(ctx, w, h, top, bottom, seal);
  } else {
    ctx.fillStyle = "#d3cdbaac";
    ctx.font = w*.036 + "px monospace";
    ctx.fillText(gateKey === "instant-go" ? "12001000181" : "12001000180", w*.105, bottom + h*.051);
    ctx.globalAlpha = .2;
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(edge * 1.4, h - edge * (1.55+i*.25), w - edge * 2.8, seal*.2);
    }
  }
  ctx.restore();
  drawCaption(ctx, byId("paper-back-text").value,
    {x:w+edge, y:top, w:w-edge*2, h:bottom-top},
    byId("paper-back-color").value, "middle", false, "paper-back-position");
}
const savedFolders = new Map();
async function renderEntry(canvas, source, type, edit) {
  try {
    const layers = edit?.exposures ?? (edit ? legacyExposure(edit.controls.fields) : exposureLayers);
    await Promise.all(layers.map(loadExposure));
    renderExport(canvas, source, type, edit);
  } finally {
    if (source.image !== photo) source.image.close?.();
  }
}

async function encodePhoto(canvas, source, type, edit) {
  await renderEntry(canvas, source, type, edit);
  return encodeCanvas(canvas, type);
}

const localDatabase = new Promise((resolve, reject) => {
  const request = indexedDB.open("film-rebate-workspace", 1);
  request.onupgradeneeded = () => request.result.createObjectStore("workspace");
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

async function workspaceValue(key, value) {
  const db = await localDatabase;
  return new Promise((resolve, reject) => {
    const writing = arguments.length > 1;
    const transaction = db.transaction("workspace", writing ? "readwrite" : "readonly");
    const store = transaction.objectStore("workspace");
    const request = writing ? store.put(value, key) : store.get(key);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
}

let restoringSession = true;
let sessionTimer;
let restoredPreview = null;

let projectId = null;
let defaultProjectState;
let recentProjects = [];
let switchingProject = false;
const projectArtSources = new WeakMap();

function scheduleProjectSave() {
  if (restoringSession || switchingProject || loadingPhoto || replayingHistory) return;
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(flushSession, 120);
}

function persistSession() {
  scheduleHistory();
  scheduleProjectSave();
}

function flushSession() {
  clearTimeout(sessionTimer);
  sessionTimer = undefined;
  return writeSession();
}

function projectPreferences() {
  return {accent:themeColor.value, presets:[...savedPresets], folders:[...savedFolders],
    folder:byId("export-folder").value, exportType:byId("export-type").value};
}

function restorePreferences(state) {
  const selectedPreset = presetSelect.value;
  savedPresets = [...state.presets];
  presetSelect.replaceChildren(new Option("选择已保存的预设", ""),
    ...savedPresets.map(item => new Option(item.name, item.name)));
  presetSelect.value = state.presets.some(item => item.name === selectedPreset) ? selectedPreset : "";
  byId("preset-export").disabled = !savedPresets.length;
  byId("preset-delete").disabled = !presetSelect.value;
  themeColor.value = state.accent;
  showAccent(state.accent);
  savedFolders.clear();
  for (const [id, handle] of state.folders) savedFolders.set(id, handle);
  showFolderOptions(state.folder);
  const exportType = byId("export-type");
  if (Array.from(exportType.options).some(option => option.value === state.exportType)) {
    exportType.value = state.exportType;
  }
}

function packProjectHistory() {
  const states = [];
  let index = 0;
  for (const [i, entry] of editHistory.entries()) {
    const state = {...entry, collage:null};
    const signature = historySignature(state);
    if (states.at(-1)?.signature !== signature) states.push({...state, signature});
    else if (i <= historyIndex) states[states.length - 1] = {...state, signature};
    if (i <= historyIndex) index = states.length - 1;
  }
  const artIds = new Map();
  const art = [];
  const packEdit = edit => {
    if (!edit) return null;
    const asset = edit.paperAsset?.art;
    if (asset && !artIds.has(asset)) {
      if (!projectArtSources.has(asset)) projectArtSources.set(asset, paperArtForPreset(asset.image));
      artIds.set(asset, art.length);
      art.push({name:asset.name, src:projectArtSources.get(asset)});
    }
    return {...edit, paperAsset:{}, artId:asset ? artIds.get(asset) : null};
  };
  return {index, art, states:states.map(({signature, ...state}) => ({
    ...state, emptyEdit:packEdit(state.emptyEdit),
    entries:state.entries.map(entry => ({...entry, edit:packEdit(entry.edit)}))
  }))};
}

async function unpackProjectHistory(record) {
  const art = await Promise.all((record.art ?? []).map(async asset => {
    const image = new Image();
    image.src = asset.src;
    try {
      await image.decode();
      const decoded = {name:asset.name, image};
      projectArtSources.set(decoded, asset.src);
      return decoded;
    } catch {
      return null;
    }
  }));
  const unpack = edit => {
    if (!edit) return null;
    const {artId, ...fields} = edit;
    const upgrade = controls => ({
      ...controls, fields:{...defaultFormatState.fields, ...controls.fields}
    });
    return {...fields, controls:upgrade(edit.controls),
      formats:new Map([...edit.formats].map(([format, controls]) => [format, upgrade(controls)])),
      paperAsset:art[artId] ? {art:art[artId]} : {}};

  };
  return record.states.map(state => {
    const hydrated = {
      ...state, collage:null, emptyEdit:unpack(state.emptyEdit),
      fields:Object.fromEntries(historyFields.map(id => [id, state.fields[id]])),
      entries:state.entries.map(entry => ({...entry, edit:unpack(entry.edit)}))
    };
    hydrated.signature = historySignature(hydrated);
    return hydrated;
  });
}

async function saveProjectValues(values) {
  const db = await localDatabase;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("workspace", "readwrite");
    const store = transaction.objectStore("workspace");
    for (const [key, value] of values) store.put(value, key);
    transaction.oncomplete = resolve;
    transaction.onabort = transaction.onerror = () => reject(transaction.error);
  });
}

async function writeSession() {
  if (restoringSession || loadingPhoto || replayingHistory) return;
  try {
    commitHistory();
    const values = [["preferences", projectPreferences()]];
    if (projectId && historyIndex >= 0 && (importedPhotos.length || recentProjects.some(item => item.id === projectId))) {
      const active = activePhoto ?? importedPhotos[0];
      const old = recentProjects.find(item => item.id === projectId);
      const label = importedPhotos[0]?.file.name ?? old?.label ?? "照片编辑";
      const cover = restoredPreview?.src ?? active?.thumb ?? old?.cover;
      const info = {id:projectId, label, cover, count:importedPhotos.length, time:Date.now()};
      recentProjects = [info, ...recentProjects.filter(item => item.id !== projectId)];
      const record = packProjectHistory();
      record.preview = restoredPreview?.src;
      values.push(["recent-projects", recentProjects], ["project:" + projectId, record]);
    }
    await saveProjectValues(values);
    return true;
  } catch {
    notice("无法保存本机项目，请检查可用存储空间。");
    return false;
  }
}

function showProjectPage(home) {
  byId("project-home").hidden = !home;
  document.querySelector("main").hidden = home;
  for (const element of document.querySelectorAll(".editor-action")) element.hidden = home;
  if (!home) queuePreview();
}

const recentContext = byId("recent-context");
let recentContextTarget;

function closeRecentContext(restoreFocus = false) {
  if (restoreFocus) recentContextTarget?.button.focus();
  recentContextTarget = null;
  recentContext.hidden = true;
}

function openRecentContext(item, button, x, y) {
  recentContextTarget = {id:item.id, button};
  recentContext.hidden = false;
  recentContext.style.left = clamp(x, 4, Math.max(4, innerWidth - recentContext.offsetWidth - 4)) + "px";
  recentContext.style.top = clamp(y, 4, Math.max(4, innerHeight - recentContext.offsetHeight - 4)) + "px";
  byId("recent-remove").focus();
}

async function removeRecentItems(id) {
  if (switchingProject || restoringSession || !recentProjects.length) return;
  const home = byId("project-home");
  switchingProject = true;
  home.inert = true;
  closeRecentContext();
  try {
    const remaining = id ? recentProjects.filter(item => item.id !== id) : [];
    await workspaceValue("recent-projects", remaining);
    recentProjects = remaining;
    renderRecentProjects();
    byId("home-status").textContent = id ? "已移除选中的最近使用项。" : "已清空最近使用项。";
  } catch {
    byId("home-status").textContent = "无法更新最近使用项，请重试。";
  } finally {
    switchingProject = false;
    home.inert = false;
    (byId("recent-projects").firstElementChild ?? byId("project-open")).focus();
  }
}

byId("recent-remove").onclick = () => {
  if (recentContextTarget) removeRecentItems(recentContextTarget.id);
};
byId("project-clear-recent").onclick = () => removeRecentItems();
document.addEventListener("pointerdown", event => {
  if (!recentContext.hidden && !recentContext.contains(event.target)) closeRecentContext();
});
recentContext.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  closeRecentContext(true);
});
window.addEventListener("resize", () => closeRecentContext());

function renderRecentProjects() {
  closeRecentContext();
  const list = byId("recent-projects");
  byId("project-clear-recent").disabled = !recentProjects.length;
  byId("home-status").textContent = recentProjects.length ? "" : "暂无最近项目。打开图片即可开始。";
  list.replaceChildren(...recentProjects.map(item => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent-project";
    const cover = item.cover ? document.createElement("img") : document.createElement("span");
    if (item.cover) {
      cover.src = item.cover;
      cover.alt = "";
    } else {
      cover.className = "recent-placeholder";
    }
    const name = document.createElement("strong");
    name.textContent = item.label;
    const detail = document.createElement("small");
    detail.textContent = item.count + " 张 · " + new Date(item.time).toLocaleString("zh-CN",
      {month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit"});
    button.append(cover, name, detail);
    button.onclick = () => {
      closeRecentContext();
      openProject(item.id);
    };
    button.addEventListener("contextmenu", event => {
      event.preventDefault();
      const rect = button.getBoundingClientRect();
      openRecentContext(item, button, event.clientX || rect.left, event.clientY || rect.bottom);
    });
    button.addEventListener("keydown", event => {
      if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
      event.preventDefault();
      const rect = button.getBoundingClientRect();
      openRecentContext(item, button, rect.left, rect.bottom);
    });
    return button;
  }));
}

async function startNewProject() {
  if (switchingProject || restoringSession) return;
  const id = crypto.randomUUID();
  projectId = id;
  clearTimeout(sessionTimer);
  editHistory.length = 0;
  historyIndex = -1;
  replayingHistory = true;
  collage = null;
  collageSelection = null;
  showProjectPage(false);
  try {
    await applyHistoryState(defaultProjectState, false);
  } finally {
    replayingHistory = false;
    commitHistory();
  }
}

async function openProject(id) {
  if (switchingProject || restoringSession) return;
  switchingProject = true;
  const list = byId("project-home");
  list.inert = true;
  try {
    const record = await workspaceValue("project:" + id);
    if (!record?.states.length) throw new Error("项目记录为空");
    const states = await unpackProjectHistory(record);
    const index = clamp(record.index, 0, states.length - 1);
    const state = states[index];
    replayingHistory = true;
    await applyHistoryState(state, false);
    if (record.preview && activePhoto) {
      const image = new Image();
      image.src = record.preview;
      try {
        await image.decode();
        restoredPreview = {src:record.preview, image};
      } catch {}
    }
    projectId = id;
    editHistory.splice(0, editHistory.length, ...states);
    historyIndex = index;
    editHistory[index] = captureHistory();
    showProjectPage(false);
  } catch {
    byId("home-status").textContent = "无法打开该项目，请检查原图是否可读取。";
  } finally {
    list.inert = false;
    replayingHistory = false;
    switchingProject = false;
    updateHistoryButtons();
    if (projectId) scheduleProjectSave();
  }
}

async function migratePreviousSession() {
  const previous = await workspaceValue("session");
  if (!previous?.entries?.length) {
    await workspaceValue("recent-projects", []);
    return;
  }
  const id = crypto.randomUUID();
  const art = [];
  const entries = previous.entries.map(entry => {
    const edit = {...(entry.edit ?? defaultProjectState.emptyEdit), paperAsset:{}};
    if (entry.edit?.savedArt) {
      edit.artId = art.length;
      art.push(entry.edit.savedArt);
    }
    return {id:entry.id, file:entry.file, thumb:entry.thumb, selected:Boolean(entry.selected),
      crop:{x:entry.crop?.x ?? .5, y:entry.crop?.y ?? .5, zoom:Number(entry.crop?.zoom ?? 100)}, edit};
  });
  const active = entries.find(entry => entry.id === previous.active) ?? entries[0];
  const state = {...defaultProjectState, ...projectPreferences(), signature:undefined,
    entries, active:active.id, emptyEdit:null, emptyCrop:null};
  const record = {states:[state], index:0, art, preview:previous.preview};
  recentProjects = [{id, label:entries[0].file.name, cover:previous.preview ?? active.thumb,
    count:entries.length, time:Date.now()}];
  await saveProjectValues([["recent-projects", recentProjects], ["project:" + id, record]]);
}

async function initializeProjects() {
  try {
    const [list, preferences] = await Promise.all([workspaceValue("recent-projects"), workspaceValue("preferences")]);
    if (preferences) {
      restorePreferences(preferences);
    } else {
      const folders = await workspaceValue("folders");
      let accent = themeColor.defaultValue;
      let presets = [];
      try {
        const stored = localStorage.getItem("film-rebate.ui-accent.v1");
        if (/^#[0-9a-f]{6}$/i.test(stored)) accent = stored;
        const oldPresets = JSON.parse(localStorage.getItem("film-rebate.presets.v1") || "[]");
        if (Array.isArray(oldPresets)) presets = oldPresets.filter(validPreset);
      } catch {}
      restorePreferences({accent, presets, folders:folders?.items ?? [], folder:folders?.selected ?? ""});
    }
    if (Array.isArray(list)) recentProjects = list;
    else await migratePreviousSession();
    renderRecentProjects();
  } catch {
    byId("home-status").textContent = "无法读取最近项目。仍可打开图片开始编辑。";
  } finally {
    restoringSession = false;
    byId("project-new").disabled = byId("project-open").disabled = false;
  }
}

byId("project-new").onclick = startNewProject;
byId("project-open").onclick = () => {
  // Open the picker from the user gesture and create the project after a file is chosen.
  byId("file").click();
};
byId("home-return").onclick = async () => {
  if (switchingProject || loadingPhoto || replayingHistory) return;
  commitHistory();
  switchingProject = true;
  const main = document.querySelector("main");
  main.inert = true;
  try {
    if (!await flushSession()) return;
    projectId = null;
    editHistory.length = 0;
    historyIndex = -1;
    updateHistoryButtons();
    showProjectPage(true);
    renderRecentProjects();
  } finally {
    switchingProject = false;
    main.inert = false;
  }
};
function showFolderOptions(selected = "") {
  byId("export-folder").replaceChildren(new Option("每次选择", ""), ...Array.from(savedFolders, ([id, handle]) => new Option(handle.name, id)));
  byId("export-folder").value = selected;
  byId("folder-remove").disabled = !selected;
}

function storeFolders(selected) {
  showFolderOptions(selected);
  scheduleHistory();
}

async function chooseSavedFile(directory, filename) {
  const dot = filename.lastIndexOf(".");
  let candidate = filename;
  for (let number = 2; ; number++) {
    try {
      await directory.getFileHandle(candidate);
    } catch (error) {
      if (error.name !== "NotFoundError") throw error;
      return directory.getFileHandle(candidate, {create:true});
    }
    candidate = filename.slice(0, dot) + " (" + number + ")" + filename.slice(dot);
  }
}

byId("export-folders").hidden = typeof window.showDirectoryPicker !== "function";
byId("folder-add").addEventListener("click", async () => {
  try {
    const directory = await window.showDirectoryPicker({mode:"readwrite", id:"film-rebate-folders"});
    for (const [id, handle] of savedFolders) {
      if (await handle.isSameEntry(directory)) return storeFolders(id);
    }
    const id = crypto.randomUUID();
    savedFolders.set(id, directory);
    await storeFolders(id);
  } catch (error) {
    if (error.name !== "AbortError") notice("无法添加这个保存路径。");
  }
});
byId("folder-remove").addEventListener("click", () => {
  savedFolders.delete(byId("export-folder").value);
  storeFolders("");
});
byId("export-folder").addEventListener("change", event => storeFolders(event.target.value));
const stockBrowser = byId("stock-browser");
stockBrowser.addEventListener("toggle", () => {
  if (!stockBrowser.open) return;
  const list = byId("stock-browser-list");
  list.replaceChildren(...Array.from(stock.options, option => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.textContent;
    button.setAttribute("aria-pressed", String(option.selected));
    button.addEventListener("click", () => {
      stock.value = option.value;
      stock.dispatchEvent(new Event("input", {bubbles:true}));
      stockBrowser.open = false;
    });
    return button;
  }));
  const selected = list.querySelector('[aria-pressed="true"]');
  if (selected) list.scrollTop = selected.offsetTop - list.clientHeight / 2 + selected.offsetHeight / 2;
});
stockSearch.addEventListener("input", () => { stockBrowser.open = false; });
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !restoringSession && !loadingPhoto && (sessionTimer || projectId)) {
    flushSession();
  }
});
function rangePercent(slider, value) {
  return (value - Number(slider.min)) * 100 / (Number(slider.max) - Number(slider.min));
}

function setRangeFill(slider) {
  slider.style.setProperty("--fill", rangePercent(slider, slider.valueAsNumber) + "%");
}

function setDetentMark(slider) {
  slider.style.setProperty("--detent", rangePercent(slider, Number(slider.dataset.detent)) + "%");
}

let detentDrag;
document.addEventListener("pointerdown", event => {
  if (event.button === 0 && event.isPrimary && event.target.matches('input[type="range"][data-detent]')) {
    detentDrag = {slider:event.target, pointer:event.pointerId};
  }
}, true);
for (const type of ["pointerup", "pointercancel"]) {
  window.addEventListener(type, event => {
    if (detentDrag?.pointer === event.pointerId) detentDrag = null;
  }, true);
}
window.addEventListener("blur", () => {detentDrag = null;});
document.addEventListener("input", event => {
  if (!event.isTrusted || event.target !== detentDrag?.slider) return;
  const slider = detentDrag.slider;
  const standard = Number(slider.dataset.detent);
  const distance = Math.abs(rangePercent(slider, slider.valueAsNumber) - rangePercent(slider, standard));
  if (distance <= 2.5) slider.value = standard;
}, true);

const collageDialog = byId("collage-dialog");
const collageCanvas = byId("collage-preview");
const collageImages = new WeakMap();
let collage = null;
let collageSelection = null;
let collageDrag = null;
let collageSaving = false;
let collageExportJob;
let collageFrame = 0;

function collagePhoto(file) {
  if (!collageImages.has(file)) {
    const asset = {};
    asset.ready = decodePhoto(file).then(async image => {
      try {
        const scale = Math.min(1, 1200 / Math.max(imageWidth(image), imageHeight(image)));
        asset.image = await createImageBitmap(image, {
          resizeWidth:Math.max(1, Math.round(imageWidth(image) * scale)),
          resizeHeight:Math.max(1, Math.round(imageHeight(image) * scale)), resizeQuality:"high"
        });
      } finally {
        image.close?.();
      }
    }).catch(() => { asset.failed = true; });
    collageImages.set(file, asset);
  }
  return collageImages.get(file);
}

function makeCollage(entries) {
  const columns = entries.length <= 1 ? 1 : entries.length <= 8 ? 2 : Math.ceil(Math.sqrt(entries.length * .7));
  const rows = Math.ceil(entries.length / columns);
  const angles = [-16, 12, -11, 19, -22, 9, 15, -8];
  const height = Math.max(1450, Math.round(rows / columns * 940));
  const filmGate = activeFormat === "120" ? gate.value : gate135.value;
  const chosen = Number(stock.value);
  const filmStock = gates[filmGate].roll !== 35 && stocks[chosen].only35 ? 0 : chosen;
  return {
    mode:activeFormat === "instant" ? "instant" : "film", columns:7, gap:6, height,
    filmGate, filmStock, start:frameNumbers[filmGate],
    filmMarks:{stock:filmStock, age:Number(byId("age").value), ink:customInk ? imprintColor.value : null,
      halo:Number(imprintHalo.value), name:customImprint.checked ? imprintName.value.trim() : ""},
    paperGate:paperSize.value, paperStyle:paperFinish.value, paperBase:paperColor.value,
    paperAccent:patternColor.value, paperArt:paperAsset.art ?? null, paperFile:null,
    backgroundMode:"solid", backgroundColor:"#202022", backgroundFile:null, backgroundBlur:35,
    backgroundRatio:"auto", ratioWidth:4, ratioHeight:5,
    cards:entries.map((entry, i) => ({
      id:entry.id, file:entry.file,
      x:(i % columns + .5 + (i % 2 ? .09 : -.06)) * 1000 / columns,
      y:(Math.floor(i / columns) + .5 + (i % 2 ? .08 : -.08)) * height / rows,
      angle:angles[i % angles.length], scale:100, zoom:120, panX:0, panY:0
    }))
  };
}

function instantCollageHeight() {
  if (collage.backgroundRatio === "auto") return collage.height;
  const [width, height] = collage.backgroundRatio === "custom"
    ? [collage.ratioWidth, collage.ratioHeight]
    : collage.backgroundRatio.split(":").map(Number);
  return 1000 * height / width;
}

function collageCardY(card) {
  return card.y * instantCollageHeight() / collage.height;
}

function collageDimensions() {
  if (collage.mode === "instant") return {w:1000, h:instantCollageHeight()};
  if (!collage.cards.length) return {w:1000, h:580, rows:[]};
  const geometry = collageFilmGeometry();
  const columns = Math.min(collage.columns, collage.cards.length, geometry.frames);
  const cellW = 960 / columns;
  const cellH = cellW * geometry.roll / geometry.pitch;
  const rowGap = cellH * collage.gap / 100;
  const rows = [];
  let offset = 0;
  let frameNumber = collage.start;
  while (offset < collage.cards.length) {
    const count = Math.min(columns, geometry.frames - frameNumber + 1);
    const cards = collage.cards.slice(offset, offset + count);
    rows.push({cards, first:frameNumber});
    offset += cards.length;
    frameNumber = frameNumber + count > geometry.frames ? 1 : frameNumber + count;
  }
  return {w:1000, h:40 + rows.length * cellH + (rows.length - 1) * rowGap, rows, cellW, cellH, rowGap};
}

function drawCollagePhoto(ctx, card, x, y, w, h) {
  const image = collageImages.get(card.file)?.image;
  ctx.fillStyle = "#1c1c1f";
  ctx.fillRect(x, y, w, h);
  if (!image) return;
  const zoomFactor = collage.mode === "instant" ? card.zoom / 100 : 1;
  const scale = Math.max(w / image.width, h / image.height) * zoomFactor;
  const iw = image.width * scale;
  const ih = image.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(image, x + (w-iw)/2 + (iw-w)/2*card.panX, y + (h-ih)/2 + (ih-h)/2*card.panY, iw, ih);
  ctx.restore();
}

function collageFilmGeometry() {
  const dimensions = gates[collage.filmGate];
  return {...dimensions, perforated:dimensions.roll === 35,
    half:collage.filmGate === "half", wide:collage.filmGate === "xpan",
    marginX:(dimensions.pitch-dimensions.width)/2, marginY:(dimensions.roll-dimensions.height)/2};
}

function drawCollageFilm(ctx, {rows, cellW, cellH, rowGap}) {
  const geometry = collageFilmGeometry();
  const stock = stocks[collage.filmStock];
  const factor = cellW / geometry.pitch;
  for (const [rowIndex, row] of rows.entries()) {
    for (const [column, card] of row.cards.entries()) {
      const frameNumber = row.first + column;
      ctx.save();
      ctx.translate(20 + column * cellW, 20 + rowIndex * (cellH + rowGap));
      ctx.scale(factor, factor);
      drawRebate(ctx, geometry, stock, frameNumber, collage.filmMarks);
      drawCollagePhoto(ctx, {...card, panX:0, panY:0}, geometry.marginX, geometry.marginY, geometry.width, geometry.height);
      if (geometry.perforated) scanPerforations(ctx, stock, geometry, "#ffffff", frameNumber);
      ctx.restore();
    }
  }
}

function collageCardSize(card) {
  const columns = collage.cards.length <= 8 ? 2 : Math.ceil(Math.sqrt(collage.cards.length * .7));
  const heightFactor = Math.min(1, instantCollageHeight() / 1000);
  const w = (collage.cards.length === 1 ? 660 : 1150 / columns) * card.scale / 100 * heightFactor;
  const gate = gates[collage.paperGate];
  return {w, h:w * gate.paperHeight / gate.paperWidth};
}

function drawCollageInstant(ctx, preview) {
  for (const card of collage.cards) {
    const {w, h} = collageCardSize(card);
    ctx.save();
    ctx.translate(card.x, collageCardY(card));
    ctx.rotate(card.angle * Math.PI / 180);
    ctx.shadowColor = "#0009";
    ctx.shadowBlur = Math.max(3, ctx.canvas.width / 120);
    ctx.shadowOffsetY = ctx.canvas.width / 300;
    ctx.fillStyle = collage.paperBase;
    ctx.fillRect(-w/2, -h/2, w, h);
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.translate(-w/2, -h/2);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    const gate = gates[collage.paperGate];
    const apertureW = w * gate.width / gate.paperWidth;
    const apertureH = h * gate.height / gate.paperHeight;
    const apertureX = (w - apertureW) / 2;
    const apertureY = h * gate.top / gate.paperHeight;
    const style = collage.paperStyle;
    const art = collage.paperFile ? collageImages.get(collage.paperFile)?.image : collage.paperArt?.image;
    if (style === "image" && art) {
      const fit = Math.max(w / imageWidth(art), h / imageHeight(art));
      const iw = imageWidth(art)*fit;
      const ih = imageHeight(art)*fit;
      ctx.drawImage(art, (w-iw)/2, (h-ih)/2, iw, ih);
    } else if (Object.hasOwn(instantStyleColors, style)) {
      drawInstantStyle(ctx, {canvasW:w, canvasH:h,
        picture:{x:apertureX,y:apertureY,w:apertureW,h:apertureH}}, style, collage.paperBase, collage.paperAccent);
    } else if (style !== "solid" && style !== "image") {
      ctx.fillStyle = paperPattern(ctx, style, Math.min(w,h)/6, collage.paperAccent);
      ctx.fillRect(0, 0, w, h);
    }
    const paper = ctx.createLinearGradient(0, 0, w, h);
    paper.addColorStop(0, "#ffffff1a");
    paper.addColorStop(1, "#00000016");
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, h);
    if (gate.round) {
      ctx.beginPath();
      ctx.ellipse(apertureX+apertureW/2, apertureY+apertureH/2, apertureW/2, apertureH/2, 0, 0, Math.PI*2);
      ctx.clip();
    }
    drawCollagePhoto(ctx, card, apertureX, apertureY, apertureW, apertureH);
    ctx.restore();
    if (preview && card.id === collageSelection) {
      ctx.strokeStyle = "#6df3e1";
      ctx.lineWidth = 3;
      ctx.strokeRect(-w/2, -h/2, w, h);
    }
    ctx.restore();
  }
}

function drawCollageBackground(ctx, {w, h}) {
  ctx.fillStyle = collage.mode === "film" ? "#fff" : collage.backgroundColor;
  ctx.fillRect(0, 0, w, h);
  if (collage.mode !== "instant" || collage.backgroundMode !== "photo" || !collage.backgroundFile) return;
  const image = collageImages.get(collage.backgroundFile)?.image;
  if (!image) return;
  const blur = Math.min(w,h) * .045 * collage.backgroundBlur / 100;
  const extra = blur * 3;
  const scale = Math.max((w+extra*2)/image.width, (h+extra*2)/image.height);
  const iw = image.width * scale;
  const ih = image.height * scale;
  ctx.save();
  if (blur) {
    ctx.filter = "blur(" + blur * ctx.canvas.width / w + "px)";
  }
  ctx.drawImage(image, (w-iw)/2, (h-ih)/2, iw, ih);
  ctx.restore();
}

function renderCollage(canvas, width, preview = false) {
  const dimensions = collageDimensions();
  canvas.width = width;
  canvas.height = Math.max(1, Math.round(width * dimensions.h / dimensions.w));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(canvas.width / dimensions.w, 0, 0, canvas.height / dimensions.h, 0, 0);
  ctx.imageSmoothingQuality = "high";
  drawCollageBackground(ctx, dimensions);
  if (!collage.cards.length) return;
  if (collage.mode === "film") drawCollageFilm(ctx, dimensions);
  else drawCollageInstant(ctx, preview);
}

function queueCollage() {
  if (collageFrame) return;
  collageFrame = requestAnimationFrame(() => {
    collageFrame = 0;
    if (!collage || !collageDialog.open) return;
    const {w, h} = collageDimensions();
    collageCanvas.style.setProperty("--collage-width", "min(100%, " + (65 * w / h) + "vh)");
    renderCollage(collageCanvas, Math.min(1400, Math.round(1800 * w / h)), true);
  });
}

const selectedCollageCard = () => collage?.cards.find(card => card.id === collageSelection);

function updateCollageControls() {
  if (!collage) return;
  const instant = collage.mode === "instant";
  const card = selectedCollageCard();
  collageCanvas.toggleAttribute("data-editable", instant);
  byId("collage-mode").value = collage.mode;
  byId("collage-film-tools").hidden = instant;
  byId("collage-instant-tools").hidden = !instant;
  byId("collage-columns").value = collage.columns;
  byId("collage-gap").value = collage.gap;
  setDetentMark(byId("collage-gap"));
  byId("collage-background-ratio").value = collage.backgroundRatio;
  byId("collage-custom-ratio").hidden = collage.backgroundRatio !== "custom";
  byId("collage-ratio-width").value = collage.ratioWidth;
  byId("collage-ratio-height").value = collage.ratioHeight;
  byId("collage-background-mode").value = collage.backgroundMode;
  byId("collage-background-color").value = collage.backgroundColor;
  byId("collage-background-color-field").hidden = collage.backgroundMode !== "solid";
  byId("collage-background-photo-fields").hidden = collage.backgroundMode !== "photo";
  byId("collage-background-name").textContent = collage.backgroundFile?.name ?? "尚未导入背景照片";
  const blur = byId("collage-background-blur");
  blur.value = collage.backgroundBlur;
  setDetentMark(blur);
  setRangeFill(blur);
  byId("collage-background-blur-value").value = blur.value + "%";
  byId("collage-film-gate").value = collage.filmGate;
  const stockPicker = byId("collage-stock");
  const is135 = gates[collage.filmGate].roll === 35;
  if (stockPicker.dataset.perforated !== String(is135)) {
    stockPicker.dataset.perforated = String(is135);
    stockPicker.replaceChildren(...stocks.flatMap((item, index) =>
      is135 || !item.only35 ? [new Option(item.name, index)] : []));
  }
  stockPicker.value = collage.filmStock;
  byId("collage-start").max = gates[collage.filmGate].frames;
  byId("collage-start").value = collage.start;
  byId("collage-paper-size").value = collage.paperGate;
  byId("collage-paper-style").value = collage.paperStyle;
  byId("collage-paper-base").value = collage.paperBase;
  byId("collage-paper-accent").value = collage.paperAccent;
  byId("collage-paper-accent-field").hidden = ["solid", "image"].includes(collage.paperStyle);
  byId("collage-paper-import").hidden = collage.paperStyle !== "image";
  byId("collage-save").disabled = !collage.cards.length || collageSaving;
  byId("collage-import").disabled = collage.cards.length >= 40 || collageSaving;
  const picker = byId("collage-item");
  picker.replaceChildren(...collage.cards.map(item => new Option(item.file.name, item.id)));
  picker.value = card?.id ?? "";
  for (const [id, key, fallback] of [["collage-angle","angle",0], ["collage-scale","scale",100], ["collage-zoom","zoom",120]]) {
    byId(id).disabled = !card;
    byId(id).value = card?.[key] ?? fallback;
    setRangeFill(byId(id));
    if (byId(id).hasAttribute("data-detent")) setDetentMark(byId(id));
  }
  byId("collage-front").disabled = !card;
  setRangeFill(byId("collage-gap"));
  byId("collage-status").textContent = collage.cards.length + " / 40 张";
  queueCollage();
}

async function loadCollageImages(state, job) {
  const cards = [...state.cards];
  if (state.paperFile) cards.push({file:state.paperFile});
  if (state.backgroundFile) cards.push({file:state.backgroundFile});
  const total = cards.length;
  await Promise.all(Array.from({length:job ? 1 : 3}, async () => {
    while (cards.length && collage === state) {
      if (job) await job.checkpoint("已载入 " + (total - cards.length) + " / " + total + " 张");
      await collagePhoto(cards.shift().file).ready;
      queueCollage();
    }
  }));
  if (collageSaving || state !== collage || !collageDialog.open) return;
  const failed = state.cards.filter(card => collagePhoto(card.file).failed).length;
  byId("collage-status").textContent = state.cards.length + " / 40 张" + (failed ? " · " + failed + " 张无法读取" : "");
}

byId("collage-open").onclick = () => {
  const selected = exportEntries("selected");
  const requested = selected.length ? selected : importedPhotos;
  const entries = requested.length <= 40 ? requested : [];
  if (requested.length > 40 && !collage) {
    notice("拼图最多容纳 40 张。可直接添加本机图片，或在照片条勾选要用的照片。");
  }
  const selectionKey = entries.map(entry => entry.id).join(",");
  if (!collage || (entries.length && collage.selectionKey !== selectionKey)) {
    collage = {...makeCollage(entries), selectionKey};
    collageSelection = null;
  }
  collageDialog.showModal();
  updateCollageControls();
  loadCollageImages(collage);
  scheduleHistory();
};
for (const [id, source] of [["collage-paper-size", paperSize], ["collage-paper-style", paperFinish]]) {
  byId(id).replaceChildren(...Array.from(source.children, option => option.cloneNode(true)));
}

let replaceCollageFiles = false;
function pickCollageFiles(replace) {
  replaceCollageFiles = replace;
  byId("collage-files").click();
}
byId("collage-import").onclick = () => pickCollageFiles(false);
byId("collage-replace").onclick = () => pickCollageFiles(true);
byId("collage-files").onchange = event => {
  const available = replaceCollageFiles ? 40 : 40 - collage.cards.length;
  const files = Array.from(event.target.files).slice(0, available);
  const exceeded = event.target.files.length > available;
  event.target.value = "";
  if (!files.length) return;
  const entries = files.map(file => ({id:crypto.randomUUID(), file}));
  const currentCards = replaceCollageFiles ? [] : collage.cards;
  const old = new Map(currentCards.map(card => [card.id, card]));
  const arranged = makeCollage([...currentCards, ...entries]);
  collage.height = replaceCollageFiles ? arranged.height : Math.max(collage.height, arranged.height);
  if (replaceCollageFiles) collageSelection = null;
  collage.cards = arranged.cards.map(card => old.get(card.id) ?? card);
  if (collage.mode === "instant" && !collageSelection) collageSelection = entries[0].id;
  updateCollageControls();
  loadCollageImages(collage);
  if (exceeded) notice("已添加到 40 张上限。");
  scheduleHistory();
};
byId("collage-film-gate").onchange = event => {
  collage.filmGate = event.target.value;
  const gate = gates[collage.filmGate];
  collage.start = Math.min(collage.start, gate.frames);
  if (gate.roll !== 35 && stocks[collage.filmStock].only35) {
    setCollageStock(0);
  }
  updateCollageControls();
  scheduleHistory();
};
function setCollageStock(index) {
  collage.filmStock = index;
  collage.filmMarks = {stock:index, age:stocks[index].expired ?? 0, ink:null, halo:0, name:""};
}
byId("collage-stock").onchange = event => {
  setCollageStock(Number(event.target.value));
  queueCollage();
  scheduleHistory();
};
byId("collage-start").onchange = event => {
  collage.start = clamp(Math.round(event.target.valueAsNumber || 1), 1, gates[collage.filmGate].frames);
  updateCollageControls();
  scheduleHistory();
};
byId("collage-paper-size").onchange = event => {
  collage.paperGate = event.target.value;
  updateCollageControls();
  scheduleHistory();
};
byId("collage-paper-style").onchange = event => {
  collage.paperStyle = event.target.value;
  if (Object.hasOwn(instantStyleColors, collage.paperStyle)) {
    [collage.paperBase, collage.paperAccent] = instantStyleColors[collage.paperStyle];
  }
  updateCollageControls();
  scheduleHistory();
};
for (const [id, key] of [["collage-paper-base","paperBase"], ["collage-paper-accent","paperAccent"]]) {
  byId(id).oninput = event => {
    collage[key] = event.target.value;
    queueCollage();
    scheduleHistory();
  };
}
byId("collage-background-ratio").onchange = event => {
  collage.backgroundRatio = event.target.value;
  updateCollageControls();
  scheduleHistory();
};
for (const [id, key] of [["collage-ratio-width","ratioWidth"], ["collage-ratio-height","ratioHeight"]]) {
  byId(id).onchange = event => {
    const control = event.target;
    const value = control.valueAsNumber;
    const width = key === "ratioWidth" ? value : collage.ratioWidth;
    const height = key === "ratioHeight" ? value : collage.ratioHeight;
    if (!control.validity.valid || !Number.isFinite(value) || width / height < .2 || width / height > 5) {
      byId("collage-status").textContent = "请输入有效宽高，比例范围为 1:5 到 5:1。";
      control.value = collage[key];
      return;
    }
    collage[key] = value;
    updateCollageControls();
    scheduleHistory();
  };
}

byId("collage-background-mode").onchange = event => {
  collage.backgroundMode = event.target.value;
  updateCollageControls();
  scheduleHistory();
};
byId("collage-background-color").oninput = event => {
  collage.backgroundColor = event.target.value;
  queueCollage();
  scheduleHistory();
};
byId("collage-background-blur").oninput = event => {
  collage.backgroundBlur = event.target.valueAsNumber;
  byId("collage-background-blur-value").value = event.target.value + "%";
  setRangeFill(event.target);
  queueCollage();
  scheduleHistory();
};
byId("collage-background-import").onclick = () => byId("collage-background-file").click();
byId("collage-background-file").onchange = async event => {
  const file = event.target.files[0];
  event.target.value = "";
  const state = collage;
  if (!file || !state) return;
  const asset = collagePhoto(file);
  await asset.ready;
  if (state !== collage || !collageDialog.open || collageSaving) return;
  if (!asset.image) {
    byId("collage-background-name").textContent = "无法读取这张背景照片";
    return;
  }
  collage.backgroundFile = file;
  updateCollageControls();
  scheduleHistory();
};

byId("collage-paper-import").onclick = () => byId("collage-paper-file").click();
byId("collage-paper-file").onchange = async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file || !collage) return;
  const state = collage;
  const asset = collagePhoto(file);
  await asset.ready;
  if (state !== collage || !collageDialog.open) return;
  if (!asset.image) {
    byId("collage-status").textContent = "无法读取这张边框图片";
    return;
  }
  collage.paperFile = file;
  queueCollage();
  scheduleHistory();
};

byId("collage-close").onclick = () => collageDialog.close();
collageDialog.addEventListener("cancel", event => {
  if (!collageSaving) return;
  event.preventDefault();
  collageExportJob?.pause();
});
byId("collage-mode").onchange = event => {
  collage.mode = event.target.value;
  updateCollageControls();
  scheduleHistory();
};
byId("collage-columns").onchange = event => {
  collage.columns = clamp(Math.round(event.target.valueAsNumber || 7), 1, 10);
  updateCollageControls();
  scheduleHistory();
};
byId("collage-gap").oninput = event => {
  collage.gap = event.target.valueAsNumber;
  setRangeFill(event.target);
  queueCollage();
  scheduleHistory();
};
byId("collage-item").onchange = event => {
  collageSelection = event.target.value;
  updateCollageControls();
};
for (const [id,key] of [["collage-angle","angle"], ["collage-scale","scale"], ["collage-zoom","zoom"]]) {
  byId(id).oninput = event => {
    const card = selectedCollageCard();
    if (!card) return;
    card[key] = event.target.valueAsNumber;
    setRangeFill(event.target);
    queueCollage();
    scheduleHistory();
  };
}
byId("collage-front").onclick = () => {
  const card = selectedCollageCard();
  if (!card) return;
  collage.cards = [...collage.cards.filter(item => item !== card), card];
  updateCollageControls();
  scheduleHistory();
};

function collagePoint(event) {
  const bounds = collageCanvas.getBoundingClientRect();
  const {w, h} = collageDimensions();
  return {x:(event.clientX-bounds.left)*w/bounds.width, y:(event.clientY-bounds.top)*h/bounds.height};
}

function collageLocal(dx, dy, card) {
  const angle = card.angle * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {x:dx*cos + dy*sin, y:-dx*sin + dy*cos};
}

collageCanvas.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0 || collageSaving || collage.mode !== "instant") return;
  const point = collagePoint(event);
  const card = [...collage.cards].reverse().find(candidate => {
    const {x,y} = collageLocal(point.x-candidate.x, point.y-collageCardY(candidate), candidate);
    const {w,h} = collageCardSize(candidate);
    return Math.abs(x) <= w/2 && Math.abs(y) <= h/2;
  });
  if (!card) return;
  collageSelection = card.id;
  const moveImage = byId("collage-drag-mode").value === "image";
  collageDrag = {pointer:event.pointerId, card, start:point, x:card.x, y:card.y, panX:card.panX, panY:card.panY,
    moveImage:moveImage !== event.shiftKey};
  collageCanvas.setPointerCapture(event.pointerId);
  updateCollageControls();
});
collageCanvas.addEventListener("pointermove", event => {
  if (event.pointerId !== collageDrag?.pointer) return;
  const {card, start, moveImage, x, y, panX, panY} = collageDrag;
  const point = collagePoint(event);
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  if (moveImage) {
    const image = collagePhoto(card.file).image;
    if (!image) return;
    const local = collageLocal(dx, dy, card);
    const size = collageCardSize(card);
    const gate = gates[collage.paperGate];
    const w = size.w * gate.width / gate.paperWidth;
    const h = size.h * gate.height / gate.paperHeight;
    const scale = Math.max(w / image.width, h / image.height) * card.zoom / 100;
    const rangeX = (image.width * scale - w) / 2;
    const rangeY = (image.height * scale - h) / 2;
    if (rangeX > .001) card.panX = clamp(panX + local.x/rangeX, -1, 1);
    if (rangeY > .001) card.panY = clamp(panY + local.y/rangeY, -1, 1);
  } else {
    card.x = clamp(x+dx, 0, 1000);
    card.y = clamp(y + dy * collage.height / instantCollageHeight(), 0, collage.height);
  }
  queueCollage();
});
collageCanvas.addEventListener("lostpointercapture", () => {
  collageDrag = null;
  commitHistory();
});

byId("collage-save").onclick = async () => {
  if (!collage?.cards.length || collageSaving) return;
  const state = collage;
  const type = byId("collage-type").value;
  const filename = (collage.mode === "film" ? "片边_多行胶片" : "片边_拍立得拼图") + "." + type;
  collageSaving = true;
  updateHistoryButtons();
  byId("collage-close").disabled = byId("collage-save").disabled = true;
  const controls = collageDialog.querySelector(".collage-workspace");
  controls.inert = true;
  const pause = byId("collage-export-pause");
  const stop = byId("collage-export-stop");
  const status = byId("collage-status");
  let message;
  status.textContent = "正在选择保存位置…";
  try {
    const handle = typeof window.showSaveFilePicker === "function" ? await window.showSaveFilePicker({
      id:"film-rebate-collage", suggestedName:filename,
      types:[{accept:{[exportMimeTypes[type]]:["." + type]}}]
    }) : null;
    pause.hidden = false;
    collageExportJob = createExportJob(pause, stop, status);
    const job = collageExportJob;
    await loadCollageImages(state, job);
    await job.checkpoint("正在合成拼图");
    if (state.mode === "instant" && state.backgroundMode === "photo" && state.backgroundFile &&
        !collagePhoto(state.backgroundFile).image) {
      throw new Error("无法读取背景照片，请重新导入。");
    }
    if (state.cards.some(card => !collagePhoto(card.file).image)) {
      throw new Error("有照片无法读取，请在照片条重新选择后再导出。");
    }
    const canvas = document.createElement("canvas");
    const {w,h} = collageDimensions();
    renderCollage(canvas, Math.min(3600, Math.round(6500 * w / h)));
    const output = await encodeCanvas(canvas, type);
    await job.write("正在准备写入文件…", async () => {
      status.textContent = "正在写入文件…";
      await saveExport(output, filename, handle);
    });
    message = "拼图已保存";
  } catch (error) {
    if (error.name !== "AbortError") message = error.message || "拼图保存失败";
    else if (collageExportJob) message = "已结束本次导出";
  } finally {
    collageExportJob?.dispose();
    collageExportJob = null;
    pause.hidden = true;
    collageSaving = false;
    updateHistoryButtons();
    controls.inert = false;
    byId("collage-close").disabled = false;
    updateCollageControls();
    if (message) status.textContent = message;
  }
};
const historyFields = ["compare-enabled", "compare-mode", "compare-split", "export-type", "jpg-compression"];
const editHistory = [];
const historyObjectIds = new WeakMap();
let nextHistoryId = 1;
let historyIndex = -1;
let pendingHistory;
let historyPointer;
let replayingHistory = false;

function historyIdentity(object) {
  if (!object) return null;
  if (!historyObjectIds.has(object)) historyObjectIds.set(object, nextHistoryId++);
  return historyObjectIds.get(object);
}

function copyHistoryEdit(edit) {
  const copy = {...edit};
  copy.formats = new Map([...edit.formats].map(([format, state]) => [format, {...state}]));
  copy.paperAsset = edit.paperAsset?.art ? {art:edit.paperAsset.art} : {};
  return copy;
}

function captureHistory() {
  const current = capturePhotoSettings();
  const entries = importedPhotos.map(entry => {
    const active = entry === activePhoto;
    const crop = active ? {x:cropX, y:cropY, zoom:Number(zoom.value)} : entry.crop;
    return {
      ...entry, selected:Boolean(entry.selected),
      crop:{x:crop?.x ?? .5, y:crop?.y ?? .5, zoom:Number(crop?.zoom ?? 100)},
      edit:copyHistoryEdit(active ? current : entry.edit)
    };
  });
  const state = {
    entries, active:activePhoto?.id, emptyEdit:entries.length ? null : copyHistoryEdit(current),
    emptyCrop:entries.length ? null : {x:cropX, y:cropY, zoom:Number(zoom.value)},
    accent:themeColor.value, presets:[...savedPresets], folders:[...savedFolders], folder:byId("export-folder").value,
    fields:Object.fromEntries(historyFields.map(id => {
      const field = byId(id);
      return [id, field.type === "checkbox" ? field.checked : field.value];
    })),
    previewZoom, collage:collage && {...collage, cards:collage.cards.map(card => ({...card}))}
  };
  state.signature = historySignature(state);
  return state;
}

function historySignature(state) {
  return JSON.stringify(state, (key, value) => {
    if (key === "active" || key === "thumb" || key === "signature") return undefined;
    if (key === "paperAsset") return historyIdentity(value.art);
    if (key === "paperArt") return historyIdentity(value);
    if (value instanceof Blob || value?.kind === "directory") return historyIdentity(value);
    if (value instanceof Map) return [...value].sort(([a], [b]) => a.localeCompare(b));
    return value;
  });
}

function updateHistoryButtons() {
  const busy = !projectId || replayingHistory || loadingPhoto || restoringSession;
  byId("history-undo").disabled = busy || historyIndex <= 0;
  byId("history-redo").disabled = busy || historyIndex >= editHistory.length - 1;
  byId("collage-undo").disabled = busy || collageSaving || historyIndex <= 0;
  byId("collage-redo").disabled = busy || collageSaving || historyIndex >= editHistory.length - 1;
}

function commitHistory() {
  if (!projectId || replayingHistory || loadingPhoto || restoringSession || historyPointer !== undefined || drag || collageDrag) return;
  clearTimeout(pendingHistory);
  const state = captureHistory();
  if (editHistory[historyIndex]?.signature === state.signature) {
    if (historyIndex >= 0) editHistory[historyIndex] = state;
  } else {
    editHistory.splice(historyIndex + 1, Infinity, state);
    if (editHistory.length > 61) editHistory.shift();
    historyIndex = editHistory.length - 1;
    scheduleProjectSave();
  }
  updateHistoryButtons();
}

function scheduleHistory() {
  updateHistoryButtons();
  if (replayingHistory || loadingPhoto || restoringSession) return;
  if (!projectId) {
    scheduleProjectSave();
    return;
  }
  clearTimeout(pendingHistory);
  pendingHistory = setTimeout(commitHistory, 250);
}

async function applyHistoryState(state, applyPreferences = true) {
  const target = state.entries.find(entry => entry.id === state.active) ?? state.entries[0];
  const keepBrush = applyPreferences && target?.id === activePhoto?.id && brushEnabled.checked;
  const reused = target && activePhoto?.id === target.id && activePhoto.file.name === target.file.name && photo;
  const image = target ? (reused || await decodePhoto(target.file)) : undefined;

  if (photo && photo !== image) photo.close?.();
  activePhoto = photo = undefined;
  stopBrush();
  setCropMode(false);
  restoredPreview = null;
  selectedCaption = null;
  importedPhotos = state.entries.map(entry => ({...entry, edit:copyHistoryEdit(entry.edit)}));

  if (applyPreferences) restorePreferences(state);
  for (const [id, value] of Object.entries(state.fields)) {
    if (id === "export-type" && !applyPreferences) continue;
    const field = byId(id);
    if (!field || value === undefined) continue;
    if (field.type === "checkbox") field.checked = value;
    else field.value = value;
  }
  byId("compare-mode").dispatchEvent(new Event("input"));
  setPreviewZoom(state.previewZoom);
  if (target) {
    activatePhoto(image, importedPhotos.find(entry => entry.id === target.id));
    if (keepBrush) {
      brushEnabled.checked = true;
      updateBrushControls();
    }
  } else {
    photoName = undefined;
    if (state.emptyEdit) {
      restorePhotoSettings(copyHistoryEdit(state.emptyEdit));
      cropX = state.emptyCrop.x;
      cropY = state.emptyCrop.y;
      zoom.value = state.emptyCrop.zoom;
    }
    histogram.getContext("2d").clearRect(0, 0, histogram.width, histogram.height);
    updateControls();
  }
  updatePhotoQueue();
  if (exportDialog.open) updateExportNote();
  if (collageDialog.open && !state.collage) collageDialog.close();
  collage = state.collage && {...state.collage, cards:state.collage.cards.map(card => ({...card}))};
  if (collageDialog.open) {
    updateCollageControls();
    loadCollageImages(collage);
  }
}
 
async function stepHistory(direction) {
  if (!projectId || switchingProject || replayingHistory || restoringSession || loadingPhoto || drag || collageDrag || collageSaving ||
      (exportDialog.open && byId("export-save").disabled)) return;
  commitHistory();
  const index = historyIndex + direction;
  const state = editHistory[index];
  if (!state) return;

  replayingHistory = true;
  clearTimeout(sessionTimer);
  updateHistoryButtons();
  const main = document.querySelector("main");
  main.inert = true;
  try {
    await applyHistoryState(state);
    historyIndex = index;
    notice(direction < 0 ? "已撤回上一步" : "已恢复下一步");
  } catch {
    notice("无法恢复这一步，请检查照片能否读取。");
  } finally {
    main.inert = false;
    replayingHistory = false;
    persistSession();
  }
}

byId("history-undo").addEventListener("click", () => stepHistory(-1));
byId("history-redo").addEventListener("click", () => stepHistory(1));
byId("collage-undo").addEventListener("click", () => stepHistory(-1));
byId("collage-redo").addEventListener("click", () => stepHistory(1));
document.addEventListener("keydown", event => {
  if (!projectId || !event.ctrlKey || event.altKey || event.metaKey || event.isComposing || presetDialog.open) return;
  const key = event.key.toLowerCase();
  if (key !== "z" && key !== "y") return;
  const direction = key === "y" || event.shiftKey ? 1 : -1;
  event.preventDefault();
  stepHistory(direction);
});

document.addEventListener("pointerdown", event => {
  if (!event.isPrimary || event.button !== 0) return;
  commitHistory();
  if (event.target.matches('input[type="range"], #film, #compare-divider')) {
    historyPointer = event.pointerId;
  }
}, true);
for (const type of ["pointerup", "pointercancel"]) {
  window.addEventListener(type, event => {
    if (historyPointer !== event.pointerId) return;
    historyPointer = undefined;
    setTimeout(commitHistory, 0);
  }, true);
}
window.addEventListener("blur", () => {
  historyPointer = undefined;
  scheduleHistory();
});
for (const type of ["input", "change"]) {
  document.addEventListener(type, event => {
    if (event.target.closest("#settings, #theme-panel, #preview-tools, #export-dialog, #collage-dialog")) scheduleHistory();
  }, true);
}
initializeCaptionFonts();
for (const family of ["Ma Shan Zheng", "Long Cang", "Caveat", "Great Vibes", "Satisfy", "Dancing Script",
  "Zhi Mang Xing", "Liu Jian Mao Cao", "Mrs Saint Delafield", "Yesteryear",
  "ZCOOL KuaiLe", "ZCOOL QingKe HuangYou", "Allura", "Sacramento", "Pinyon Script"]) {
  document.fonts.load('18px "' + family + '"', "片边 Film").then(queuePreview, () => {});
}
date.value = today();
updateControls();
defaultProjectState = captureHistory();
importQueue = initializeProjects();
