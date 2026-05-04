const api = {
  files: '/.netlify/functions/files',
  upload: '/.netlify/functions/upload',
  download: '/.netlify/functions/download',
  delete: '/.netlify/functions/delete'
};

const message = document.getElementById('message');
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const fileRows = document.getElementById('fileRows');
const emptyState = document.getElementById('emptyState');
const tableWrap = document.getElementById('tableWrap');
const logoutBtn = document.getElementById('logoutBtn');
const pageGate = document.getElementById('pageGate');

function setMessage(text, type = 'success') {
  message.textContent = text;
  message.className = `alert ${type}`;
  message.hidden = false;
}

function getAuthHeader() {
  const storedUser = localStorage.getItem('hrdDriveUser') || '';
  const storedPass = localStorage.getItem('hrdDrivePass') || '';

  if (!storedUser) {
    return {};
  }

  return {
    Authorization: `Basic ${btoa(`${storedUser}:${storedPass}`)}`
  };
}

function requireLogin() {
  const user = localStorage.getItem('hrdDriveUser') || '';
  const pass = localStorage.getItem('hrdDrivePass') || '';

  if (!user || !pass) {
    window.location.replace('/');
    return false;
  }

  return true;
}

async function request(url, options = {}) {
  const headers = {
    ...(options.headers || {}),
    ...getAuthHeader()
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    throw new Error('Autentikasi diperlukan. Login ulang dari halaman awal.');
  }

  return response;
}

async function parseApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const text = await response.text();
  return text ? { message: text } : {};
}

async function requestJson(url, options = {}) {
  const response = await request(url, options);
  const payload = await parseApiResponse(response);

  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Request failed (${response.status})`);
  }

  return payload;
}

function formatSize(bytes) {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderRows(objects) {
  fileRows.innerHTML = '';

  if (!objects.length) {
    tableWrap.hidden = true;
    emptyState.hidden = false;
    emptyState.textContent = 'Belum ada file di bucket ini.';
    return;
  }

  emptyState.hidden = true;
  tableWrap.hidden = false;

  for (const file of objects) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="file-name">${escapeHtml(file.displayName)}</div>
        <div class="file-path">${escapeHtml(file.name)}</div>
      </td>
      <td>${formatSize(file.size)}</td>
      <td>${new Date(file.lastModified).toLocaleString('id-ID')}</td>
      <td class="actions">
        <a class="button secondary" href="${api.download}?name=${encodeURIComponent(file.name)}">Unduh</a>
        <button class="button danger" type="button" data-delete="${file.name}">Hapus</button>
      </td>
    `;
    fileRows.appendChild(tr);
  }

  fileRows.querySelectorAll('[data-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      const name = button.getAttribute('data-delete');
      if (!confirm('Hapus file ini?')) {
        return;
      }

      try {
        const data = await requestJson(`${api.delete}?name=${encodeURIComponent(name)}`, {
          method: 'DELETE'
        });
        setMessage(data.message || 'File berhasil dihapus.', 'success');
        await loadFiles();
      } catch (error) {
        setMessage(error.message, 'error');
      }
    });
  });
}

async function loadFiles() {
  try {
    const data = await requestJson(api.files);
    renderRows(data.objects || []);
  } catch (error) {
    emptyState.hidden = false;
    tableWrap.hidden = true;
    emptyState.textContent = error.message;
  }
}

uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!fileInput.files || fileInput.files.length === 0) {
    setMessage('Pilih minimal satu file.', 'error');
    return;
  }

  const formData = new FormData();
  Array.from(fileInput.files).forEach((file) => {
    formData.append('files', file);
  });

  try {
    const data = await requestJson(api.upload, {
      method: 'POST',
      body: formData
    });
    setMessage(data.message || 'Upload berhasil.', 'success');
    fileInput.value = '';
    await loadFiles();
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('hrdDriveUser');
  localStorage.removeItem('hrdDrivePass');
  window.location.replace('/');
});

if (requireLogin()) {
  pageGate.style.visibility = 'visible';
  loadFiles();
}
