// =====================================================================
// worker/index.ts — SERVER (Cloudflare Worker)
// ---------------------------------------------------------------------
// Sayt fayllari (HTML, CSS, rasmlar) Cloudflare tomonidan to'g'ridan-to'g'ri
// beriladi. Bu kod faqat /api/... so'rovlariga javob beradi:
//
//   Hamma uchun:
//     GET    /api/tovarlar              — saytda ko'rinadigan yangi tovarlar
//     GET    /api/rasm/:id              — yuklangan rasm
//     POST   /api/buyurtma              — buyurtma (Telegram botga yuboriladi)
//     POST   /api/izoh                  — tovarga izoh (Telegram botga yuboriladi)
//   Faqat admin (login va parol bilan):
//     GET    /api/admin/telegram        — bot holati
//     POST   /api/admin/telegram/kod    — botni ulash havolasi
//     POST   /api/admin/telegram/tasdiq — /start bosilganini tekshirib, ulash
//     POST   /api/admin/telegram/sinov  — sinov xabari
//     GET    /api/admin/tekshir         — parol to'g'rimi?
//     GET    /api/admin/tovarlar        — barcha tovarlar (yashirinlari ham)
//     POST   /api/admin/tovarlar        — yangi tovar
//     PUT    /api/admin/tovarlar/:id    — tovarni tahrirlash
//     DELETE /api/admin/tovarlar/:id    — tovarni o'chirish
//     POST   /api/admin/rasm            — rasm yuklash
//
// Ma'lumotlar Cloudflare D1 (SQL baza) da saqlanadi. Jadvallar birinchi
// so'rovda avtomatik yaratiladi.
// =====================================================================

interface Env {
  DB?: any;              // D1 ma'lumotlar bazasi
  ADMIN_LOGIN?: string;  // Cloudflare'da "Secret" sifatida saqlanadi
  ADMIN_PAROL?: string;  // Cloudflare'da "Secret" sifatida saqlanadi
  TELEGRAM_TOKEN?: string; // @BotFather bergan token ("Secret")
  TELEGRAM_API?: string;   // faqat sinov uchun (odatda bo'sh)
  ASSETS: { fetch(req: Request): Promise<Response> };
}

const ID_BOSHI = 1000; // kod ichidagi 20 ta tovar bilan to'qnashmasligi uchun
const MAX_RASM = 1_500_000; // 1.5 MB

// ---------------------------------------------------------------------
// YORDAMCHILAR
// ---------------------------------------------------------------------

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function xato(matn: string, status = 400): Response {
  return json({ xato: matn }, status);
}

let jadvallarTayyor = false;
async function jadvallar(db: any): Promise<void> {
  if (jadvallarTayyor) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS tovarlar (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nomi       TEXT    NOT NULL,
      tavsif     TEXT    NOT NULL DEFAULT '',
      turkum     TEXT    NOT NULL,
      tur        TEXT    NOT NULL,
      narx       INTEGER NOT NULL,
      eski_narx  INTEGER,
      yangi      INTEGER NOT NULL DEFAULT 0,
      yashirin   INTEGER NOT NULL DEFAULT 0,
      variantlar TEXT    NOT NULL,
      yaratilgan TEXT    NOT NULL DEFAULT (datetime('now'))
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sozlamalar (
      kalit  TEXT PRIMARY KEY,
      qiymat TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sorovlar (
      ip    TEXT NOT NULL,
      turi  TEXT NOT NULL,
      vaqt  INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS rasmlar (
      id         TEXT PRIMARY KEY,
      turi       TEXT NOT NULL,
      malumot    BLOB NOT NULL,
      yaratilgan TEXT NOT NULL DEFAULT (datetime('now'))
    )`),
  ]);
  jadvallarTayyor = true;
}

// Parolni xavfsiz solishtirish (vaqt bo'yicha farq qilmaydi)
async function parolTogri(berilgan: string, asl: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(berilgan)),
    crypto.subtle.digest("SHA-256", enc.encode(asl)),
  ]);
  const x = new Uint8Array(a), y = new Uint8Array(b);
  let farq = 0;
  for (let i = 0; i < x.length; i++) farq |= x[i] ^ y[i];
  return farq === 0;
}

// ---------------------------------------------------------------------
// TOVAR MA'LUMOTINI TEKSHIRISH
// ---------------------------------------------------------------------

interface VariantKirish { rang: string; hex: string; rasmlar: string[] }
interface TovarKirish {
  nomi: string; tavsif: string; turkum: "sport" | "casual"; tur: "kiyim" | "poyabzal";
  narx: number; eskiNarx: number | null; yangi: boolean; yashirin: boolean; variantlar: VariantKirish[];
}

const RASM_URL = /^\/api\/rasm\/[a-f0-9]{32}$|^img\/[a-z0-9-]+\.webp$|^https:\/\/[^\s"'<>]{4,500}$/i;

function tekshir(b: any): TovarKirish | string {
  if (!b || typeof b !== "object") return "Ma'lumot noto'g'ri";
  const nomi = String(b.nomi ?? "").trim();
  const tavsif = String(b.tavsif ?? "").trim();
  if (nomi.length < 2 || nomi.length > 80) return "Tovar nomi 2–80 belgidan iborat bo'lsin";
  if (tavsif.length > 400) return "Tavsif 400 belgidan oshmasin";
  if (b.turkum !== "sport" && b.turkum !== "casual") return "Turkum: sport yoki casual";
  if (b.tur !== "kiyim" && b.tur !== "poyabzal") return "Tur: kiyim yoki poyabzal";
  const narx = Math.round(Number(b.narx));
  if (!Number.isFinite(narx) || narx < 1000 || narx > 100_000_000) return "Narxni to'g'ri kiriting";
  let eskiNarx: number | null = null;
  if (b.eskiNarx !== null && b.eskiNarx !== undefined && b.eskiNarx !== "" && Number(b.eskiNarx) > 0) {
    eskiNarx = Math.round(Number(b.eskiNarx));
    if (!Number.isFinite(eskiNarx) || eskiNarx <= narx) return "Eski narx hozirgi narxdan katta bo'lsin";
  }
  if (!Array.isArray(b.variantlar) || b.variantlar.length < 1 || b.variantlar.length > 8) return "Kamida bitta rang kiriting (ko'pi bilan 8 ta)";
  const variantlar: VariantKirish[] = [];
  for (const v of b.variantlar) {
    const rang = String(v?.rang ?? "").trim();
    const hex = String(v?.hex ?? "").trim();
    if (rang.length < 1 || rang.length > 30) return "Rang nomini kiriting";
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return "Rang kodi noto'g'ri";
    const rasmlar = Array.isArray(v?.rasmlar) ? v.rasmlar.map((r: unknown) => String(r)) : [];
    if (rasmlar.length < 1 || rasmlar.length > 8) return `"${rang}" rangiga 1–8 ta rasm qo'shing`;
    if (!rasmlar.every((r: string) => RASM_URL.test(r))) return "Rasm manzili noto'g'ri";
    variantlar.push({ rang, hex, rasmlar });
  }
  return { nomi, tavsif, turkum: b.turkum, tur: b.tur, narx, eskiNarx, yangi: !!b.yangi, yashirin: !!b.yashirin, variantlar };
}

function qatordan(q: any) {
  return {
    id: ID_BOSHI + q.id,
    nomi: q.nomi,
    tavsif: q.tavsif,
    turkum: q.turkum,
    tur: q.tur,
    narx: q.narx,
    ...(q.eski_narx ? { eskiNarx: q.eski_narx } : {}),
    ...(q.yangi ? { yangi: true } : {}),
    yashirin: !!q.yashirin,
    variantlar: JSON.parse(q.variantlar),
  };
}

function rasmIdlari(variantlar: VariantKirish[]): string[] {
  return variantlar.flatMap((v) => v.rasmlar).filter((r) => r.startsWith("/api/rasm/")).map((r) => r.slice(10));
}

// Hech qaysi tovarda ishlatilmayotgan rasmlarni o'chiradi
async function keraksizRasmlarniTozala(db: any, nomzodlar: string[]): Promise<void> {
  if (!nomzodlar.length) return;
  const { results } = await db.prepare("SELECT variantlar FROM tovarlar").all();
  const ishlatilgan = new Set<string>();
  for (const q of results) for (const id of rasmIdlari(JSON.parse(q.variantlar))) ishlatilgan.add(id);
  const ochir = nomzodlar.filter((id) => !ishlatilgan.has(id));
  if (ochir.length) await db.batch(ochir.map((id) => db.prepare("DELETE FROM rasmlar WHERE id = ?").bind(id)));
}

// ---------------------------------------------------------------------
// TELEGRAM BOT
// ---------------------------------------------------------------------

async function sozlama(db: any, kalit: string): Promise<string | null> {
  const q = await db.prepare("SELECT qiymat FROM sozlamalar WHERE kalit = ?").bind(kalit).first();
  return q ? q.qiymat : null;
}
async function sozlamaYoz(db: any, kalit: string, qiymat: string): Promise<void> {
  await db.prepare("INSERT INTO sozlamalar (kalit, qiymat) VALUES (?, ?) ON CONFLICT(kalit) DO UPDATE SET qiymat = excluded.qiymat").bind(kalit, qiymat).run();
}

let tgManzil = "https://api.telegram.org";
async function tg(token: string, usul: string, malumot: unknown = {}): Promise<any> {
  const javob = await fetch(`${tgManzil}/bot${token}/${usul}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(malumot),
  });
  const j: any = await javob.json().catch(() => ({}));
  if (!j.ok) throw new Error(j.description || "Telegram javob bermadi");
  return j.result;
}

const h = (m: string) => m.replace(/[&<>]/g, (b) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[b]!));
const somMatn = (n: number) => Math.round(n).toLocaleString("ru-RU").replace(/\u00a0/g, " ") + " so'm";

// Botga xabar yuborish (bot va admin chati sozlangan bo'lishi kerak)
async function botgaYubor(env: Env, matn: string): Promise<void> {
  if (!env.TELEGRAM_TOKEN) throw new Error("bot");
  const chat = await sozlama(env.DB, "tg_chat");
  if (!chat) throw new Error("bot");
  await tg(env.TELEGRAM_TOKEN, "sendMessage", { chat_id: Number(chat), text: matn, parse_mode: "HTML", disable_web_page_preview: true });
}

// Bitta IP manzildan juda ko'p so'rovni cheklash
async function cheklov(db: any, req: Request, turi: string, max: number, daqiqa: number): Promise<boolean> {
  const ip = req.headers.get("cf-connecting-ip") || "nomalum";
  const hozir = Date.now();
  await db.prepare("DELETE FROM sorovlar WHERE vaqt < ?").bind(hozir - 24 * 3600_000).run();
  const q = await db.prepare("SELECT COUNT(*) AS soni FROM sorovlar WHERE ip = ? AND turi = ? AND vaqt > ?").bind(ip, turi, hozir - daqiqa * 60_000).first();
  if ((q?.soni ?? 0) >= max) return false;
  await db.prepare("INSERT INTO sorovlar (ip, turi, vaqt) VALUES (?, ?, ?)").bind(ip, turi, hozir).run();
  return true;
}

const qisqa = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function buyurtmaXabari(b: any): string | { matn: string } {
  const ism = qisqa(b?.ism, 60), tel = qisqa(b?.tel, 30), manzil = qisqa(b?.manzil, 200), izoh = qisqa(b?.izoh, 500);
  if (ism.length < 2) return "Ismingizni kiriting";
  if (!/^[+\d][\d\s()\-]{6,20}$/.test(tel)) return "Telefon raqamni to'g'ri kiriting";
  if (manzil.length < 3) return "Manzilni kiriting";
  if (!Array.isArray(b?.qatorlar) || !b.qatorlar.length || b.qatorlar.length > 30) return "Savatcha bo'sh";
  let jami = 0;
  const qatorlar: string[] = [];
  for (const [i, q] of b.qatorlar.entries()) {
    const soni = Math.round(Number(q?.soni)), narx = Math.round(Number(q?.narx));
    if (!(soni >= 1 && soni <= 50) || !(narx >= 0 && narx <= 100_000_000)) return "Savatcha ma'lumoti noto'g'ri";
    jami += soni * narx;
    qatorlar.push(`${i + 1}. <b>${h(qisqa(q?.nomi, 80))}</b> — ${h(qisqa(q?.rang, 30))}, ${h(qisqa(q?.olcham, 10))} × ${soni} = ${somMatn(soni * narx)}`);
  }
  return {
    matn: [
      "🛍 <b>Yangi buyurtma — Aliyevs Store</b>",
      "",
      ...qatorlar,
      "",
      `💰 <b>Jami: ${somMatn(jami)}</b>`,
      "",
      `👤 Ism: ${h(ism)}`,
      `📞 Telefon: ${h(tel)}`,
      `📍 Manzil: ${h(manzil)}`,
      ...(izoh ? [`📝 Izoh: ${h(izoh)}`] : []),
    ].join("\n"),
  };
}

// ---------------------------------------------------------------------
// SO'ROVLARNI BOSHQARISH
// ---------------------------------------------------------------------

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const yol = url.pathname;
  const usul = req.method;

  // ---- Hamma uchun: tovarlar ro'yxati ----
  if (yol === "/api/tovarlar" && usul === "GET") {
    if (!env.DB) return json([]);
    await jadvallar(env.DB);
    const { results } = await env.DB.prepare("SELECT * FROM tovarlar WHERE yashirin = 0 ORDER BY id DESC").all();
    return new Response(JSON.stringify(results.map(qatordan).map(({ yashirin, ...t }: any) => t)), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=30" },
    });
  }

  // ---- Hamma uchun: rasm ----
  const rasmMos = yol.match(/^\/api\/rasm\/([a-f0-9]{32})$/);
  if (rasmMos && usul === "GET") {
    if (!env.DB) return xato("Topilmadi", 404);
    await jadvallar(env.DB);
    const q = await env.DB.prepare("SELECT turi, malumot FROM rasmlar WHERE id = ?").bind(rasmMos[1]).first();
    if (!q) return xato("Rasm topilmadi", 404);
    return new Response(new Uint8Array(q.malumot), {
      headers: { "content-type": q.turi, "cache-control": "public, max-age=31536000, immutable" },
    });
  }

  // ---- Hamma uchun: buyurtma va izoh (Telegram botga) ----
  if ((yol === "/api/buyurtma" || yol === "/api/izoh") && usul === "POST") {
    if (!env.DB || !env.TELEGRAM_TOKEN) return xato("Buyurtma qabul qilish vaqtincha ishlamayapti. Birozdan keyin urinib ko'ring.", 503);
    await jadvallar(env.DB);
    const b: any = await req.json().catch(() => null);
    if (b?.sayt) return json({ ok: true }); // robotlar uchun yashirin maydon
    const buyurtma = yol === "/api/buyurtma";
    if (!(await cheklov(env.DB, req, buyurtma ? "buyurtma" : "izoh", buyurtma ? 5 : 8, 10)))
      return xato("Juda ko'p so'rov yuborildi. 10 daqiqadan keyin urinib ko'ring.", 429);
    let matn: string;
    if (buyurtma) {
      const x = buyurtmaXabari(b);
      if (typeof x === "string") return xato(x);
      matn = x.matn;
    } else {
      const ism = qisqa(b?.ism, 60), izoh = qisqa(b?.matn, 1000), baho = Math.round(Number(b?.baho));
      if (ism.length < 2 || izoh.length < 2 || !(baho >= 1 && baho <= 5)) return xato("Baho, ism va izohni to'ldiring");
      matn = [
        "⭐ <b>Yangi izoh — Aliyevs Store</b>",
        "",
        `Tovar: <b>${h(qisqa(b?.tovar, 80))}</b> (#${Math.round(Number(b?.tovarId)) || "?"})`,
        `Baho: ${"★".repeat(baho)}${"☆".repeat(5 - baho)} (${baho}/5)`,
        `Ism: ${h(ism)}`,
        "",
        h(izoh),
      ].join("\n");
    }
    try {
      await botgaYubor(env, matn);
    } catch (e) {
      console.error(e);
      return xato("Buyurtma qabul qilish vaqtincha ishlamayapti. Birozdan keyin urinib ko'ring.", 503);
    }
    return json({ ok: true });
  }

  // ---- Admin: parol tekshiruvi ----
  if (yol.startsWith("/api/admin/")) {
    if (!env.ADMIN_LOGIN) return xato("Admin logini hali sozlanmagan (Cloudflare → Settings → Variables and Secrets → ADMIN_LOGIN)", 503);
    if (!env.ADMIN_PAROL) return xato("Admin paroli hali sozlanmagan (Cloudflare → Settings → Variables and Secrets → ADMIN_PAROL)", 503);
    if (!env.DB) return xato("Ma'lumotlar bazasi ulanmagan (D1)", 503);
    const sarlavha = req.headers.get("authorization") ?? "";
    const berilgan = sarlavha.startsWith("Bearer ") ? sarlavha.slice(7) : "";
    let login = "";
    try { login = decodeURIComponent(req.headers.get("x-admin-login") ?? ""); } catch { /* noto'g'ri */ }
    const [loginTogri, parolTogriMi] = await Promise.all([
      parolTogri(login.trim(), env.ADMIN_LOGIN.trim()),
      parolTogri(berilgan, env.ADMIN_PAROL),
    ]);
    if (!login || !berilgan || !loginTogri || !parolTogriMi) {
      await new Promise((r) => setTimeout(r, 600)); // taxmin qilishni sekinlashtirish
      return xato("Login yoki parol noto'g'ri", 401);
    }
    await jadvallar(env.DB);
    const db = env.DB;

    if (yol === "/api/admin/tekshir" && usul === "GET") return json({ ok: true });

    if (yol === "/api/admin/tovarlar" && usul === "GET") {
      const { results } = await db.prepare("SELECT * FROM tovarlar ORDER BY id DESC").all();
      return json(results.map(qatordan));
    }

    if (yol === "/api/admin/tovarlar" && usul === "POST") {
      const t = tekshir(await req.json().catch(() => null));
      if (typeof t === "string") return xato(t);
      const q = await db
        .prepare(`INSERT INTO tovarlar (nomi, tavsif, turkum, tur, narx, eski_narx, yangi, yashirin, variantlar)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
        .bind(t.nomi, t.tavsif, t.turkum, t.tur, t.narx, t.eskiNarx, t.yangi ? 1 : 0, t.yashirin ? 1 : 0, JSON.stringify(t.variantlar))
        .first();
      return json(qatordan(q), 201);
    }

    const tovarMos = yol.match(/^\/api\/admin\/tovarlar\/(\d+)$/);
    if (tovarMos) {
      const dbId = Number(tovarMos[1]) - ID_BOSHI;
      const eski = await db.prepare("SELECT * FROM tovarlar WHERE id = ?").bind(dbId).first();
      if (!eski) return xato("Tovar topilmadi", 404);
      const eskiRasmlar = rasmIdlari(JSON.parse(eski.variantlar));

      if (usul === "PUT") {
        const t = tekshir(await req.json().catch(() => null));
        if (typeof t === "string") return xato(t);
        const q = await db
          .prepare(`UPDATE tovarlar SET nomi=?, tavsif=?, turkum=?, tur=?, narx=?, eski_narx=?, yangi=?, yashirin=?, variantlar=?
                    WHERE id=? RETURNING *`)
          .bind(t.nomi, t.tavsif, t.turkum, t.tur, t.narx, t.eskiNarx, t.yangi ? 1 : 0, t.yashirin ? 1 : 0, JSON.stringify(t.variantlar), dbId)
          .first();
        await keraksizRasmlarniTozala(db, eskiRasmlar);
        return json(qatordan(q));
      }
      if (usul === "DELETE") {
        await db.prepare("DELETE FROM tovarlar WHERE id = ?").bind(dbId).run();
        await keraksizRasmlarniTozala(db, eskiRasmlar);
        return json({ ok: true });
      }
    }

    // ---- Telegram bot sozlamalari ----
    if (yol === "/api/admin/telegram" && usul === "GET") {
      if (!env.TELEGRAM_TOKEN) return json({ token: false });
      try {
        const bot = await tg(env.TELEGRAM_TOKEN, "getMe");
        return json({ token: true, bot: bot.username, chat: await sozlama(db, "tg_chat_nomi") });
      } catch (e) {
        return json({ token: true, xato: "Token noto'g'ri: " + (e as Error).message });
      }
    }
    if (yol === "/api/admin/telegram/kod" && usul === "POST") {
      if (!env.TELEGRAM_TOKEN) return xato("TELEGRAM_TOKEN sozlanmagan");
      const bot = await tg(env.TELEGRAM_TOKEN, "getMe");
      const kod = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
      await sozlamaYoz(db, "tg_kod", kod);
      return json({ havola: `https://t.me/${bot.username}?start=${kod}`, bot: bot.username });
    }
    if (yol === "/api/admin/telegram/tasdiq" && usul === "POST") {
      if (!env.TELEGRAM_TOKEN) return xato("TELEGRAM_TOKEN sozlanmagan");
      const kod = await sozlama(db, "tg_kod");
      if (!kod) return xato("Avval «Botni ulash» tugmasini bosing");
      const yangilanishlar: any[] = await tg(env.TELEGRAM_TOKEN, "getUpdates", { allowed_updates: ["message"] });
      const topildi = yangilanishlar.reverse().find((u) => u.message?.text === `/start ${kod}`);
      if (!topildi) return xato("Botda «Start» bosilmagan. Havolani ochib, «Start» tugmasini bosing.");
      const c = topildi.message.chat;
      const nomi = c.username ? "@" + c.username : [c.first_name, c.last_name].filter(Boolean).join(" ") || String(c.id);
      await sozlamaYoz(db, "tg_chat", String(c.id));
      await sozlamaYoz(db, "tg_chat_nomi", nomi);
      await db.prepare("DELETE FROM sozlamalar WHERE kalit = 'tg_kod'").run();
      await tg(env.TELEGRAM_TOKEN, "getUpdates", { offset: topildi.update_id + 1 });
      await tg(env.TELEGRAM_TOKEN, "sendMessage", { chat_id: c.id, text: "✅ Bot ulandi! Endi Aliyevs Store buyurtmalari va izohlari shu yerga keladi." });
      return json({ chat: nomi });
    }
    if (yol === "/api/admin/telegram/sinov" && usul === "POST") {
      try {
        await botgaYubor(env, "🔔 <b>Sinov xabari</b>\nAliyevs Store boti to'g'ri ishlayapti.");
      } catch (e) {
        return xato((e as Error).message === "bot" ? "Bot hali ulanmagan" : (e as Error).message);
      }
      return json({ ok: true });
    }

    if (yol === "/api/admin/rasm" && usul === "POST") {
      const turi = (req.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!["image/webp", "image/jpeg", "image/png"].includes(turi)) return xato("Faqat WebP, JPEG yoki PNG rasm");
      const malumot = await req.arrayBuffer();
      if (malumot.byteLength < 100) return xato("Rasm bo'sh");
      if (malumot.byteLength > MAX_RASM) return xato("Rasm juda katta (1.5 MB dan oshmasin)");
      const id = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
      await db.prepare("INSERT INTO rasmlar (id, turi, malumot) VALUES (?, ?, ?)").bind(id, turi, malumot).run();
      return json({ url: `/api/rasm/${id}` }, 201);
    }
  }

  return xato("Topilmadi", 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (env.TELEGRAM_API) tgManzil = env.TELEGRAM_API;
    if (url.pathname.startsWith("/api/")) {
      try {
        return await api(req, env, url);
      } catch (e) {
        console.error(e);
        return xato("Serverda xatolik yuz berdi", 500);
      }
    }
    return env.ASSETS.fetch(req);
  },
};
