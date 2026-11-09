'use strict';

const $ = id => document.getElementById(id);

const fmt = n => n.toLocaleString('tr-TR');

function parseIPv4(input) {
  const parts = input.trim().split('.');
  if (parts.length !== 4 || parts.some(p => !/^(0|[1-9]\d{0,2})$/.test(p) || Number(p) > 255)) throw new Error('Geçerli bir IPv4 adresi girin (ör. 192.168.1.75).');
  return parts.reduce((v, p) => ((v << 8) >>> 0) + Number(p), 0) >>> 0;
}

const dotted = n => [24, 16, 8, 0].map(s => (n >>> s) & 255).join('.');

const prefixMask = p => p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0;

function calc(ip, p) {
  const mask = prefixMask(p), net = (ip & mask) >>> 0, wild = (~mask) >>> 0, broadcast = (net | wild) >>> 0;
  const total = 2 ** (32 - p), usable = p === 32 ? 1 : p === 31 ? 2 : Math.max(0, total - 2);
  const first = p >= 31 ? net : (net + 1) >>> 0, last = p >= 31 ? broadcast : (broadcast - 1) >>> 0;
  return { ip, p, mask, net, broadcast, wild, total, usable, first, last };
}

function ipType(ip) {
  const a = ip >>> 24, b = (ip >>> 16) & 255;
  if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'Özel (Private)';
  if (a === 127) return 'Loopback';
  if (a === 169 && b === 254) return 'Link-local';
  if (a >= 224 && a <= 239) return 'Multicast';
  if (a >= 240) return 'Ayrılmış / deneysel';
  if (a === 0) return 'Özel amaçlı (0/8)';
  return 'Genel veya özel amaçlı';
}

function setText(id, v) { $(id).textContent = v; }

function update() {
  try {
    const ip = parseIPv4($('ip').value), p = Number($('prefixNumber').value);

    if (!Number.isInteger(p) || p < 0 || p > 32) 
      throw new Error('CIDR ön eki 0 ile 32 arasında bir tam sayı olmalıdır.');

    $('error').hidden = true; 
    $('prefix').value = p; 
    setText('prefixLabel', '/' + p);

    const r = calc(ip, p);

    [
      ['network', dotted(r.net) + '/' + p], 
      ['broadcast', dotted(r.broadcast)], 
      ['mask', dotted(r.mask)], 
      ['usable', fmt(r.usable)], 
      ['first', dotted(r.first)], 
      ['last', dotted(r.last)], 
      ['total', fmt(r.total)], 
      ['wildcard', dotted(r.wild)], 
      ['bits', p + ' / ' + (32 - p)], 
      ['type', ipType(ip)]
    ].forEach(([id, value]) => setText(id, value));

    const binary = ip.toString(2).padStart(32, '0');

    $('bitStrip').replaceChildren(...Array.from(binary, (bit, i) => { 
      const e = document.createElement('span'); 
      e.className = 'bit' + (i >= p ? ' host' : '') + ([7, 15, 23].includes(i) ? ' octet-end' : ''); 
      e.textContent = bit; return e; 
    }));

    setText('binary', binary.match(/.{8}/g).join(' . '));
    setText('explain', p === 31 ? 'RFC 3021: /31, noktadan noktaya bağlantılarda iki adresin ikisi de kullanılabilir; klasik broadcast ayrılmaz.' : p === 32 ? '/32 tek bir IPv4 adresini belirtir; ayrı bir host aralığı veya yayın adresi bulunmaz.' : `İlk ${p} bit ağ bölümünü, kalan ${32 - p} bit host bölümünü oluşturur. /${p} ağında ${fmt(r.total)} toplam adres vardır; klasik IPv4 alt ağlarında ağ ve broadcast adresleri hostlara atanmaz.`);
    renderSubnets(r);
  } catch (e) { 
    $('error').hidden = false; 
    setText('error', e.message); 
  }
}

function renderSubnets(r) {
  const select = $('childPrefix'), previous = Number(select.value);

  select.replaceChildren();

  for (let p = r.p; p <= 32; p++) { 
    const option = document.createElement('option'); 
    option.value = p; 
    option.textContent = '/' + p; 
    select.append(option); 
  }

  select.value = previous >= r.p && previous <= 32 ? previous : Math.min(r.p + 2, 32);

  const child = Number(select.value), count = 2 ** (child - r.p), shown = Math.min(count, 64), size = 2 ** (32 - child);

  setText('subnetSummary', `/${r.p} ağı, /${child} kullanılarak ${fmt(count)} eşit alt ağa ayrılır. İlk ${shown} alt ağ gösteriliyor.`);

  const fragment = document.createDocumentFragment();

  for (let i = 0; i < shown; i++) {
    const net = (r.net + i * size) >>> 0, c = calc(net, child), tr = document.createElement('tr');
    [i + 1, dotted(c.net) + '/' + child, dotted(c.first), dotted(c.last), child >= 31 ? '—' : dotted(c.broadcast)].forEach(v => { 
      const td = document.createElement('td'); 
      td.textContent = v; 
      tr.append(td); }); 
      fragment.append(tr);
  }

  $('subnetRows').replaceChildren(fragment);

  setText('limitNote', count > 64 ? 'Performans için yalnızca ilk 64 alt ağ gösterilir.' : '');
}

$('ip').addEventListener('input', update);

$('prefix').addEventListener('input', e => { 
  $('prefixNumber').value = e.target.value; 
  update(); 
});

$('prefixNumber').addEventListener('input', update);

$('childPrefix').addEventListener('change', () => { 
  try { 
    renderSubnets(calc(parseIPv4($('ip').value), Number($('prefixNumber').value))); 
  } catch { } 
});

document
  .querySelectorAll('[data-ip]')
  .forEach(btn => btn.addEventListener('click', () => { 
    $('ip').value = btn.dataset.ip; 
    $('prefixNumber').value = btn.dataset.prefix; 
    update(); 
  }));

update();
