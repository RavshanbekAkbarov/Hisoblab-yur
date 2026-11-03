// ===== Sozlamalar =====
const KEY = 'hisob-v1';
const EXPENSE_CATS = [
  { name: 'Oziq-ovqat', icon: '🍞', color: '#2563eb' },
  { name: 'Transport', icon: '🚌', color: '#f97316' },
  { name: 'Uy', icon: '🏠', color: '#16a34a' },
  { name: 'Salomatlik', icon: '💊', color: '#0ea5e9' },
  { name: "O'qish", icon: '📚', color: '#8b5cf6' },
  { name: 'Oila', icon: '👨‍👩‍👧', color: '#ec4899' },
  { name: 'Obunalar', icon: '🔁', color: '#6366f1' },
  { name: 'Xaridlar', icon: '🛍️', color: '#d946ef' },
  { name: 'Dam olish', icon: '🎉', color: '#eab308' },
  { name: "Sovg'alar", icon: '🎁', color: '#f43f5e' },
  { name: 'Sayohat', icon: '✈️', color: '#14b8a6' },
  { name: 'Telefon/Internet', icon: '📱', color: '#64748b' },
  { name: 'Bank xizmati', icon: '🏦', color: '#a16207' },
  { name: 'Qarz', icon: '💳', color: '#dc2626' },
  { name: 'Ichimliklar', icon: '🥤', color: '#84cc16' },
  { name: 'Boshqa', icon: '📦', color: '#94a3b8' }
];
const INCOME_CATS = [
  { name: 'Maosh', icon: '💼', color: '#16a34a' },
  { name: 'Repetitorlik', icon: '🧑‍🏫', color: '#0d9488' },
  { name: 'Boshqa', icon: '💰', color: '#65a30d' }
];
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const REMIND_TEXTS = [
  "Pullaringiz qayerga ketdi? Ular jim, lekin daftar hammasini biladi 🕵️",
  "Hamyoningizdan xabar keldi: \"Meni ham o'ylab qo'ying!\" 👛",
  "Bitta non ham hisobda! Bugungi xarajatni yozib qo'ying 🍞",
  "Kofe, taksi, shirinlik… Hammasi yozildimi? ☕",
  "Mayda xarajatlar jimgina yig'ilib, katta raqamga aylanadi 📊",
  "Millioner bo'lish yozishdan boshlanadi. 30 soniya ajrating 💸",
  "Moliyaviy erkinlik bugungi bitta yozuvdan boshlanadi 🚀",
  "Qoldiq qancha? Bilish uchun ilovani oching 👀",
  "Bugun nimaga pul sarfladingiz? Esdan chiqmasidan yozing ✍️",
  "Pulni sanagan odam pulsiz qolmaydi. Hisobni yuriting 🧮"
];
const DAYS_AHEAD = 30; // necha kunga oldindan eslatma qo'yiladi
const MAX_MESSAGES = 12; // eslatma gaplari soni chegarasi

// ===== Ma'lumot (telefon xotirasida) =====
let data = load();

function load() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(KEY));
  } catch (e) { /* buzilgan bo'lsa, yangidan boshlaymiz */ }
  const d = saved || { items: [], debts: [], reminders: ['09:00', '14:00', '21:00'], currency: "so'm" };
  if (!d.messages) d.messages = [...REMIND_TEXTS]; // boshida standart gaplar
  return d;
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(data));
}

// ===== Yordamchilar =====
const $ = (s) => document.querySelector(s);
const sum = (list) => list.reduce((s, x) => s + x.amount, 0);

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // mahalliy vaqt
  return d.toISOString().slice(0, 10);
}

function money(n) {
  const [whole, frac] = (Math.round(n * 100) / 100).toString().split('.');
  const spaced = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return spaced + (frac ? '.' + frac : '') + ' ' + data.currency;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.style.display = 'block';
  setTimeout(() => (t.style.display = 'none'), 1800);
}

function catInfo(item) {
  const list = item.type === 'income' ? INCOME_CATS : EXPENSE_CATS;
  return list.find((c) => c.name === item.category) || { icon: '📦', color: '#94a3b8' };
}

function monthItems() {
  return data.items
    .filter((i) => i.date.startsWith($('#month').value))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

// Bitta yozuv qatori (asosiy va tarixda ishlatiladi)
function itemRow(i, withDelete) {
  const c = catInfo(i);
  const sign = i.type === 'income' ? '+' : '−';
  return `<li>
    <span class="icon" style="background:${c.color}22">${c.icon}</span>
    <span class="grow">${i.category}<small>${i.note ? escapeHtml(i.note) : i.date}</small></span>
    <b class="${i.type === 'income' ? 'plus' : 'minus'}">${sign}${money(i.amount)}</b>
    ${withDelete ? `<button class="del" onclick="removeItem(${i.id})">✕</button>` : ''}
  </li>`;
}

// ===== Asosiy sahifa =====
function renderHome() {
  const items = monthItems();
  const income = sum(items.filter((i) => i.type === 'income'));
  const expense = sum(items.filter((i) => i.type === 'expense'));
  $('#sumIncome').textContent = money(income);
  $('#sumExpense').textContent = money(expense);
  $('#sumLeft').textContent = money(income - expense);

  // Kategoriya bo'yicha yig'indi
  const byCat = EXPENSE_CATS
    .map((c) => ({ ...c, sum: sum(items.filter((i) => i.type === 'expense' && i.category === c.name)) }))
    .filter((c) => c.sum > 0)
    .sort((a, b) => b.sum - a.sum);

  drawChart(byCat, expense);
  $('#catList').innerHTML = byCat.map((c) => {
    const pct = Math.round((c.sum / expense) * 100);
    return `<li>
      <div class="line"><span>${c.icon} ${c.name}</span><b>${money(c.sum)} · ${pct}%</b></div>
      <div class="bar"><i style="width:${pct}%;background:${c.color}"></i></div>
    </li>`;
  }).join('');

  $('#recentList').innerHTML = items.length
    ? items.slice(0, 5).map((i) => itemRow(i, false)).join('')
    : '<li class="empty">Hali yozuv yo\'q. Pastdagi + tugmasini bosing</li>';
}

function drawChart(cats, total) {
  const canvas = $('#chart');
  const size = 220;
  const dpr = window.devicePixelRatio || 1; // telefonda tiniq chiqishi uchun
  canvas.width = canvas.height = size * dpr;
  canvas.style.width = canvas.style.height = size + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const mid = size / 2;
  ctx.lineWidth = 26;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#f0f2f5';
  ctx.beginPath(); ctx.arc(mid, mid, 90, 0, Math.PI * 2); ctx.stroke();

  let start = -Math.PI / 2;
  for (const c of cats) {
    const angle = (c.sum / total) * Math.PI * 2;
    ctx.strokeStyle = c.color;
    ctx.beginPath(); ctx.arc(mid, mid, 90, start, start + angle - 0.02); ctx.stroke();
    start += angle;
  }

  // O'rtadagi yozuv
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7a8494';
  ctx.font = '13px system-ui';
  ctx.fillText('Jami xarajat', mid, mid - 8);
  ctx.fillStyle = '#1c2430';
  ctx.font = 'bold 18px system-ui';
  ctx.fillText(money(total), mid, mid + 16);
}

// ===== Qo'shish =====
const currentType = () => document.querySelector('input[name=type]:checked').value;

function fillCategories() {
  const cats = currentType() === 'income' ? INCOME_CATS : EXPENSE_CATS;
  $('#category').innerHTML = cats.map((c, i) => `
    <label class="chip">
      <input type="radio" name="category" value="${c.name}" ${i === 0 ? 'checked' : ''}>
      <span><i>${c.icon}</i>${c.name}</span>
    </label>`).join('');
}

$('#addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  data.items.push({
    id: Date.now(),
    type: currentType(),
    amount: Number($('#amount').value),
    category: document.querySelector('input[name=category]:checked').value,
    note: $('#note').value.trim(),
    date: $('#date').value
  });
  save();
  e.target.reset();
  fillCategories();
  $('#date').value = today();
  render();
  openTab('home');
  toast('Saqlandi ✓');
});

document.querySelectorAll('input[name=type]').forEach((r) => r.addEventListener('change', fillCategories));

// ===== Tarix (kunlarga bo'lingan) =====
function dayTitle(dateStr) {
  const d = new Date(dateStr + 'T00:00');
  return `${d.getDate()}-${MONTHS[d.getMonth()].toLowerCase()}, ${WEEKDAYS[d.getDay()]}`;
}

function renderHistory() {
  const [y, m] = $('#month').value.split('-');
  $('#historyMonth').textContent = `${MONTHS[m - 1]} ${y}`;

  const items = monthItems();
  if (!items.length) {
    $('#historyList').innerHTML = '<div class="box empty">Bu oyda yozuv yo\'q</div>';
    return;
  }
  const days = [...new Set(items.map((i) => i.date))];
  $('#historyList').innerHTML = days.map((day) => `
    <p class="day">${dayTitle(day)}</p>
    <div class="box"><ul class="list">
      ${items.filter((i) => i.date === day).map((i) => itemRow(i, true)).join('')}
    </ul></div>`).join('');
}

function removeItem(id) {
  if (!confirm("O'chirilsinmi?")) return;
  data.items = data.items.filter((i) => i.id !== id);
  save();
  render();
}

// ===== Qarz =====
function renderDebts() {
  const open = data.debts.filter((d) => !d.done);
  $('#iOwe').textContent = money(sum(open.filter((d) => d.dir === 'me')));
  $('#theyOwe').textContent = money(sum(open.filter((d) => d.dir === 'them')));
  $('#debtList').innerHTML = data.debts.length
    ? data.debts.map((d) => `<li class="${d.done ? 'done' : ''}">
        <input type="checkbox" class="check" ${d.done ? 'checked' : ''} onchange="toggleDebt(${d.id})">
        <span class="grow">${escapeHtml(d.name)}<small>${d.dir === 'me' ? 'Men qarzdorman' : 'Menga qarzdor'}</small></span>
        <b class="${d.dir === 'me' ? 'minus' : 'plus'}">${money(d.amount)}</b>
        <button class="del" onclick="removeDebt(${d.id})">✕</button></li>`).join('')
    : '<li class="empty">Qarz yo\'q 🎉</li>';
}

$('#debtForm').addEventListener('submit', (e) => {
  e.preventDefault();
  data.debts.push({
    id: Date.now(),
    name: $('#debtName').value.trim(),
    amount: Number($('#debtAmount').value),
    dir: document.querySelector('input[name=debtDir]:checked').value,
    done: false
  });
  save();
  e.target.reset();
  renderDebts();
  toast("Qo'shildi ✓");
});

function toggleDebt(id) {
  const d = data.debts.find((x) => x.id === id);
  d.done = !d.done;
  save();
  renderDebts();
}

function removeDebt(id) {
  if (!confirm("O'chirilsinmi?")) return;
  data.debts = data.debts.filter((d) => d.id !== id);
  save();
  renderDebts();
}

// ===== Eslatmalar (faqat APK ichida ishlaydi) =====
const Notify = window.Capacitor?.Plugins?.LocalNotifications;

// Oldingisidan farqli tasodifiy gap tanlaydi
let lastText = -1;
function randomText() {
  const list = data.messages.length ? data.messages : REMIND_TEXTS; // bo'sh bo'lsa standart
  if (list.length === 1) return list[0];
  let i;
  do { i = Math.floor(Math.random() * list.length); } while (i === lastText);
  lastText = i;
  return list[i];
}

function refreshReminders() {
  scheduleReminders().then((text) => ($('#remindStatus').textContent = text));
}

// ===== Eslatma gaplarini boshqarish =====
function renderMessages() {
  const full = data.messages.length >= MAX_MESSAGES;
  $('#msgCount').textContent = `${data.messages.length}/${MAX_MESSAGES}`;
  $('#msgList').innerHTML = data.messages.length
    ? data.messages.map((m, i) => `<li>
        <span class="grow">${escapeHtml(m)}</span>
        <button class="del" onclick="removeMessage(${i})">✕</button></li>`).join('')
    : "<li class=\"empty\">Gap yo'q — standart gaplar ishlatiladi</li>";
  $('#msgInput').disabled = $('#msgAddBtn').disabled = full;
  $('#msgInput').placeholder = full ? "12 ta to'ldi. Avval bittasini o'chiring" : 'Yangi gap yozing';
}

$('#msgForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('#msgInput').value.trim();
  if (!text || data.messages.length >= MAX_MESSAGES) return;
  data.messages.push(text);
  save();
  e.target.reset();
  renderMessages();
  refreshReminders();
  toast("Gap qo'shildi ✓");
});

function removeMessage(i) {
  if (!confirm("Bu gap o'chirilsinmi?")) return;
  data.messages.splice(i, 1);
  save();
  renderMessages();
  refreshReminders();
}

// Har bir eslatmaga alohida tasodifiy gap kerak, shuning uchun
// keyingi 30 kunning har bir vaqtiga alohida eslatma qo'yamiz.
// Ilova har ochilganda ro'yxat yangilanadi.
async function scheduleReminders() {
  if (!Notify) return 'Eslatmalar faqat telefondagi ilovada (APK) ishlaydi.';
  const perm = await Notify.requestPermissions();
  if (perm.display !== 'granted') return 'Bildirishnomaga ruxsat berilmadi.';

  const pending = await Notify.getPending();
  if (pending.notifications.length) {
    await Notify.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }

  const now = new Date();
  const list = [];
  for (let day = 0; day < DAYS_AHEAD; day++) {
    for (const time of data.reminders) {
      const [hour, minute] = time.split(':').map(Number);
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, hour, minute);
      if (at <= now) continue; // bugungi o'tib ketgan vaqtlar
      list.push({
        id: list.length + 1,
        title: 'Hisoblab yur',
        body: randomText(),
        schedule: { at, allowWhileIdle: true }
      });
    }
  }
  await Notify.schedule({ notifications: list });
  return '✅ Har kuni: ' + data.reminders.join(', ');
}

// ===== Sozlamalar =====
function renderSettings() {
  document.querySelectorAll('.remind').forEach((inp, i) => (inp.value = data.reminders[i]));
  $('#currency').value = data.currency;
}

$('#settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  data.reminders = [...document.querySelectorAll('.remind')].map((inp) => inp.value);
  data.currency = $('#currency').value.trim();
  save();
  render();
  $('#remindStatus').textContent = await scheduleReminders();
  toast('Saqlandi ✓');
});

$('#exportBtn').addEventListener('click', async () => {
  $('#backup').value = JSON.stringify(data);
  try {
    await navigator.clipboard.writeText($('#backup').value);
    toast("Nusxa olindi — Telegram'ga joylang");
  } catch (e) {
    $('#backup').select();
    toast('Matnni belgilab, nusxa oling');
  }
});

$('#importBtn').addEventListener('click', () => {
  try {
    const parsed = JSON.parse($('#backup').value);
    if (!Array.isArray(parsed.items)) throw new Error();
    if (!confirm("Hozirgi ma'lumotlar almashtiriladi. Davom etilsinmi?")) return;
    if (!parsed.messages) parsed.messages = [...REMIND_TEXTS];
    data = parsed;
    save();
    renderSettings();
    renderMessages();
    render();
    toast('Tiklandi ✓');
  } catch (e) {
    toast("Nusxa noto'g'ri");
  }
});

// ===== Tablar =====
function openTab(name) {
  document.querySelectorAll('nav button, .tab').forEach((el) => el.classList.remove('active'));
  document.querySelector(`nav button[data-tab=${name}]`).classList.add('active');
  $('#' + name).classList.add('active');
  window.scrollTo(0, 0);
}

document.querySelectorAll('nav button').forEach((btn) =>
  btn.addEventListener('click', () => openTab(btn.dataset.tab))
);

// ===== Boshlash =====
function render() {
  renderHome();
  renderHistory();
  renderDebts();
}

$('#month').value = today().slice(0, 7);
$('#month').addEventListener('change', render);
$('#date').value = today();
fillCategories();
renderSettings();
renderMessages();
render();
refreshReminders();
