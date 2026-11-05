// =====================================================================
// admin.ts — ADMIN PANEL
// ---------------------------------------------------------------------
// 1) Parol bilan kirish (parol faqat shu brauzer oynasida eslab qolinadi)
// 2) Tovarlar ro'yxati: tahrirlash, yashirish, o'chirish
// 3) Tovar formasi: ranglar va rasmlar (rasmlar yuklashdan oldin
//    brauzerda kichraytiriladi va WebP formatiga o'tkaziladi)
// Barcha ma'lumotlar /api/admin/... orqali serverga yuboriladi.
// =====================================================================

(() => {
  type AdminTovar = Mahsulot & { yashirin: boolean };
  interface FormaVariant { rang: string; hex: string; rasmlar: string[] }

  const PAROL_KALITI = "as-admin-parol";
  let parol = "";
  let tovarlar: AdminTovar[] = [];
  let tahrirId: number | null = null;
  let variantlar: FormaVariant[] = [];
  let yuklanayotgan = 0;

  // ------------------------------------------------------------------
  // YORDAMCHILAR
  // ------------------------------------------------------------------
  const $ = <T extends HTMLElement = HTMLElement>(s: string): T => {
    const e = document.querySelector<T>(s);
    if (!e) throw new Error("Element topilmadi: " + s);
    return e;
  };
  const xavfsiz = (m: string) =>
    m.replace(/[&<>"']/g, (b) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[b]!));
  const narxMatn = (n: number) => n.toLocaleString("ru-RU").replace(/ /g, " ") + " so'm";

  let xabarTaymer = 0;
  function xabar(matn: string): void {
    const t = $("#xabar");
    t.textContent = matn;
    t.classList.add("korin");
    clearTimeout(xabarTaymer);
    xabarTaymer = window.setTimeout(() => t.classList.remove("korin"), 2200);
  }

  async function so_rov<T>(yol: string, sozlama: RequestInit = {}): Promise<T> {
    const javob = await fetch(yol, {
      ...sozlama,
      headers: { authorization: "Bearer " + parol, ...(sozlama.headers || {}) },
    });
    const malumot = await javob.json().catch(() => ({}));
    if (!javob.ok) {
      if (javob.status === 401) chiqish();
      throw new Error((malumot as { xato?: string }).xato || "Xatolik yuz berdi");
    }
    return malumot as T;
  }

  // ------------------------------------------------------------------
  // KIRISH / CHIQISH
  // ------------------------------------------------------------------
  async function kirish(yangiParol: string): Promise<boolean> {
    parol = yangiParol;
    try {
      await so_rov("/api/admin/tekshir");
      try { sessionStorage.setItem(PAROL_KALITI, parol); } catch { /* yopiq */ }
      $("#kirish").hidden = true;
      $("#panel").hidden = false;
      await royxatniYukla();
      return true;
    } catch (e) {
      const x = $("#kirish-xato");
      x.textContent = (e as Error).message;
      x.hidden = false;
      return false;
    }
  }

  function chiqish(): void {
    parol = "";
    try { sessionStorage.removeItem(PAROL_KALITI); } catch { /* yopiq */ }
    $("#panel").hidden = true;
    $("#kirish").hidden = false;
    $<HTMLInputElement>("#parol").value = "";
  }

  // ------------------------------------------------------------------
  // RO'YXAT
  // ------------------------------------------------------------------
  async function royxatniYukla(): Promise<void> {
    tovarlar = await so_rov<AdminTovar[]>("/api/admin/tovarlar");
    royxatniChiz();
  }

  function royxatniChiz(): void {
    const korinadigan = tovarlar.filter((t) => !t.yashirin).length;
    $("#a-sanoq").textContent = tovarlar.length
      ? `${tovarlar.length} ta tovar · ${korinadigan} tasi saytda ko'rinadi`
      : "Hali tovar qo'shilmagan";
    const joy = $("#royxat");
    if (!tovarlar.length) {
      joy.innerHTML = `<div class="a-bosh-holat"><strong>Tovarlar yo'q</strong><span>«+ Yangi tovar» tugmasini bosib, birinchi tovarni qo'shing.</span></div>`;
      return;
    }
    joy.innerHTML = tovarlar
      .map((t) => {
        const rasm = t.variantlar[0]?.rasmlar[0] ?? "";
        return `
        <article class="a-karta${t.yashirin ? " yashirin" : ""}" data-id="${t.id}">
          <div class="a-karta-rasm">
            ${rasm ? `<img src="${xavfsiz(rasm)}" alt="" loading="lazy">` : ""}
            <div class="a-holat">
              ${t.yashirin ? "<span>Yashirin</span>" : ""}
              ${t.yangi ? "<span>Yangi</span>" : ""}
              ${t.eskiNarx ? `<span class="y">−${Math.round((1 - t.narx / t.eskiNarx) * 100)}%</span>` : ""}
            </div>
          </div>
          <div class="a-karta-info">
            <small>${t.turkum === "sport" ? "Sport" : "Casual"} · ${t.tur === "poyabzal" ? "Poyabzal" : "Kiyim"} · ${t.variantlar.length} rang</small>
            <strong>${xavfsiz(t.nomi)}</strong>
            <b>${narxMatn(t.narx)}</b>
          </div>
          <div class="a-amallar">
            <button class="tugma glow" data-amal="tahrir" type="button">Tahrirlash</button>
            <button class="tugma glow" data-amal="yashir" type="button">${t.yashirin ? "Ko'rsatish" : "Yashirish"}</button>
            <button class="tugma glow ochir" data-amal="ochir" type="button">O'chirish</button>
          </div>
        </article>`;
      })
      .join("");
  }

  async function amal(id: number, nima: string): Promise<void> {
    const t = tovarlar.find((x) => x.id === id);
    if (!t) return;
    try {
      if (nima === "tahrir") return formaniOch(t);
      if (nima === "yashir") {
        await so_rov(`/api/admin/tovarlar/${id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...t, yashirin: !t.yashirin }),
        });
        xabar(t.yashirin ? "Tovar saytda ko'rsatildi" : "Tovar saytda yashirildi");
      }
      if (nima === "ochir") {
        if (!confirm(`"${t.nomi}" butunlay o'chirilsinmi? Rasmlari ham o'chadi.`)) return;
        await so_rov(`/api/admin/tovarlar/${id}`, { method: "DELETE" });
        xabar("Tovar o'chirildi");
      }
      await royxatniYukla();
    } catch (e) {
      xabar((e as Error).message);
    }
  }

  // ------------------------------------------------------------------
  // FORMA
  // ------------------------------------------------------------------
  function formaniOch(t?: AdminTovar): void {
    tahrirId = t ? t.id : null;
    $("#forma-sarlavha").textContent = t ? "Tovarni tahrirlash" : "Yangi tovar";
    $<HTMLInputElement>("#f-nomi").value = t?.nomi ?? "";
    $<HTMLTextAreaElement>("#f-tavsif").value = t?.tavsif ?? "";
    $<HTMLSelectElement>("#f-turkum").value = t?.turkum ?? "sport";
    $<HTMLSelectElement>("#f-tur").value = t?.tur ?? "kiyim";
    $<HTMLInputElement>("#f-narx").value = t ? String(t.narx) : "";
    $<HTMLInputElement>("#f-eski").value = t?.eskiNarx ? String(t.eskiNarx) : "";
    $<HTMLInputElement>("#f-yangi").checked = !!t?.yangi;
    $<HTMLInputElement>("#f-yashirin").checked = !!t?.yashirin;
    variantlar = t ? t.variantlar.map((v) => ({ ...v, rasmlar: [...v.rasmlar] })) : [{ rang: "", hex: "#111111", rasmlar: [] }];
    $("#forma-xato").hidden = true;
    variantlarniChiz();
    $<HTMLDialogElement>("#forma-oyna").showModal();
    $<HTMLInputElement>("#f-nomi").focus();
  }

  function variantlarniChiz(): void {
    $("#variantlar").innerHTML = variantlar
      .map(
        (v, i) => `
      <div class="a-variant" data-v="${i}">
        <div class="a-variant-bosh">
          <label>Rang nomi
            <input data-maydon="rang" value="${xavfsiz(v.rang)}" maxlength="30" placeholder="Masalan: Qora">
          </label>
          <label class="a-rang-tanla">Rang
            <input data-maydon="hex" type="color" value="${v.hex}">
          </label>
          ${variantlar.length > 1 ? `<button type="button" class="tugma glow a-variant-ochir" data-v-ochir="${i}" aria-label="Rangni o'chirish">✕</button>` : ""}
        </div>
        <div class="a-rasmlar">
          ${v.rasmlar
            .map(
              (r, k) => `<div class="a-rasm"><img src="${xavfsiz(r)}" alt="">${k === 0 ? '<span class="bosh-rasm">Asosiy</span>' : ""}<button type="button" data-rasm-ochir="${k}" aria-label="Rasmni olib tashlash">✕</button></div>`
            )
            .join("")}
          ${v.rasmlar.length < 8 ? `<label class="a-rasm-qosh">+ Rasm<br>qo'shish<input type="file" accept="image/*" multiple data-rasm-input></label>` : ""}
        </div>
      </div>`
      )
      .join("");
  }

  // Rasmni brauzerda 1200px gacha kichraytirib, WebP ga o'tkazadi
  async function rasmniTayyorla(fayl: File): Promise<Blob> {
    const bitmap = await createImageBitmap(fayl);
    const max = 1200;
    const k = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * k), h = Math.round(bitmap.height * k);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    for (const [turi, sifat] of [["image/webp", 0.82], ["image/jpeg", 0.85]] as const) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, turi, sifat));
      if (blob && blob.type === turi) return blob;
    }
    throw new Error("Rasmni o'qib bo'lmadi");
  }

  async function rasmlarniYukla(vi: number, fayllar: FileList): Promise<void> {
    const joy = 8 - variantlar[vi].rasmlar.length;
    const tanlangan = Array.from(fayllar).slice(0, joy);
    for (const fayl of tanlangan) {
      yuklanayotgan++;
      const blok = document.querySelector<HTMLElement>(`[data-v="${vi}"] .a-rasm-qosh`);
      const vaqtinchalik = document.createElement("div");
      vaqtinchalik.className = "a-rasm yuklanmoqda";
      blok?.before(vaqtinchalik);
      try {
        const blob = await rasmniTayyorla(fayl);
        const { url } = await so_rov<{ url: string }>("/api/admin/rasm", {
          method: "POST",
          headers: { "content-type": blob.type },
          body: blob,
        });
        variantlar[vi].rasmlar.push(url);
      } catch (e) {
        xabar((e as Error).message);
      } finally {
        yuklanayotgan--;
        vaqtinchalik.remove();
      }
    }
    variantlarniChiz();
  }

  async function saqla(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    const xatoJoy = $("#forma-xato");
    xatoJoy.hidden = true;
    if (yuklanayotgan > 0) {
      xatoJoy.textContent = "Rasmlar yuklanishini kuting…";
      xatoJoy.hidden = false;
      return;
    }
    const tovar = {
      nomi: $<HTMLInputElement>("#f-nomi").value,
      tavsif: $<HTMLTextAreaElement>("#f-tavsif").value,
      turkum: $<HTMLSelectElement>("#f-turkum").value,
      tur: $<HTMLSelectElement>("#f-tur").value,
      narx: Number($<HTMLInputElement>("#f-narx").value),
      eskiNarx: $<HTMLInputElement>("#f-eski").value ? Number($<HTMLInputElement>("#f-eski").value) : null,
      yangi: $<HTMLInputElement>("#f-yangi").checked,
      yashirin: $<HTMLInputElement>("#f-yashirin").checked,
      variantlar,
    };
    const tugma = $<HTMLButtonElement>("#forma-saqla");
    tugma.disabled = true;
    tugma.textContent = "Saqlanmoqda…";
    try {
      await so_rov(tahrirId ? `/api/admin/tovarlar/${tahrirId}` : "/api/admin/tovarlar", {
        method: tahrirId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tovar),
      });
      $<HTMLDialogElement>("#forma-oyna").close();
      xabar(tahrirId ? "O'zgarishlar saqlandi ✓" : "Tovar qo'shildi ✓");
      await royxatniYukla();
    } catch (err) {
      xatoJoy.textContent = (err as Error).message;
      xatoJoy.hidden = false;
    } finally {
      tugma.disabled = false;
      tugma.textContent = "Saqlash";
    }
  }

  // ------------------------------------------------------------------
  // HODISALAR
  // ------------------------------------------------------------------
  $("#kirish-forma").addEventListener("submit", async (e) => {
    e.preventDefault();
    const tugma = $<HTMLButtonElement>("#kirish-tugma");
    tugma.disabled = true;
    tugma.textContent = "Tekshirilmoqda…";
    $("#kirish-xato").hidden = true;
    await kirish($<HTMLInputElement>("#parol").value);
    tugma.disabled = false;
    tugma.textContent = "Kirish";
  });
  $("#chiqish").addEventListener("click", chiqish);
  $("#yangi-tovar").addEventListener("click", () => formaniOch());

  $("#royxat").addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-amal]");
    const karta = b?.closest<HTMLElement>("[data-id]");
    if (b && karta) amal(Number(karta.dataset.id), b.dataset.amal!);
  });

  const oyna = $<HTMLDialogElement>("#forma-oyna");
  const yop = () => oyna.close();
  $("#forma-yop").addEventListener("click", yop);
  $("#forma-bekor").addEventListener("click", yop);
  $("#tovar-forma").addEventListener("submit", (e) => saqla(e as SubmitEvent));
  $("#rang-qosh").addEventListener("click", () => {
    if (variantlar.length >= 8) return xabar("Ko'pi bilan 8 ta rang");
    variantlar.push({ rang: "", hex: "#111111", rasmlar: [] });
    variantlarniChiz();
  });

  const vJoy = $("#variantlar");
  vJoy.addEventListener("input", (e) => {
    const inp = e.target as HTMLInputElement;
    const vi = Number(inp.closest<HTMLElement>("[data-v]")?.dataset.v);
    if (inp.dataset.maydon === "rang") variantlar[vi].rang = inp.value;
    if (inp.dataset.maydon === "hex") variantlar[vi].hex = inp.value;
  });
  vJoy.addEventListener("change", (e) => {
    const inp = e.target as HTMLInputElement;
    if (!inp.matches("[data-rasm-input]") || !inp.files?.length) return;
    rasmlarniYukla(Number(inp.closest<HTMLElement>("[data-v]")?.dataset.v), inp.files);
  });
  vJoy.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const vi = Number(t.closest<HTMLElement>("[data-v]")?.dataset.v);
    const vOchir = t.closest<HTMLElement>("[data-v-ochir]");
    if (vOchir) {
      variantlar.splice(Number(vOchir.dataset.vOchir), 1);
      return variantlarniChiz();
    }
    const rOchir = t.closest<HTMLElement>("[data-rasm-ochir]");
    if (rOchir) {
      variantlar[vi].rasmlar.splice(Number(rOchir.dataset.rasmOchir), 1);
      variantlarniChiz();
    }
  });

  // Avvalgi kirish (shu brauzer oynasida)
  try {
    const saqlangan = sessionStorage.getItem(PAROL_KALITI);
    if (saqlangan) kirish(saqlangan);
  } catch { /* yopiq */ }
})();
