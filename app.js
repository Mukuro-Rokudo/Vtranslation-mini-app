/* app.js

This file loads the public library and also merges locally-published books stored in
localStorage under the key `vtranslation_local_books` into the library view.
Chapter-based books (books which include a `chapters` array or have structure === 'chapters')
are rendered inline with an expandable list of chapters.

It also listens for a custom event 'vtranslation:book-published' and storage events to
refresh the library when a local book is published from the editor.
*/

(function () {
  'use strict';

  const LOCAL_BOOKS_KEY = 'vtranslation_local_books';
  const LIBRARY_ENDPOINT = '/library.json'; // fallback if your app serves a library file
  const libraryContainerId = 'library'; // container id in DOM where books are rendered

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    const container = document.getElementById(libraryContainerId);
    if (!container) {
      console.warn(`Library container with id '${libraryContainerId}' not found. Aborting library render.`);
      return;
    }

    loadAndRenderLibrary(container);

    // Listen for custom event dispatched by editor when a book is published
    window.addEventListener('vtranslation:book-published', function (e) {
      const book = e && e.detail;
      if (book) {
        mergeAndRenderLocalBook(book, container);
      }
    });

    // Listen for storage events so other windows/tabs publishing a book are reflected
    window.addEventListener('storage', function (e) {
      if (e.key === LOCAL_BOOKS_KEY) {
        loadAndRenderLibrary(container);
      }
    });
  }

  // Loads remote library then merges locally-published books and renders
  async function loadAndRenderLibrary(container) {
    const [remoteBooks] = await Promise.all([fetchRemoteLibrary().catch(() => [])]);
    const localPublished = loadLocalPublishedBooks();

    const merged = mergeBooks(remoteBooks || [], localPublished || []);
    renderLibrary(container, merged);
  }

  function fetchRemoteLibrary() {
    return fetch(LIBRARY_ENDPOINT, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('No remote library');
        return res.json();
      })
      .catch((err) => {
        console.info('Could not fetch remote library:', err && err.message);
        return [];
      });
  }

  function loadLocalPublishedBooks() {
    try {
      const raw = localStorage.getItem(LOCAL_BOOKS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter((b) => b && b.published === true);
    } catch (err) {
      console.warn('Failed to parse local books from localStorage', err);
      return [];
    }
  }

  function mergeBooks(remote = [], local = []) {
    // Merge, preferring local book if IDs clash. If no id present, use title as fallback.
    const out = [];
    const byId = new Map();

    (remote || []).forEach((b) => {
      const id = b && (b.id || b.slug || b.title) || JSON.stringify(b);
      if (id) byId.set(id, b);
    });

    (local || []).forEach((b) => {
      const id = b && (b.id || b.slug || b.title) || JSON.stringify(b);
      if (id) byId.set(id, b); // local overrides remote on conflict
    });

    for (const v of byId.values()) out.push(v);
    // Optional: sort alphabetically by title
    out.sort((a, b) => (String(a.title || '').localeCompare(String(b.title || ''))));
    return out;
  }

  function renderLibrary(container, books) {
    container.innerHTML = '';
    if (!books || books.length === 0) {
      container.innerHTML = '<p>No books available.</p>';
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'library-list';

    books.forEach((book) => {
      const li = document.createElement('li');
      li.className = 'library-item';

      const header = document.createElement('div');
      header.className = 'book-header';

      const title = document.createElement('strong');
      title.textContent = book.title || 'Untitled';
      header.appendChild(title);

      if (book.author) {
        const author = document.createElement('span');
        author.className = 'book-author';
        author.textContent = ` — ${book.author}`;
        header.appendChild(author);
      }

      li.appendChild(header);

      // Detect chapter-based books: either has a 'chapters' array or structure flag
      const isChapterBased = Array.isArray(book.chapters) || (book.structure && book.structure === 'chapters');

      if (isChapterBased) {
        renderChapterBasedBookInline(li, book);
      } else {
        renderNonChapterBook(li, book);
      }

      ul.appendChild(li);
    });

    container.appendChild(ul);
  }

  function renderNonChapterBook(li, book) {
    const desc = document.createElement('p');
    desc.className = 'book-desc';
    desc.textContent = book.description || book.excerpt || '';
    li.appendChild(desc);

    const actions = document.createElement('div');
    actions.className = 'book-actions';

    const openBtn = document.createElement('button');
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', function () {
      // If book has a URL, open; else try to open in-app reader
      if (book.url) window.open(book.url, '_blank');
      else openBookInReader(book);
    });

    actions.appendChild(openBtn);
    li.appendChild(actions);
  }

  function renderChapterBasedBookInline(li, book) {
    const toggle = document.createElement('button');
    toggle.className = 'toggle-chapters';
    toggle.textContent = 'Show chapters';

    const chapterList = document.createElement('ul');
    chapterList.className = 'chapter-list';
    chapterList.style.display = 'none';

    const chapters = Array.isArray(book.chapters) ? book.chapters : [];

    if (chapters.length === 0 && book.content && typeof book.content === 'string') {
      // If there is raw content, show a preview as single 'chapter'
      chapters.push({ title: 'Content', excerpt: book.content.slice(0, 400) });
    }

    chapters.forEach(function (ch, idx) {
      const cli = document.createElement('li');
      cli.className = 'chapter-item';

      const tch = document.createElement('div');
      tch.className = 'chapter-title';
      tch.textContent = ch.title || `Chapter ${idx + 1}`;

      const excerpt = document.createElement('div');
      excerpt.className = 'chapter-excerpt';
      excerpt.innerHTML = sanitizeHtml(ch.excerpt || ch.content || '');

      tch.addEventListener('click', function () {
        // Toggle expanded excerpt inline
        if (excerpt.style.display === 'none' || !excerpt.style.display) {
          excerpt.style.display = 'block';
        } else {
          excerpt.style.display = 'none';
        }
      });

      excerpt.style.display = 'none';

      cli.appendChild(tch);
      cli.appendChild(excerpt);
      chapterList.appendChild(cli);
    });

    toggle.addEventListener('click', function () {
      const shown = chapterList.style.display === 'block';
      chapterList.style.display = shown ? 'none' : 'block';
      toggle.textContent = shown ? 'Show chapters' : 'Hide chapters';
    });

    li.appendChild(toggle);
    li.appendChild(chapterList);
  }

  function openBookInReader(book) {
    // Try to open an in-app reader view if the app provides one. We provide a fallback alert.
    if (window.openBook) {
      try { window.openBook(book); return; } catch (e) { /* continue fallback */ }
    }
    alert(`Opening book: ${book.title || 'Untitled'}`);
  }

  function sanitizeHtml(input) {
    // Very small sanitizer that escapes HTML to avoid XSS in case content isn't trusted.
    if (!input) return '';
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML.replace(/\n/g, '<br>');
  }

  function mergeAndRenderLocalBook(book, container) {
    // Add/replace the single published book into the current rendered library
    const current = Array.from((container.querySelectorAll('.library-item') || [])).map((li) => {
      // Attempt to reconstruct from DOM — easier to just reload full library
      return null;
    });
    // Simpler: reload entire library
    loadAndRenderLibrary(container);
  }

  // Expose helper so editor (in same window) can call this directly
  window.__vtranslation_local_publish = function (book) {
    const container = document.getElementById(libraryContainerId);
    if (!container) return;
    loadAndRenderLibrary(container);
  };

})();
