/**
 * Metadata-strip vóór een foto zichtbaar wordt (privacyregel 5): EXIF bevat
 * GPS-locaties en toesteldata van kinderen. Geen externe libs — pure
 * byte-chirurgie per formaat. Retourneert null als veilig strippen niet lukt;
 * de aanroeper mag de foto dan NIET publiceren.
 */

export function stripImageMetadata(bytes: Uint8Array, contentType: string): Uint8Array | null {
  try {
    if (contentType === "image/jpeg") return stripJpeg(bytes);
    if (contentType === "image/png") return stripPng(bytes);
    if (contentType === "image/heic") return stripHeic(bytes);
    return null;
  } catch {
    return null; // liever geen foto dan een foto met GPS-data
  }
}

/** JPEG: verwijder APP1 (EXIF/GPS/XMP) en APP13 (IPTC). JFIF/ICC/Adobe blijven staan. */
function stripJpeg(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null; // geen SOI
  const out: Uint8Array[] = [bytes.slice(0, 2)];
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return null; // corrupte segmentstructuur
    const marker = bytes[i + 1]!;
    if (marker === 0xda) {
      // SOS: vanaf hier entropy-coded data t/m EOI — ongewijzigd doorkopiëren.
      out.push(bytes.slice(i));
      return concat(out);
    }
    const length = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    const segmentEnd = i + 2 + length;
    if (length < 2 || segmentEnd > bytes.length) return null;
    if (marker !== 0xe1 && marker !== 0xed) {
      out.push(bytes.slice(i, segmentEnd));
    }
    i = segmentEnd;
  }
  return null;
}

/** PNG: verwijder eXIf-chunks; alle overige chunks (incl. kleurprofiel) blijven. */
function stripPng(bytes: Uint8Array): Uint8Array | null {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 8 || !SIG.every((b, idx) => bytes[idx] === b)) return null;
  const out: Uint8Array[] = [bytes.slice(0, 8)];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 8;
  while (i + 8 <= bytes.length) {
    const length = view.getUint32(i);
    const type = String.fromCharCode(bytes[i + 4]!, bytes[i + 5]!, bytes[i + 6]!, bytes[i + 7]!);
    const chunkEnd = i + 12 + length; // length + type + data + crc
    if (chunkEnd > bytes.length) return null;
    if (type !== "eXIf") out.push(bytes.slice(i, chunkEnd));
    if (type === "IEND") return concat(out);
    i = chunkEnd;
  }
  return null;
}

/**
 * HEIC (ISOBMFF): het Exif-item wordt niet verwijderd maar genuld — de
 * boxstructuur blijft intact (iloc-offsets blijven kloppen), decoders negeren
 * het lege metadata-item. We zoeken in 'meta' → 'iinf' de item-ID's met type
 * 'Exif' en nullen hun 'iloc'-extents in het bestand.
 */
function stripHeic(bytes: Uint8Array): Uint8Array | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const meta = findBox(bytes, view, 0, bytes.length, "meta");
  if (!meta) return null; // geen meta-box: geen plek waar EXIF kan zitten
  // 'meta' is een FullBox: 4 bytes version+flags na de header.
  const metaContent = meta.contentStart + 4;

  const iinf = findBox(bytes, view, metaContent, meta.end, "iinf");
  const iloc = findBox(bytes, view, metaContent, meta.end, "iloc");
  if (!iinf || !iloc) return null;

  const exifIds = parseIinfForExif(bytes, view, iinf);
  if (exifIds === null) return null;
  if (exifIds.size === 0) return bytes; // geen EXIF-item aanwezig

  const extents = parseIlocExtents(view, iloc, exifIds);
  if (extents === null) return null;

  const out = bytes.slice();
  for (const { offset, length } of extents) {
    if (offset + length > out.length) return null;
    out.fill(0, offset, offset + length);
  }
  return out;
}

interface Box { contentStart: number; end: number }

/** Eerste box met dit type binnen [start, end). */
function findBox(bytes: Uint8Array, view: DataView, start: number, end: number, type: string): Box | null {
  let i = start;
  while (i + 8 <= end) {
    let size = view.getUint32(i);
    const boxType = String.fromCharCode(bytes[i + 4]!, bytes[i + 5]!, bytes[i + 6]!, bytes[i + 7]!);
    let headerSize = 8;
    if (size === 1) {
      // 64-bit largesize; > 2^53 komt bij foto's niet voor.
      size = Number(view.getBigUint64(i + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - i; // box loopt tot het einde
    }
    if (size < headerSize || i + size > end) return null;
    if (boxType === type) return { contentStart: i + headerSize, end: i + size };
    i += size;
  }
  return null;
}

/** iinf → item-ID's met item_type 'Exif'. */
function parseIinfForExif(bytes: Uint8Array, view: DataView, iinf: Box): Set<number> | null {
  const version = bytes[iinf.contentStart]!;
  let i = iinf.contentStart + 4;
  i += version === 0 ? 2 : 4; // entry_count
  const ids = new Set<number>();
  while (i + 8 <= iinf.end) {
    const size = view.getUint32(i);
    const type = String.fromCharCode(bytes[i + 4]!, bytes[i + 5]!, bytes[i + 6]!, bytes[i + 7]!);
    if (size < 8 || i + size > iinf.end) return null;
    if (type === "infe") {
      const v = bytes[i + 8]!;
      if (v >= 2) {
        const itemId = v === 2 ? view.getUint16(i + 12) : view.getUint32(i + 12);
        const typeOffset = i + 12 + (v === 2 ? 2 : 4) + 2; // item_ID + protection_index
        const itemType = String.fromCharCode(
          bytes[typeOffset]!, bytes[typeOffset + 1]!, bytes[typeOffset + 2]!, bytes[typeOffset + 3]!,
        );
        if (itemType === "Exif") ids.add(itemId);
      }
    }
    i += size;
  }
  return ids;
}

/** iloc → absolute (offset, length)-extents van de gezochte items. */
function parseIlocExtents(
  view: DataView,
  iloc: Box,
  wantedIds: Set<number>,
): Array<{ offset: number; length: number }> | null {
  const version = view.getUint8(iloc.contentStart);
  let i = iloc.contentStart + 4;
  const sizes = view.getUint16(i);
  i += 2;
  const offsetSize = (sizes >> 12) & 0xf;
  const lengthSize = (sizes >> 8) & 0xf;
  const baseOffsetSize = (sizes >> 4) & 0xf;
  const indexSize = version >= 1 ? sizes & 0xf : 0;

  const readN = (at: number, n: number): number => {
    if (n === 0) return 0;
    if (n === 4) return view.getUint32(at);
    if (n === 8) return Number(view.getBigUint64(at));
    return null as never; // andere breedtes vangen we hieronder af
  };
  for (const n of [offsetSize, lengthSize, baseOffsetSize, indexSize]) {
    if (![0, 4, 8].includes(n)) return null;
  }

  const itemCount = version < 2 ? view.getUint16(i) : view.getUint32(i);
  i += version < 2 ? 2 : 4;

  const extents: Array<{ offset: number; length: number }> = [];
  for (let item = 0; item < itemCount; item++) {
    const itemId = version < 2 ? view.getUint16(i) : view.getUint32(i);
    i += version < 2 ? 2 : 4;
    let constructionMethod = 0;
    if (version >= 1) {
      constructionMethod = view.getUint16(i) & 0xf;
      i += 2;
    }
    i += 2; // data_reference_index
    const baseOffset = readN(i, baseOffsetSize);
    i += baseOffsetSize;
    const extentCount = view.getUint16(i);
    i += 2;
    for (let e = 0; e < extentCount; e++) {
      i += indexSize;
      const extentOffset = readN(i, offsetSize);
      i += offsetSize;
      const extentLength = readN(i, lengthSize);
      i += lengthSize;
      if (wantedIds.has(itemId)) {
        // Alleen construction_method 0 (file offset) kunnen we in-place nullen.
        if (constructionMethod !== 0) return null;
        extents.push({ offset: baseOffset + extentOffset, length: extentLength });
      }
    }
  }
  return extents;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
