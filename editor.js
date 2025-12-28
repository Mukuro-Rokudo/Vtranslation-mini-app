// editor.js
// Utilities for interacting with GitHub contents API

// Encode each segment of a path using encodeURIComponent so that '/' is preserved
function encodePath(path) {
  if (!path) return '';
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

function base64Encode(str) {
  if (typeof btoa === 'function') {
    // browser
    return btoa(unescape(encodeURIComponent(str)));
  }
  if (typeof Buffer === 'function') {
    // Node
    return Buffer.from(str, 'utf8').toString('base64');
  }
  throw new Error('No base64 encoder available');
}

async function getFile({ owner, repo, path, ref = undefined, token }) {
  const encodedPath = encodePath(path);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      ...(token ? { Authorization: `token ${token}` } : {})
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get file ${path}: ${res.status} ${res.statusText} - ${text}`);
  }

  const json = await res.json();
  return json;
}

async function createOrUpdateFile({ owner, repo, path, content, message, branch = undefined, sha = undefined, token }) {
  const encodedPath = encodePath(path);
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
  const body = {
    message,
    content: base64Encode(content)
  };
  if (branch) body.branch = branch;
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `token ${token}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create/update file ${path}: ${res.status} ${res.statusText} - ${text}`);
  }

  return await res.json();
}

// Example helper that updates books.json; uses encodePath when interacting with the API
async function updateBooksJson({ owner, repo, token, updateFn, branch = undefined, commitMessage = 'Update books.json' }) {
  // Read existing books.json
  const file = await getFile({ owner, repo, path: 'books.json', ref: branch, token });

  // Decode content
  const contentStr = file.content ? atob(file.content.replace(/\n/g, '')) : '';
  let books;
  try {
    books = JSON.parse(contentStr || '{}');
  } catch (e) {
    throw new Error('books.json contains invalid JSON');
  }

  // Let caller modify the books object
  const newBooks = await updateFn(books);
  const newContent = JSON.stringify(newBooks, null, 2);

  // Update the file using the SHA from the original file
  return await createOrUpdateFile({
    owner,
    repo,
    path: 'books.json',
    content: newContent,
    message: commitMessage,
    branch,
    sha: file.sha,
    token
  });
}

// Export for environments that support modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    encodePath,
    getFile,
    createOrUpdateFile,
    updateBooksJson
  };
}
