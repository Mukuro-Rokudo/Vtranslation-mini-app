/* editor.js - UI-attached GitHub helpers for books.json

Features:
- encodePath(path) to safely encode path segments
- base64Encode(str) for upload content
- GitHub helpers to GET and PUT contents using sessionStorage.github_pat
- Connect / Disconnect buttons to store/remove PAT
- Publish (create-only) and Publish+Update (create or update) for books.json
- Graceful 404 handling, status messages, and redirect to index.html after publish

Expected (optional) HTML element IDs:
- patInput (input for PAT)
- connectBtn
- disconnectBtn
- publishBtn
- publishUpdateBtn
- booksTextarea (textarea holding books.json content)
- status (div/span for status messages)

If elements are missing the script will still work but will log to console.
*/

(function () {
  'use strict';

  // Configuration - change if your repo is different
  const OWNER = 'Mukuro-Rokudo';
  const REPO = 'Vtranslation-mini-app';
  const FILE_PATH = 'books.json';

  // Utility: encode path preserving slashes but encoding each segment
  function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  // Unicode-safe base64 encode
  function base64Encode(str) {
    // btoa works on binary strings; this ensures UTF-8 safety
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
      // Fallback: try without encodeURIComponent
      return btoa(str);
    }
  }

  // DOM helpers
  function $(id) { return document.getElementById(id); }

  const statusEl = $('status') || (function () {
    const el = document.createElement('div');
    el.id = 'status';
    el.style.position = 'fixed';
    el.style.right = '16px';
    el.style.top = '16px';
    el.style.zIndex = 9999;
    document.body.appendChild(el);
    return el;
  })();

  function setStatus(message, isError) {
    if (!statusEl) return console.log(message);
    statusEl.textContent = message;
    statusEl.style.color = isError ? 'red' : 'green';
    console.log(message);
  }

  function clearStatus() {
    if (statusEl) statusEl.textContent = '';
  }

  function getPat() {
    return sessionStorage.getItem('github_pat') || null;
  }

  function setPat(pat) {
    if (pat) sessionStorage.setItem('github_pat', pat);
    else sessionStorage.removeItem('github_pat');
  }

  // Build headers for GitHub API requests
  function buildHeaders() {
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    const pat = getPat();
    if (pat) headers['Authorization'] = 'token ' + pat;
    return headers;
  }

  // GET a file from the repo. Returns JSON or null if 404.
  async function getFile(path) {
    const encodedPath = encodePath(path);
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodedPath}`;
    setStatus('Fetching ' + path + '...', false);

    const res = await fetch(url, { headers: buildHeaders() });
    if (res.status === 404) {
      setStatus(path + ' not found (404).', false);
      return null;
    }
    if (!res.ok) {
      const text = await res.text();
      setStatus(`Failed to fetch ${path}: ${res.status} ${res.statusText}: ${text}`, true);
      throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data;
  }

  // Create or update a file via PUT. If sha is provided, this will update.
  async function putFile(path, contentStr, message, sha) {
    const encodedPath = encodePath(path);
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodedPath}`;
    const body = {
      message: message || `Update ${path}`,
      content: base64Encode(contentStr),
      committer: { name: OWNER, email: `${OWNER}@users.noreply.github.com` }
    };
    if (sha) body.sha = sha;

    setStatus((sha ? 'Updating' : 'Creating') + ' ' + path + '...', false);

    const res = await fetch(url, {
      method: 'PUT',
      headers: Object.assign({'Content-Type': 'application/json'}, buildHeaders()),
      body: JSON.stringify(body)
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* ignore */ }

    if (!res.ok) {
      const errMsg = json && json.message ? json.message : text;
      setStatus(`Failed to ${sha ? 'update' : 'create'} ${path}: ${errMsg}`, true);
      throw new Error(errMsg);
    }

    setStatus(`${path} ${sha ? 'updated' : 'created'} successfully.`, false);
    return json;
  }

  // UI actions
  async function handleConnect() {
    const patInput = $('patInput');
    let pat = patInput && patInput.value ? patInput.value.trim() : null;
    if (!pat) {
      // Prompt if no input element
      pat = prompt('Enter a GitHub personal access token (scopes: repo)');
    }
    if (!pat) {
      setStatus('No PAT provided.', true);
      return;
    }
    setPat(pat);
    setStatus('PAT saved to sessionStorage.', false);
  }

  function handleDisconnect() {
    setPat(null);
    const patInput = $('patInput');
    if (patInput) patInput.value = '';
    setStatus('Disconnected and removed PAT from session storage.', false);
  }

  async function handlePublish() {
    const pat = getPat();
    if (!pat) { setStatus('Please connect (provide PAT) before publishing.', true); return; }

    const textarea = $('booksTextarea');
    const content = textarea ? textarea.value : ''; // user supplied content

    try {
      const existing = await getFile(FILE_PATH);
      if (existing) {
        setStatus('books.json already exists. Use Publish+Update to overwrite.', true);
        return;
      }
      await putFile(FILE_PATH, content || '[]', 'Publish books.json via editor', null);
      setStatus('Publish successful. Redirecting to index.html...', false);
      setTimeout(() => window.location.href = 'index.html', 2000);
    } catch (err) {
      setStatus('Publish failed: ' + err.message, true);
    }
  }

  async function handlePublishUpdate() {
    const pat = getPat();
    if (!pat) { setStatus('Please connect (provide PAT) before publishing.', true); return; }

    const textarea = $('booksTextarea');
    const content = textarea ? textarea.value : '';

    try {
      const existing = await getFile(FILE_PATH);
      const sha = existing ? existing.sha : null;
      await putFile(FILE_PATH, content || '[]', sha ? 'Update books.json via editor' : 'Publish books.json via editor', sha);
      setStatus('Publish+Update successful. Redirecting to index.html...', false);
      setTimeout(() => window.location.href = 'index.html', 2000);
    } catch (err) {
      setStatus('Publish+Update failed: ' + err.message, true);
    }
  }

  // Bind UI
  function bind(id, handler) {
    const el = $(id);
    if (!el) {
      console.log(`UI element #${id} not found; skipping binding.`);
      return;
    }
    el.addEventListener('click', handler);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // Attach listeners
    bind('connectBtn', async (e) => { e.preventDefault(); await handleConnect(); });
    bind('disconnectBtn', (e) => { e.preventDefault(); handleDisconnect(); });
    bind('publishBtn', async (e) => { e.preventDefault(); await handlePublish(); });
    bind('publishUpdateBtn', async (e) => { e.preventDefault(); await handlePublishUpdate(); });

    // If a PAT is in sessionStorage, show it in the input if present (but not required)
    const pat = getPat();
    const patInput = $('patInput');
    if (pat && patInput) patInput.value = pat;

    // Optionally pre-fill textarea with existing books.json content for editing
    const textarea = $('booksTextarea');
    if (textarea) {
      (async () => {
        try {
          const existing = await getFile(FILE_PATH);
          if (existing && existing.content) {
            // content is base64 encoded
            const decoded = atob(existing.content);
            // try to decode unicode-safe
            let text = decoded;
            try { text = decodeURIComponent(escape(decoded)); } catch (e) { /* ignore */ }
            textarea.value = text;
            setStatus('Loaded existing books.json for editing.', false);
          }
        } catch (err) {
          // getFile handles status messages; no-op here
        }
      })();
    }

    setStatus('Editor ready.', false);
  });

  // Expose helpers to window for debugging if needed
  window.editorHelpers = {
    encodePath,
    base64Encode,
    getFile,
    putFile,
    getPat,
    setPat,
  };

})();
