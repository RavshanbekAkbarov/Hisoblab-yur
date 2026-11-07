// Hisoblab yur — eslatma serveri (Cloudflare Worker)
// 1) www papkasidagi saytni tarqatadi (buni Cloudflare o'zi qiladi)
// 2) /api/... orqali obunalarni saqlaydi
// 3) Har 5 daqiqada vaqti kelgan telefonlarga eslatma signalini yuboradi
//
// Saqlash (KV) tuzilishi:
//   sub:<id>             → { endpoint, slots: ["0400", ...] }   (slot = UTC vaqt, HHMM)
//   slot:<HHMM>:<id>     → "1"   (shu vaqtda kimga yuborishni tez topish uchun)

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === '/api/key') return json({ key: vapidKeys(env).publicKey });
      if (pathname === '/api/subscribe' && request.method === 'POST') return await subscribe(await request.json(), env);
      if (pathname === '/api/unsubscribe' && request.method === 'POST') return await unsubscribe(await request.json(), env);
    } catch (err) {
      return json({ error: "noto'g'ri so'rov" }, 400);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDue(new Date(event.scheduledTime), env));
  }
};

// ===== Obuna =====
async function subscribe(body, env) {
  const { subscription, times, tz } = body || {};
  const valid = typeof subscription?.endpoint === 'string' && subscription.endpoint.startsWith('https://')
    && Array.isArray(times) && times.length <= 3 && times.every((t) => /^\d{2}:\d{2}$/.test(t))
    && Number.isInteger(tz) && Math.abs(tz) <= 840;
  if (!valid) return json({ error: "noto'g'ri ma'lumot" }, 400);

  const id = await hashId(subscription.endpoint);
  await removeSub(id, env); // eski vaqtlarni o'chiramiz
  const slots = [...new Set(times.map((t) => toUtcSlot(t, tz)))];
  await env.SUBS.put('sub:' + id, JSON.stringify({ endpoint: subscription.endpoint, slots }));
  await Promise.all(slots.map((s) => env.SUBS.put(`slot:${s}:${id}`, '1')));
  return json({ ok: true, slots });
}

async function unsubscribe(body, env) {
  if (typeof body?.endpoint !== 'string') return json({ error: "noto'g'ri ma'lumot" }, 400);
  await removeSub(await hashId(body.endpoint), env);
  return json({ ok: true });
}

async function removeSub(id, env) {
  const old = await env.SUBS.get('sub:' + id, 'json');
  if (!old) return;
  await Promise.all([
    ...old.slots.map((s) => env.SUBS.delete(`slot:${s}:${id}`)),
    env.SUBS.delete('sub:' + id)
  ]);
}

// Mahalliy vaqt ("09:00") + vaqt mintaqasi → UTC slot ("0400"), 5 daqiqaga yaxlitlangan
function toUtcSlot(time, tz) {
  const [h, m] = time.split(':').map(Number);
  let min = (((h * 60 + m + tz) % 1440) + 1440) % 1440; // tz = getTimezoneOffset() (Toshkent: -300)
  min -= min % 5;
  return pad(Math.floor(min / 60)) + pad(min % 60);
}

// ===== Eslatma yuborish (har 5 daqiqada) =====
async function sendDue(now, env) {
  let min = now.getUTCHours() * 60 + now.getUTCMinutes();
  min -= min % 5;
  const slot = pad(Math.floor(min / 60)) + pad(min % 60);
  const vapid = vapidKeys(env);
  const key = await crypto.subtle.importKey('jwk', vapid.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);

  let cursor;
  do {
    const page = await env.SUBS.list({ prefix: `slot:${slot}:`, cursor });
    for (const { name } of page.keys) {
      const id = name.split(':')[2];
      const sub = await env.SUBS.get('sub:' + id, 'json');
      if (!sub || !sub.slots.includes(slot)) {
        await env.SUBS.delete(name); // eskirgan yozuv
        continue;
      }
      const res = await sendPush(sub.endpoint, vapid.publicKey, key, env.VAPID_SUBJECT);
      if (res.status === 404 || res.status === 410) await removeSub(id, env); // telefon obunani bekor qilgan
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
}

// Bo'sh (matnsiz) push: telefon faqat "vaqt bo'ldi" signalini oladi,
// gapni service worker o'zi tanlaydi. Shuning uchun shifrlash shart emas, faqat VAPID imzo.
async function sendPush(endpoint, publicKey, privateKey, subject) {
  const enc = (obj) => b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject
  });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(unsigned));
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${unsigned}.${b64url(sig)}, k=${publicKey}`,
      TTL: '3600',
      Urgency: 'high'
    }
  });
}

// ===== Yordamchilar =====
// VAPID kalit GitHub Actions tomonidan bir marta yaratilib, VAPID_JWK maxfiy o'zgaruvchisiga qo'yiladi
function vapidKeys(env) {
  const jwk = JSON.parse(env.VAPID_JWK);
  const raw = new Uint8Array([4, ...fromB64url(jwk.x), ...fromB64url(jwk.y)]);
  return { jwk, publicKey: b64url(raw) };
}

async function hashId(text) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const pad = (n) => String(n).padStart(2, '0');
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
