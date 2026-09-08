import { describe, it, expect } from 'vitest';
import { crc32, buildZip } from './zipStore';

const enc = (s: string) => new TextEncoder().encode(s);
const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

describe('crc32', () => {
  it('matches known vectors', () => {
    expect(crc32(enc(''))).toBe(0);
    expect(crc32(enc('123456789'))).toBe(0xcbf43926);
  });
});

describe('buildZip', () => {
  it('empty archive is a lone 22-byte EOCD', () => {
    const z = buildZip([]);
    expect(z).toHaveLength(22);
    expect(u32(z, 0)).toBe(0x06054b50);
    expect(u16(z, 8)).toBe(0); // entry count
  });

  it('single entry: signatures, count, and central-dir offset line up', () => {
    const data = enc('hello');
    const z = buildZip([{ name: 'a.txt', data }]);

    expect(u32(z, 0)).toBe(0x04034b50); // local header
    expect(u16(z, 6)).toBe(0x0800); // UTF-8 flag
    expect(u16(z, 8)).toBe(0); // store method

    const localLen = 30 + 5 /* name */ + data.length;
    expect(u32(z, localLen)).toBe(0x02014b50); // central directory

    const eocdOffset = z.length - 22;
    expect(u32(z, eocdOffset)).toBe(0x06054b50);
    expect(u16(z, eocdOffset + 8)).toBe(1); // this-disk entries
    expect(u16(z, eocdOffset + 10)).toBe(1); // total entries
    expect(u32(z, eocdOffset + 16)).toBe(localLen); // central dir start offset
  });

  it('two entries: central-dir local-header offsets are cumulative', () => {
    const a = enc('aa');
    const b = enc('bbbb');
    const z = buildZip([
      { name: 'a', data: a },
      { name: 'b', data: b },
    ]);
    const firstLocalLen = 30 + 1 + a.length;
    const secondLocalLen = 30 + 1 + b.length;
    const cdStart = firstLocalLen + secondLocalLen;
    expect(u32(z, cdStart)).toBe(0x02014b50);
    // first central record's "relative offset of local header" (byte 42 of the record)
    expect(u32(z, cdStart + 42)).toBe(0);
    const secondRecord = cdStart + 46 + 1; // 46-byte fixed record + 1-byte name
    expect(u32(z, secondRecord + 42)).toBe(firstLocalLen);
  });
});
