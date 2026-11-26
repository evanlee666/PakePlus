"use strict";

// PNG and JPG are already compressed, so store each image directly in ZIP.
const crcTable = Uint32Array.from({length:256}, (_, value) => {
  for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
const zipLimit = 0xffffffff;

function zipHeader(size, signature) {
  const view = new DataView(new ArrayBuffer(size));
  view.setUint32(0, signature, true);
  return view;
}

class ImageZip {
  constructor() {
    this.parts = [];
    this.directory = [];
    this.offset = 0;
    this.directorySize = 0;
    this.count = 0;
  }

  async add(filename, blob) {
    const name = new TextEncoder().encode(filename);
    const nextOffset = this.offset + 30 + name.length + blob.size;
    const nextDirectorySize = this.directorySize + 46 + name.length;
    if (nextOffset + nextDirectorySize + 22 >= zipLimit || this.count >= 65535) {
      throw new RangeError("ZIP 太大，请分批导出。");
    }
    let crc = 0xffffffff;
    const reader = blob.stream().getReader();
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      for (const byte of value) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    }
    crc = (crc ^ 0xffffffff) >>> 0;

    const local = zipHeader(30, 0x04034b50);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(12, 33, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, blob.size, true);
    local.setUint32(22, blob.size, true);
    local.setUint16(26, name.length, true);
    this.parts.push(local.buffer, name, blob);

    const central = zipHeader(46, 0x02014b50);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(14, 33, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, blob.size, true);
    central.setUint32(24, blob.size, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, this.offset, true);
    this.directory.push(central.buffer, name);
    this.offset = nextOffset;
    this.directorySize = nextDirectorySize;
    this.count++;
  }

  finish() {
    const end = zipHeader(22, 0x06054b50);
    end.setUint16(8, this.count, true);
    end.setUint16(10, this.count, true);
    end.setUint32(12, this.directorySize, true);
    end.setUint32(16, this.offset, true);
    return new Blob([...this.parts, ...this.directory, end.buffer], {type:"application/zip"});
  }
}
