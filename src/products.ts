// =====================================================================
// products.ts — DO'KON SOZLAMALARI va MAHSULOTLAR
// ---------------------------------------------------------------------
// Yangi tovar qo'shish: pastdagi "mahsulotlar" ro'yxatiga yangi obyekt
// qo'shing, rasmlarni img/ papkasiga joylang va `tsc -p .` ni ishga tushiring.
// =====================================================================

const DOKON = {
  nomi: "Aliyevs Store",
  shahar: "Andijon",
  ishVaqti: "Har kuni 09:00 – 21:00",
};

// ---- Tiplar ----
type Turkum = "sport" | "casual";
type Tur = "kiyim" | "poyabzal";

interface Variant {
  rang: string;      // "Qora"
  hex: string;       // rang doirachasi uchun
  rasmlar: string[]; // img/ papkasidagi fayllar (birinchisi asosiy)
}

// Haqiqiy xaridorlar izohlari (Telegram orqali kelganlarini shu yerga qo'shing)
interface Izoh {
  ism: string;
  baho: 1 | 2 | 3 | 4 | 5;
  matn: string;
  sana: string; // "2026-11-05"
}

interface Mahsulot {
  id: number;
  nomi: string;
  tavsif: string;
  turkum: Turkum;
  tur: Tur;
  narx: number;       // so'mda
  eskiNarx?: number;  // chegirma bo'lsa
  yangi?: boolean;
  variantlar: Variant[];
  izohlar?: Izoh[];
}

const TURKUM_NOMLARI: Record<Turkum, string> = { sport: "Sport", casual: "Casual" };

const KIYIM_OLCHAM = ["S", "M", "L", "XL", "XXL"];
const POYABZAL_OLCHAM = ["39", "40", "41", "42", "43", "44"];

function v(rang: string, hex: string, ...rasmlar: string[]): Variant {
  return { rang, hex, rasmlar: rasmlar.map((r) => "img/" + r + ".webp") };
}

// ---- Mahsulotlar ----
const mahsulotlar: Mahsulot[] = [
  // ======================== SPORT ========================
  {
    id: 3, nomi: "Ikki qavatli zip-hudi", turkum: "sport", tur: "kiyim", narx: 390000, yangi: true,
    tavsif: "Qalin futer, ichki tomoni to'q ko'k astarli. Keng yelka, erkin bichim.",
    variantlar: [v("Kulrang", "#a9aaa9", "p03-1", "p03-2", "p03-3", "p03-4", "p03-5")],
  },
  {
    id: 6, nomi: "Kontrast astarli hudi", turkum: "sport", tur: "kiyim", narx: 390000,
    tavsif: "Qora futer hudi, kapyushon ichi rangli. Oversize bichim.",
    variantlar: [
      v("Qizil astar", "#b3122e", "p06-qizil-1"),
      v("Kulrang astar", "#9b9b9b", "p06-kulrang-1"),
    ],
  },
  {
    id: 4, nomi: "Raglan bomber", turkum: "sport", tur: "kiyim", narx: 450000,
    tavsif: "Yengil, shamol o'tkazmaydigan mato. Tik yoqa, rezinkali etak va yeng.",
    variantlar: [
      v("Qora", "#151515", "p04-qora-1"),
      v("Kulrang", "#a7a8a4", "p04-kulrang-1"),
    ],
  },
  {
    id: 10, nomi: "Balaklava-hudi", turkum: "sport", tur: "kiyim", narx: 420000, yangi: true,
    tavsif: "Kapyushoni yuz niqobiga aylanadi. Sovuq kunlar uchun qalin futer.",
    variantlar: [v("Qora", "#111111", "p10-1", "p10-2")],
  },
  {
    id: 13, nomi: "Yugurish krossovkasi", turkum: "sport", tur: "poyabzal", narx: 480000,
    tavsif: "Yengil to'r ustki qism, yumshoq to'lqinsimon taglik. Kundalik yugurish uchun.",
    variantlar: [v("Qora / yalpiz", "#0f0f0f", "p13-1", "p13-2", "p13-3", "p13-4")],
  },
  {
    id: 19, nomi: "Paypoq-krossovka «Blade»", turkum: "sport", tur: "poyabzal", narx: 450000, eskiNarx: 520000,
    tavsif: "Paypoqdek o'tiradigan trikotaj, bo'shliqli egiluvchan taglik. Bog'ichsiz.",
    variantlar: [
      v("To'q sariq", "#c8641e", "p19-sariq-1", "p19-sariq-2", "p19-sariq-3"),
      v("Qora", "#121212", "p19-qora-1", "p19-qora-2"),
      v("Oq", "#ecebe8", "p19-oq-1"),
      v("Qora / sariq", "#e0702a", "p19-qora-sariq-1"),
    ],
  },

  // ======================== CASUAL ========================
  {
    id: 7, nomi: "Tvid kurtka kapyushonli", turkum: "casual", tur: "kiyim", narx: 690000, yangi: true,
    tavsif: "Qora-oq tvid to'qima, ikki tomonlama zamok, trikotaj etak va yeng.",
    variantlar: [v("Qora-oq", "#6f6f6f", "p07-1", "p07-2", "p07-3", "p07-4")],
  },
  {
    id: 2, nomi: "Charm kurtka, velvet yoqa", turkum: "casual", tur: "kiyim", narx: 790000, eskiNarx: 890000,
    tavsif: "Yumshoq eko-charm, jigarrang velvet yoqa, katta cho'ntaklar.",
    variantlar: [v("Qora", "#1b1d22", "p02-1", "p02-2", "p02-3")],
  },
  {
    id: 1, nomi: "Ish kurtkasi, velvet yoqa", turkum: "casual", tur: "kiyim", narx: 590000,
    tavsif: "Zich kanvas mato, ko'krak cho'ntaklari, issiq astar.",
    variantlar: [v("Jigarrang", "#4a3a2c", "p01-1")],
  },
  {
    id: 5, nomi: "Klassik bomber", turkum: "casual", tur: "kiyim", narx: 490000,
    tavsif: "Tik yoqa, trikotaj etak va manjetlar. Har qanday kiyim bilan mos.",
    variantlar: [
      v("To'q ko'k", "#24304a", "p05-kok-1"),
      v("Qora", "#141414", "p05-qora-1", "p05-qora-2"),
    ],
  },
  {
    id: 8, nomi: "Bej bomber", turkum: "casual", tur: "kiyim", narx: 550000,
    tavsif: "Silliq neylon, ichi issiq astar, tik yoqa.",
    variantlar: [v("Bej", "#a39068", "p08-1")],
  },
  {
    id: 9, nomi: "Kapyushonli bomber", turkum: "casual", tur: "kiyim", narx: 590000, eskiNarx: 690000,
    tavsif: "Yuvilgan kanvas, katakli astar, ko'krakda zamokli cho'ntak.",
    variantlar: [
      v("Zaytun", "#8b8579", "p09-zaytun-1"),
      v("Qora", "#15171c", "p09-qora-1"),
    ],
  },
  {
    id: 11, nomi: "Velvet kostyum", turkum: "casual", tur: "kiyim", narx: 650000,
    tavsif: "Kurtka va shim to'plami. Yumshoq velvet, zamokli kurtka.",
    variantlar: [
      v("Bordo", "#7a1f2c", "p11-bordo-1"),
      v("To'q yashil", "#2f3a33", "p11-yashil-1"),
      v("Jigarrang", "#9a6a45", "p11-jigarrang-1"),
    ],
  },
  {
    id: 12, nomi: "To'qilgan zip-kofta", turkum: "casual", tur: "kiyim", narx: 340000,
    tavsif: "Rezinka to'qima, ag'darma yoqa, ikki yon cho'ntak.",
    variantlar: [
      v("Qora", "#14161c", "p12-qora-1"),
      v("Kulrang", "#7d7e80", "p12-kulrang-1"),
    ],
  },
  {
    id: 14, nomi: "Zamsh baland krossovka", turkum: "casual", tur: "poyabzal", narx: 520000, yangi: true,
    tavsif: "Tabiiy zamsh, qalin oq taglik, yo'g'on bog'ich.",
    variantlar: [
      v("Qora", "#151515", "p14-qora-1"),
      v("Kulrang", "#4b4d50", "p14-kulrang-1"),
      v("Zaytun", "#56603a", "p14-zaytun-1"),
      v("Jigarrang", "#a8763f", "p14-jigarrang-1"),
    ],
  },
  {
    id: 17, nomi: "Zamsh past krossovka", turkum: "casual", tur: "poyabzal", narx: 490000,
    tavsif: "Yumshoq zamsh, qalin taglik. To'rt rangda mavjud.",
    variantlar: [
      v("Qora", "#151515", "p17-qora-1"),
      v("Barcha ranglar", "#7b6f55", "p17-ranglar-1"),
    ],
  },
  {
    id: 18, nomi: "Bog'ichsiz charm krossovka", turkum: "casual", tur: "poyabzal", narx: 420000,
    tavsif: "Silliq charm, rezinkali qo'yilma. Oson kiyiladi.",
    variantlar: [v("Qora / oq", "#121212", "p18-1")],
  },
  {
    id: 15, nomi: "Charm keda", turkum: "casual", tur: "poyabzal", narx: 290000,
    tavsif: "Klassik shakl, eko-charm, yumshoq ichki qism.",
    variantlar: [
      v("Oq", "#f1f0ec", "p15-oq-1"),
      v("Qora", "#161616", "p15-qora-1"),
    ],
  },
  {
    id: 16, nomi: "Kanvas keda", turkum: "casual", tur: "poyabzal", narx: 240000,
    tavsif: "Qora kanvas, oq chiziqli rezina taglik.",
    variantlar: [v("Qora", "#18181a", "p16-1")],
  },
  {
    id: 20, nomi: "Zamsh loafer-botinka", turkum: "casual", tur: "poyabzal", narx: 680000,
    tavsif: "To'q ko'k zamsh, yengil oq taglik. Bog'ichsiz, nafis.",
    variantlar: [v("To'q ko'k", "#1f2742", "p20-1")],
  },
];

function olchamlar(m: Mahsulot): string[] {
  return m.tur === "poyabzal" ? POYABZAL_OLCHAM : KIYIM_OLCHAM;
}
