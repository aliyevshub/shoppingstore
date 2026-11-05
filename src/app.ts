// =====================================================================
// app.ts — DO'KON DASTURI
// ---------------------------------------------------------------------
// 1) Katalog: turkumlar, qidiruv, saralash, sevimlilar
// 2) Tovar kartasi: rasmlar galereyasi (surish), rang tanlash
// 3) Tovar oynasi: katta galereya, rang, o'lcham, soni
// 4) Savatcha va Telegram orqali buyurtma
// =====================================================================

// ---------------------------------------------------------------------
// YORDAMCHI FUNKSIYALAR
// ---------------------------------------------------------------------

function $<T extends HTMLElement = HTMLElement>(selektor: string, ota: ParentNode = document): T {
  const e = ota.querySelector<T>(selektor);
  if (!e) throw new Error("Element topilmadi: " + selektor);
  return e;
}

function narxMatn(son: number): string {
  return son.toLocaleString("ru-RU").replace(/ /g, " ") + " so'm";
}

function xavfsiz(matn: string): string {
  return matn.replace(/[&<>"']/g, (b) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[b]!));
}

function xotiradanOl<T>(kalit: string, standart: T): T {
  try {
    const m = localStorage.getItem(kalit);
    return m ? (JSON.parse(m) as T) : standart;
  } catch {
    return standart;
  }
}

function xotiragaYoz(kalit: string, qiymat: unknown): void {
  try {
    localStorage.setItem(kalit, JSON.stringify(qiymat));
  } catch {
    /* xotira yopiq bo'lsa ham sayt ishlayveradi */
  }
}

const IKON = {
  yurak: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>`,
  chap: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m14.5 6-6 6 6 6"/></svg>`,
  ong: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m9.5 6 6 6-6 6"/></svg>`,
};

// ---------------------------------------------------------------------
// HOLAT (STATE)
// ---------------------------------------------------------------------

interface SavatQatori {
  id: number;
  variant: number;
  olcham: string;
  soni: number;
}

type Filtr = "hammasi" | Turkum | "sevimli";

let savat: SavatQatori[] = xotiradanOl<SavatQatori[]>("as-savat-v2", []);
let sevimlilar = new Set<number>(xotiradanOl<number[]>("as-sevimli", []));
let filtr: Filtr = "hammasi";
let qidiruv = "";
let saralash: "standart" | "arzon" | "qimmat" | "yangi" = "standart";
const kartaVariant = new Map<number, number>(); // kartada tanlangan rang

function mahsulotTop(id: number): Mahsulot | undefined {
  return mahsulotlar.find((m) => m.id === id);
}

function savatniSaqla(): void {
  xotiragaYoz("as-savat-v2", savat);
}

function sevimlilarniSaqla(): void {
  xotiragaYoz("as-sevimli", [...sevimlilar]);
}

function savatJami(): number {
  return savat.reduce((j, q) => j + (mahsulotTop(q.id)?.narx ?? 0) * q.soni, 0);
}

function savatSoni(): number {
  return savat.reduce((j, q) => j + q.soni, 0);
}

// ---------------------------------------------------------------------
// GALEREYA (karta va oyna uchun umumiy)
// ---------------------------------------------------------------------

function galereyaHTML(rasmlar: string[], nomi: string, katta = false): string {
  const rasmlarHTML = rasmlar
    .map(
      (r, i) =>
        `<img src="${r}" alt="${xavfsiz(nomi)} — ${i + 1}-rasm" ${i === 0 && katta ? "" : 'loading="lazy"'} decoding="async" draggable="false">`
    )
    .join("");
  const kop = rasmlar.length > 1;
  return `
    <div class="galereya" data-galereya tabindex="0" aria-label="${xavfsiz(nomi)} rasmlari">${rasmlarHTML}</div>
    ${
      kop
        ? `<button class="gal-strelka chap glow" data-gal-chap aria-label="Oldingi rasm">${IKON.chap}</button>
           <button class="gal-strelka ong glow" data-gal-ong aria-label="Keyingi rasm">${IKON.ong}</button>
           <div class="nuqtalar" aria-hidden="true">${rasmlar.map((_, i) => `<span${i === 0 ? ' class="faol"' : ""}></span>`).join("")}</div>`
        : ""
    }`;
}

function galereyaIndeksi(gal: HTMLElement): number {
  return Math.round(gal.scrollLeft / Math.max(1, gal.clientWidth));
}

function galereyagaOt(gal: HTMLElement, i: number): void {
  const soni = gal.children.length;
  const yangi = (i + soni) % soni;
  gal.scrollTo({ left: yangi * gal.clientWidth, behavior: "smooth" });
}

function nuqtalarniYangila(gal: HTMLElement): void {
  const ota = gal.parentElement;
  if (!ota) return;
  const i = galereyaIndeksi(gal);
  ota.querySelectorAll(".nuqtalar span").forEach((s, k) => s.classList.toggle("faol", k === i));
  ota.querySelectorAll<HTMLElement>("[data-thumb]").forEach((t, k) => t.classList.toggle("faol", k === i));
}

// Galereya hodisalari — hujjat darajasida bir marta ulanadi
function galereyaHodisalari(): void {
  document.addEventListener(
    "scroll",
    (e) => {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLElement && t.matches("[data-galereya]")) nuqtalarniYangila(t);
    },
    true
  );
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-gal-chap],[data-gal-ong]");
    if (!b) return;
    e.stopPropagation();
    const gal = b.parentElement?.querySelector<HTMLElement>("[data-galereya]");
    if (!gal) return;
    galereyagaOt(gal, galereyaIndeksi(gal) + (b.hasAttribute("data-gal-ong") ? 1 : -1));
  });
  document.addEventListener("keydown", (e) => {
    const gal = e.target as HTMLElement;
    if (!(gal instanceof HTMLElement) || !gal.matches("[data-galereya]")) return;
    if (e.key === "ArrowRight") galereyagaOt(gal, galereyaIndeksi(gal) + 1);
    if (e.key === "ArrowLeft") galereyagaOt(gal, galereyaIndeksi(gal) - 1);
  });
}

// ---------------------------------------------------------------------
// KATALOG
// ---------------------------------------------------------------------

function korinadiganlar(): Mahsulot[] {
  const q = qidiruv.trim().toLowerCase();
  const natija = mahsulotlar.filter((m) => {
    if (filtr === "sevimli" && !sevimlilar.has(m.id)) return false;
    if ((filtr === "sport" || filtr === "casual") && m.turkum !== filtr) return false;
    if (q && !(m.nomi + " " + m.tavsif + " " + m.variantlar.map((x) => x.rang).join(" ")).toLowerCase().includes(q)) return false;
    return true;
  });
  if (saralash === "arzon") natija.sort((a, b) => a.narx - b.narx);
  if (saralash === "qimmat") natija.sort((a, b) => b.narx - a.narx);
  if (saralash === "yangi") natija.sort((a, b) => Number(!!b.yangi) - Number(!!a.yangi));
  return natija;
}

function belgilarHTML(m: Mahsulot): string {
  const chegirma = m.eskiNarx ? Math.round((1 - m.narx / m.eskiNarx) * 100) : 0;
  return `<div class="belgilar">
      ${m.yangi ? `<span class="belgi">Yangi</span>` : ""}
      ${chegirma ? `<span class="belgi chegirma">−${chegirma}%</span>` : ""}
    </div>`;
}

function narxHTML(m: Mahsulot): string {
  return `<div class="narx"><span>${narxMatn(m.narx)}</span>${m.eskiNarx ? `<s>${narxMatn(m.eskiNarx)}</s>` : ""}</div>`;
}

function rangDoiralari(m: Mahsulot, tanlangan: number, atribut: string): string {
  if (m.variantlar.length < 2) return `<div class="ranglar"><span class="rang-nomi">${xavfsiz(m.variantlar[0].rang)}</span></div>`;
  return `<div class="ranglar" role="radiogroup" aria-label="Rang">
    ${m.variantlar
      .map(
        (vr, i) =>
          `<button class="rang${i === tanlangan ? " faol" : ""}" ${atribut}="${i}" role="radio" aria-checked="${i === tanlangan}" aria-label="${xavfsiz(vr.rang)}" title="${xavfsiz(vr.rang)}" style="--r:${vr.hex}"></button>`
      )
      .join("")}
  </div>`;
}

function kartaHTML(m: Mahsulot): string {
  const vi = kartaVariant.get(m.id) ?? 0;
  const vr = m.variantlar[vi];
  const sevimli = sevimlilar.has(m.id);
  return `
  <article class="karta" data-id="${m.id}">
    <div class="karta-media" data-ochish>
      ${galereyaHTML(vr.rasmlar, m.nomi)}
      ${belgilarHTML(m)}
      <button class="sevimli-tugma glow${sevimli ? " faol" : ""}" data-sevimli="${m.id}" aria-pressed="${sevimli}" aria-label="Sevimlilarga qo'shish">${IKON.yurak}</button>
    </div>
    <div class="karta-info">
      <span class="karta-turkum">${TURKUM_NOMLARI[m.turkum]} · ${m.tur === "poyabzal" ? "Poyabzal" : "Kiyim"}</span>
      <h3 data-ochish>${xavfsiz(m.nomi)}</h3>
      ${narxHTML(m)}
      ${rangDoiralari(m, vi, "data-karta-rang")}
      <button class="tugma glow karta-tugma" data-ochish>Tanlash</button>
    </div>
  </article>`;
}

function katalogniChiz(): void {
  const royxat = korinadiganlar();
  const joy = $("#katalog");
  $("#natija-soni").textContent = `${royxat.length} ta tovar`;
  if (royxat.length === 0) {
    joy.innerHTML =
      filtr === "sevimli"
        ? `<div class="bosh"><strong>Sevimlilar hali bo'sh</strong><span>Tovar rasmidagi ♡ belgisini bosing, u shu yerda saqlanadi.</span></div>`
        : `<div class="bosh"><strong>Hech narsa topilmadi</strong><span>Qidiruv so'zini o'zgartirib ko'ring yoki turkumni almashtiring.</span></div>`;
    return;
  }
  joy.innerHTML = royxat.map(kartaHTML).join("");
}

function sanoqlarniYangila(): void {
  const s = (f: Filtr) =>
    f === "hammasi" ? mahsulotlar.length : f === "sevimli" ? sevimlilar.size : mahsulotlar.filter((m) => m.turkum === f).length;
  document.querySelectorAll<HTMLElement>("[data-sanoq]").forEach((e) => (e.textContent = String(s(e.dataset.sanoq as Filtr))));
  const hs = $("#sevimli-soni");
  hs.textContent = String(sevimlilar.size);
  hs.hidden = sevimlilar.size === 0;
}

function filtrniTanla(f: Filtr): void {
  filtr = f;
  document.querySelectorAll<HTMLElement>("[data-filtr]").forEach((b) => {
    const faol = b.dataset.filtr === f;
    b.classList.toggle("faol", faol);
    b.setAttribute("aria-selected", String(faol));
  });
  katalogniChiz();
}

function katalogga(): void {
  $("#katalog-bolim").scrollIntoView({ behavior: "smooth", block: "start" });
}

function sevimliAlmashtir(id: number): void {
  if (sevimlilar.has(id)) {
    sevimlilar.delete(id);
    xabar("Sevimlilardan olib tashlandi");
  } else {
    sevimlilar.add(id);
    xabar("Sevimlilarga qo'shildi ♥");
  }
  sevimlilarniSaqla();
  sanoqlarniYangila();
  document.querySelectorAll<HTMLElement>(`[data-sevimli="${id}"]`).forEach((b) => {
    b.classList.toggle("faol", sevimlilar.has(id));
    b.setAttribute("aria-pressed", String(sevimlilar.has(id)));
  });
  if (filtr === "sevimli") katalogniChiz();
}

// ---------------------------------------------------------------------
// TOVAR OYNASI
// ---------------------------------------------------------------------

let oynaTovar: Mahsulot | null = null;
let oynaVariant = 0;
let oynaOlcham = "";
let oynaSoni = 1;

function tovarOynasiniOch(id: number): void {
  const m = mahsulotTop(id);
  if (!m) return;
  oynaTovar = m;
  oynaVariant = kartaVariant.get(id) ?? 0;
  oynaOlcham = "";
  oynaSoni = 1;
  oynaBaho = 0;
  tovarOynasiniChiz();
  const d = $<HTMLDialogElement>("#tovar-oyna");
  if (!d.open) d.showModal();
  $("[data-galereya]", d).focus({ preventScroll: true });
}

function tovarOynasiniChiz(): void {
  const m = oynaTovar;
  if (!m) return;
  const vr = m.variantlar[oynaVariant];
  const sevimli = sevimlilar.has(m.id);
  $("#tovar-oyna-ichi").innerHTML = `
    <div class="t-media">
      <div class="t-galereya">
        ${galereyaHTML(vr.rasmlar, m.nomi, true)}
        ${belgilarHTML(m)}
      </div>
      ${
        vr.rasmlar.length > 1
          ? `<div class="t-thumbs">${vr.rasmlar
              .map((r, i) => `<button class="thumb glow${i === 0 ? " faol" : ""}" data-thumb="${i}" aria-label="${i + 1}-rasm"><img src="${r}" alt="" loading="lazy"></button>`)
              .join("")}</div>`
          : ""
      }
    </div>
    <div class="t-info">
      <span class="karta-turkum">${TURKUM_NOMLARI[m.turkum]} · ${m.tur === "poyabzal" ? "Poyabzal" : "Kiyim"}</span>
      <h2 id="tovar-sarlavha">${xavfsiz(m.nomi)}</h2>
      ${narxHTML(m)}
      <p class="t-tavsif">${xavfsiz(m.tavsif)}</p>

      <div class="t-qator">
        <span class="t-yorliq">Rang: <b>${xavfsiz(vr.rang)}</b></span>
        ${m.variantlar.length > 1 ? rangDoiralari(m, oynaVariant, "data-oyna-rang") : ""}
      </div>

      <div class="t-qator">
        <span class="t-yorliq">O'lcham${oynaOlcham ? `: <b>${oynaOlcham}</b>` : ""}</span>
        <div class="olchamlar" role="radiogroup" aria-label="O'lcham">
          ${olchamlar(m)
            .map((o) => `<button class="olcham glow${o === oynaOlcham ? " faol" : ""}" data-olcham="${o}" role="radio" aria-checked="${o === oynaOlcham}">${o}</button>`)
            .join("")}
        </div>
        <span class="t-xato" id="olcham-xato" hidden>Avval o'lchamni tanlang</span>
      </div>

      <div class="t-amallar">
        <div class="soni" aria-label="Soni">
          <button class="glow" data-oyna-soni="-1" aria-label="Kamaytirish">−</button>
          <span>${oynaSoni}</span>
          <button class="glow" data-oyna-soni="1" aria-label="Ko'paytirish">+</button>
        </div>
        <button class="tugma asosiy glow" id="btn-oyna-savat">Savatga qo'shish</button>
        <button class="sevimli-tugma katta glow${sevimli ? " faol" : ""}" data-sevimli="${m.id}" aria-pressed="${sevimli}" aria-label="Sevimlilarga qo'shish">${IKON.yurak}</button>
      </div>

      <ul class="t-afzallik">
        <li>Andijon bo'ylab yetkazib berish — 1 kun</li>
        <li>14 kun ichida almashtirish</li>
        <li>To'lov qabul qilinganda: naqd yoki karta</li>
      </ul>
    </div>
    ${otzivlarHTML(m)}`;
}

// ---------------------------------------------------------------------
// OTZIVLAR
// ---------------------------------------------------------------------

let oynaBaho = 0;

function yulduzlar(baho: number): string {
  return `<span class="yulduzlar" aria-label="${baho} / 5">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= baho ? "tola" : ""}">★</i>`).join("")}</span>`;
}

function otzivlarHTML(m: Mahsulot): string {
  const r = m.otzivlar ?? [];
  const ortacha = r.length ? r.reduce((j, o) => j + o.baho, 0) / r.length : 0;
  const royxat = r.length
    ? r
        .map(
          (o) => `
        <article class="otziv">
          <div class="otziv-bosh">
            <span class="otziv-avatar">${xavfsiz(o.ism.charAt(0).toUpperCase())}</span>
            <div><strong>${xavfsiz(o.ism)}</strong><time>${xavfsiz(o.sana)}</time></div>
            ${yulduzlar(o.baho)}
          </div>
          <p>${xavfsiz(o.matn)}</p>
        </article>`
        )
        .join("")
    : `<div class="otziv-bosh-holat">
        <span class="otziv-belgi" aria-hidden="true">✦</span>
        <strong>Hali otziv yo'q</strong>
        <span>Bu tovarni sotib olgan bo'lsangiz, birinchi bo'lib fikringizni qoldiring.</span>
      </div>`;
  return `
  <section class="t-otzivlar" aria-labelledby="otziv-sarlavha">
    <div class="otziv-ustki">
      <h3 id="otziv-sarlavha">Otzivlar <span>${r.length}</span></h3>
      ${r.length ? `<div class="otziv-ortacha">${yulduzlar(Math.round(ortacha))}<b>${ortacha.toFixed(1)}</b></div>` : ""}
    </div>
    <div class="otziv-ichi">
      <div class="otziv-royxat">${royxat}</div>
      <form class="otziv-forma" id="otziv-forma" novalidate>
        <h4>Fikringizni qoldiring</h4>
        <div class="baho-tanlash" role="radiogroup" aria-label="Baho">
          ${[1, 2, 3, 4, 5]
            .map(
              (i) =>
                `<button type="button" class="baho${i <= oynaBaho ? " faol" : ""}" data-baho="${i}" role="radio" aria-checked="${i === oynaBaho}" aria-label="${i} yulduz">★</button>`
            )
            .join("")}
          <span class="baho-matn">${oynaBaho ? ["", "Yomon", "O'rtacha emas", "Yaxshi", "Juda yaxshi", "A'lo!"][oynaBaho] : "Baho bering"}</span>
        </div>
        <label>Ismingiz<input id="o-ism" name="ism" autocomplete="given-name" required placeholder="Masalan: Jasur"></label>
        <label>Fikringiz<textarea id="o-matn" name="matn" rows="3" required placeholder="O'lchami, sifati, yetkazib berish haqida…"></textarea></label>
        <span class="t-xato" id="otziv-xato" hidden>Baho, ism va fikrni to'ldiring</span>
        <button class="tugma asosiy glow toliq" type="submit">Telegram orqali yuborish</button>
        <small class="otziv-izoh">Otzivlar tekshirilgandan keyin saytda chiqadi.</small>
      </form>
    </div>
  </section>`;
}

function otzivYubor(m: Mahsulot): void {
  const ism = $<HTMLInputElement>("#o-ism").value.trim();
  const matn = $<HTMLTextAreaElement>("#o-matn").value.trim();
  if (!oynaBaho || !ism || !matn) {
    $("#otziv-xato").hidden = false;
    return;
  }
  const xabarMatni = [
    `⭐ Yangi otziv — ${DOKON.nomi}`,
    "",
    `Tovar: ${m.nomi} (#${m.id})`,
    `Baho: ${"★".repeat(oynaBaho)}${"☆".repeat(5 - oynaBaho)} (${oynaBaho}/5)`,
    `Ism: ${ism}`,
    "",
    matn,
  ].join("\n");
  window.open(`https://t.me/${DOKON.telegram}?text=${encodeURIComponent(xabarMatni)}`, "_blank", "noopener");
  oynaBaho = 0;
  xabar("Rahmat! Telegram ochildi — xabarni yuboring");
  tovarOynasiniChiz();
}

function oynadanSavatga(): void {
  const m = oynaTovar;
  if (!m) return;
  if (!oynaOlcham) {
    $("#olcham-xato").hidden = false;
    $(".olchamlar", $("#tovar-oyna")).classList.add("silkinish");
    window.setTimeout(() => document.querySelector(".olchamlar.silkinish")?.classList.remove("silkinish"), 500);
    return;
  }
  const bor = savat.find((q) => q.id === m.id && q.variant === oynaVariant && q.olcham === oynaOlcham);
  if (bor) bor.soni += oynaSoni;
  else savat.push({ id: m.id, variant: oynaVariant, olcham: oynaOlcham, soni: oynaSoni });
  savatniSaqla();
  savatniChiz();
  $<HTMLDialogElement>("#tovar-oyna").close();
  xabar("Savatga qo'shildi ✓");
  const s = $("#btn-savat");
  s.classList.remove("urildi");
  void s.offsetWidth;
  s.classList.add("urildi");
}

// ---------------------------------------------------------------------
// SAVATCHA
// ---------------------------------------------------------------------

function savatniChiz(): void {
  const soni = savatSoni();
  const h = $("#savat-soni");
  h.textContent = String(soni);
  h.hidden = soni === 0;

  const joy = $("#savat-royxat");
  if (savat.length === 0) {
    joy.innerHTML = `<div class="bosh"><strong>Savatcha bo'sh</strong><span>Katalogdan yoqqan tovarni tanlang.</span></div>`;
  } else {
    joy.innerHTML = savat
      .map((q, i) => {
        const m = mahsulotTop(q.id);
        if (!m) return "";
        const vr = m.variantlar[q.variant] ?? m.variantlar[0];
        return `
        <div class="savat-qator">
          <img src="${vr.rasmlar[0]}" alt="" loading="lazy">
          <div class="savat-info">
            <strong>${xavfsiz(m.nomi)}</strong>
            <span>${xavfsiz(vr.rang)} · ${q.olcham}</span>
            <span class="savat-narx">${narxMatn(m.narx * q.soni)}</span>
          </div>
          <div class="soni kichik">
            <button class="glow" data-kamay="${i}" aria-label="Kamaytirish">−</button>
            <span>${q.soni}</span>
            <button class="glow" data-kopay="${i}" aria-label="Ko'paytirish">+</button>
          </div>
          <button class="olib-tashla" data-ochir="${i}" aria-label="O'chirish">✕</button>
        </div>`;
      })
      .join("");
  }
  $("#savat-jami").textContent = narxMatn(savatJami());
  $<HTMLButtonElement>("#btn-buyurtma").disabled = savat.length === 0;
}

function savatniOch(ochiq: boolean): void {
  document.body.classList.toggle("savat-ochiq", ochiq);
  $(".savat").setAttribute("aria-hidden", String(!ochiq));
  if (ochiq) $<HTMLButtonElement>("#btn-savat-yop").focus();
}

// ---------------------------------------------------------------------
// BUYURTMA
// ---------------------------------------------------------------------

function buyurtmaMatni(ism: string, tel: string, manzil: string, izoh: string): string {
  const q = savat.map((s, i) => {
    const m = mahsulotTop(s.id)!;
    const vr = m.variantlar[s.variant] ?? m.variantlar[0];
    return `${i + 1}. ${m.nomi} — ${vr.rang}, ${s.olcham} × ${s.soni} = ${narxMatn(m.narx * s.soni)}`;
  });
  return [
    `🛍 Yangi buyurtma — ${DOKON.nomi}`,
    "",
    ...q,
    "",
    `💰 Jami: ${narxMatn(savatJami())}`,
    "",
    `👤 Ism: ${ism}`,
    `📞 Telefon: ${tel}`,
    `📍 Manzil: ${manzil}`,
    ...(izoh ? [`📝 Izoh: ${izoh}`] : []),
  ].join("\n");
}

function buyurtmaYubor(e: SubmitEvent): void {
  e.preventDefault();
  const d = new FormData(e.target as HTMLFormElement);
  const ol = (k: string) => String(d.get(k) ?? "").trim();
  const matn = buyurtmaMatni(ol("ism"), ol("tel"), ol("manzil"), ol("izoh"));
  if (DOKON.telegram) {
    window.open(`https://t.me/${DOKON.telegram}?text=${encodeURIComponent(matn)}`, "_blank", "noopener");
    xabar("Telegram ochildi — xabarni yuboring");
  } else {
    $<HTMLTextAreaElement>("#tayyor-matn").value = matn;
    $("#oyna-forma").hidden = true;
    $("#oyna-natija").hidden = false;
  }
}

function buyurtmaOynasi(ochiq: boolean): void {
  const d = $<HTMLDialogElement>("#buyurtma-oyna");
  if (!ochiq) return d.close();
  $("#oyna-forma").hidden = false;
  $("#oyna-natija").hidden = true;
  $("#oyna-jami").textContent = narxMatn(savatJami());
  savatniOch(false);
  d.showModal();
}

// ---------------------------------------------------------------------
// XABAR (toast)
// ---------------------------------------------------------------------

let xabarTaymer = 0;
function xabar(matn: string): void {
  const t = $("#xabar");
  t.textContent = matn;
  t.classList.add("korin");
  window.clearTimeout(xabarTaymer);
  xabarTaymer = window.setTimeout(() => t.classList.remove("korin"), 1900);
}

// ---------------------------------------------------------------------
// HODISALAR
// ---------------------------------------------------------------------

function hodisalar(): void {
  galereyaHodisalari();

  // Filtr tugmalari (katalog tablari va turkum plitkalari)
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-filtr]");
    if (!b) return;
    filtrniTanla(b.dataset.filtr as Filtr);
    if (b.hasAttribute("data-katalogga")) katalogga();
  });

  $<HTMLInputElement>("#qidiruv").addEventListener("input", (e) => {
    qidiruv = (e.target as HTMLInputElement).value;
    katalogniChiz();
  });
  $<HTMLSelectElement>("#saralash").addEventListener("change", (e) => {
    saralash = (e.target as HTMLSelectElement).value as typeof saralash;
    katalogniChiz();
  });

  // Katalog ichidagi bosishlar
  $("#katalog").addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const karta = t.closest<HTMLElement>(".karta");
    if (!karta) return;
    const id = Number(karta.dataset.id);

    const sev = t.closest<HTMLElement>("[data-sevimli]");
    if (sev) return sevimliAlmashtir(id);

    const rang = t.closest<HTMLElement>("[data-karta-rang]");
    if (rang) {
      kartaVariant.set(id, Number(rang.dataset.kartaRang));
      const m = mahsulotTop(id)!;
      const yangi = document.createElement("div");
      yangi.innerHTML = kartaHTML(m);
      karta.replaceWith(yangi.firstElementChild!);
      return;
    }
    if (t.closest("[data-ochish]")) tovarOynasiniOch(id);
  });

  // Klaviatura: karta ustida Enter
  $("#katalog").addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if (e.key === "Enter" && t.matches("[data-galereya]")) {
      const id = Number(t.closest<HTMLElement>(".karta")?.dataset.id);
      if (id) tovarOynasiniOch(id);
    }
  });

  // Bosh sahifadagi tovar havolalari
  document.querySelectorAll<HTMLElement>("[data-tovar]").forEach((el) =>
    el.addEventListener("click", () => tovarOynasiniOch(Number(el.dataset.tovar)))
  );

  // Tovar oynasi
  const tOyna = $<HTMLDialogElement>("#tovar-oyna");
  tOyna.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t === tOyna) return tOyna.close();
    if (t.closest("#btn-tovar-yop")) return tOyna.close();
    const rang = t.closest<HTMLElement>("[data-oyna-rang]");
    if (rang && oynaTovar) {
      oynaVariant = Number(rang.dataset.oynaRang);
      kartaVariant.set(oynaTovar.id, oynaVariant);
      return tovarOynasiniChiz();
    }
    const ol = t.closest<HTMLElement>("[data-olcham]");
    if (ol) {
      oynaOlcham = ol.dataset.olcham ?? "";
      return tovarOynasiniChiz();
    }
    const sn = t.closest<HTMLElement>("[data-oyna-soni]");
    if (sn) {
      oynaSoni = Math.max(1, Math.min(20, oynaSoni + Number(sn.dataset.oynaSoni)));
      return tovarOynasiniChiz();
    }
    const th = t.closest<HTMLElement>("[data-thumb]");
    if (th) {
      const gal = $("[data-galereya]", tOyna);
      return galereyagaOt(gal, Number(th.dataset.thumb));
    }
    if (t.closest("[data-sevimli]") && oynaTovar) return sevimliAlmashtir(oynaTovar.id);
    if (t.closest("#btn-oyna-savat")) return oynadanSavatga();
    const bh = t.closest<HTMLElement>("[data-baho]");
    if (bh) {
      oynaBaho = Number(bh.dataset.baho);
      const ism = $<HTMLInputElement>("#o-ism").value;
      const matn = $<HTMLTextAreaElement>("#o-matn").value;
      tovarOynasiniChiz();
      $<HTMLInputElement>("#o-ism").value = ism;
      $<HTMLTextAreaElement>("#o-matn").value = matn;
      $<HTMLElement>(`[data-baho="${oynaBaho}"]`).focus();
    }
  });
  tOyna.addEventListener("submit", (e) => {
    if ((e.target as HTMLElement).id !== "otziv-forma" || !oynaTovar) return;
    e.preventDefault();
    otzivYubor(oynaTovar);
  });
  tOyna.addEventListener("close", () => katalogniChiz());

  // Savatcha
  $("#savat-royxat").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    if (b.dataset.kopay) savat[Number(b.dataset.kopay)].soni++;
    if (b.dataset.kamay) {
      const i = Number(b.dataset.kamay);
      if (--savat[i].soni <= 0) savat.splice(i, 1);
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

  // Header tugmalari
  $("#btn-qidiruv").addEventListener("click", () => {
    katalogga();
    window.setTimeout(() => $<HTMLInputElement>("#qidiruv").focus({ preventScroll: true }), 450);
  });
  $("#btn-sevimli").addEventListener("click", () => {
    filtrniTanla("sevimli");
    katalogga();
  });

  // Buyurtma
  $("#btn-buyurtma").addEventListener("click", () => buyurtmaOynasi(true));
  $("#btn-oyna-yop").addEventListener("click", () => buyurtmaOynasi(false));
  $("#buyurtma-forma").addEventListener("submit", (e) => buyurtmaYubor(e as SubmitEvent));
  $("#btn-nusxa").addEventListener("click", async () => {
    const ta = $<HTMLTextAreaElement>("#tayyor-matn");
    try {
      await navigator.clipboard.writeText(ta.value);
      xabar("Nusxalandi ✓");
    } catch {
      ta.select();
      xabar("Matnni belgilab, nusxalang");
    }
  });

  // Header soyasi (skroll qilinganda)
  const header = $(".menyu");
  const soya = () => header.classList.toggle("suzuvchi", window.scrollY > 8);
  window.addEventListener("scroll", soya, { passive: true });
  soya();
}

// ---------------------------------------------------------------------
// ISHGA TUSHIRISH
// ---------------------------------------------------------------------

function boshlash(): void {
  document.querySelectorAll("[data-dokon-nomi]").forEach((e) => (e.textContent = DOKON.nomi));
  $("#shahar").textContent = DOKON.shahar;
  $("#ish-vaqti").textContent = DOKON.ishVaqti;
  $("#yil").textContent = String(new Date().getFullYear());
  const tg = $<HTMLAnchorElement>("#tg-havola");
  if (DOKON.telegram) {
    tg.href = `https://t.me/${DOKON.telegram}`;
    tg.textContent = "@" + DOKON.telegram;
  } else {
    tg.textContent = "tez orada";
    tg.removeAttribute("href");
  }
  savat = savat.filter((q) => mahsulotTop(q.id));
  sanoqlarniYangila();
  katalogniChiz();
  savatniChiz();
  hodisalar();
}

boshlash();
