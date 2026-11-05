// =====================================================================
// worker/index.ts — SERVER (Cloudflare Worker)
// ---------------------------------------------------------------------
// Sayt fayllari (HTML, CSS, rasmlar) Cloudflare tomonidan to'g'ridan-to'g'ri
// beriladi. Bu kod faqat /api/... so'rovlariga javob beradi:
//
//   Hamma uchun:
//     GET    /api/tovarlar              — saytda ko'rinadigan yangi tovarlar
//     GET    /api/rasm/:id              — yuklangan rasm
//   Faqat admin (parol bilan):
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
  ADMIN_PAROL?: string;  // Cloudflare'da "Secret" sifatida saqlanadi
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

  // ---- Admin: parol tekshiruvi ----
  if (yol.startsWith("/api/admin/")) {
    if (!env.ADMIN_PAROL) return xato("Admin paroli hali sozlanmagan (Cloudflare → Settings → Variables and Secrets → ADMIN_PAROL)", 503);
    if (!env.DB) return xato("Ma'lumotlar bazasi ulanmagan (D1)", 503);
    const sarlavha = req.headers.get("authorization") ?? "";
    const berilgan = sarlavha.startsWith("Bearer ") ? sarlavha.slice(7) : "";
    if (!berilgan || !(await parolTogri(berilgan, env.ADMIN_PAROL))) {
      await new Promise((r) => setTimeout(r, 600)); // taxmin qilishni sekinlashtirish
      return xato("Parol noto'g'ri", 401);
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
