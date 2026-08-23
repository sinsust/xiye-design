// 纯前端 .zip 打包（store 无压缩模式），不依赖任何第三方库。
// 用于把导出的多个工程文件一键打包成一个文件夹(.zip)下载。

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc: number;
  size: number;
}

function buildLocalHeader(e: ZipEntry): Uint8Array {
  const h = new Uint8Array(30 + e.nameBytes.length);
  const dv = new DataView(h.buffer);
  dv.setUint32(0, 0x04034b50, true);
  dv.setUint16(4, 20, true); // version needed
  dv.setUint16(6, 0x0800, true); // UTF-8
  dv.setUint16(8, 0, true); // method: store
  dv.setUint16(10, 0, true); // mod time
  dv.setUint16(12, 0, true); // mod date
  dv.setUint32(14, e.crc, true);
  dv.setUint32(18, e.size, true); // compressed
  dv.setUint32(22, e.size, true); // uncompressed
  dv.setUint16(26, e.nameBytes.length, true);
  dv.setUint16(28, 0, true); // extra len
  h.set(e.nameBytes, 30);
  return h;
}

function buildCentral(entries: ZipEntry[], offsets: number[]): Uint8Array[] {
  return entries.map((e, i) => {
    const c = new Uint8Array(46 + e.nameBytes.length);
    const dv = new DataView(c.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true); // version made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0x0800, true); // UTF-8
    dv.setUint16(10, 0, true); // method: store
    dv.setUint16(12, 0, true); // mod time
    dv.setUint16(14, 0, true); // mod date
    dv.setUint32(16, e.crc, true);
    dv.setUint32(20, e.size, true);
    dv.setUint32(24, e.size, true);
    dv.setUint16(28, e.nameBytes.length, true);
    dv.setUint16(30, 0, true); // extra len
    dv.setUint16(32, 0, true); // comment len
    dv.setUint16(34, 0, true); // disk start
    dv.setUint16(36, 0, true); // internal attrs
    dv.setUint32(38, 0, true); // external attrs
    dv.setUint32(42, offsets[i], true); // local header offset
    c.set(e.nameBytes, 46);
    return c;
  });
}

// 将多个文本文件打包为一个无需解压工具的存储型 zip（Windows/mac 双击即展开成文件夹）
export function buildZip(files: { name: string; content: string }[]): Blob {
  const enc = new TextEncoder();
  const entries: ZipEntry[] = files.map((f) => {
    const nameBytes = enc.encode(f.name);
    const data = enc.encode(f.content);
    return { nameBytes, data, crc: crc32(data), size: data.length };
  });

  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let total = 0;
  for (const e of entries) {
    offsets.push(total);
    const lh = buildLocalHeader(e);
    parts.push(lh);
    total += lh.length;
    parts.push(e.data);
    total += e.data.length;
  }

  const central = buildCentral(entries, offsets);
  for (const c of central) total += c.length;

  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const cdOffset = total - cdSize;

  const eocd = new Uint8Array(22);
  const edv = new DataView(eocd.buffer);
  edv.setUint32(0, 0x06054b50, true);
  edv.setUint16(4, 0, true); // 本磁盘
  edv.setUint16(6, 0, true); // 中央目录起始磁盘
  edv.setUint16(8, entries.length, true);
  edv.setUint16(10, entries.length, true);
  edv.setUint32(12, cdSize, true);
  edv.setUint32(16, cdOffset, true);
  edv.setUint16(20, 0, true); // comment len

  // 拼接为单一 ArrayBuffer，避免 BlobPart 泛型歧义
  const out = new Uint8Array(total + 22);
  let p = 0;
  for (const chunk of [...parts, ...central, eocd]) {
    out.set(chunk, p);
    p += chunk.length;
  }
  return new Blob([out.buffer], { type: "application/zip" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}