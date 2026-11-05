// =====================================================================
// app.ts — DO'KON DASTURI
// ---------------------------------------------------------------------
// 1) Katalogni chizadi (filtr, qidiruv, saralash)
// 2) Savatcha: qo'shish, sonini o'zgartirish, o'chirish (xotirada saqlanadi)
// 3) Buyurtma: ma'lumotlarni yig'ib, Telegram'ga yuboradi
// =====================================================================

// ---------------------------------------------------------------------
// YORDAMCHI FUNKSIYALAR
// ---------------------------------------------------------------------

function $(selektor: string): HTMLElement {
  const e = document.querySelector<HTMLElement>(selektor);
  if (!e) throw new Error("Element topilmadi: " + selektor);
  return e;
}

// 149000 → "149 000 so'm"
function narxMatn(son: number): string {
  return son.toLocaleString("ru-RU").replace(/ /g, " ") + " so'm";
}

// HTML ichiga xavfsiz matn qo'yish
function xavfsiz(matn: string): string {
  return matn.replace(/[&<>"']/g, (b) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[b]!));
}

// ---------------------------------------------------------------------
// KIYIM RASMLARI (SVG) — rasm fayllarisiz, kod bilan chiziladi
// ---------------------------------------------------------------------

const SHAKLLAR: Record<KiyimShakli, string> = {
  futbolka:
    `<path d="M62 42 L86 30 Q100 46 114 30 L138 42 L170 72 L150 94 L138 82 L138 172 L62 172 L62 82 L50 94 L30 72 Z"/>`,
  hudi:
    `<path d="M66 52 L86 40 L114 40 L134 52 L166 142 L148 148 L134 102 L134 172 L66 172 L66 102 L52 148 L34 142 Z"/>
     <path class="soya" d="M80 44 Q100 6 120 44 Q100 60 80 44 Z"/>
     <path class="soya" d="M78 128 L122 128 L118 152 L82 152 Z"/>`,
  kurtka:
    `<path d="M66 50 L88 36 L112 36 L134 50 L166 146 L148 152 L134 104 L134 174 L66 174 L66 104 L52 152 L34 146 Z"/>
     <path class="soya" d="M88 36 L100 58 L112 36 L118 44 L100 70 L82 44 Z"/>
     <line x1="100" y1="64" x2="100" y2="174" class="chiziq"/>
     <rect class="soya" x="72" y="124" width="18" height="4" rx="2"/>
     <rect class="soya" x="110" y="124" width="18" height="4" rx="2"/>`,
  shim:
    `<path d="M66 28 L134 28 L142 174 L108 174 L100 78 L92 174 L58 174 Z"/>
     <rect class="soya" x="66" y="28" width="68" height="10"/>`,
  koylak:
    `<path d="M84 26 L90 26 L92 50 L108 50 L110 26 L116 26 L120 62 Q150 120 156 174 L44 174 Q50 120 80 62 Z"/>
     <path class="soya" d="M80 62 L120 62 L118 72 L82 72 Z"/>`,
  kofta:
    `<path d="M66 48 L86 38 Q100 50 114 38 L134 48 L166 140 L148 146 L134 100 L134 170 L66 170 L66 100 L52 146 L34 140 Z"/>
     <rect class="soya" x="66" y="160" width="68" height="10"/>`,
  krossovka:
    `<path d="M28 126 Q30 92 58 96 L96 80 Q112 102 142 106 Q172 110 174 132 L174 138 L28 138 Z"/>
     <rect class="taglik" x="26" y="136" width="150" height="14" rx="6"/>
     <path class="chiziq" d="M70 98 L84 112 M80 92 L94 106 M90 86 L104 100" fill="none"/>`,
  kepka:
    `<path d="M52 118 Q56 62 100 62 Q144 62 148 118 Z"/>
     <path class="soya" d="M104 112 L178 112 Q176 126 146 128 L104 124 Z"/>
     <circle class="soya" cx="100" cy="64" r="5"/>`,
};

function kiyimRasmi(m: Mahsulot): string {
  return `<svg viewBox="0 0 200 200" class="kiyim-svg" style="--rang:${m.rang}" aria-hidden="true">
    <g class="kiyim">${SHAKLLAR[m.shakl]}</g>
  </svg>`;
}

// ---------------------------------------------------------------------
// HOLAT (STATE)
// ---------------------------------------------------------------------

interface SavatQatori {
  id: number;
  olcham: string;
  soni: number;
}

const SAVAT_KALITI = "aliyevs-store-savat";

let savat: SavatQatori[] = savatniYukla();
let tanlanganTurkum: Turkum | "hammasi" = "hammasi";
let qidiruv = "";
let saralash: "standart" | "arzon" | "qimmat" = "standart";

function savatniYukla(): SavatQatori[] {
  try {
    const matn = localStorage.getItem(SAVAT_KALITI);
    return matn ? (JSON.parse(matn) as SavatQatori[]) : [];
  } catch {
    return [];
  }
}

function savatniSaqla(): void {
  try {
    localStorage.setItem(SAVAT_KALITI, JSON.stringify(savat));
  } catch {
    /* xotira yopiq bo'lsa ham sayt ishlayveradi */
  }
}

function mahsulotTop(id: number): Mahsulot | undefined {
  return mahsulotlar.find((m) => m.id === id);
}

function savatJami(): number {
  return savat.reduce((jami, q) => jami + (mahsulotTop(q.id)?.narx ?? 0) * q.soni, 0);
}

function savatSoni(): number {
  return savat.reduce((jami, q) => jami + q.soni, 0);
}

// ---------------------------------------------------------------------
// KATALOG
// ---------------------------------------------------------------------

function korinadiganMahsulotlar(): Mahsulot[] {
  const q = qidiruv.trim().toLowerCase();
  const natija = mahsulotlar.filter(
    (m) =>
      (tanlanganTurkum === "hammasi" || m.turkum === tanlanganTurkum) &&
      (q === "" || m.nomi.toLowerCase().includes(q))
  );
  if (saralash === "arzon") natija.sort((a, b) => a.narx - b.narx);
  if (saralash === "qimmat") natija.sort((a, b) => b.narx - a.narx);
  return natija;
}

function katalogniChiz(): void {
  const royxat = korinadiganMahsulotlar();
  const joy = $("#katalog");

  if (royxat.length === 0) {
    joy.innerHTML = `<p class="bosh">Hech narsa topilmadi. Boshqa so'z bilan qidirib ko'ring.</p>`;
    return;
  }

  joy.innerHTML = royxat
    .map((m) => {
      const chegirma = m.eskiNarx ? Math.round((1 - m.narx / m.eskiNarx) * 100) : 0;
      return `
      <article class="karta">
        <div class="karta-rasm">
          ${kiyimRasmi(m)}
          ${m.yangi ? `<span class="belgi">Yangi</span>` : ""}
          ${chegirma ? `<span class="belgi chegirma">−${chegirma}%</span>` : ""}
        </div>
        <div class="karta-matn">
          <span class="turkum">${TURKUM_NOMLARI[m.turkum]}</span>
          <h3>${xavfsiz(m.nomi)}</h3>
          <div class="narx">
            ${narxMatn(m.narx)}
            ${m.eskiNarx ? `<s>${narxMatn(m.eskiNarx)}</s>` : ""}
          </div>
          <div class="olchamlar" role="radiogroup" aria-label="O'lcham">
            ${m.olchamlar
              .map(
                (o, i) =>
                  `<label><input type="radio" name="o-${m.id}" value="${o}" ${i === 0 ? "checked" : ""}><span>${o}</span></label>`
              )
              .join("")}
          </div>
          <button class="tugma qora" data-qosh="${m.id}">Savatga qo'shish</button>
        </div>
      </article>`;
    })
    .join("");
}

// ---------------------------------------------------------------------
// SAVATCHA
// ---------------------------------------------------------------------

function savatgaQosh(id: number, olcham: string): void {
  const bor = savat.find((q) => q.id === id && q.olcham === olcham);
  if (bor) bor.soni++;
  else savat.push({ id, olcham, soni: 1 });
  savatniSaqla();
  savatniChiz();
  xabar("Savatga qo'shildi ✓");
}

function savatniChiz(): void {
  const soni = savatSoni();
  const hisoblagich = $("#savat-soni");
  hisoblagich.textContent = String(soni);
  hisoblagich.hidden = soni === 0;

  const joy = $("#savat-royxat");
  if (savat.length === 0) {
    joy.innerHTML = `<p class="bosh">Savatcha bo'sh</p>`;
  } else {
    joy.innerHTML = savat
      .map((q, i) => {
        const m = mahsulotTop(q.id);
        if (!m) return "";
        return `
        <div class="savat-qator">
          <div class="savat-rasm">${kiyimRasmi(m)}</div>
          <div class="savat-info">
            <strong>${xavfsiz(m.nomi)}</strong>
            <span>O'lcham: ${q.olcham}</span>
            <span>${narxMatn(m.narx)}</span>
          </div>
          <div class="soni">
            <button data-kamay="${i}" aria-label="Kamaytirish">−</button>
            <span>${q.soni}</span>
            <button data-kopay="${i}" aria-label="Ko'paytirish">+</button>
          </div>
          <button class="olib-tashla" data-ochir="${i}" aria-label="O'chirish">✕</button>
        </div>`;
      })
      .join("");
  }
  $("#savat-jami").textContent = narxMatn(savatJami());
  ($("#btn-buyurtma") as HTMLButtonElement).disabled = savat.length === 0;
}

function savatniOch(ochiq: boolean): void {
  document.body.classList.toggle("savat-ochiq", ochiq);
}

// ---------------------------------------------------------------------
// BUYURTMA
// ---------------------------------------------------------------------

function buyurtmaMatni(ism: string, tel: string, manzil: string, izoh: string): string {
  const qatorlar = savat.map((q, i) => {
    const m = mahsulotTop(q.id)!;
    return `${i + 1}. ${m.nomi} (${q.olcham}) × ${q.soni} = ${narxMatn(m.narx * q.soni)}`;
  });
  return [
    `🛍 Yangi buyurtma — ${DOKON.nomi}`,
    ``,
    ...qatorlar,
    ``,
    `💰 Jami: ${narxMatn(savatJami())}`,
    ``,
    `👤 Ism: ${ism}`,
    `📞 Telefon: ${tel}`,
    `📍 Manzil: ${manzil}`,
    izoh ? `📝 Izoh: ${izoh}` : "",
  ]
    .filter((q, i, arr) => !(q === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
}

function buyurtmaYubor(e: SubmitEvent): void {
  e.preventDefault();
  const forma = e.target as HTMLFormElement;
  const d = new FormData(forma);
  const matn = buyurtmaMatni(
    String(d.get("ism") ?? "").trim(),
    String(d.get("tel") ?? "").trim(),
    String(d.get("manzil") ?? "").trim(),
    String(d.get("izoh") ?? "").trim()
  );

  if (DOKON.telegram) {
    window.open(`https://t.me/${DOKON.telegram}?text=${encodeURIComponent(matn)}`, "_blank");
    xabar("Telegram ochildi — xabarni yuboring");
  } else {
    // Telegram sozlanmagan — matnni ko'rsatamiz
    ($("#tayyor-matn") as HTMLTextAreaElement).value = matn;
    $("#oyna-forma").hidden = true;
    $("#oyna-natija").hidden = false;
  }
}

function oynaniOch(ochiq: boolean): void {
  const oyna = $("#buyurtma-oyna") as HTMLDialogElement;
  if (ochiq) {
    $("#oyna-forma").hidden = false;
    $("#oyna-natija").hidden = true;
    $("#oyna-jami").textContent = narxMatn(savatJami());
    savatniOch(false);
    oyna.showModal();
  } else {
    oyna.close();
  }
}

// ---------------------------------------------------------------------
// KICHIK XABAR (toast)
// ---------------------------------------------------------------------

let xabarTaymer = 0;
function xabar(matn: string): void {
  const t = $("#xabar");
  t.textContent = matn;
  t.classList.add("korin");
  window.clearTimeout(xabarTaymer);
  xabarTaymer = window.setTimeout(() => t.classList.remove("korin"), 1800);
}

// ---------------------------------------------------------------------
// HODISALAR (EVENTS)
// ---------------------------------------------------------------------

function hodisalarniUla(): void {
  // Turkum tugmalari
  document.querySelectorAll<HTMLButtonElement>("[data-turkum]").forEach((b) =>
    b.addEventListener("click", () => {
      tanlanganTurkum = b.dataset.turkum as Turkum | "hammasi";
      document.querySelectorAll("[data-turkum]").forEach((x) => x.classList.toggle("faol", x === b));
      katalogniChiz();
    })
  );

  $("#qidiruv").addEventListener("input", (e) => {
    qidiruv = (e.target as HTMLInputElement).value;
    katalogniChiz();
  });

  $("#saralash").addEventListener("change", (e) => {
    saralash = (e.target as HTMLSelectElement).value as typeof saralash;
    katalogniChiz();
  });

  // "Savatga qo'shish" — katalog ichidagi tugmalar
  $("#katalog").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-qosh]");
    if (!b) return;
    const id = Number(b.dataset.qosh);
    const tanlangan = document.querySelector<HTMLInputElement>(`input[name="o-${id}"]:checked`);
    savatgaQosh(id, tanlangan?.value ?? "");
  });

  // Savatcha ichidagi +, −, ✕
  $("#savat-royxat").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    if (b.dataset.kopay) savat[Number(b.dataset.kopay)].soni++;
    if (b.dataset.kamay) {
      const q = savat[Number(b.dataset.kamay)];
      q.soni--;
      if (q.soni <= 0) savat.splice(Number(b.dataset.kamay), 1);
    }
    if (b.dataset.ochir) savat.splice(Number(b.dataset.ochir), 1);
    savatniSaqla();
    savatniChiz();
  });

  $("#btn-savat").addEventListener("click", () => savatniOch(true));
  $("#btn-savat-yop").addEventListener("click", () => savatniOch(false));
  $("#parda").addEventListener("click", () => savatniOch(false));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") savatniOch(false);
  });

  $("#btn-buyurtma").addEventListener("click", () => oynaniOch(true));
  $("#btn-oyna-yop").addEventListener("click", () => oynaniOch(false));
  $("#buyurtma-forma").addEventListener("submit", (e) => buyurtmaYubor(e as SubmitEvent));

  $("#btn-nusxa").addEventListener("click", async () => {
    const matn = ($("#tayyor-matn") as HTMLTextAreaElement).value;
    try {
      await navigator.clipboard.writeText(matn);
      xabar("Nusxalandi ✓");
    } catch {
      ($("#tayyor-matn") as HTMLTextAreaElement).select();
      xabar("Matnni belgilab, nusxalang");
    }
  });
}

// ---------------------------------------------------------------------
// ISHGA TUSHIRISH
// ---------------------------------------------------------------------

function boshlash(): void {
  document.querySelectorAll("[data-dokon-nomi]").forEach((e) => (e.textContent = DOKON.nomi));
  $("#shahar").textContent = DOKON.shahar;
  $("#ish-vaqti").textContent = DOKON.ishVaqti;
  $("#yil").textContent = String(new Date().getFullYear());
  const tg = $("#tg-havola") as HTMLAnchorElement;
  if (DOKON.telegram) {
    tg.href = `https://t.me/${DOKON.telegram}`;
    tg.textContent = "@" + DOKON.telegram;
  } else {
    tg.textContent = "Tez orada";
    tg.removeAttribute("href");
  }

  katalogniChiz();
  savatniChiz();
  hodisalarniUla();
}

boshlash();
