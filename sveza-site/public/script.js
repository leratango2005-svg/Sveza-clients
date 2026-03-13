const clientsList = document.getElementById('clientsList');
const clientInput = document.getElementById('clientInput');
const gradeFilter = document.getElementById('gradeFilter');
const sizeFilter = document.getElementById('sizeFilter');
const dateFrom = document.getElementById('dateFrom');
const dateTo = document.getElementById('dateTo');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const historyTableBody = document.getElementById('historyTableBody');
const recordForm = document.getElementById('recordForm');
const messageBox = document.getElementById('message');
const summaryBox = document.getElementById('summaryBox');

function setMessage(text = '', type = '') {
  messageBox.textContent = text;
  messageBox.className = 'message';
  if (type) {
    messageBox.classList.add(`message--${type}`);
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadClients() {
  try {
    const response = await fetch('/api/clients');
    const data = await response.json();
    clientsList.innerHTML = data.clients
      .map(client => `<option value="${escapeHtml(client)}"></option>`)
      .join('');
  } catch (error) {
    setMessage('Не удалось загрузить список клиентов.', 'error');
  }
}

function buildQuery() {
  const params = new URLSearchParams();
  if (clientInput.value.trim()) params.set('client', clientInput.value.trim());
  if (gradeFilter.value.trim()) params.set('grade', gradeFilter.value.trim());
  if (sizeFilter.value.trim()) params.set('size', sizeFilter.value.trim());
  if (dateFrom.value) params.set('dateFrom', dateFrom.value);
  if (dateTo.value) params.set('dateTo', dateTo.value);
  return params.toString();
}

function renderTable(records) {
  summaryBox.textContent = `Записей: ${records.length}`;

  if (!records.length) {
    historyTableBody.innerHTML = '<tr><td colspan="8" class="empty">По вашему запросу записи не найдены.</td></tr>';
    return;
  }

  historyTableBody.innerHTML = records.map(record => `
    <tr>
      <td>${escapeHtml(record.client)}</td>
      <td>${escapeHtml(record.date)}</td>
      <td>${escapeHtml(record.size)}</td>
      <td>${escapeHtml(record.grade)}</td>
      <td>${escapeHtml(record.price)}</td>
      <td>${escapeHtml(record.currency || '')}</td>
      <td>${escapeHtml(record.manager || '')}</td>
      <td>${escapeHtml(record.comment || '')}</td>
    </tr>
  `).join('');
}

async function loadHistory() {
  try {
    setMessage('');
    historyTableBody.innerHTML = '<tr><td colspan="8" class="empty">Загрузка данных...</td></tr>';
    const query = buildQuery();
    const response = await fetch(`/api/history${query ? `?${query}` : ''}`);
    const data = await response.json();
    renderTable(data.records || []);
  } catch (error) {
    historyTableBody.innerHTML = '<tr><td colspan="8" class="empty">Ошибка загрузки.</td></tr>';
    setMessage('Не удалось загрузить историю цен.', 'error');
  }
}

applyFiltersBtn.addEventListener('click', loadHistory);

resetFiltersBtn.addEventListener('click', () => {
  clientInput.value = '';
  gradeFilter.value = '';
  sizeFilter.value = '';
  dateFrom.value = '';
  dateTo.value = '';
  setMessage('Фильтры сброшены.', 'ok');
  loadHistory();
});

recordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');

  const formData = new FormData(recordForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const errorText = Array.isArray(data.errors) ? data.errors.join(' ') : 'Не удалось сохранить запись.';
      setMessage(errorText, 'error');
      return;
    }

    setMessage(data.message || 'Запись сохранена.', 'ok');
    recordForm.reset();
    await loadClients();
    await loadHistory();
  } catch (error) {
    setMessage('Ошибка соединения с сервером. Проверьте, запущен ли backend.', 'error');
  }
});

loadClients();
loadHistory();
