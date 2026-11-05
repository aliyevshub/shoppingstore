"use strict";
// =====================================================================
// products.ts — DO'KON SOZLAMALARI va MAHSULOTLAR
// ---------------------------------------------------------------------
// Yangi kiyim qo'shish uchun pastdagi "mahsulotlar" ro'yxatiga
// yangi qator qo'shing va `tsc` buyrug'ini ishga tushiring.
// =====================================================================
// ---- Do'kon sozlamalari ----
const DOKON = {
    nomi: "Aliyevs Store",
    shahar: "Andijon",
    ishVaqti: "Har kuni 09:00 – 20:00",
    // Buyurtmalar keladigan Telegram username (@ belgisisiz).
    // Bo'sh qolsa, buyurtma matni ekranda ko'rsatiladi va nusxalanadi.
    telegram: "",
};
const TURKUM_NOMLARI = {
    erkaklar: "Erkaklar",
    ayollar: "Ayollar",
    bolalar: "Bolalar",
};
// ---- Mahsulotlar (namunaviy) ----
const mahsulotlar = [
    { id: 1, nomi: "Oversize futbolka", turkum: "erkaklar", shakl: "futbolka", narx: 149000, rang: "#1c1c1c", olchamlar: ["S", "M", "L", "XL"], yangi: true },
    { id: 2, nomi: "Klassik hudi", turkum: "erkaklar", shakl: "hudi", narx: 289000, eskiNarx: 349000, rang: "#5b6b7a", olchamlar: ["M", "L", "XL", "XXL"] },
    { id: 3, nomi: "Qishki kurtka", turkum: "erkaklar", shakl: "kurtka", narx: 690000, rang: "#2f3b2f", olchamlar: ["M", "L", "XL"] },
    { id: 4, nomi: "Chino shim", turkum: "erkaklar", shakl: "shim", narx: 239000, rang: "#b59b74", olchamlar: ["30", "32", "34", "36"] },
    { id: 5, nomi: "Oq krossovka", turkum: "erkaklar", shakl: "krossovka", narx: 459000, rang: "#e9e9e9", olchamlar: ["40", "41", "42", "43", "44"], yangi: true },
    { id: 6, nomi: "Yozgi ko'ylak", turkum: "ayollar", shakl: "koylak", narx: 319000, rang: "#c98a8a", olchamlar: ["XS", "S", "M", "L"], yangi: true },
    { id: 7, nomi: "Trikotaj kofta", turkum: "ayollar", shakl: "kofta", narx: 259000, eskiNarx: 299000, rang: "#d8cbb5", olchamlar: ["S", "M", "L"] },
    { id: 8, nomi: "Uzun palto-kurtka", turkum: "ayollar", shakl: "kurtka", narx: 790000, rang: "#7a5c45", olchamlar: ["S", "M", "L"] },
    { id: 9, nomi: "Basic futbolka", turkum: "ayollar", shakl: "futbolka", narx: 119000, rang: "#f2f2f2", olchamlar: ["XS", "S", "M", "L"] },
    { id: 10, nomi: "Bolalar hudisi", turkum: "bolalar", shakl: "hudi", narx: 179000, rang: "#e0a43a", olchamlar: ["110", "122", "134", "146"] },
    { id: 11, nomi: "Bolalar kepkasi", turkum: "bolalar", shakl: "kepka", narx: 69000, eskiNarx: 89000, rang: "#3a6fe0", olchamlar: ["Yagona"] },
    { id: 12, nomi: "Bolalar shimi", turkum: "bolalar", shakl: "shim", narx: 139000, rang: "#44506b", olchamlar: ["110", "122", "134"] },
];
