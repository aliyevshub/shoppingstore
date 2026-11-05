# Aliyevs Store

Zamonaviy kiyim do'koni sayti: katalog, filtr, qidiruv, savatcha va Telegram orqali buyurtma.

## Imkoniyatlar
- 👕 Katalog: 20 ta tovar, ikki turkum — Sport va Boshqa
- 🖼 Har bir tovarda rasm galereyasi (surish) va rang tanlash
- ♥ Sevimlilar
- 🔍 Turkum bo'yicha filtr, qidiruv, narx bo'yicha saralash
- 🛒 Savatcha: o'lcham tanlash, sonini o'zgartirish (brauzerda saqlanadi)
- 📲 Buyurtma Telegram orqali yuboriladi
- 📱 Telefon va kompyuterga moslashgan

## Tuzilishi
| Fayl | Vazifasi |
|---|---|
| `index.html` | Sahifa tuzilishi |
| `style.css` | Dizayn |
| `src/products.ts` | ⭐ Do'kon sozlamalari va mahsulotlar ro'yxati (ranglar, rasmlar, narxlar) |
| `img/` | Tovar rasmlari (WebP, qirqilgan) |
| `logo-belgi.svg`, `favicon.svg` | Logotip (vektor) |
| `src/app.ts` | Dastur mantig'i: katalog, savatcha, buyurtma |
| `dist/*.js` | TypeScript'dan kompilyatsiya qilingan fayllar (brauzer shuni ishlatadi) |

## Mahsulot qo'shish yoki o'zgartirish
1. `src/products.ts` faylini oching va `mahsulotlar` ro'yxatini tahrirlang.
2. Telegram username'ni `DOKON.telegram` ga yozing.
3. Kompilyatsiya qiling:
   ```bash
   tsc -p .
   ```
4. O'zgarishlarni GitHub'ga yuklang — Cloudflare saytni avtomatik yangilaydi.

## Cloudflare Pages sozlamalari
- Production branch: `main`
- Framework preset: None
- Build command: *(bo'sh)*
- Build output directory: `/`
