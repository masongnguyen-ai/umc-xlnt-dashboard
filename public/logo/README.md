# Bộ logo UMC Water — hướng dẫn dùng cho web & app

## File
| File | Dùng ở đâu |
| --- | --- |
| `umc-water-icon.svg` | App icon chính (nền xanh navy bo góc) — nguồn gốc cho mọi PNG |
| `umc-water-mark.svg` | Mark không nền, đặt trên nền sáng (header, sidebar, tài liệu) |
| `umc-water-maskable.svg` | Icon PWA maskable (mark thu 80% trong vùng an toàn) |
| `umc-water-seal.svg` | Con dấu chính thức — văn bản, biên bản, biển hiệu, trang giới thiệu |
| `umc-water-lockup.svg` | Logo ngang: mark + "UMC WATER" + dòng phụ |
| `png/icon-512.png`, `png/icon-192.png` | PWA manifest |
| `png/apple-touch-icon-180.png` | iOS home screen |
| `png/favicon-32.png`, `png/favicon-16.png` | Favicon |
| `png/seal-1024.png`, `png/lockup-1240.png` | Bản raster cho slide, Word, mạng xã hội |

## Gắn vào web
Copy thư mục này vào `public/logo/`, rồi trong `<head>`:

```html
<link rel="icon" href="/logo/png/favicon-32.png" sizes="32x32">
<link rel="icon" href="/logo/umc-water-icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/logo/png/apple-touch-icon-180.png">
<link rel="manifest" href="/manifest.webmanifest">
```

`manifest.webmanifest`:

```json
{
  "name": "UMC Water — Hệ thống xử lý nước thải",
  "short_name": "UMC Water",
  "theme_color": "#0f4c75",
  "background_color": "#eaf4fb",
  "display": "standalone",
  "icons": [
    { "src": "/logo/png/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/logo/png/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/logo/umc-water-maskable.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "maskable" }
  ]
}
```

## App di động
- Android: `icon-512.png` cho adaptive icon (dùng bản maskable làm foreground).
- iOS: `icon-512.png`, không nền trong suốt, không bo góc sẵn (iOS tự bo).

## Màu
- Navy `#0f4c75` — màu chính
- Xanh lá `#4cb05c` — màu phụ (tuần hoàn / môi trường)
- Xanh nhạt `#eaf4fb` — nền sáng, chi tiết âm bản

## Lưu ý
Chữ trong `umc-water-seal.svg` và `umc-water-lockup.svg` là `<text>` với font Figtree (fallback sans-serif). Nếu web không nhúng Figtree, dùng bản PNG hoặc convert text → path trong Illustrator/Figma trước khi phát hành.
