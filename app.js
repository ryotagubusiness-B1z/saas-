const STORE_KEY = 'bizops_state_v1';

const seedState = {
  customers: [
    { name: 'サンプル顧客 A', plan: 'Pro', monthly: 120000, status: '継続中', owner: '田中', nextAction: '月次レビュー' },
    { name: 'サンプル顧客 B', plan: 'Standard', monthly: 48000, status: '確認中', owner: '佐藤', nextAction: '請求先確認' },
    { name: 'サンプル顧客 C', plan: 'Enterprise', monthly: 260000, status: '継続中', owner: '鈴木', nextAction: '追加ID提案' },
    { name: 'サンプル顧客 D', plan: 'Starter', monthly: 18000, status: '要対応', owner: '山本', nextAction: '利用状況確認' },
  ],
  reservations: [
    { id: 'BKG-101', time: '10:30', title: 'オンライン商談', type: '新規相談', owner: '田中', status: '未確認' },
    { id: 'BKG-102', time: '14:00', title: '導入サポート', type: '既存顧客', owner: '佐藤', status: '確認済み' },
  ],
  monthly: [42, 54, 50, 62, 78, 88],
};

const $ = (selector) => document.querySelector(selector);

const yen = (value) => `¥${Number(value).toLocaleString('ja-JP')}`;

const html = (value) =>
  String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));

function readStore() {
  return JSON.parse(localStorage.getItem(STORE_KEY) || JSON.stringify(seedState));
}

function writeStore(nextState) {
  localStorage.setItem(STORE_KEY, JSON.stringify(nextState));
}

let state = readStore();

function visibleCustomers() {
  const term = $('#search').value.trim().toLowerCase();
  const status = $('#statusFilter').value;

  return state.customers.filter((customer) => {
    const haystack = `${customer.name} ${customer.plan} ${customer.status} ${customer.owner} ${customer.nextAction}`.toLowerCase();
    const matchesText = !term || haystack.includes(term);
    return matchesText && (status === 'all' || customer.status === status);
  });
}

function renderMetrics() {
  const active = state.customers.filter((customer) => customer.status === '継続中');
  const revenue = active.reduce((sum, customer) => sum + Number(customer.monthly || 0), 0);

  $('#revenue').textContent = yen(revenue);
  $('#customersMetric').textContent = active.length;
  $('#bookingsMetric').textContent = state.reservations.length;
  $('#riskMetric').textContent = state.customers.filter((customer) => customer.status === '要対応').length;
}

function renderChart() {
  const labels = ['1月', '2月', '3月', '4月', '5月', '6月'];

  $('#chart').innerHTML = state.monthly.map((height, index) =>
    `<div class="bar" data-label="${labels[index]}" style="height:${height}%"></div>`
  ).join('');
}

function syncCustomerStatus(select) {
  const row = visibleCustomers()[Number(select.dataset.customerStatus)];
  const target = state.customers.find((customer) => customer.name === row.name && customer.owner === row.owner);

  target.status = select.value;
  writeStore(state);
  renderAll();
}

function renderCustomers() {
  const rows = visibleCustomers();

  if (!rows.length) {
    $('#customerRows').innerHTML = '<tr><td colspan="6" class="empty">条件に合う顧客がありません。</td></tr>';
    return;
  }

  $('#customerRows').innerHTML = rows.map((customer, index) => `
    <tr>
      <td>${html(customer.name)}</td>
      <td>${html(customer.plan)}</td>
      <td>${yen(customer.monthly)}</td>
      <td>
        <select data-customer-status="${index}">
          <option ${customer.status === '継続中' ? 'selected' : ''}>継続中</option>
          <option ${customer.status === '確認中' ? 'selected' : ''}>確認中</option>
          <option ${customer.status === '要対応' ? 'selected' : ''}>要対応</option>
        </select>
      </td>
      <td>${html(customer.owner)}</td>
      <td>${html(customer.nextAction)}</td>
    </tr>
  `).join('');

  document.querySelectorAll('[data-customer-status]').forEach((select) => {
    select.addEventListener('change', () => syncCustomerStatus(select));
  });
}

function bookingRows() {
  const term = $('#search').value.trim().toLowerCase();

  return state.reservations.filter((booking) => {
    const text = `${booking.title} ${booking.type} ${booking.owner} ${booking.status}`.toLowerCase();
    return !term || text.includes(term);
  });
}

function toggleBooking(id) {
  const booking = state.reservations.find((row) => row.id === id);
  booking.status = booking.status === '確認済み' ? '未確認' : '確認済み';

  writeStore(state);
  renderAll();
}

function renderReservations() {
  const rows = bookingRows();

  if (!rows.length) {
    $('#reservationList').innerHTML = '<p class="empty">予約はありません。</p>';
    return;
  }

  $('#reservationList').innerHTML = rows.map((booking) => {
    const done = booking.status === '確認済み';
    return `
      <article class="reservation-card ${done ? 'done' : ''}">
        <strong>${html(booking.time)} ${html(booking.title)}</strong>
        <span>担当: ${html(booking.owner)} / 種別: ${html(booking.type)} / 状態: ${html(booking.status)}</span>
        <button class="btn ${done ? '' : 'primary'}" data-booking="${booking.id}">${done ? '未確認に戻す' : '確認済みにする'}</button>
      </article>
    `;
  }).join('');

  document.querySelectorAll('[data-booking]').forEach((button) => {
    button.addEventListener('click', () => toggleBooking(button.dataset.booking));
  });
}

function renderAll() {
  renderMetrics();
  renderChart();
  renderCustomers();
  renderReservations();
}

function downloadCustomers() {
  const headers = ['name', 'plan', 'monthly', 'status', 'owner', 'nextAction'];
  const rows = state.customers.map((customer) =>
    headers.map((key) => `"${String(customer[key] ?? '').replaceAll('"', '""')}"`).join(',')
  );

  const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'customers.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function bindTabs() {
  document.querySelectorAll('.side-nav button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.side-nav button').forEach((item) => item.setAttribute('aria-selected', 'false'));
      button.setAttribute('aria-selected', 'true');
      $('#pageTitle').textContent = button.textContent;
    });
  });
}

function addCustomer(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  state.customers.unshift({ ...data, monthly: Number(data.monthly) });

  writeStore(state);
  form.reset();
  renderAll();
}

function addBooking(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));

  state.reservations.unshift({
    id: `BKG-${Date.now().toString().slice(-5)}`,
    ...data,
    status: '未確認',
  });

  writeStore(state);
  form.reset();
  renderAll();
}

function shuffleChart() {
  state.monthly = state.monthly.map((value) =>
    Math.max(35, Math.min(95, value + Math.round((Math.random() * 18) - 6)))
  );

  writeStore(state);
  renderAll();
}

function resetDemo() {
  if (!confirm('デモデータを初期状態に戻しますか？')) return;

  state = structuredClone(seedState);
  writeStore(state);
  renderAll();
}

document.addEventListener('DOMContentLoaded', () => {
  renderAll();
  bindTabs();

  $('#search').addEventListener('input', renderAll);
  $('#statusFilter').addEventListener('change', renderAll);
  $('#customerForm').addEventListener('submit', addCustomer);
  $('#bookingForm').addEventListener('submit', addBooking);
  $('#toggleChart').addEventListener('click', shuffleChart);
  $('#refreshBtn').addEventListener('click', renderAll);
  $('#exportCsv').addEventListener('click', downloadCustomers);
  $('#resetDemo').addEventListener('click', resetDemo);
});
