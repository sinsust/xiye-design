// 服务端 .zip 打包（Node zlib deflate + 二进制支持）。
// 用于把整站品牌目录（含图片等二进制资源）打包为 zip 下载。
import { deflateRawSync } from "zlib";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Entry {
  nameBuf: Buffer;
  data: Buffer; // 已压缩
  raw: Buffer; // 未压缩（存原始体积/CRC）
  crc: number;
}

function u16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff, 0);
  return b;
}
function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

/**
 * 把一组文件（内容可为文本/二进制）打包成 zip 的 Buffer。
 * 条目名用相对路径，目录本身用 name 以 "/" 结尾的零长度条目表示（若提供）。
 */
export function makeZip(files: { name: string; content: Buffer | Uint8Array | string; isDir?: boolean }[]): Buffer {
  const enc = new TextEncoder();
  const entries: { local: Buffer; central: Buffer; data: Buffer }[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(enc.encode(f.name.replace(/\\/g, "/")));
    if (f.isDir) {
      // 目录条目：method=0, 无内容
      const lh = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(0), u32(0), u32(0), u16(nameBuf.length), u16(0), nameBuf]);
      const cf = Buffer.concat([Buffer.from([0x50, 0x4b, 0x01, 0x02]), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(0), u32(0), u32(0), u16(nameBuf.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBuf]);
      entries.push({ local: lh, central: cf, data: Buffer.alloc(0) });
      offset += lh.length;
      continue;
    }

    const raw = Buffer.isBuffer(f.content) ? f.content : Buffer.from(typeof f.content === "string" ? f.content : f.content);
    let data: Buffer;
    let method = 0;
    if (raw.length > 0) {
      data = deflateRawSync(raw, { level: 6 });
      if (data.length >= raw.length) {
        data = raw;
        method = 0;
      } else {
        method = 8;
      }
    } else {
      data = Buffer.alloc(0);
      method = 0;
    }
    const crc = crc32(raw);

    const lh = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), u16(20), u16(0x0800), u16(method), u16(0), u16(0), u32(crc), u32(data.length), u32(raw.length), u16(nameBuf.length), u16(0), nameBuf]);
    const cf = Buffer.concat([Buffer.from([0x50, 0x4b, 0x01, 0x02]), u16(20), u16(20), u16(0x0800), u16(method), u16(0), u16(0), u32(crc), u32(data.length), u32(raw.length), u16(nameBuf.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBuf]);
    entries.push({ local: lh, central: cf, data });
    offset += lh.length + data.length;
  }

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  for (const e of entries) {
    localParts.push(e.local, e.data);
    centralParts.push(e.central);
  }
  const localBuf = Buffer.concat(localParts);
  const centralBuf = Buffer.concat(centralParts);
  const cdOffset = localBuf.length;
  const cdSize = centralBuf.length;

  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16(0),
    u16(0),
    u16(entries.length & 0xffff),
    u16(entries.length & 0xffff),
    u32(cdSize),
    u32(cdOffset),
    u16(0),
  ]);

  return Buffer.concat([localBuf, centralBuf, eocd]);
}