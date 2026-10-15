import { readPlate, type Plate, type PlateMetadata } from './plate.ts';

// One instance per render worker/module realm. Counts decoded pixel arrays,
// not metadata, transient RGBA input, caller-held frames or the plate cache.
export class DecodedFrameCache {
  private readonly entries = new Map<string, { plate: Plate; bytes: number }>();
  private bytes = 0;
  private hits = 0;
  private misses = 0;
  private readonly limitBytes: number;
  private readonly decode: (name: string, meta: PlateMetadata) => Plate;

  constructor(limitBytes: number, decode: (name: string, meta: PlateMetadata) => Plate = readPlate) {
    if (!Number.isSafeInteger(limitBytes) || limitBytes < 0) throw new Error('Frame cache limit must be nonnegative integer bytes');
    this.limitBytes = limitBytes;
    this.decode = decode;
  }

  get(name: string, meta: PlateMetadata): Plate {
    const entry = this.entries.get(name);
    if (entry) {
      this.hits++;
      this.entries.delete(name);
      this.entries.set(name, entry);
      return entry.plate;
    }
    this.misses++;
    const expectedBytes = meta.w * meta.h * 13;
    // Evict before allocating the next frame. An oversized individual drawing
    // is returned uncached, so it cannot permanently exceed the cache budget.
    while (this.entries.size && this.bytes + expectedBytes > this.limitBytes) {
      const oldest = this.entries.keys().next().value!;
      this.bytes -= this.entries.get(oldest)!.bytes;
      this.entries.delete(oldest);
    }
    const plate = this.decode(name, meta);
    const bytes = plate.r.byteLength + plate.g.byteLength + plate.b.byteLength + plate.a.byteLength;
    if (bytes !== expectedBytes) throw new Error(`Decoded frame byte count disagrees with metadata: ${name}`);
    if (bytes <= this.limitBytes) {
      this.entries.set(name, { plate, bytes });
      this.bytes += bytes;
    }
    return plate;
  }

  stats() { return { limitBytes: this.limitBytes, bytes: this.bytes, entries: this.entries.size, hits: this.hits, misses: this.misses }; }
}

export function lazyPlateFrames(names: readonly string[], metadata: readonly PlateMetadata[], cache: DecodedFrameCache): Plate[] {
  if (names.length !== metadata.length) throw new Error('Frame names and metadata must have equal length');
  const frames = new Array<Plate>(names.length);
  for (let i = 0; i < names.length; i++) {
    const name = names[i]!, meta = metadata[i]!;
    // Do not replace this getter with its result: that would retain every
    // decoded Plate in the Anim and defeat eviction. No Plate enters a slot.
    Object.defineProperty(frames, i, { enumerable: true, get: () => cache.get(name, meta) });
  }
  return frames;
}
