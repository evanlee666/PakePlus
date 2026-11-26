"use strict";

const cameraRawExtension = /\.(arw|cr2|cr3|dng|nef|nrw|raf|rw2|rwl|orf|pef|srw|sr2|srf|mrw|x3f|3fr|iiq|erf|kdc|dcr|mef|mos|raw)$/i;
const imageWidth = image => image?.naturalWidth || image?.width || 0;
const imageHeight = image => image?.naturalHeight || image?.height || 0;

function pixelCanvas(width, height, rgba) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas;
}

async function decodeTiff(file) {
  const data = await file.arrayBuffer();
  const pages = UTIF.decode(data);
  const image = pages.filter(page => page.t256?.[0] && page.t257?.[0])
    .sort((a,b) => b.t256[0]*b.t257[0] - a.t256[0]*a.t257[0])[0];
  if (!image) throw new Error("找不到可读取的 TIFF 图像");
  UTIF.decodeImage(data, image, pages);
  if (!image.data?.length) throw new Error("不支持这张 TIFF 的压缩方式");
  const {width, height} = image;
  const canvas = pixelCanvas(width, height, new Uint8ClampedArray(UTIF.toRGBA8(image)));
  const orientation = image.t274?.[0] || 1;
  const transforms = {
    2:[-1,0,0,1,width,0], 3:[-1,0,0,-1,width,height], 4:[1,0,0,-1,0,height],
    5:[0,1,1,0,0,0], 6:[0,1,-1,0,height,0], 7:[0,-1,-1,0,height,width], 8:[0,-1,1,0,0,width]
  };
  if (!transforms[orientation]) return canvas;
  const oriented = document.createElement("canvas");
  oriented.width = orientation >= 5 ? height : width;
  oriented.height = orientation >= 5 ? width : height;
  const ctx = oriented.getContext("2d");
  ctx.setTransform(...transforms[orientation]);
  ctx.drawImage(canvas, 0, 0);
  return oriented;
}

async function decodeCameraRaw(file) {
  const [core, workerCode, wasm] = RAW_OFFLINE;
  const url = URL.createObjectURL(new Blob([core, "\n", workerCode], {type:"text/javascript"}));
  let worker;
  try {
    worker = new Worker(url);
    const request = (id, type, data, extra = {}) => new Promise((resolve,reject) => {
      worker.onerror = event => reject(new Error(event.message || "RAW 解码器启动失败"));
      worker.onmessage = ({data:reply}) => {
        if (reply.id !== id) return;
        if (reply.type === "error") reject(new Error(reply.error));
        else resolve(reply.result);
      };
      worker.postMessage({id, type, data, ...extra}, [data]);
    });
    const binary = Uint8Array.from(atob(wasm), character => character.charCodeAt(0));
    await request(1, "init", binary.buffer);
    const pixels = await request(2, "convert", await file.arrayBuffer(), {filename:file.name});
    const {width, height, colors, data} = pixels;
    if (colors !== 1 && colors !== 3 && colors !== 4) throw new Error("无法读取这张 RAW 的颜色通道");
    const rgba = new Uint8ClampedArray(width*height*4);
    for (let i=0,j=0; i<rgba.length; i+=4,j+=colors) {
      rgba[i] = data[j];
      rgba[i+1] = data[j+(colors > 1 ? 1 : 0)];
      rgba[i+2] = data[j+(colors > 1 ? 2 : 0)];
      rgba[i+3] = 255;
    }
    return pixelCanvas(width, height, rgba);
  } finally {
    worker?.terminate();
    URL.revokeObjectURL(url);
  }
}

function encodeBmp({width, height, data}) {
  const rowBytes = Math.ceil(width*3/4)*4;
  const pixels = new Uint8Array(rowBytes*height);
  for (let y=0; y<height; y++) {
    let src = y*width*4;
    let dst = (height-y-1)*rowBytes;
    for (let x=0; x<width; x++,src+=4) {
      pixels[dst++] = data[src+2];
      pixels[dst++] = data[src+1];
      pixels[dst++] = data[src];
    }
  }
  const header = new DataView(new ArrayBuffer(54));
  header.setUint16(0, 0x4d42, true);
  header.setUint32(2, 54+pixels.byteLength, true);
  header.setUint32(10, 54, true);
  header.setUint32(14, 40, true);
  header.setUint32(18, width, true);
  header.setUint32(22, height, true);
  header.setUint16(26, 1, true);
  header.setUint16(28, 24, true);
  header.setUint32(34, pixels.byteLength, true);
  return new Blob([header.buffer,pixels], {type:"image/bmp"});
}

const linearSamples = Uint16Array.from({length:256}, (_, value) => {
  const unit = value/255;
  return Math.round(65535 * (unit <= .04045 ? unit/12.92 : ((unit+.055)/1.055)**2.4));
});

function encodeTiff({width, height, data}, raw = false) {
  let pixels = data;
  if (raw) {
    pixels = new Uint16Array(width*height*3);
    for (let i=0,j=0; i<data.length; i+=4,j+=3) {
      pixels[j] = linearSamples[data[i]];
      pixels[j+1] = linearSamples[data[i+1]];
      pixels[j+2] = linearSamples[data[i+2]];
    }
  }
  const tags = [];
  const add = (tag, type, ...values) => tags.push({tag,type,values});
  const samples = raw ? 3 : 4;
  add(254,4,0);
  add(256,4,width);
  add(257,4,height);
  add(258,3,...Array(samples).fill(raw ? 16 : 8));
  add(259,3,1);
  add(262,3,raw ? 34892 : 2);
  add(273,4,0); // The strip begins after the IFD and its overflow values.
  add(274,3,1);
  add(277,3,samples);
  add(278,4,height);
  add(279,4,pixels.byteLength);
  add(284,3,1);
  if (raw) {
    add(50706,1,1,4,0,0); // DNGVersion
    add(50707,1,1,1,0,0);
    const model = new TextEncoder().encode("Film Rebate Linear sRGB\0");
    add(50708,2,...model);
    add(50714,3,0);
    add(50717,4,65535);
    // XYZ D65 to linear sRGB, ISO 17321 calibration illuminant D65.
    add(50721,10,3.2404542,-1.5371385,-.4985314,-.9692660,1.8760108,.0415560,.0556434,-.2040259,1.0572252);
    add(50728,5,1,1,1);
    add(50778,3,21);
    // Reference white adapted to D50 for output to the profile connection space.
    add(50964,10,.4360747,.3850649,.1430804,.2225045,.7168786,.0606169,.0139322,.0971045,.7141733);
  } else {
    add(338,3,2); // Unassociated alpha.
  }

  const fieldSizes = {1:1,2:1,3:2,4:4,5:8,10:8};
  let dataOffset = 8 + 2 + tags.length*12 + 4;
  for (const item of tags) {
    const bytes = fieldSizes[item.type] * item.values.length;
    if (bytes > 4) {
      item.offset = dataOffset;
      dataOffset += bytes + bytes%2;
    }
  }
  const view = new DataView(new ArrayBuffer(dataOffset));
  view.setUint16(0,0x4949,true);
  view.setUint16(2,42,true);
  view.setUint32(4,8,true);
  view.setUint16(8,tags.length,true);
  tags.find(item => item.tag === 273).values[0] = dataOffset;
  for (const [index,item] of tags.entries()) {
    const pos = 10+12*index;
    view.setUint16(pos,item.tag,true);
    view.setUint16(pos+2,item.type,true);
    view.setUint32(pos+4,item.values.length,true);
    if (item.offset) view.setUint32(pos+8,item.offset,true);
    for (const [i,value] of item.values.entries()) {
      const offset = (item.offset || pos+8) + fieldSizes[item.type]*i;
      if (item.type <= 2) view.setUint8(offset,value);
      else if (item.type === 3) view.setUint16(offset,value,true);
      else if (item.type === 4) view.setUint32(offset,value,true);
      else {
        view.setInt32(offset,Math.round(value*10000000),true);
        view.setInt32(offset+4,10000000,true);
      }
    }
  }
  return new Blob([view.buffer,pixels], {type:raw ? "image/x-adobe-dng" : "image/tiff"});
}
