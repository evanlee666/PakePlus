"use strict";

// Visual interpretations for a positive scan. Product numbers identify emulsions;
// colour settings and edge lettering are artwork, not manufacturer profiles.
const families = {
  portrait: ["#38261d", "#edac67", "saturate(.94) contrast(.96) sepia(.07)"],
  gold: ["#412d17", "#f4b951", "sepia(.15) saturate(1.12) contrast(1.02)"],
  vivid: ["#32221c", "#dfa057", "saturate(1.19) contrast(1.07)"],
  fuji: ["#2d251e", "#e7a16e", "sepia(.06) hue-rotate(350deg) saturate(.98)"],
  slide: ["#171b1c", "#ded3a1", "contrast(1.09) saturate(1.12)"],
  silver: ["#242423", "#d2cab5", "grayscale(1) contrast(1.10)"],
  softSilver: ["#252628", "#babcb5", "grayscale(1) contrast(.96)"],
  daylight: ["#34251e", "#e8a065", "sepia(.08) saturate(.94) contrast(.97)"],
  tungsten: ["#2d2529", "#dc9775", "saturate(.91) contrast(1.02) hue-rotate(355deg)"]
};

const stocks = [];
function addStocks(group, rows) {
  for (const [name, imprint, family, options = {}] of rows) {
    const [base, edge, filter] = families[family];
    stocks.push({group, name, imprint, base, edge, filter, family, ...options});
  }
}
addStocks("柯达 Kodak", [
  ["Kodak Portra 400", "KODAK PORTRA 400", "portrait"],
  ["Kodak Gold 200", "KODAK GOLD 200", "gold"],
  ["Kodak Ektar 100", "KODAK EKTAR 100", "vivid"],
  ["Kodak Portra 160", "KODAK PORTRA 160", "portrait"],
  ["Kodak Portra 800", "KODAK PORTRA 800", "portrait"],
  ["Kodak ColorPlus 200", "KODAK 200", "gold", {only35:true}],
  ["Kodak UltraMax 400", "KODAK 400", "vivid", {only35:true}],
  ["Kodak Ektachrome E100", "KODAK E100", "slide"],
  ["Kodak Tri-X 400", "KODAK 400 TX", "silver"],
  ["Kodak T-Max 100", "KODAK 100 TMX", "softSilver"],
  ["Kodak T-Max 400", "KODAK 400 TMY", "silver"],
  ["Kodak T-Max P3200", "KODAK P3200 TMZ", "silver", {only35:true, iso:3200}],
  ["Kodak Pro Image 100", "KODAK PRO IMAGE 100", "portrait", {only35:true}]
]);
addStocks("富士 Fujifilm", [
  ["Fujifilm Velvia 50", "FUJI RVP 50", "slide", {filter:"contrast(1.14) saturate(1.33)"}],
  ["Fujifilm Provia 100F", "FUJI RDP III", "slide"],
  ["Fujifilm Neopan Acros II", "FUJI ACROS II", "softSilver"],
  ["Fujicolor C200", "FUJI C200", "fuji", {only35:true}]
]);
addStocks("柯达电影卷 · 35mm 分装", [
  ["VISION3 50D · 5203", "KODAK 5203", "daylight", {only35:true, bh:true}],
  ["VISION3 250D · 5207", "KODAK 5207", "daylight", {only35:true, bh:true}],
  ["VISION3 200T · 5213", "KODAK 5213", "tungsten", {only35:true, bh:true}],
  ["VISION3 500T · 5219", "KODAK 5219", "tungsten", {only35:true, bh:true}],
  ["Eastman Double-X · 5222", "EASTMAN 5222", "silver", {only35:true, bh:true}],
  ["Ektachrome 100D · 5294", "KODAK 5294", "slide", {only35:true, bh:true, iso:100}]
]);
addStocks("CineStill 电影风格卷", [
  ["CineStill 50D", "CINESTILL 50D", "daylight"],
  ["CineStill 400D", "CINESTILL 400D", "daylight"],
  ["CineStill 800T", "CINESTILL 800T", "tungsten"]
]);
addStocks("伊尔福 ILFORD", [
  ["Ilford HP5 Plus 400", "ILFORD HP5 PLUS", "silver"],
  ["Ilford FP4 Plus 125", "ILFORD FP4 PLUS", "softSilver"],
  ["Ilford Delta 100", "ILFORD DELTA 100", "softSilver"],
  ["Ilford Delta 3200", "ILFORD DELTA 3200", "silver"],
  ["Ilford Delta 400", "ILFORD DELTA 400", "silver"],
  ["Ilford Pan F Plus 50", "ILFORD PAN F PLUS", "softSilver"],
  ["Ilford XP2 Super 400", "ILFORD XP2 SUPER", "softSilver"],
  ["Ilford SFX 200", "ILFORD SFX 200", "silver", {filter:"grayscale(1) contrast(1.18)"}],
  ["Ilford Ortho Plus 80", "ILFORD ORTHO PLUS", "softSilver", {filter:"grayscale(1) contrast(1.13)"}]
]);
addStocks("Kentmere / Foma", [
  ["Kentmere Pan 100", "KENTMERE 100", "softSilver"],
  ["Kentmere Pan 400", "KENTMERE 400", "silver"],
  ["Fomapan 100 Classic", "FOMAPAN 100", "softSilver"],
  ["Fomapan 400 Action", "FOMAPAN 400", "silver"],
  ["Fomapan 200 Creative", "FOMAPAN 200", "softSilver"],
  ["Kentmere Pan 200", "KENTMERE 200", "silver", {filter:"grayscale(1) contrast(1.15)"}]
]);
addStocks("历史型号 · 过期卷预设", [
  ["Fujicolor Pro 400H", "FUJI PRO400H", "fuji", {expired:35}],
  ["Fujicolor Superia X-TRA 400", "FUJI SUPERIA 400", "fuji", {only35:true, expired:50}],
  ["AgfaPhoto Vista Plus 200", "AGFAPHOTO VISTA 200", "gold", {only35:true, expired:65}],
  ["Kodak Plus-X 125", "KODAK 125 PX", "softSilver", {expired:55}],
  ["Kodak Kodachrome 64", "KODACHROME 64", "slide", {only35:true, iso:64, expired:35, filter:"contrast(1.16) saturate(1.12) sepia(.06)"}],
  ["Kodak Ektachrome E100VS", "KODAK E100VS", "slide", {iso:100, expired:30, filter:"contrast(1.12) saturate(1.30)"}],
  ["Fujichrome Velvia 100", "FUJI RVP 100", "slide", {filter:"contrast(1.15) saturate(1.24)"}],
  ["Fujicolor Superia 1600", "FUJI SUPERIA 1600", "fuji", {only35:true, iso:1600, expired:40}]
]);
addStocks("上海 Shanghai", [
  ["上海 GP3 100 黑白", "SHANGHAI GP3 100", "softSilver"],
  ["上海 GP3 400 黑白", "SHANGHAI GP3 400", "silver"]
]);
addStocks("禄来 Rollei", [
  ["Rollei RPX 100", "ROLLEI RPX 100", "softSilver"],
  ["Rollei Retro 80S", "ROLLEI RETRO 80S", "silver", {filter:"grayscale(1) contrast(1.17)"}],
  ["Rollei RPX 400", "ROLLEI RPX 400", "silver"],
  ["Rollei RPX 25", "ROLLEI RPX 25", "softSilver", {iso:25}],
  ["Rollei Retro 400S", "ROLLEI RETRO 400S", "silver", {iso:400, filter:"grayscale(1) contrast(1.20)"}],
  ["Rollei Superpan 200", "ROLLEI SUPERPAN 200", "silver"],
  ["Rollei Ortho 25 Plus", "ROLLEI ORTHO 25", "softSilver", {iso:25, filter:"grayscale(1) contrast(1.17)"}],
  ["Rollei Infrared 400", "ROLLEI INFRARED 400", "silver", {filter:"grayscale(1) contrast(1.24)"}]
]);
addStocks("Lomography", [
  ["Lomography Color Negative 400", "LOMO CN 400", "vivid"],
  ["Lomography Color Negative 800", "LOMO CN 800", "gold"],
  ["LomoChrome Purple", "LOMOCHROME PURPLE", "vivid", {filter:"hue-rotate(34deg) saturate(1.16) contrast(1.03)"}],
  ["LomoChrome Metropolis", "LOMOCHROME METROPOLIS", "fuji", {filter:"saturate(.58) contrast(1.15) sepia(.12)"}],
  ["LomoChrome Turquoise", "LOMOCHROME TURQUOISE", "vivid", {filter:"hue-rotate(338deg) saturate(1.30) contrast(1.04)"}],
  ["LomoChrome Color ’92", "LOMOCHROME COLOR 92", "daylight", {iso:400, filter:"saturate(.91) contrast(1.05) hue-rotate(354deg)"}],
  ["LomoChrome Color ’92 Sun-kissed", "LOMOCHROME 92 SUN-KISSED", "gold", {iso:400, filter:"sepia(.22) saturate(1.07)"}],
  ["Lomography Berlin Kino 400", "LOMO BERLIN KINO 400", "silver", {filter:"grayscale(1) contrast(1.08)"}]
]);
addStocks("HARMAN / ADOX", [
  ["Harman Phoenix 200", "HARMAN PHOENIX 200", "gold", {filter:"contrast(1.16) saturate(1.18) sepia(.14)"}],
  ["Harman Phoenix II 200", "HARMAN PHOENIX II", "portrait", {filter:"contrast(1.04) saturate(1.09) sepia(.07)"}],
  ["Harman Red 125", "HARMAN RED 125", "gold", {filter:"sepia(.60) saturate(1.40) hue-rotate(335deg)"}],
  ["Harman Switch Azure 125", "HARMAN SWITCH AZURE 125", "daylight", {filter:"hue-rotate(188deg) saturate(.85)"}],
  ["ADOX CHS 100 II", "ADOX CHS 100 II", "softSilver"],
  ["ADOX HR-50", "ADOX HR-50", "softSilver", {iso:50, filter:"grayscale(1) contrast(1.08)"}]
]);
addStocks("乐凯 Lucky", [
  ["乐凯 Lucky C200 彩色负片", "LUCKY C200", "gold", {iso:200, filter:"sepia(.13) saturate(1.13) contrast(1.02)"}],
  ["乐凯 Lucky C400 彩色负片", "LUCKY C400", "vivid", {iso:400, only35:true}],
  ["乐凯 Lucky SHD100 黑白", "LUCKY SHD100", "softSilver", {iso:100}],
  ["乐凯 Lucky SHD400 黑白", "LUCKY SHD400", "silver", {iso:400}],
  ["乐凯 影者100 黑白", "LUCKY YINGZHE 100", "softSilver", {iso:100, only35:true, filter:"grayscale(1) contrast(1.04)"}]
]);
