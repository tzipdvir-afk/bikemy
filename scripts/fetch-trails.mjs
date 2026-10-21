// Downloads all MTB routes in Israel from OpenStreetMap (Overpass) into www/trails.json.
// Run occasionally to refresh: node scripts/fetch-trails.mjs
// Output: [{ id, name, km, loop, diff, net, start:[lat,lng], lines:[[[lat,lng],...],...] }]
import { writeFileSync } from 'node:fs';

const QUERY = '[out:json][timeout:180];area["ISO3166-1"="IL"]->.a;relation["route"="mtb"](area.a);out geom;';
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const UA = 'bikemy-trails/1.0 (tzipdvir@gmail.com)';

async function fetchOverpass() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = SERVERS[attempt % SERVERS.length];
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(QUERY)
      });
      if (res.ok) return await res.json();
      console.log(url, res.status, '- retrying');
    } catch (e) { console.log(url, e.message, '- retrying'); }
    await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
  }
  throw new Error('Overpass unavailable, try again later');
}

const R = Math.PI / 180;
const hav = (a, b) => {
  const s = Math.sin((b[0] - a[0]) * R / 2) ** 2 + Math.cos(a[0] * R) * Math.cos(b[0] * R) * Math.sin((b[1] - a[1]) * R / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(s));
};
const len = line => line.reduce((d, p, i) => i ? d + hav(line[i - 1], p) : 0, 0);

// Douglas–Peucker in meters (equirectangular approximation is fine at trail scale)
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const k = Math.cos(pts[0][0] * R) * 111320, m = 110540;
  const xy = pts.map(p => [p[1] * k, p[0] * m]);
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1, bd = tol;
    const [ax, ay] = xy[a], [bx, by] = xy[b], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy[i];
      const t = L2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
      const d = Math.hypot(px - ax - t * dx, py - ay - t * dy);
      if (d > bd) { bd = d; best = i; }
    }
    if (best > 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// chain the relation's way segments into as few continuous lines as possible
function chain(segs) {
  const near = (a, b) => hav(a, b) < 15;
  const lines = [];
  const left = segs.map(s => s.slice());
  while (left.length) {
    let line = left.shift(), grown = true;
    while (grown) {
      grown = false;
      for (let i = 0; i < left.length; i++) {
        const s = left[i], head = line[0], tail = line[line.length - 1];
        if (near(tail, s[0])) line = line.concat(s.slice(1));
        else if (near(tail, s[s.length - 1])) line = line.concat(s.slice(0, -1).reverse());
        else if (near(head, s[s.length - 1])) line = s.concat(line.slice(1));
        else if (near(head, s[0])) line = s.slice().reverse().concat(line.slice(1));
        else continue;
        left.splice(i, 1); grown = true; break;
      }
    }
    lines.push(line);
  }
  return lines.sort((a, b) => len(b) - len(a));
}

const data = await fetchOverpass();
const trails = [];
for (const el of data.elements) {
  const t = el.tags || {};
  const segs = (el.members || []).filter(m => m.type === 'way' && m.geometry && m.geometry.length > 1)
    .map(m => m.geometry.map(g => [g.lat, g.lon]));
  if (!segs.length) continue;
  const lines = chain(segs);
  const km = lines.reduce((d, l) => d + len(l), 0) / 1000;
  const main = lines[0];
  const out = lines.map(l => simplify(l, 6).map(p => [+p[0].toFixed(5), +p[1].toFixed(5)])).filter(l => l.length > 1);
  trails.push({
    id: el.id,
    name: t['name:he'] || t.name || t['name:en'] || 'מסלול ללא שם',
    km: +km.toFixed(1),
    loop: hav(main[0], main[main.length - 1]) < 150,
    diff: t['mtb:scale'] || t['mtb:scale:imba'] || t.difficulty || '',
    net: t.network || '',
    desc: (t['description:he'] || t.description || '').slice(0, 240),
    start: out[0][0],
    lines: out
  });
}
trails.sort((a, b) => a.name.localeCompare(b.name, 'he'));
const json = JSON.stringify(trails);
writeFileSync('www/trails.json', json);
console.log(trails.length + ' trails, ' + (json.length / 1024).toFixed(0) + ' KB, generated ' + new Date().toISOString());
