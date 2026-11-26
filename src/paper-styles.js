"use strict";

const paperSwatches = [
  ["经典白","#ffffff"], ["哑光黑","#171719"], ["天空蓝","#9cceeb"], ["柠檬粉","#f2adbd"],
  ["柔薰衣草","#d9cdea"], ["薄荷绿","#b6dfcc"], ["奶油黄","#f6e2aa"], ["石纹灰","#727478"]
];

// Original renderings inspired by instant film editions. Colors can be swapped
// independently of the pattern or the size of the paper.
const instantStyleColors = {
  rainbow:["#ffc7de","#a0d9f0"], sunset:["#f57f85","#5e4b83"],
  marble:["#2f81af","#e5f5fa"], stone:["#575a5f","#cdd0d2"],
  confetti:["#fff6e8","#f493a5"], contact:["#171719","#db9452"],
  metallic:["#a3a9ae","#f4f7fa"], hearts:["#fff9f5","#db6b81"]
};

const instantTextures = new Map();
function surfaceVariation(style, accent) {
  const key = style+accent;
  if (instantTextures.has(key)) return instantTextures.get(key);
  const canvas = document.createElement("canvas");
  const size = canvas.width = canvas.height = 320;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size,size);
  const random = seeded(1739);
  const rgb = [1,3,5].map(offset => parseInt(accent.slice(offset,offset+2),16));
  for (let y=0; y<size; y++) {
    for (let x=0; x<size; x++) {
      const u=x/size;
      const v=y/size;
      const cloud = Math.sin(u*18+v*5+Math.sin(v*9)*2) * Math.cos(v*23+Math.sin(u*14)*1.6);
      const noise = random();
      const ridge = Math.abs(Math.sin(u*17+v*9 + Math.sin(u*9+v*6)*2.2 + cloud*.9));
      const value = style === "marble"
        ? (ridge < .17 ? .55*(1-ridge/.17) : .025) + .12*cloud
        : cloud*.18 + (noise-.48)*.22 + (noise > .986 ? .29 : 0);
      const i = (y*size+x)*4;
      for (let c=0;c<3;c++) image.data[i+c] = value < 0 ? 0 : rgb[c];
      image.data[i+3] = Math.min(255, Math.abs(value)*258);
    }
  }
  ctx.putImageData(image,0,0);
  if (instantTextures.size >= 8) instantTextures.delete(instantTextures.keys().next().value);
  instantTextures.set(key,canvas);
  return canvas;
}

function drawInstantStyle(ctx, geometry, style, base, accent) {
  const {canvasW:w, canvasH:h, picture} = geometry;
  const random = seeded(6421);
  if (style === "rainbow" || style === "sunset" || style === "metallic") {
    const fill = ctx.createLinearGradient(0, 0, style === "rainbow" ? w : w*.20, h);
    fill.addColorStop(0,base);
    if (style === "rainbow") {
      fill.addColorStop(.27,"#ffe6aa");
      fill.addColorStop(.52,"#c7ebc8");
      fill.addColorStop(.76,"#c8b6ed");
    } else if (style === "sunset") {
      fill.addColorStop(.25,"#f3b082");
      fill.addColorStop(.64,"#9c608e");
    } else {
      fill.addColorStop(.27,accent);
      fill.addColorStop(.43,base);
      fill.addColorStop(.69,accent);
    }
    fill.addColorStop(1,style === "metallic" ? base : accent);
    ctx.fillStyle = fill;
    ctx.fillRect(0,0,w,h);
    if (style === "metallic") {
      for (let row=0; row<h; row+=.22) {
        ctx.globalAlpha = random()*.085;
        ctx.fillStyle = random()>.5 ? "#ffffff" : "#192328";
        ctx.fillRect(random()*w*.17,row,w,.075);
      }
      ctx.globalAlpha = 1;
    }
    return;
  }

  if (style === "marble" || style === "stone") {
    const surface = surfaceVariation(style,accent);
    const texture = ctx.createPattern(surface,"no-repeat");
    texture.setTransform(new DOMMatrix().scale(w/surface.width,h/surface.height));
    ctx.fillStyle = texture;
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle = accent;
    ctx.globalAlpha = style === "marble" ? .15 : .58;
    for (let i=0; i<82; i++) {
      const dot = .045+random()*.27;
      ctx.fillRect(random()*w,random()*h,dot,dot);
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (style === "contact") {
    ctx.fillStyle = accent;
    const bottom = picture.y+picture.h+2.4;
    const step = w/15;
    const scale = Math.min(w,h)/54;
    for (let i=1; i<15; i++) {
      const x=i*step;
      ctx.fillRect(x,bottom,scale*.85,scale*(i%3 === 0 ? 2.15 : .86));
      ctx.fillRect(x,h-scale*1.4,scale*.88,scale*.57);
    }
    ctx.font = "600 " + scale*2.05 + "px Consolas, monospace";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("◂ 01",picture.x,h-scale*3.2);
    ctx.textAlign = "right";
    ctx.fillText("01A ▸",picture.x+picture.w,h-scale*3.2);
    ctx.textAlign = "start";
    return;
  }

  const spacing = Math.min(w,h)/(style === "hearts" ? 8 : 13);
  const colors = [accent,"#66b7c1","#f3b66e","#a49adb","#83a978"];
  for (let row=0; row<h; row+=spacing) {
    for (let col=0; col<w; col+=spacing) {
      const x=col+random()*spacing;
      const y=row+random()*spacing;
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate((random()-.5)*2);
      const s=spacing*(.15+random()*.17);
      if (style === "confetti") {
        ctx.fillStyle = colors[Math.floor(random()*colors.length)];
        ctx.fillRect(-s/2,-s/2,s*1.65,s*.57);
      } else {
        ctx.strokeStyle = accent;
        ctx.lineWidth = s*.17;
        ctx.beginPath();
        ctx.moveTo(0,s*.82);
        ctx.bezierCurveTo(-s*2,-s*.64,-s*.58,-s*1.45,0,-s*.53);
        ctx.bezierCurveTo(s*.64,-s*1.46,s*1.9,-s*.72,0,s*.82);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
