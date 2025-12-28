# Book Library (GitHub Pages)

This repository contains a simple static Book Library web interface designed to work with GitHub Pages. It loads a JSON manifest (`books.json`) and displays available books. Clicking "Read" opens a simple reader (PDFs are shown in an iframe; text/markdown files are rendered as text).

How to add books
- Put book files (PDF, TXT, MD, or HTML) into the `books/` folder in the repository.
- Add an entry to `books.json` with fields: `title`, `author`, `file` (path relative to repo root), optional `cover`, and optional `tags` array.

Example entry:
{
  "title": "My Book",
  "author": "Me",
  "file": "books/my-book.pdf",
  "cover": "books/my-book-cover.jpg",
  "tags": ["fiction","novel"]
}

Enable GitHub Pages
- Go to the repository Settings → Pages and set the source to the branch you pushed to (e.g., `main`) and folder `/ (root)`.
- Visit `https://<your-github-username>.github.io/<repo-name>/` once Pages has built.

Notes & next steps
- To support EPUBs, integrate an EPUB reader library (e.g., epub.js) and update `app.js` to handle `.epub` files.
- For larger libraries, consider adding pagination, categories, or a small backend to host metadata and files.
