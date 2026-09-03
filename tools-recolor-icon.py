"""Перекрашивает знак совы OWLS в инверсию: тёмный фон, светлый контур.
Исходник: assets/owls_owl.png (навy-контур + оранжевые столбики, прозрачный фон).
Без внешних библиотек: разбор и сборка PNG на zlib из стандартной поставки.
"""
import zlib, struct, sys

NAVY = (11, 30, 53)      # --owls-navy #0B1E35
CREAM = (243, 239, 231)  # светлый контур на тёмном, как в макете

def read_png(path):
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', 'не PNG'
    pos, idat, meta = 8, b'', None
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]
        typ = data[pos+4:pos+8]
        body = data[pos+8:pos+8+ln]
        if typ == b'IHDR':
            w, h, depth, color, comp, filt, inter = struct.unpack('>IIBBBBB', body)
            assert depth == 8 and color == 6 and inter == 0, (depth, color, inter)
            meta = (w, h)
        elif typ == b'IDAT':
            idat += body
        elif typ == b'IEND':
            break
        pos += 12 + ln
    w, h = meta
    raw = zlib.decompress(idat)
    stride = w * 4
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        f = raw[p]; p += 1
        line = bytearray(raw[p:p+stride]); p += stride
        if f == 1:
            for i in range(4, stride): line[i] = (line[i] + line[i-4]) & 255
        elif f == 2:
            for i in range(stride): line[i] = (line[i] + prev[i]) & 255
        elif f == 3:
            for i in range(stride):
                a = line[i-4] if i >= 4 else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif f == 4:
            for i in range(stride):
                a = line[i-4] if i >= 4 else 0
                b = prev[i]
                c = prev[i-4] if i >= 4 else 0
                pa, pb, pc = abs(b-c), abs(a-c), abs(a+b-2*c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y*stride:(y+1)*stride] = line
        prev = line
    return w, h, out

def write_png_rgb(path, w, h, rgb):
    raw = bytearray()
    stride = w * 3
    for y in range(h):
        raw.append(0)
        raw += rgb[y*stride:(y+1)*stride]
    def chunk(typ, body):
        return struct.pack('>I', len(body)) + typ + body + struct.pack('>I', zlib.crc32(typ + body) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    open(path, 'wb').write(png)

src, dst = sys.argv[1], sys.argv[2]
w, h, px = read_png(src)

# Габариты знака: всё, что заметно непрозрачно.
x0, y0, x1, y1 = w, h, -1, -1
for y in range(h):
    for x in range(w):
        if px[(y*w + x)*4 + 3] > 12:
            if x < x0: x0 = x
            if x > x1: x1 = x
            if y < y0: y0 = y
            if y > y1: y1 = y
bw, bh = x1 - x0 + 1, y1 - y0 + 1

# Перекраска: тёмный контур становится светлым, оранжевый остаётся.
# Всё складывается на сплошной тёмный фон, поэтому итог непрозрачный.
out = bytearray(bw * bh * 3)
for y in range(bh):
    for x in range(bw):
        i = ((y + y0) * w + (x + x0)) * 4
        r, g, b, a = px[i], px[i+1], px[i+2], px[i+3]
        if a == 0:
            cr, cg, cb = NAVY
        else:
            warm = r - b  # у оранжевого красного заметно больше синего
            if warm > 40:
                fr, fg, fb = r, g, b            # столбики и стрелка остаются оранжевыми
            else:
                # Инверсия с узкой зоной сглаживания: контур остаётся плотным,
                # а серый ореол исходника уходит в фон. Края при этом не рвутся.
                lum = (r * 299 + g * 587 + b * 114) / 255000
                e0, e1 = 0.34, 0.80
                t = min(1, max(0, (lum - e0) / (e1 - e0)))
                t = t * t * (3 - 2 * t)
                fr = CREAM[0] + (NAVY[0] - CREAM[0]) * t
                fg = CREAM[1] + (NAVY[1] - CREAM[1]) * t
                fb = CREAM[2] + (NAVY[2] - CREAM[2]) * t
            al = a / 255
            cr = round(fr * al + NAVY[0] * (1 - al))
            cg = round(fg * al + NAVY[1] * (1 - al))
            cb = round(fb * al + NAVY[2] * (1 - al))
        j = (y * bw + x) * 3
        out[j], out[j+1], out[j+2] = cr, cg, cb

write_png_rgb(dst, bw, bh, out)
print(f'source {w}x{h}, mark bbox {bw}x{bh} at {x0},{y0}')
