/**
 * Downloads free-licence product photos from Wikimedia Commons for the demo seed data.
 *   node tools/fetch-seed-photos.mjs          -> fetch missing photos
 *   node tools/fetch-seed-photos.mjs 4 12     -> re-fetch products 4 and 12 only
 * Output: seed-photos/p{N}-v{V}.jpg (800 px) and seed-photos/credits.json (author + licence per photo).
 * The files are committed, so normal builds never touch the network.
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'seed-photos');
const UA = 'shuka-seed-photos/1.0 (student project; demo images)';
const LICENCES = /^(public domain|pd|cc0|cc by(-sa)? [1-4]\.0|cc by(-sa)? 2\.5|cc by(-sa)? 2\.0)/i;

// Product number (1-based, same order as server/seed.js) -> search query, photos wanted, titles to skip.
export const QUERIES = {
  1: { q: 'wireless earbuds', n: 1 },
  2: { q: 'smartphone stand desk', n: 2 },
  3: { q: 'USB charger', n: 3 },
  4: { q: 'mechanical keyboard', n: 1 },
  5: { q: 'power bank', n: 2 },
  6: { q: 'LED light bulb', n: 3 },
  7: { q: 'headphones', n: 1 },
  8: { q: 'action camera', n: 2 },
  9: { q: 'computer mouse', n: 3 },
  10: { q: 'laptop backpack', n: 1 },
  11: { q: 'fitness tracker wristband', n: 2 },
  12: { q: 'JavaScript book', n: 3 },
  13: { q: 'electric kettle', n: 1 },
  14: { q: 'bluetooth speaker', n: 2 },
  15: { q: 'Armenian ceramic plate', n: 3 },
  16: { q: 'Armenian carpet', n: 1 },
  17: { q: 'obsidian pendant', n: 2 },
  18: { q: 'backgammon board', n: 3 },
  19: { q: 'duduk', n: 1 },
  20: { q: 'copper cezve', n: 2 },
  21: { q: 'embroidered table runner', n: 3 },
  22: { q: 'knitted wool socks', n: 1 },
  23: { q: 'handmade soap', n: 2 },
  24: { q: 'herbal tea', n: 3 },
  25: { q: 'filigree earrings', n: 1 },
  26: { q: 'cookbook', n: 2 },
  27: { q: 'wooden alphabet blocks', n: 3 },
  28: { q: 'khachkar', n: 1 },
  29: { q: 'dried apricots', n: 2 },
  30: { q: 'gata armenian pastry', n: 3 },
  31: { q: 'lavash', n: 1 },
  32: { q: 'mulberry jam', n: 2 },
  33: { q: 'churchkhela', n: 3 },
  34: { q: 'leather shoes', n: 1 },
  35: { q: 'wool coat', n: 2 },
  36: { q: 't-shirt', n: 3 },
  37: { q: 'hiking backpack', n: 1 },
  38: { q: 'yoga mat', n: 2 },
  39: { q: 'football ball', n: 3 },
  40: { q: 'cast iron skillet', n: 1 },
  41: { q: 'glass food storage container', n: 2 },
  42: { q: 'toy building blocks', n: 3 },
  43: { q: 'teddy bear', n: 1 },
  44: { q: 'rose water bottle', n: 2 },
  45: { q: 'history book', n: 3 },
};

// Hand-picked Commons files (reviewed); they replace the search results.
const FILES = {
 "1": [
  "File:ActiveSound wireless earbuds by Hykker (POJM200483).jpg"
 ],
 "2": [
  "File:IPhone in a wooden phone holder (43636842001).jpg",
  "File:A phone holder.jpg"
 ],
 "3": [
  "File:USB wall charger.JPG",
  "File:Apple 5W USB Power Adapter (4935).jpg",
  "File:Phone charger 2026.jpg"
 ],
 "4": [
  "File:Mechanical Keyboard.jpg"
 ],
 "5": [
  "File:Charging a smartphone with a USB power bank.jpg",
  "File:Portable power bank.jpg"
 ],
 "6": [
  "File:LED-E27-Light-Bulb-1134.jpg",
  "File:LED bulbs.jpg",
  "File:LED bulb 800 Lm Soft white 2024.agr.jpg"
 ],
 "7": [
  "File:Headphones on desk.jpg"
 ],
 "8": [
  "File:GoPro Hero 8 Black and Hero 11 Black.JPG",
  "File:Action camera.jpg"
 ],
 "9": [
  "File:A wireless computer mouse.jpg",
  "File:A black wireless computer mouse.jpg",
  "File:2023 Mysz komputerowa Logitech G903 Lightspeed.jpg"
 ],
 "10": [
  "File:Peak Design Everyday Backpack 30 L.jpg"
 ],
 "11": [
  "File:Fitbit Alta HR.jpg",
  "File:Fitbit Alta HR landscape.jpg"
 ],
 "12": [
  "File:The Art of Computer Programming (vol. 1-4B)-2808.jpg",
  "File:The Art of Computer Programming (vol. 1-4B)-2805.jpg",
  "File:Books in stack with lamps (Unsplash).jpg"
 ],
 "13": [
  "File:Electric kettle phillips white.JPG"
 ],
 "14": [
  "File:JBL Flip 3 bluetooth speaker (DSCF2653).jpg",
  "File:UE Boom 2.jpg"
 ],
 "15": [
  "File:Pomegranates and a ceramic plate.jpg",
  "File:Ceramic vessels adorned with pomegranate motifs.jpg",
  "File:Plate pomegranates Louvre MAO868.jpg"
 ],
 "16": [
  "File:Carpet Tree of life.jpg"
 ],
 "17": [
  "File:Aztec Obsidian Necklace (9756161106).jpg",
  "File:Obsidian pendant Neolithic Jericho Ashmolean.jpg"
 ],
 "18": [
  "File:Persian Backgammon board made in Khatam technique.jpg",
  "File:Tavli Board with slots C Closed.jpg",
  "File:Greek Coffee next to a board of Tavli.jpg"
 ],
 "19": [
  "File:Duduk-view.jpg"
 ],
 "20": [
  "File:Copper cezve.jpg",
  "File:Türk Kahvesi - Bakir Cezve.jpg"
 ],
 "21": [
  "File:Oriental Table Runner, item 5.jpg",
  "File:Table runner (AM 1991.48-6).jpg",
  "File:Table runner (AM 1991.48-3).jpg"
 ],
 "22": [
  "File:Hand knitted socks.jpg"
 ],
 "23": [
  "File:Handmade soap.jpg",
  "File:Aleppo soap 01.jpg"
 ],
 "24": [
  "File:Mixture for herbal tea 03.jpg",
  "File:Hibiscus Delight tisane.jpg",
  "File:White mug with red herbal Advent tea in Tuntorp.jpg"
 ],
 "25": [
  "File:Silver filigree earrings with pearls by Delfino García Esperanza.jpg"
 ],
 "26": [
  "File:Handwritten cookbook by Dorothea Grimm.jpg",
  "File:Mrs. Welch's Cookbook, published in 1884.jpg"
 ],
 "27": [
  "File:A pile of alphabet wooden blocks.jpg",
  "File:Blocks, alphabet (51359801586).jpg"
 ],
 "28": [
  "File:Khachkar on the background of Lake Sevan.jpg"
 ],
 "29": [
  "File:Dried Apricots.jpg",
  "File:Turkey dried apricots.jpg"
 ],
 "30": [
  "File:Armenian Gata in slices (1).jpg",
  "File:Armenian gata with layers.jpg",
  "File:Gata (pâtisserie).jpg"
 ],
 "31": [
  "File:Lavash stacked at GUM market in Yerevan, Armenia.jpg"
 ],
 "32": [
  "File:Mulberries jam CNE.jpg",
  "File:Morus alba fruits.jpg"
 ],
 "33": [
  "File:Churchkhela on the market.jpg",
  "File:Churchkhela.jpg",
  "File:Churchkhela (1).jpg"
 ],
 "34": [
  "File:Handgefertigte Schuhe.jpg"
 ],
 "35": [
  "File:Red Coat in Wool designed by Sybil Connolly - Full Lenght Front.jpg",
  "File:Red Coat in Wool designed by Sybil Connolly - Full Lenght Back.jpg"
 ],
 "36": [
  "File:T-Shirt Wikipedia white.jpg",
  "File:Wiki Loves Bangla T-Shirt White.jpg",
  "File:T-shirt mockup.jpg"
 ],
 "37": [
  "File:A backpack with trekking poles and shoes.jpg"
 ],
 "38": [
  "File:Yoga mat.jpg",
  "File:Cotton Yoga Mats.png"
 ],
 "39": [
  "File:Just a soccer ball (34782492153).jpg",
  "File:Adidas MLS Tango 12 soccer ball.jpg",
  "File:Giant Soccer Ball.jpg"
 ],
 "40": [
  "File:Griswold cast iron skillet.jpg"
 ],
 "41": [
  "File:Glass food storage container with Easy Find Lids.jpg",
  "File:Mason Jar with Screw Top.JPG"
 ],
 "42": [
  "File:Toy Blocks (50995087111).jpg"
 ],
 "43": [
  "File:Handmade teddy bear.jpg"
 ],
 "44": [
  "File:Rose and water bottle.jpg",
  "File:Rose syrup bottles.jpg"
 ],
 "45": [
  "File:Old Books 01.JPG",
  "File:Old books (Unsplash).jpg",
  "File:Stack of old Enid Blyton books.jpg"
 ]
};
for (const [num, files] of Object.entries(FILES)) QUERIES[num].files = files;

const strip = (html = '') => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** GET with retries: Commons answers "too many requests" with plain text or HTTP 429. */
async function getJson(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const text = await res.text();
    if (res.ok) { try { return JSON.parse(text); } catch { /* rate-limit text */ } }
    await sleep(5000 * (attempt + 1));
  }
  throw new Error(`Commons API kept refusing: ${url}`);
}

async function getBytes(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    await sleep(5000 * (attempt + 1));
  }
  throw new Error(`download failed: ${url}`);
}

/** Exact files chosen by hand (cfg.files) win over search results. */
async function byTitles(titles) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({ action: 'query', format: 'json', titles: titles.join('|'), prop: 'imageinfo',
    iiprop: 'url|extmetadata|size|mime', iiurlwidth: '800' }).forEach(([k, v]) => url.searchParams.set(k, v));
  const pages = Object.values((await getJson(url)).query?.pages || {});
  return titles.map((t) => pages.find((p) => p.title === t)).filter((p) => p?.imageinfo);
}

async function search(q, skip = []) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '25',
    gsrsearch: `${q} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '800',
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  const pages = Object.values((await getJson(url)).query?.pages || {}).sort((a, b) => a.index - b.index);
  return pages.filter((p) => {
    const ii = p.imageinfo?.[0];
    const lic = ii?.extmetadata?.LicenseShortName?.value || '';
    return ii && /jpeg|png/.test(ii.mime) && ii.width >= 500 && ii.height >= 400
      && LICENCES.test(lic) && !skip.includes(p.title);
  });
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const creditsFile = path.join(OUT, 'credits.json');
  const credits = existsSync(creditsFile) ? JSON.parse(await fs.readFile(creditsFile, 'utf8')) : {};
  const only = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
  for (const [num, cfg] of Object.entries(QUERIES)) {
    if (only.length && !only.includes(Number(num))) continue;
    const wanted = Array.from({ length: cfg.n }, (_, v) => `p${num}-v${v}.jpg`);
    if (!only.length && !process.argv.includes('--list') && wanted.every((f) => existsSync(path.join(OUT, f)))) continue;
    if (!process.argv.includes('--list')) for (const f of wanted) { await fs.rm(path.join(OUT, f), { force: true }); delete credits[f]; }
    if (process.argv.includes('--list')) {
      const c = await search(cfg.q, cfg.skip);
      console.log(`p${num} [${cfg.n}] "${cfg.q}":\n  ` + c.slice(0, 12).map((h) => h.title).join('\n  '));
      await sleep(1500);
      continue;
    }
    const hits = (cfg.files ? await byTitles(cfg.files) : await search(cfg.q, cfg.skip)).slice(0, cfg.n);
    for (let v = 0; v < hits.length; v++) {
      const ii = hits[v].imageinfo[0];
      const m = ii.extmetadata;
      const file = `p${num}-v${v}.jpg`;
      // Re-encode: only real image bytes survive, and EXIF/metadata is dropped.
      await sharp(await getBytes(ii.thumburl)).rotate().resize(800, 800, { fit: 'inside' })
        .flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toFile(path.join(OUT, file));
      credits[file] = {
        title: hits[v].title.replace(/^File:/, ''),
        author: strip(m.Artist?.value) || 'Unknown',
        license: m.LicenseShortName?.value,
        licenseUrl: m.LicenseUrl?.value || null,
        source: ii.descriptionurl,
      };
    }
    console.log(`p${num} "${cfg.q}": ${hits.length}/${cfg.n} -> ${hits.map((h) => h.title.slice(5, 60)).join(' | ')}`);
    await saveCredits(creditsFile, credits);
    await sleep(1500); // be polite to the API
  }
  await saveCredits(creditsFile, credits);
}

async function saveCredits(creditsFile, credits) {
  const sorted = Object.fromEntries(Object.entries(credits).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })));
  await fs.writeFile(creditsFile, JSON.stringify(sorted, null, 2) + '\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
