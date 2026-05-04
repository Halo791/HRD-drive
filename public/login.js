const authUser = document.getElementById('authUser');
const authPass = document.getElementById('authPass');
const loginForm = document.getElementById('loginForm');
const message = document.getElementById('message');
const loginGate = document.getElementById('loginGate');

function setMessage(text, type = 'success') {
  message.textContent = text;
  message.className = `alert ${type}`;
  message.hidden = false;
}

function getStoredCredentials() {
  return {
    user: localStorage.getItem('hrdDriveUser') || '',
    pass: localStorage.getItem('hrdDrivePass') || ''
  };
}

function saveCredentials(user, pass) {
  localStorage.setItem('hrdDriveUser', user);
  localStorage.setItem('hrdDrivePass', pass);
}

const stored = getStoredCredentials();
authUser.value = stored.user;
authPass.value = stored.pass;

if (stored.user && stored.pass) {
  window.location.replace('/upload.html');
} else {
  loginGate.style.visibility = 'visible';
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const user = authUser.value.trim();
  const pass = authPass.value;

  if (!user || !pass) {
    setMessage('Username dan password wajib diisi.', 'error');
    return;
  }

  saveCredentials(user, pass);
  loginGate.setAttribute('aria-busy', 'true');
  window.location.replace('/upload.html');
});
