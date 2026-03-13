const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify({ records: [] }, null, 2), 'utf8');
  }
}

function loadDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.records || !Array.isArray(parsed.records)) {
      return { records: [] };
    }
    return parsed;
  } catch (error) {
    return { records: [] };
  }
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

function cleanSpaces(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function replaceLookalikesToLatin(value = '') {
  const map = {
    'А': 'A', 'а': 'a',
    'В': 'B', 'в': 'b',
    'С': 'C', 'с': 'c',
    'Е': 'E', 'е': 'e',
    'Н': 'H', 'н': 'h',
    'К': 'K', 'к': 'k',
    'М': 'M', 'м': 'm',
    'О': 'O', 'о': 'o',
    'Р': 'P', 'р': 'p',
    'Т': 'T', 'т': 't',
    'Х': 'X', 'х': 'x'
  };
  return String(value).split('').map(ch => map[ch] || ch).join('');
}

function normalizeClientName(value = '') {
  const cleaned = cleanSpaces(value);
  const unified = replaceLookalikesToLatin(cleaned);
  return unified.toLowerCase();
}

function displayClientName(value = '') {
  return cleanSpaces(value);
}

const allowedGrades = ['B/B', 'B/BB', 'S/BB', 'B/CP', 'B/C', 'BB/BB', 'BB/CP', 'BB/C', 'CP/CP', 'CP/C', 'C/C'];

function normalizeGrade(value = '') {
  let v = cleanSpaces(value);
  v = replaceLookalikesToLatin(v).toUpperCase();
  v = v.replace(/\s+/g, '');
  v = v.replace(/[|\\]+/g, '/');
  v = v.replace(/-/g, '/');

  const match = v.match(/^([A-Z]+)\/([A-Z]+)$/);
  if (!match) return '';

  const candidate = `${match[1]}/${match[2]}`;
  return allowedGrades.includes(candidate) ? candidate : '';
}

const sizeAliases = {
  '1525x1525': '1525×1525',
  '1500x1500': '1500×1500',
  '5x5': '5×5'
};

function normalizeSize(value = '') {
  let v = cleanSpaces(value).toLowerCase();
  v = v.replace(/\s+/g, '');
  v = v.replace(/[×х*]/g, 'x');

  const match = v.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
  if (!match) return '';

  let a = match[1];
  let b = match[2];

  const numA = Number(a);
  const numB = Number(b);
  if (!Number.isFinite(numA) || !Number.isFinite(numB) || numA <= 0 || numB <= 0) {
    return '';
  }

  const ordered = [numA, numB].sort((x, y) => x - y);
  const key = `${ordered[0]}x${ordered[1]}`;

  if (sizeAliases[key]) {
    return sizeAliases[key];
  }

  return `${ordered[0]}×${ordered[1]}`;
}

function normalizeDate(value = '') {
  const cleaned = cleanSpaces(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return '';
  const date = new Date(`${cleaned}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return cleaned;
}

function normalizePrice(value) {
  if (value === null || value === undefined) return null;
  const stringValue = cleanSpaces(String(value)).replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(stringValue)) return null;
  const num = Number(stringValue);
  if (!Number.isFinite(num) || num < 0) return null;
  return Number(num.toFixed(2));
}

function validateRecord(input) {
  const client = displayClientName(input.client);
  const clientNorm = normalizeClientName(input.client);
  const date = normalizeDate(input.date);
  const size = normalizeSize(input.size);
  const grade = normalizeGrade(input.grade);
  const price = normalizePrice(input.price);
  const comment = cleanSpaces(input.comment || '');
  const currency = cleanSpaces(input.currency || 'RUB').toUpperCase();
  const manager = cleanSpaces(input.manager || '');

  const errors = [];
  if (!client) errors.push('Укажите клиента.');
  if (!clientNorm) errors.push('Имя клиента введено некорректно.');
  if (!date) errors.push('Укажите корректную дату в формате ГГГГ-ММ-ДД.');
  if (!size) errors.push('Укажите корректный размер. Например: 1525x1525 или 2500x1250.');
  if (!grade) errors.push('Укажите корректный сорт. Например: B/BB, BB/CP, CP/C.');
  if (price === null) errors.push('Цена должна быть числом. Например: 12500 или 12500.50.');

  return {
    errors,
    record: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      client,
      clientNormalized: clientNorm,
      date,
      size,
      sizeNormalized: size,
      grade,
      gradeNormalized: grade,
      price,
      comment,
      currency,
      manager,
      createdAt: new Date().toISOString()
    }
  };
}

function applyFilters(records, query) {
  const clientNorm = normalizeClientName(query.client || '');
  const gradeNorm = normalizeGrade(query.grade || '');
  const sizeNorm = normalizeSize(query.size || '');
  const dateFrom = normalizeDate(query.dateFrom || '');
  const dateTo = normalizeDate(query.dateTo || '');

  return records.filter(record => {
    if (clientNorm && record.clientNormalized !== clientNorm) return false;
    if (gradeNorm && record.gradeNormalized !== gradeNorm) return false;
    if (sizeNorm && record.sizeNormalized !== sizeNorm) return false;
    if (dateFrom && record.date < dateFrom) return false;
    if (dateTo && record.date > dateTo) return false;
    return true;
  });
}

app.get('/api/clients', (req, res) => {
  const db = loadDb();
  const clientsMap = new Map();

  for (const record of db.records) {
    if (!clientsMap.has(record.clientNormalized)) {
      clientsMap.set(record.clientNormalized, record.client);
    }
  }

  const clients = Array.from(clientsMap.values()).sort((a, b) => a.localeCompare(b, 'ru'));
  res.json({ clients });
});

app.get('/api/history', (req, res) => {
  const db = loadDb();
  const records = applyFilters(db.records, req.query)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  res.json({ records });
});

app.post('/api/records', (req, res) => {
  const db = loadDb();
  const { errors, record } = validateRecord(req.body || {});

  if (errors.length) {
    return res.status(400).json({ errors });
  }

  db.records.push(record);
  saveDb(db);
  return res.status(201).json({ message: 'Запись успешно сохранена.', record });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Sveza app started: http://localhost:${PORT}`);
});
