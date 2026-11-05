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

## Admin panel
Manzil: `/admin` (masalan, `https://aliyevs-store.aliyevofficial0011.workers.dev/admin`)

- Login va parol bilan kirish, tovar qo'shish, rasm yuklash, tahrirlash, yashirish va o'chirish
- Tovarlar va rasmlar **Cloudflare D1** ma'lumotlar bazasida saqlanadi (`worker/index.ts`)
- Jadvallar birinchi so'rovda avtomatik yaratiladi

### Cloudflare sozlamalari
1. **D1 baza:** `aliyevs-store-db` nomli baza yaratiladi va `wrangler.jsonc` ga `DB` nomi bilan ulanadi
2. **Login va parol:** Workers & Pages → aliyevs-store → Settings → Variables and Secrets → `ADMIN_LOGIN` va `ADMIN_PAROL` (turi: Secret)

### Kompyuterda sinash
```bash
npx wrangler dev
```
Login va parol uchun `.dev.vars` fayliga `ADMIN_LOGIN="..."` va `ADMIN_PAROL="..."` yoziladi (bu fayl GitHub'ga yuklanmaydi).
