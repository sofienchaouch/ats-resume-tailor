/**
 * Minimal ZIP writer, STORE method (no compression). ~zero size cost here since
 * DOCX files are themselves deflate-compressed zips, and it keeps the bundle
 * dependency-free. Pure; returns the archive bytes.
 *
 * Layout per the PKZIP APPNOTE: [local header + data]* then [central dir]* then
 * [end-of-central-directory].
 */

const textEncoder = new TextEncoder();

let crcTable: Uint32Array | null = null;
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

export function crc32(bytes: Uint8Array): number {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function pushU16(arr: number[], v: number) {
  arr.push(v & 0xff, (v >>> 8) & 0xff);
}
function pushU32(arr: number[], v: number) {
  arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
}

// Bit 11 set = filename is UTF-8.
const FLAG_UTF8 = 0x0800;

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const local: number[] = [];
  const central: number[] = [];
  const offsets: number[] = [];

  for (const entry of entries) {
    const nameBytes = textEncoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    offsets.push(local.length);

    // Local file header
    pushU32(local, 0x04034b50);
    pushU16(local, 20); // version needed
    pushU16(local, FLAG_UTF8);
    pushU16(local, 0); // method: store
    pushU16(local, 0); // mod time
    pushU16(local, 0x21); // mod date (1980-01-01)
    pushU32(local, crc);
    pushU32(local, size); // compressed
    pushU32(local, size); // uncompressed
    pushU16(local, nameBytes.length);
    pushU16(local, 0); // extra len
    for (const b of nameBytes) local.push(b);
    for (const b of entry.data) local.push(b);

    // Central directory record
    pushU32(central, 0x02014b50);
    pushU16(central, 20); // version made by
    pushU16(central, 20); // version needed
    pushU16(central, FLAG_UTF8);
    pushU16(central, 0); // method
    pushU16(central, 0); // time
    pushU16(central, 0x21); // date
    pushU32(central, crc);
    pushU32(central, size);
    pushU32(central, size);
    pushU16(central, nameBytes.length);
    pushU16(central, 0); // extra
    pushU16(central, 0); // comment
    pushU16(central, 0); // disk #
    pushU16(central, 0); // internal attrs
    pushU32(central, 0); // external attrs
    pushU32(central, offsets[offsets.length - 1]);
    for (const b of nameBytes) central.push(b);
  }

  const centralOffset = local.length;
  const eocd: number[] = [];
  pushU32(eocd, 0x06054b50);
  pushU16(eocd, 0); // disk #
  pushU16(eocd, 0); // central dir start disk
  pushU16(eocd, entries.length);
  pushU16(eocd, entries.length);
  pushU32(eocd, central.length);
  pushU32(eocd, centralOffset);
  pushU16(eocd, 0); // comment len

  return Uint8Array.from([...local, ...central, ...eocd]);
}
