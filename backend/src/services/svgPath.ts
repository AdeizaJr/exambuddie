// src/services/svgPath.ts — turns an opentype.js glyph Path into SVG path data.
//
// Replaces opentype's own Path.toPathData(), which has a rounding bug: its
// roundDecimal() builds a string like `fraction + "e+2"`, so a coordinate with
// float noise (e.g. 629.0000000000001, fraction 1.1e-13) becomes "1.1e-13e+2",
// parses as NaN, and the letter comes out as "NaN" in the path. Our glyph check
// then dropped the whole letter, which is how flyers ended up reading
// "243 Earth  ay  to orbit the  un." Rounding here with toFixed avoids it.
import type * as opentype from 'opentype.js';

function num(v: number): string {
  // toFixed never uses exponent notation for |v| < 1e21; +() trims trailing zeros.
  return String(+v.toFixed(2));
}

export function glyphPathData(path: opentype.Path): string {
  let d = '';
  for (const c of path.commands as any[]) {
    switch (c.type) {
      case 'M': d += `M${num(c.x)} ${num(c.y)}`; break;
      case 'L': d += `L${num(c.x)} ${num(c.y)}`; break;
      case 'Q': d += `Q${num(c.x1)} ${num(c.y1)} ${num(c.x)} ${num(c.y)}`; break;
      case 'C': d += `C${num(c.x1)} ${num(c.y1)} ${num(c.x2)} ${num(c.y2)} ${num(c.x)} ${num(c.y)}`; break;
      case 'Z': d += 'Z'; break;
    }
  }
  return d;
}
