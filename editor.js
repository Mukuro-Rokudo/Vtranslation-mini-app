(function(){
  const LS_KEY = 'localBooks_v1'
  function uid(){ return 'id-' + Math.random().toString(36).slice(2,9) }

  let books = []
  let currentId = null
  // DOM
  const booksList = document.getElementById('books-list')
  const createBtn = document.getElementById('create-book')
  const bookEditor = document.getElementById('book-editor')
  const editorEmpty = document.getElementById('editor-empty')
  const titleInput = document.getElementById('book-title')
  const authorInput = document.getElementById('book-author')
  const coverInput = document.getElementById('cover-input')
  const coverPreview = document.getElementById('cover-preview')
  const saveBookBtn = document.getElementById('save-book')
  const exportBtn = document.getElementById('export-book')
  const deleteBtn = document.getElementById('delete-book')

  const chapterTitleInput = document.getElementById('chapter-title')
  const addChapterBtn = document.getElementById('add-chapter')
  const chaptersList = document.getElementById('chapters-list')

  const chapterEditor = document.getElementById('chapter-editor')
  const editChapterTitle = document.getElementById('edit-chapter-title')
  const editChapterContent = document.getElementById('edit-chapter-content')
  const saveChapterBtn = document.getElementById('save-chapter')
  const cancelChapterBtn = document.getElementById('cancel-chapter')

  function load(){
    try{ books = JSON.parse(localStorage.getItem(LS_KEY) || '[]') }catch(e){ books = [] }
    renderBooksList()
  }

  function save(){ localStorage.setItem(LS_KEY, JSON.stringify(books)) }

  function renderBooksList(){
    booksList.innerHTML = ''
    if(!books.length){ booksList.innerHTML = '<div style="color:#6b7280">No books yet</div>'; return }
    for(const b of books){
      const el = document.createElement('div')
      el.style.padding = '8px'
      el.style.borderBottom = '1px solid #eef2f6'
      el.innerHTML = `<strong>${escapeHtml(b.title||'(untitled)')}</strong><div style="color:#6b7280;font-size:13px">${escapeHtml(b.author||'')}</div>`
      el.onclick = ()=> openBook(b.id)
      booksList.appendChild(el)
    }
  }

  function openBook(id){
    currentId = id
    const b = books.find(x=>x.id===id)
    if(!b) return
    editorEmpty.classList.add('hidden')
    bookEditor.classList.remove('hidden')
    titleInput.value = b.title || ''
    authorInput.value = b.author || ''
    if(b.cover && b.cover.dataUrl){ coverPreview.src = b.cover.dataUrl; coverPreview.style.display = 'inline-block' } else { coverPreview.style.display = 'none' }
    renderChapters(b)
  }

  function renderChapters(book){
    chaptersList.innerHTML = ''
    if(!(book.chapters||[]).length){ chaptersList.innerHTML = '<div style="color:#6b7280">No chapters</div>'; return }
    for(let i=0;i<book.chapters.length;i++){
      const c = book.chapters[i]
      const row = document.createElement('div')
      row.style.display = 'flex'
      row.style.alignItems = 'center'
      row.style.justifyContent = 'space-between'
      row.style.padding = '6px 0'
      row.innerHTML = `<div style="flex:1"><strong>${escapeHtml(c.title)}</strong></div>`
      const controls = document.createElement('div')
      controls.style.display = 'flex'
      controls.style.gap = '6px'
      const editBtn = document.createElement('button'); editBtn.textContent='Edit'
      editBtn.onclick = ()=> editChapter(currentId, c.id)
      const upBtn = document.createElement('button'); upBtn.textContent='↑'
      upBtn.onclick = ()=> moveChapter(currentId, i, i-1)
      const downBtn = document.createElement('button'); downBtn.textContent='↓'
      downBtn.onclick = ()=> moveChapter(currentId, i, i+1)
      const delBtn = document.createElement('button'); delBtn.textContent='Delete'; delBtn.style.background='#ef4444'
      delBtn.onclick = ()=> deleteChapter(currentId, c.id)
      controls.appendChild(editBtn); controls.appendChild(upBtn); controls.appendChild(downBtn); controls.appendChild(delBtn)
      row.appendChild(controls)
      chaptersList.appendChild(row)
    }
  }

  function createBook(){
    const b = { id: uid(), title: 'Untitled', author: '', cover:null, chapters: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    books.unshift(b)
    save()
    renderBooksList()
    openBook(b.id)
  }

  function saveBook(){
    if(!currentId) return
    const b = books.find(x=>x.id===currentId)
    if(!b) return
    b.title = titleInput.value.trim()
    b.author = authorInput.value.trim()
    b.updated_at = new Date().toISOString()
    save()
    renderBooksList()
    alert('Book saved locally')
  }

  function deleteBook(){
    if(!currentId) return
    if(!confirm('Delete this book?')) return
    books = books.filter(x=>x.id!==currentId)
    save()
    currentId = null
    bookEditor.classList.add('hidden')
    editorEmpty.classList.remove('hidden')
    renderBooksList()
  }

  function handleCoverChange(e){
    const f = e.target.files && e.target.files[0]
    if(!f || !currentId) return
    const r = new FileReader()
    r.onload = ()=>{
      const b = books.find(x=>x.id===currentId)
      if(!b) return
      b.cover = { name: f.name, dataUrl: r.result }
      save()
      coverPreview.src = r.result
      coverPreview.style.display = 'inline-block'
    }
    r.readAsDataURL(f)
  }

  function addChapter(){
    const t = chapterTitleInput.value.trim()
    if(!t) return alert('Enter chapter title')
    const b = books.find(x=>x.id===currentId); if(!b) return
    const c = { id: uid(), title: t, content: '' }
    b.chapters.push(c)
    save()
    chapterTitleInput.value = ''
    renderChapters(b)
  }

  let editingChapterId = null
  function editChapter(bookId, chapterId){
    const b = books.find(x=>x.id===bookId); if(!b) return
    const c = b.chapters.find(x=>x.id===chapterId); if(!c) return
    editingChapterId = chapterId
    chapterEditor.classList.remove('hidden')
    editChapterTitle.value = c.title
    editChapterContent.value = c.content
    window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})
  }

  function saveChapter(){
    if(!currentId || !editingChapterId) return
    const b = books.find(x=>x.id===currentId); if(!b) return
    const c = b.chapters.find(x=>x.id===editingChapterId); if(!c) return
    c.title = editChapterTitle.value.trim()
    c.content = editChapterContent.value
    save()
    editingChapterId = null
    chapterEditor.classList.add('hidden')
    renderChapters(b)
  }

  function cancelChapter(){ editingChapterId = null; chapterEditor.classList.add('hidden') }

  function moveChapter(bookId, fromIdx, toIdx){
    const b = books.find(x=>x.id===bookId); if(!b) return
    if(toIdx<0 || toIdx>=b.chapters.length) return
    const arr = b.chapters
    const [item] = arr.splice(fromIdx,1)
    arr.splice(toIdx,0,item)
    save()
    renderChapters(b)
  }

  function deleteChapter(bookId, chapterId){
    const b = books.find(x=>x.id===bookId); if(!b) return
    b.chapters = b.chapters.filter(x=>x.id!==chapterId)
    save()
    renderChapters(b)
  }

  async function exportBook(){
    if(!currentId) return
    const b = books.find(x=>x.id===currentId); if(!b) return
    const zip = new JSZip()
    const bookFolder = zip.folder(safeFilename(b.title||b.id))
    // book.json
    const manifest = { title: b.title, author: b.author, chapters: b.chapters.map((c,i)=>({filename:`${String(i+1).padStart(2,'0')}-${safeFilename(c.title||'chapter')}.md`, title:c.title })) }
    bookFolder.file('book.json', JSON.stringify(manifest, null, 2))
    // cover
    if(b.cover && b.cover.dataUrl){
      const blob = dataURLToBlob(b.cover.dataUrl)
      bookFolder.file(b.cover.name || 'cover.jpg', blob)
    }
    // chapters
    for(let i=0;i<b.chapters.length;i++){
      const c = b.chapters[i]
      const filename = `${String(i+1).padStart(2,'0')}-${safeFilename(c.title||'chapter')}.md`
      bookFolder.file(filename, c.content || `# ${c.title}\n\n`)
    }
    const blob = await zip.generateAsync({type:'blob'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeFilename(b.title||'book')}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  function safeFilename(s){ return (s||'file').replace(/[^a-z0-9\-\_\.]/gi,'_') }

  function dataURLToBlob(dataURL){
    const parts = dataURL.split(',')
    const meta = parts[0]
    const base64 = parts[1]
    const m = meta.match(/data:(.*);base64/)
    const mime = m ? m[1] : 'application/octet-stream'
    const binary = atob(base64)
    const len = binary.length
    const arr = new Uint8Array(len)
    for(let i=0;i<len;i++) arr[i]=binary.charCodeAt(i)
    return new Blob([arr],{type:mime})
  }

  function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>\"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]||c)) }

  // event hooks
  createBtn.onclick = createBook
  saveBookBtn.onclick = saveBook
  deleteBtn.onclick = deleteBook
  coverInput.onchange = handleCoverChange
  addChapterBtn.onclick = addChapter
  saveChapterBtn.onclick = saveChapter
  cancelChapterBtn.onclick = cancelChapter
  exportBtn.onclick = exportBook

  // init
  load()
})();
