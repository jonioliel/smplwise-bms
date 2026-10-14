"""CR-038 hostile-upload pipeline (services/tickets/image_intake.py, spec 10.6 / review T7): a corpus generated here - pixel
and zlib bombs, 16 MP + 1, oversize sides, truncated files, polyglots (JPEG + HTML, PNG + ZIP), WebP / HEIC / AVIF / GIF / BMP /
TIFF / SVG / HTML / PDF renamed as images, crafted PNG chunk layouts, metadata (EXIF GPS, ICC, XMP, comments) that must not
survive the re-encode - plus the own decode semaphore (never the administrator's), storage confinement, the storage cap and
the one-upload-per-link guard. Every file is synthesised; no real photo is used."""
from __future__ import annotations

import io
import os
import struct
import sys
import threading
import time
import zlib
from pathlib import Path

import pytest
from conftest import sw_time_factor
from PIL import Image

from smplwise.services.tickets import image_intake as ii
from smplwise.services.tickets.public_ports import PhotoCounts


# ---------------------------------------------------------------- corpus helpers


def jpeg(w: int = 320, h: int = 240, *, noise: bool = False, **save: object) -> bytes:
    if noise:
        im = Image.frombytes("RGB", (w, h), bytes((i * 7919) % 251 for i in range(w * h * 3)))
    else:
        im = Image.new("RGB", (w, h), (30, 120, 200))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=90, **save)
    return buf.getvalue()


def png(w: int = 64, h: int = 48, mode: str = "RGB", color: object = (10, 200, 30)) -> bytes:
    buf = io.BytesIO()
    Image.new(mode, (w, h), color).save(buf, "PNG")
    return buf.getvalue()


def chunk(ctype: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + ctype + data + struct.pack(">I", zlib.crc32(ctype + data) & 0xFFFFFFFF)


def png_with(*extra: bytes, w: int = 8, h: int = 8, before_idat: bool = True) -> bytes:
    """A small valid PNG with extra chunks inserted before (or after) the image data."""
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    raw = b"".join(b"\x00" + b"\x10\x20\x30" * w for _ in range(h))
    idat = chunk(b"IDAT", zlib.compress(raw))
    iend = chunk(b"IEND", b"")
    sig = b"\x89PNG\r\n\x1a\n"
    return sig + ihdr + (b"".join(extra) + idat if before_idat else idat + b"".join(extra)) + iend


def patch_png_size(data: bytes, w: int, h: int) -> bytes:
    ihdr = bytearray(data[8:8 + 25])
    ihdr[8:16] = struct.pack(">II", w, h)
    crc = zlib.crc32(bytes(ihdr[4:21])) & 0xFFFFFFFF
    ihdr[21:25] = struct.pack(">I", crc)
    return data[:8] + bytes(ihdr) + data[33:]


def patch_jpeg_size(data: bytes, w: int, h: int) -> bytes:
    i = data.index(b"\xff\xc0")
    return data[:i + 5] + struct.pack(">HH", h, w) + data[i + 9:]


def jpeg_segment(marker: int, payload: bytes) -> bytes:
    return bytes([0xFF, marker]) + struct.pack(">H", len(payload) + 2) + payload


def insert_after_soi(data: bytes, *segments: bytes) -> bytes:
    return data[:2] + b"".join(segments) + data[2:]


def reopen(out: ii.Reencoded) -> Image.Image:
    im = Image.open(io.BytesIO(out.data))
    im.load()
    return im


def refuse(data: bytes, code: str, status: int, **kw) -> None:
    with pytest.raises(ii.IntakeError) as e:
        ii.reencode(data, **kw)
    assert (e.value.code, e.value.status) == (code, status), (e.value.code, e.value.status)


# ---------------------------------------------------------------- accepted files


def test_jpeg_is_reencoded_fresh_and_bounded():
    out = ii.reencode(jpeg(3000, 1500))
    im = reopen(out)
    assert im.format == "JPEG" and im.size == (2048, 1024) and (out.width, out.height) == (2048, 1024)
    assert out.data.startswith(b"\xff\xd8\xff") and len(out.sha256) == 64


def test_png_with_transparency_is_flattened_onto_white():
    out = ii.reencode(png(40, 30, "RGBA", (0, 0, 0, 0)))
    im = reopen(out)
    assert im.mode == "RGB" and im.getpixel((5, 5))[0] > 245


def test_exactly_16_megapixels_passes_and_is_decoded_at_half_scale():
    out = ii.reencode(jpeg(4000, 4000))
    assert reopen(out).size == (2000, 2000)  # draft 1/2: never the full 16 MP grid in memory


@pytest.mark.parametrize("w,h,expected", [(4032, 3024, (2016, 1512)), (4618, 3464, (2048, 1536)), (8000, 2000, (2000, 500)),
                                          (2500, 1000, (2048, 819)), (1000, 700, (1000, 700))])
def test_typical_phone_photos_decode_reduced_and_never_exceed_2048(w, h, expected):
    out = ii.reencode(jpeg(w, h))
    size = reopen(out).size
    assert size == expected and max(size) <= ii.OUT_MAX_SIDE


def test_metadata_never_survives_gps_exif_icc_xmp_comment():
    exif = Image.Exif()
    exif[0x010E] = "GPS 32.0853N 34.7818E secret-location"  # ImageDescription
    exif[0x0112] = 1
    gps = {1: "N", 2: (32.0, 5.0, 7.0), 3: "E", 4: (34.0, 46.0, 54.0)}
    exif[0x8825] = gps
    base = jpeg(400, 300, exif=exif.tobytes(), icc_profile=b"ICC-SECRET-PROFILE" * 10)
    xmp = jpeg_segment(0xE1, b"http://ns.adobe.com/xap/1.0/\x00<x:xmpmeta>xmp-secret-person</x:xmpmeta>")
    com = jpeg_segment(0xFE, b"comment-secret")
    data = insert_after_soi(base, xmp, com)
    src = Image.open(io.BytesIO(data))
    assert src.getexif() and src.info.get("icc_profile")  # the source really carries them
    out = ii.reencode(data)
    im = reopen(out)
    assert not im.getexif() and "icc_profile" not in im.info and "xmp" not in im.info and "comment" not in im.info
    for needle in (b"secret-location", b"ICC-SECRET", b"xmp-secret", b"comment-secret", b"Exif", b"GPS"):
        assert needle not in out.data, needle


def test_metadata_never_reaches_a_log_record_whatever_pillows_log_level(caplog):
    """Regression (found by the log scan) and code review V10: Pillow's TIFF reader logs EXIF tag VALUES at DEBUG and its PNG
    reader an ICC profile's NAME. The decoder never receives an upload's metadata (the structure walk hands it a clean copy),
    so nothing leaks even with every Pillow logger at its lowest level - the INFO pin on `PIL` is belt and braces only."""
    import logging

    assert logging.getLogger("PIL").level == logging.INFO  # the pin is still there ...
    pil = [logging.getLogger(n) for n in ("PIL", "PIL.Image", "PIL.TiffImagePlugin", "PIL.PngImagePlugin", "PIL.JpegImagePlugin")]
    saved = [lg.level for lg in pil]
    exif = Image.Exif()
    exif[0x010E] = "exif-log-secret"  # short: Pillow logs values of up to 32 bytes in full
    exif[0x0112] = 6
    photo = jpeg(120, 80, exif=exif.tobytes())  # built BEFORE the levels drop: building EXIF logs it too
    iccp = chunk(b"iCCP", b"iccp-name-secret\x00\x00" + zlib.compress(b"\x00" * 128))
    text = chunk(b"tEXt", b"Comment\x00text-log-secret")
    ztxt = chunk(b"zTXt", b"Author\x00\x00" + zlib.compress(b"ztxt-log-secret"))
    screenshot = png_with(iccp, text, ztxt, chunk(b"eXIf", exif.tobytes()))
    try:
        for lg in pil:
            lg.setLevel(1)  # ... and does not matter: someone debugging Pillow cannot re-open the leak
        caplog.set_level(1)
        out = ii.reencode(photo)
        assert reopen(out).size == (80, 120)  # the orientation was still applied
        assert reopen(ii.reencode(screenshot)).size == (8, 8)
    finally:
        for lg, level in zip(pil, saved):
            lg.setLevel(level)
    assert caplog.records, "nothing captured: the capture is not wired"
    for secret in ("exif-log-secret", "iccp-name-secret", "text-log-secret", "ztxt-log-secret"):
        assert secret not in caplog.text, secret


def test_exif_orientation_is_applied_after_the_pixel_check():
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90 on display
    out = ii.reencode(jpeg(200, 100, exif=exif.tobytes()))
    assert reopen(out).size == (100, 200)


@pytest.mark.parametrize("orientation", range(1, 9))
def test_the_own_orientation_reader_matches_pillows_exif_transpose(orientation):
    """The bounded IFD0 reader + transpose give exactly what PIL.ImageOps.exif_transpose gives (big- and little-endian EXIF)."""
    from PIL import ImageOps

    src = Image.frombytes("RGB", (6, 4), bytes(range(72)))
    exif = Image.Exif()
    exif[0x0112] = orientation
    for endian in ("<", ">"):
        block = exif.tobytes()
        if endian == ">":  # re-pack as a big-endian TIFF block
            le = Image.Exif()
            le[0x0112] = orientation
            block = b"MM\x00\x2a\x00\x00\x00\x08\x00\x01" + struct.pack(">HHIHH", 0x0112, 3, 1, orientation, 0) + b"\x00" * 4
        assert ii.exif_orientation(block[6:] if block.startswith(b"Exif") else block) == orientation
    buf = io.BytesIO()
    src.save(buf, "PNG", exif=exif.tobytes())
    out = reopen(ii.reencode(buf.getvalue()))
    expected = ImageOps.exif_transpose(Image.open(io.BytesIO(buf.getvalue())))
    assert out.size == expected.size


@pytest.mark.parametrize("block", [b"", b"II", b"XX*\x00\x08\x00\x00\x00", b"II*\x00\xff\xff\xff\xff",
                                   b"II*\x00\x08\x00\x00\x00\xff\xff" + b"\x00" * 12,
                                   b"II*\x00\x08\x00\x00\x00\x01\x00\x12\x01\x04\x00\x01\x00\x00\x00\x06\x00\x00\x00",
                                   b"II*\x00\x08\x00\x00\x00\x01\x00\x12\x01\x03\x00\x01\x00\x00\x00\x09\x00\x00\x00"])
def test_a_broken_or_odd_exif_block_means_no_rotation(block):
    assert ii.exif_orientation(block) == 1


@pytest.mark.parametrize("payload", [b"<html><script>alert(document.cookie)</script></html>", b"PK\x03\x04" + b"\x14\x00" * 20 + b"evil.js"])
def test_polyglot_payloads_are_dropped_by_the_reencode(payload):
    for base in (jpeg(120, 90), png(60, 40)):
        out = ii.reencode(base + payload)
        assert payload[:8] not in out.data and b"<script" not in out.data
        assert reopen(out).size == Image.open(io.BytesIO(base)).size


def test_png_text_chunk_with_markup_is_dropped():
    text = chunk(b"tEXt", b"Comment\x00<script>alert(1)</script>")
    out = ii.reencode(png_with(text))
    assert b"<script" not in out.data and reopen(out).size == (8, 8)


def test_palette_and_grayscale_and_cmyk_inputs():
    for mode, color in (("P", 3), ("L", 128), ("1", 1)):
        assert reopen(ii.reencode(png(50, 50, mode, color))).mode == "RGB"
    buf = io.BytesIO()
    Image.new("CMYK", (40, 40), (0, 128, 255, 0)).save(buf, "JPEG")
    assert reopen(ii.reencode(buf.getvalue())).mode == "RGB"


def test_sixteen_bit_png_is_refused_before_any_decode():
    """Code review V6: 16-bit samples double every buffer of a PNG decode (16 MP RGBA16 = 128 MB); refused from IHDR."""
    buf = io.BytesIO()
    Image.new("I;16", (40, 40), 30000).save(buf, "PNG")
    assert ii.png_layout(buf.getvalue()).bit_depth == 16
    t0 = time.monotonic()
    refuse(buf.getvalue(), "unsupported_format", 415)
    rgb16 = png_with(w=8, h=8).replace(struct.pack(">IIBB", 8, 8, 8, 2), struct.pack(">IIBB", 8, 8, 16, 2))
    rgb16 = rgb16[:8] + chunk(b"IHDR", struct.pack(">IIBBBBB", 8, 8, 16, 2, 0, 0, 0)) + rgb16[33:]
    refuse(rgb16, "unsupported_format", 415)
    assert time.monotonic() - t0 < 0.5 * sw_time_factor()


def test_png_over_8_megapixels_is_refused_and_8_passes():
    refuse(patch_png_size(png(10, 10), 4000, 2001), "too_many_pixels", 422)
    with pytest.raises(ii.IntakeError) as e:
        ii.reencode(patch_png_size(png(10, 10), 4000, 2001))
    assert e.value.details == {"max_pixels": ii.PNG_MAX_PIXELS}
    assert reopen(ii.reencode(png(4000, 2000))).size == (2048, 1024)


# ---------------------------------------------------------------- refused by type (magic bytes, never the name)


def test_webp_heic_avif_and_other_types_are_refused_by_content():
    buf = io.BytesIO()
    try:
        Image.new("RGB", (10, 10)).save(buf, "WEBP")
        webp = buf.getvalue()
    except (KeyError, OSError):
        webp = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 30
    refuse(webp, "webp_refused", 415)
    refuse(b"\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic" + b"\x00" * 64, "heic_refused", 415)
    refuse(b"\x00\x00\x00\x18ftypmif1\x00\x00\x00\x00mif1heic" + b"\x00" * 64, "heic_refused", 415)
    refuse(b"\x00\x00\x00\x1cftypavif\x00\x00\x00\x00avifmif1" + b"\x00" * 64, "unsupported_format", 415)
    for fmt in ("GIF", "BMP", "TIFF"):
        b = io.BytesIO()
        Image.new("RGB", (10, 10)).save(b, fmt)
        refuse(b.getvalue(), "unsupported_format", 415)
    for text in (b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', b"<!doctype html><script>x</script>",
                 b"%PDF-1.7\n%%EOF", b"", b"\xff\xd8", b"\x89PN"):
        refuse(text, "unsupported_format", 415)


def test_more_than_8_mib_is_refused_before_anything_else():
    refuse(b"\xff\xd8\xff" + b"\x00" * (ii.MAX_BYTES - 2), "too_large", 413)


# ---------------------------------------------------------------- bombs and oversize declarations (refused before a decode)


def test_png_pixel_bomb_and_16mp_plus_one_are_refused_from_the_header():
    refuse(patch_png_size(png(10, 10), 20000, 20000), "too_many_pixels", 422)
    refuse(patch_png_size(png(10, 10), 4001, 4000), "too_many_pixels", 422)
    refuse(patch_png_size(png(10, 10), 10001, 50), "too_many_pixels", 422)  # small budget, absurd side


def test_jpeg_pixel_bomb_and_16mp_plus_one_are_refused_from_the_header():
    refuse(patch_jpeg_size(jpeg(16, 16), 65000, 65000), "too_many_pixels", 422)
    refuse(patch_jpeg_size(jpeg(16, 16), 4001, 4000), "too_many_pixels", 422)
    refuse(patch_jpeg_size(jpeg(16, 16), 10001, 16), "too_many_pixels", 422)


def test_zlib_text_bomb_never_reaches_the_decoder():
    """A 60 KiB zTXt chunk that inflates to 60 MB: the structure walk keeps it out of the decoder (Pillow would inflate it while
    opening), so the image is accepted quickly with the text gone - not refused by luck of Pillow's own text limit."""
    bomb = zlib.compress(b"\x00" * (60 * 1024 * 1024), 9)
    assert len(bomb) < 64 * 1024
    data = png_with(chunk(b"zTXt", b"Comment\x00\x00" + bomb))
    assert b"zTXt" not in ii.png_layout(data).clean
    t0 = time.monotonic()
    out = ii.reencode(data)
    assert time.monotonic() - t0 < 1.0 * sw_time_factor()
    assert b"Comment" not in out.data and reopen(out).size == (8, 8)


def test_the_decoder_gets_a_metadata_free_copy():
    exif = Image.Exif()
    exif[0x010E] = "walk-secret"
    data = insert_after_soi(jpeg(64, 48, exif=exif.tobytes(), icc_profile=b"ICC-WALK" * 8),
                            jpeg_segment(0xFE, b"com-walk"), jpeg_segment(0xED, b"Photoshop 3.0\x00psd-walk"))
    data = data + jpeg(32, 32) + b"trailing-walk"  # an MPF-style secondary image and a payload after the primary EOI
    layout = ii.jpeg_layout(data)
    assert (layout.width, layout.height, layout.progressive, layout.scans) == (64, 48, False, 1)
    for needle in (b"walk-secret", b"ICC-WALK", b"com-walk", b"psd-walk", b"trailing-walk", b"Exif"):
        assert needle not in layout.clean, needle
    assert layout.clean.endswith(b"\xff\xd9") and layout.clean.count(b"\xff\xd8") == 1
    assert reopen(ii.reencode(data)).size == (64, 48)


@pytest.mark.parametrize("marker,code,status", [(0xC3, "unsupported_format", 415), (0xC9, "unsupported_format", 415),
                                                (0xCA, "unsupported_format", 415), (0xC5, "unsupported_format", 415)])
def test_lossless_hierarchical_and_arithmetic_frames_are_refused(marker, code, status):
    data = jpeg(16, 16)
    i = data.index(b"\xff\xc0")
    refuse(data[:i + 1] + bytes([marker]) + data[i + 2:], code, status)


def test_twelve_bit_and_odd_component_frames_are_refused():
    data = jpeg(16, 16)
    i = data.index(b"\xff\xc0")
    refuse(data[:i + 4] + b"\x0c" + data[i + 5:], "unsupported_format", 415)  # 12-bit samples
    refuse(data[:i + 9] + b"\x02" + data[i + 10:], "image_invalid", 422)  # two components


@pytest.mark.parametrize("extra,code,status", [
    ((chunk(b"tEXt", b"k\x00v"),) * 9, "image_invalid", 422),  # too many text chunks
    ((chunk(b"iCCP", b"x\x00\x00" + b"\x00" * (1024 * 1024)),), "image_invalid", 422),  # oversize ICC
    ((chunk(b"zzZz", b"\x00" * (65 * 1024)),), "image_invalid", 422),  # oversize unknown ancillary chunk
    ((chunk(b"ABCD", b"\x00"),), "image_invalid", 422),  # unknown critical chunk
    ((chunk(b"acTL", struct.pack(">II", 2, 0)),), "unsupported_format", 415),  # animated PNG
    ((chunk(b"IHDR", struct.pack(">IIBBBBB", 8, 8, 8, 2, 0, 0, 0)),), "image_invalid", 422),  # a second IHDR
])
def test_png_chunk_layout_attacks(extra, code, status):
    refuse(png_with(*extra), code, status)


def test_png_structure_errors():
    good = png(10, 10)
    refuse(good[:8] + chunk(b"IDAT", b"x") + good[8:], "image_invalid", 422)  # IHDR not first
    refuse(good[:40], "image_invalid", 422)  # truncated before IEND
    refuse(good[:8] + struct.pack(">I", 0x7FFFFFFF) + good[12:], "image_invalid", 422)  # a length beyond the file
    refuse(png_with(chunk(b"tEXt", b"x"), w=0), "too_many_pixels", 422)


def test_progressive_jpeg_is_fine_and_a_scan_bomb_is_refused_before_decoding():
    progressive = jpeg(640, 480, noise=True, progressive=True)
    layout = ii.jpeg_layout(progressive)
    assert layout.progressive and 1 < layout.scans <= ii.JPEG_MAX_SCANS
    assert ii.reencode(progressive).width == 640
    t0 = time.monotonic()
    sequential_bomb = jpeg(16, 16)[:-2] + b"\xff\xda\x00\x08\x01\x01\x00\x00\x3f\x00" * ii.SEQUENTIAL_MAX_SCANS + b"\xff\xd9"
    refuse(sequential_bomb, "image_invalid", 422)
    progressive_bomb = progressive[:-2] + b"\xff\xda\x00\x08\x01\x01\x00\x00\x3f\x00" * ii.JPEG_MAX_SCANS + b"\xff\xd9"
    refuse(progressive_bomb, "image_invalid", 422)
    assert time.monotonic() - t0 < 1.0 * sw_time_factor()


def test_a_progressive_jpeg_over_8_megapixels_is_refused_from_the_header():
    """Code review V6: libjpeg keeps a progressive image's whole coefficient buffer whatever the draft scale - 8 MP for
    progressive, 16 MP stays for baseline."""
    progressive = jpeg(64, 48, progressive=True)
    i = progressive.index(b"\xff\xc2")
    big = progressive[:i + 5] + struct.pack(">HH", 2001, 4000) + progressive[i + 9:]
    with pytest.raises(ii.IntakeError) as e:
        ii.reencode(big)
    assert (e.value.code, e.value.status, e.value.details) == ("too_many_pixels", 422, {"max_pixels": ii.PROGRESSIVE_MAX_PIXELS})
    assert ii.jpeg_layout(patch_jpeg_size(jpeg(16, 16), 4000, 4000)).width == 4000  # a baseline 16 MP header passes the walk


def test_truncated_jpeg_is_one_clean_refusal():
    data = jpeg(800, 600, noise=True)
    refuse(data[: len(data) // 2], "image_invalid", 422)


def test_garbage_after_a_valid_header_is_one_clean_refusal():
    head = jpeg(64, 64)[:200]
    refuse(head + b"\x00" * 5000, "image_invalid", 422)
    refuse(png(10, 10)[:33] + chunk(b"IDAT", b"not zlib at all") + chunk(b"IEND", b""), "image_invalid", 422)


# ---------------------------------------------------------------- the own decode semaphore


def test_busy_decoder_answers_429_and_the_administrators_slot_is_never_shared():
    from smplwise.routers import ui_background

    assert ii._DECODE is not ui_background._DECODE  # noqa: SLF001
    held = threading.Event()
    release = threading.Event()

    def hold():
        with ii.decode_slot():
            held.set()
            release.wait(5)

    t = threading.Thread(target=hold)
    t.start()
    try:
        assert held.wait(5)
        t0 = time.monotonic()
        refuse(jpeg(32, 32), "busy", 429, wait_s=0.2)
        assert time.monotonic() - t0 < 2 * sw_time_factor()
        with ui_background._decode_slot():  # noqa: SLF001 - the administrator's upload is not made to wait
            pass
    finally:
        release.set()
        t.join(5)
    assert ii.reencode(jpeg(32, 32)).width == 32


def test_decodes_are_serialised_not_refused_within_the_wait():
    order: list[str] = []
    started = threading.Event()

    def first():
        with ii.decode_slot():
            order.append("first-in")
            started.set()
            time.sleep(0.3)
            order.append("first-out")

    t = threading.Thread(target=first)
    t.start()
    assert started.wait(5)
    out = ii.reencode(jpeg(16, 16), wait_s=5)
    order.append("second-done")
    t.join(5)
    assert out.width == 16 and order == ["first-in", "first-out", "second-done"]


# ---------------------------------------------------------------- storage, confinement, quotas


def test_store_image_writes_a_random_confined_name(tmp_path):
    out = ii.reencode(jpeg(64, 48))
    stored = ii.store_image(tmp_path, "tk0001", out)
    assert stored.rel_path.startswith("tk0001/") and stored.rel_path.endswith(".jpg") and len(stored.rel_path) == len("tk0001/") + 20
    p = ii.resolve_stored(tmp_path, stored.rel_path)
    assert p.read_bytes() == out.data and stored.sha256 == out.sha256 and (stored.width, stored.height) == (64, 48)
    assert not [x for x in p.parent.iterdir() if x.name.endswith(".tmp")]
    cost = ii.store_image(tmp_path, "tk0001", out, subdir="costs")
    assert cost.rel_path.startswith("tk0001/costs/")
    assert ii.remove_stored(tmp_path, stored.rel_path) and not p.exists()


@pytest.mark.parametrize("ticket_id", ["../escape", "a/b", "", ".", "..", "x" * 70, "a\\b", "C:"])
def test_store_refuses_ids_that_could_leave_the_folder(tmp_path, ticket_id):
    with pytest.raises(ii.StorePathError):
        ii.store_image(tmp_path, ticket_id, ii.reencode(jpeg(8, 8)))
    with pytest.raises(ii.StorePathError):
        ii.store_image(tmp_path, "tk1", ii.reencode(jpeg(8, 8)), subdir="../x")


@pytest.mark.parametrize("rel", ["../x.jpg", "/etc/passwd", "a\\b.jpg", "tk/../../x", "", "C:/x", "tk/.."])
def test_stored_paths_are_confined(tmp_path, rel):
    with pytest.raises(ii.StorePathError):
        ii.resolve_stored(tmp_path, rel)
    assert ii.remove_stored(tmp_path, rel) is False


def test_storage_cap_is_checked_from_a_cached_walk(tmp_path):
    (tmp_path / "t1").mkdir()
    (tmp_path / "t1" / "a.jpg").write_bytes(b"x" * 600)
    now = [0.0]
    meter = ii.StorageMeter(tmp_path, cap_bytes=1000, refresh_s=60, clock=lambda: now[0])
    assert meter.used() == 600
    meter.admit(400)
    with pytest.raises(ii.IntakeError) as e:
        meter.admit(401)
    assert (e.value.code, e.value.status) == ("storage_full", 507)
    (tmp_path / "t1" / "b.jpg").write_bytes(b"x" * 300)
    assert meter.used() == 600  # cached
    meter.note(300)
    assert meter.used() == 900
    now[0] = 61
    assert meter.used() == 900  # re-walked: the same truth


def test_a_slow_storage_walk_never_blocks_other_admits(tmp_path):
    """Review finding 10: a stale total is re-walked by one caller while the others go on with the stale value."""
    now = [0.0]
    meter = ii.StorageMeter(tmp_path, cap_bytes=10_000, refresh_s=60, clock=lambda: now[0])
    assert meter.used() == 0
    now[0] = 61
    entered, release = threading.Event(), threading.Event()
    real_walk = meter._walk  # noqa: SLF001

    def slow_walk() -> int:
        entered.set()
        release.wait(5)
        return real_walk()

    meter._walk = slow_walk  # type: ignore[method-assign]  # noqa: SLF001
    t = threading.Thread(target=meter.used)
    t.start()
    assert entered.wait(5)
    t0 = time.monotonic()
    meter.admit(100)  # answered from the stale total while the walk runs
    assert time.monotonic() - t0 < 0.5
    release.set()
    t.join(5)


def test_photo_quota_per_assignment_and_per_ticket():
    ii.check_photo_quota(PhotoCounts(29, 59))
    for counts in (PhotoCounts(30, 0), PhotoCounts(0, 60)):
        with pytest.raises(ii.IntakeError) as e:
            ii.check_photo_quota(counts)
        assert (e.value.code, e.value.status) == ("photo_limit", 409)


def test_one_upload_in_flight_per_link():
    guard = ii.InFlight()
    with guard.claim("link-a"):
        with pytest.raises(ii.IntakeError) as e:
            with guard.claim("link-a"):
                pass
        assert (e.value.code, e.value.status) == ("busy", 429)
        with guard.claim("link-b"):
            pass
    with guard.claim("link-a"):
        pass
    wins: list[int] = []
    barrier = threading.Barrier(12)
    hold = threading.Event()

    def contend(i: int):
        barrier.wait()
        try:
            with guard.claim("link-c"):
                wins.append(i)
                hold.wait(2)
        except ii.IntakeError:
            pass

    threads = [threading.Thread(target=contend, args=(i,)) for i in range(12)]
    for t in threads:
        t.start()
    time.sleep(0.3)
    hold.set()
    for t in threads:
        t.join(5)
    assert len(wins) == 1


@pytest.mark.skipif(not (os.environ.get("SW_MEASURE_RSS") == "1" and sys.platform.startswith("linux")),
                    reason="a measurement: Linux (the add-on image) and SW_MEASURE_RSS=1 only")
@pytest.mark.parametrize("case", ["baseline_16mp", "progressive_8mp", "png_rgba_8mp"])
def test_peak_rss_of_one_decode_per_path(tmp_path, case):
    """Code review V6: the peak memory of ONE upload's decode, per path, in a fresh interpreter (ru_maxrss before / after the
    reencode call). A measurement with a loose bound, run on the runner on demand: SW_MEASURE_RSS=1 pytest -k peak_rss -s."""
    import subprocess

    if case == "baseline_16mp":
        data = jpeg(4000, 4000, noise=True)
    elif case == "progressive_8mp":
        data = jpeg(4000, 2000, noise=True, progressive=True)
    else:
        buf = io.BytesIO()
        Image.frombytes("RGBA", (4000, 2000), bytes((i * 31) % 251 for i in range(4000 * 2000 * 4))).save(buf, "PNG")
        data = buf.getvalue()
    src = tmp_path / "upload.bin"
    src.write_bytes(data)
    code = ("import resource, sys; from pathlib import Path\n"
            "from smplwise.services.tickets import image_intake as ii\n"
            f"data = Path({str(src)!r}).read_bytes()\n"
            "before = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss\n"
            "ii.reencode(data)\n"
            "after = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss\n"
            "print(before, after)\n")
    out = subprocess.run([sys.executable, "-c", code], cwd=Path(__file__).resolve().parents[1], capture_output=True, text=True,
                         timeout=120, check=True).stdout.split()
    before_kb, after_kb = int(out[0]), int(out[1])
    peak_mb = (after_kb - before_kb) / 1024
    print(f"peak RSS growth of one decode, {case}: {peak_mb:.0f} MB")
    assert peak_mb < 400
