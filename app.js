const libraryEl = document.getElementById('library')
const searchEl = document.getElementById('search')
const readerEl = document.getElementById('reader')
const readerTitleEl = document.getElementById('reader-title')
const readerContentEl = document.getElementById('reader-content')
const downloadBtn = document.getElementById('download-btn')

let books = []

async function loadBooks(){
  try{
    const res = await fetch('books.json')
    books = await res.json()
    renderBooks(books)
  }catch(e){
    libraryEl.innerHTML = '<p style="color:#b91c1c">Failed to load books.json — make sure it exists and is valid JSON.</p>'
    console.error(e)
  }
}

function renderBooks(list){
  libraryEl.innerHTML = ''
  if(!list.length){
    libraryEl.innerHTML = '<p>No books found. Add book files to /books and entries in books.json.</p>'
    return
  }
  for(const book of list){
    const card = document.createElement('div')
    card.className = 'card'
    card.innerHTML = `
      <div class="thumbnail">${book.cover ? `<img src="${book.cover}" alt="cover" style="max-width:100%;max-height:100%;object-fit:cover;border-radius:6px">` : 'No cover'}</div>
      <div class="meta"><strong>${escapeHtml(book.title)}</strong><div style="color:var(--muted)">${escapeHtml(book.author || '')}</div></div>
      <div class="tags">${(book.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      <div class="button-row"><button onclick='openReader(${JSON.stringify(book)})'>Read</button></div>
    `
    libraryEl.appendChild(card)
  }
}

function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'":"&#39;'}[c] || c)) }

function openReader(book){
  readerEl.classList.remove('hidden')
  readerTitleEl.textContent = book.title + (book.author ? ' — ' + book.author : '')
  readerContentEl.innerHTML = ''
  downloadBtn.onclick = ()=>{ window.open(book.file, '_blank') }

  // Decide how to render
  const ext = (book.file || '').split('.').pop().toLowerCase()
  if(ext === 'pdf'){
    const iframe = document.createElement('iframe')
    iframe.src = book.file + '#toolbar=0'
    readerContentEl.appendChild(iframe)
  } else if(ext === 'txt' || ext === 'md'){
    fetch(book.file).then(r=>r.text()).then(t=>{
      const pre = document.createElement('pre')
      pre.textContent = t
      readerContentEl.appendChild(pre)
    }).catch(err=>{
      readerContentEl.textContent = 'Failed to load text file.'
      console.error(err)
    })
  } else {
    // fallback: try iframe (works for plain html, some hosted viewers)
    const iframe = document.createElement('iframe')
    iframe.src = book.file
    readerContentEl.appendChild(iframe)
  }
}

function closeReader(){ readerEl.classList.add('hidden'); readerContentEl.innerHTML = '' }

searchEl.addEventListener('input', (e)=>{
  const q = e.target.value.trim().toLowerCase()
  if(!q) return renderBooks(books)
  const filtered = books.filter(b=>{
    return (b.title||'').toLowerCase().includes(q) || (b.author||'').toLowerCase().includes(q) || (b.tags||[]).join(' ').toLowerCase().includes(q)
  })
  renderBooks(filtered)
})

// Initialize
loadBooks()
