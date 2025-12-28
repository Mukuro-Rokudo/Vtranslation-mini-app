// Editor GitHub publishing logic
// Stores PAT in sessionStorage under key 'github_pat'

const OWNER = 'Mukuro-Rokudo';
const REPO = 'Vtranslation-mini-app';
const BRANCH = 'main';
const BOOKS_JSON_PATH = 'books.json';

// UI elements
const patInput = document.getElementById('pat');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const authStatus = document.getElementById('authStatus');
const filePathInput = document.getElementById('filePath');
const fileContentInput = document.getElementById('fileContent');
const publishBtn = document.getElementById('publishBtn');
const publishAndUpdateBooksBtn = document.getElementById('publishAndUpdateBooksBtn');
const bookTitleInput = document.getElementById('bookTitle');
const bookAuthorInput = document.getElementById('bookAuthor');
const resultEl = document.getElementById('result');

function setStatus(msg, isError = false) {
  resultEl.textContent = msg;
  resultEl.className = isError ? 'result error' : 'result muted';
}

function getToken() {
  return sessionStorage.getItem('github_pat') || '';
}

function setToken(token) {
  if (token) {
    sessionStorage.setItem('github_pat', token);
  } else {
    sessionStorage.removeItem('github_pat');
  }
}

async function testToken(token) {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });
  if (!res.ok) return null;
  return res.json();
}

async function onConnect() {
  const token = patInput.value.trim();
  if (!token) {
    setStatus('Please provide a PAT.', true);
    return;
  }
  setStatus('Validating token...');
  try {
    const user = await testToken(token);
    if (!user) {
      setStatus('Invalid token or network error.', true);
      return;
    }
    setToken(token);
    authStatus.textContent = `Connected: ${user.login}`;
    connectBtn.style.display = 'none';
    disconnectBtn.style.display = '';
    patInput.value = '';
    setStatus('Token stored in session. Ready to publish.');
  } catch (err) {
    console.error(err);
    setStatus('Error validating token.', true);
  }
}

function onDisconnect() {
  setToken('');
  authStatus.textContent = 'Not connected';
  connectBtn.style.display = '';
  disconnectBtn.style.display = 'none';
  setStatus('Disconnected and token cleared from session.');
}

async function getFile(path) {
  const token = getToken();
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to get file: ${res.status}`);
  return res.json();
}

async function createOrUpdateFile(path, contentText, message) {
  const token = getToken();
  if (!token) throw new Error('No token available');
  const existing = await getFile(path);
  const contentBase64 = btoa(unescape(encodeURIComponent(contentText)));
  const body = {
    message: message || `Update ${path}`,
    content: contentBase64,
    branch: BRANCH
  };
  if (existing && existing.sha) body.sha = existing.sha;

  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data && data.message ? data.message : `HTTP ${res.status}`;
    throw new Error(`Failed to write file: ${msg}`);
  }
  return data;
}

async function updateBooksJson(entry) {
  // entry: {path, title, author}
  const token = getToken();
  if (!token) throw new Error('No token available');

  const existing = await getFile(BOOKS_JSON_PATH);
  let books = [];
  let sha = null;
  if (existing && existing.content) {
    const raw = atob(existing.content.replace(/\n/g, ''));
    try {
      books = JSON.parse(raw);
      if (!Array.isArray(books)) books = [];
    } catch (e) {
      // if parsing fails, keep as empty array
      books = [];
    }
    sha = existing.sha;
  }

  // find existing by path
  const now = new Date().toISOString();
  const idx = books.findIndex(b => b.path === entry.path);
  const bookObj = {
    path: entry.path,
    title: entry.title || '',
    author: entry.author || '',
    updated: now
  };
  if (idx >= 0) {
    books[idx] = {...books[idx], ...bookObj};
  } else {
    books.push(bookObj);
  }

  const newContent = JSON.stringify(books, null, 2);
  const body = {
    message: `Update ${BOOKS_JSON_PATH} (add/update ${entry.path})`,
    content: btoa(unescape(encodeURIComponent(newContent))),
    branch: BRANCH
  };
  if (sha) body.sha = sha;

  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(BOOKS_JSON_PATH)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data && data.message ? data.message : `HTTP ${res.status}`;
    throw new Error(`Failed to update books.json: ${msg}`);
  }
  return data;
}

// Event handlers
connectBtn.addEventListener('click', onConnect);
disconnectBtn.addEventListener('click', onDisconnect);

publishBtn.addEventListener('click', async () => {
  const path = filePathInput.value.trim();
  const content = fileContentInput.value || '';
  if (!path) {
    setStatus('Please provide a file path to publish.', true);
    return;
  }
  setStatus('Publishing file...');
  try {
    const res = await createOrUpdateFile(path, content, `Publish ${path} from editor`);
    setStatus(`File published: ${res.content.path}`);
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, true);
  }
});

publishAndUpdateBooksBtn.addEventListener('click', async () => {
  const path = filePathInput.value.trim();
  const content = fileContentInput.value || '';
  const title = bookTitleInput.value.trim();
  const author = bookAuthorInput.value.trim();
  if (!path) {
    setStatus('Please provide a file path to publish.', true);
    return;
  }
  setStatus('Publishing file and updating books.json...');
  try {
    const publishRes = await createOrUpdateFile(path, content, `Publish ${path} from editor`);
    await updateBooksJson({path, title, author});
    setStatus(`Published ${publishRes.content.path} and updated books.json`);
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, true);
  }
});

// Initialize UI from session
(function init() {
  const token = getToken();
  if (token) {
    // attempt to get username to show status
    testToken(token).then(user => {
      if (user && user.login) {
        authStatus.textContent = `Connected: ${user.login}`;
        connectBtn.style.display = 'none';
        disconnectBtn.style.display = '';
        setStatus('Token loaded from session.');
      } else {
        onDisconnect();
      }
    }).catch(() => onDisconnect());
  }
})();
