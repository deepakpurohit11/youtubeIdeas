/* ════════════════════════════════════════
   STUDIO VAULT — app.js (FINALIZED)
   ════════════════════════════════════════ */

/* ── State ── */
let topics       = JSON.parse(localStorage.getItem('sv_topics') || '[]');
let currentTab   = 'all';
let activeTopicId = null;
let editingTopicId = null;
let selectedType  = 'long';
let selectedEditType = 'long';
let listView      = false;
let useFirebase   = false;
let pendingDeleteId = null;

/* ════════════════════════════════════════
   FIREBASE INIT
   ════════════════════════════════════════ */
window.addEventListener('backend-ready', () => {
  useFirebase = true; // Kept true so your existing UI buttons/flows unlock
  // Do NOT call listenTopics() here anymore
});

window.addEventListener('firebase-failed', () => {
  showConfigBanner();
  render();
});

setTimeout(() => {
  if (!useFirebase) { showConfigBanner(); render(); }
}, 3000);

function showConfigBanner() {
  const b = document.getElementById('config-banner');
  if (b) b.style.display = 'flex';
}

function listenTopics() {
  const { collection, onSnapshot, query, orderBy } = window._fbFns;
  const q = query(collection(window._db, 'topics'), orderBy('createdAt', 'desc'));
  onSnapshot(q, snap => {
    topics = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    save();
    render();
    if (activeTopicId) {
      const t = topics.find(t => t.id === activeTopicId);
      if (t) renderDetailContent(t);
    }
  });
}

function save() {
  localStorage.setItem('sv_topics', JSON.stringify(topics));
}

function render() {
  const long  = topics.filter(t => t.type === 'long'  && !t.done);
  const short = topics.filter(t => t.type === 'short' && !t.done);
  const done  = topics.filter(t => t.done);
  const all   = topics.filter(t => !t.done);
  const totalComments = topics.reduce((a, t) => a + (t.comments?.length || 0), 0);

  setText('stat-total',    topics.length);
  setText('stat-long',     long.length);
  setText('stat-short',    short.length);
  setText('stat-done',     done.length);
  setText('stat-comments', totalComments);

  setText('badge-all',   all.length);
  setText('badge-long',  long.length);
  setText('badge-short', short.length);
  setText('badge-done',  done.length);

  setText('meta-all',   `${all.length} idea${all.length !== 1 ? 's' : ''}`);
  setText('meta-long',  `${long.length} idea${long.length !== 1 ? 's' : ''}`);
  setText('meta-short', `${short.length} idea${short.length !== 1 ? 's' : ''}`);
  setText('meta-done',  `${done.length} completed`);

  renderGrid('grid-all',   all);
  renderGrid('grid-long',  long);
  renderGrid('grid-short', short);
  renderGrid('grid-done',  done);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderGrid(id, list) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">💡</div>
        <div class="empty-title">Nothing here yet</div>
        <div class="empty-desc">Click <strong>+ New Topic</strong> to add your first idea.</div>
      </div>`;
    return;
  }
  el.innerHTML = list.map(t => cardHTML(t)).join('');
}

function cardHTML(t) {
  const date = t.createdAt?.seconds
    ? new Date(t.createdAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
    : (t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : 'Just now');

  const tags         = (t.tags || []).map(tag => `<span class="tag">#${tag}</span>`).join('');
  const commentCount = t.comments?.length || 0;
  const scriptCount  = t.scripts?.length  || 0;
  const cardClass    = t.done ? 'done-card' : `${t.type}-card`;
  const badgeClass   = t.done ? 'badge-done' : (t.type === 'long' ? 'badge-long' : 'badge-short');
  const badgeLabel   = t.done ? '✅ Done' : (t.type === 'long' ? '🎬 Long Video' : '⚡ Short');
  const doneLabel    = t.done ? '↩ Reopen' : '✅ Done';

  return `
  <div class="topic-card ${cardClass}" id="card-${t.id}">
    <div class="card-header" onclick="openDetailModal('${t.id}')">
      <span class="card-type-badge ${badgeClass}">${badgeLabel}</span>
      <span class="card-date">${date}</span>
    </div>
    <div class="card-body" onclick="openDetailModal('${t.id}')">
      <div class="card-title">${escHtml(t.title)}</div>
      ${t.desc ? `<div class="card-desc">${escHtml(t.desc)}</div>` : ''}
    </div>
    ${tags ? `<div class="card-tags" onclick="openDetailModal('${t.id}')">${tags}</div>` : ''}
    <div class="card-footer">
      <div class="card-meta-info">
        <span class="meta-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          ${commentCount}
        </span>
        <span class="meta-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          ${scriptCount}
        </span>
      </div>
      <div class="card-action-row">
        <button class="card-btn done-btn"   onclick="event.stopPropagation(); toggleDone('${t.id}')"   title="${doneLabel}">${doneLabel}</button>
        <button class="card-btn edit-btn"   onclick="event.stopPropagation(); openEditModal('${t.id}')" title="Edit">✏️ Edit</button>
        <button class="card-btn delete-btn" onclick="event.stopPropagation(); askDelete('${t.id}')"     title="Delete">🗑 Delete</button>
      </div>
    </div>
  </div>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setTab(tab) {
  currentTab = tab;
  ['all','long','short','done'].forEach(t => {
    document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab);
    const sec = document.getElementById(`section-${t}`);
    if (sec) sec.style.display = t === tab ? 'block' : 'none';
  });
}

function openAddModal() {
  document.getElementById('add-modal').classList.add('open');
  setTimeout(() => document.getElementById('new-title').focus(), 50);
}

function closeAddModal() {
  document.getElementById('add-modal').classList.remove('open');
  document.getElementById('new-title').value = '';
  document.getElementById('new-desc').value  = '';
  document.getElementById('new-tags').value  = '';
  selectType('long');
}

function selectType(type) {
  selectedType = type;
  document.getElementById('type-long').className  = `type-btn${type === 'long'  ? ' active-long'  : ''}`;
  document.getElementById('type-short').className = `type-btn${type === 'short' ? ' active-short' : ''}`;
}

async function addTopic() {
  const title = document.getElementById('new-title').value.trim();
  if (!title) { showToast('⚠️ Please enter a topic title'); return; }
  
  closeAddModal(); // Close first

  const desc    = document.getElementById('new-desc').value.trim();
  const tagsRaw = document.getElementById('new-tags').value;
  const tags    = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  const topic = {
    type: selectedType, title, desc, tags,
    comments: [], scripts: [], done: false,
    createdAt: new Date().toISOString()
  };

  if (useFirebase) {
    const { collection, addDoc, serverTimestamp } = window._fbFns;
    topic.createdAt = serverTimestamp();
    await addDoc(collection(window._db, 'topics'), topic);
  } else {
    topic.id = Date.now().toString();
    topics.unshift(topic);
    save();
    render();
  }

  setTimeout(() => showSuccessPopup('Topic saved successfully!'), 50);
}

function openEditModal(id) {
  const t = topics.find(t => t.id === id);
  if (!t) return;
  editingTopicId = id;
  selectedEditType = t.type;
  document.getElementById('edit-title').value = t.title;
  document.getElementById('edit-desc').value  = t.desc || '';
  document.getElementById('edit-tags').value  = (t.tags || []).join(', ');
  selectEditType(t.type);
  document.getElementById('edit-modal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.remove('open');
  editingTopicId = null;
}

function openEditFromModal() {
  closeDetailModal();
  openEditModal(activeTopicId || editingTopicId);
}

function selectEditType(type) {
  selectedEditType = type;
  document.getElementById('edit-type-long').className  = `type-btn${type === 'long'  ? ' active-long'  : ''}`;
  document.getElementById('edit-type-short').className = `type-btn${type === 'short' ? ' active-short' : ''}`;
}

async function saveEdit() {
  const id    = editingTopicId;
  const title = document.getElementById('edit-title').value.trim();
  if (!title) { showToast('⚠️ Title cannot be empty'); return; }

  closeEditModal(); // Close first

  const desc    = document.getElementById('edit-desc').value.trim();
  const tagsRaw = document.getElementById('edit-tags').value;
  const tags    = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  const updates = { type: selectedEditType, title, desc, tags };

  if (useFirebase) {
    const { doc, updateDoc } = window._fbFns;
    await updateDoc(doc(window._db, 'topics', id), updates);
  } else {
    const idx = topics.findIndex(t => t.id === id);
    if (idx !== -1) Object.assign(topics[idx], updates);
    save();
    render();
  }

  setTimeout(() => showSuccessPopup('Topic updated!'), 50);
}

async function toggleDone(id) {
  const t = topics.find(t => t.id === id);
  if (!t) return;
  const newDone = !t.done;
  if (useFirebase) {
    const { doc, updateDoc } = window._fbFns;
    await updateDoc(doc(window._db, 'topics', id), { done: newDone });
  } else {
    t.done = newDone;
    save();
    render();
  }
  showToast(newDone ? '✅ Marked as Done!' : '↩ Reopened topic');
}

function toggleDoneFromModal() {
  if (activeTopicId) toggleDone(activeTopicId);
  closeDetailModal();
}

function askDelete(id) {
  pendingDeleteId = id;
  document.getElementById('confirm-modal').classList.add('open');
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.remove('open');
  pendingDeleteId = null;
}

async function confirmDelete() {
  const id = pendingDeleteId;
  if (!id) return;

  closeConfirmModal();
  closeDetailModal();

  if (useFirebase) {
    const { doc, deleteDoc } = window._fbFns;
    await deleteDoc(doc(window._db, 'topics', id));
  } else {
    topics = topics.filter(t => t.id !== id);
    save();
    render();
  }

  setTimeout(() => showToast('🗑 Topic deleted'), 50);
}

function deleteFromModal() {
  if (activeTopicId) askDelete(activeTopicId);
}

function openDetailModal(id) {
  const t = topics.find(t => t.id === id);
  if (!t) return;
  activeTopicId = id;
  renderDetailContent(t);
  document.getElementById('detail-modal').classList.add('open');
}

function closeDetailModal() {
  document.getElementById('detail-modal').classList.remove('open');
  activeTopicId = null;
}

function renderDetailContent(t) {
  const badge = document.getElementById('modal-badge');
  if (t.done) {
    badge.className = 'card-type-badge badge-done';
    badge.textContent = '✅ Completed';
  } else {
    badge.className = `card-type-badge ${t.type === 'long' ? 'badge-long' : 'badge-short'}`;
    badge.textContent = t.type === 'long' ? '🎬 Long Video' : '⚡ Short';
  }
  const banner = document.getElementById('modal-done-banner');
  if (banner) banner.style.display = t.done ? 'block' : 'none';
  const doneBtn = document.getElementById('modal-done-btn');
  if (doneBtn) doneBtn.title = t.done ? '↩ Reopen' : '✅ Mark as Done';
  document.getElementById('modal-title').textContent = t.title;
  document.getElementById('modal-desc').textContent  = t.desc || 'No description added.';
  const tagsEl = document.getElementById('modal-tags');
  tagsEl.innerHTML = (t.tags || []).map(tag => `<span class="tag">#${tag}</span>`).join('');
  const sl = document.getElementById('scripts-list');
  sl.innerHTML = (t.scripts || []).map(s => `
    <div class="script-file-item">
      <span class="script-file-name">📄 ${escHtml(s.name)}</span>
      ${s.url ? `<a class="script-file-link" href="${s.url}" target="_blank">Download ↗</a>` : '<span style="font-size:11px;color:var(--text-dim)">Local only</span>'}
    </div>`).join('');
  const cl       = document.getElementById('comment-list');
  const comments = t.comments || [];
  cl.innerHTML   = comments.length ? comments.map(c => `
        <div class="comment-item">
          <div class="comment-author">${escHtml(c.author || 'Anonymous')}</div>
          <div class="comment-text">${escHtml(c.text)}</div>
          <div class="comment-ts">${c.ts || ''}</div>
        </div>`).join('') : '<div class="no-comments">No comments yet. Be the first to add a note.</div>';
}

async function postComment() {
  if (!activeTopicId) return;
  const author = document.getElementById('comment-author').value.trim() || 'Anonymous';
  const text   = document.getElementById('comment-text').value.trim();
  if (!text) { showToast('⚠️ Write something first'); return; }
  const comment = { author, text, ts: new Date().toLocaleString('en-IN') };
  if (useFirebase) {
    const { doc, updateDoc, arrayUnion } = window._fbFns;
    await updateDoc(doc(window._db, 'topics', activeTopicId), { comments: arrayUnion(comment) });
  } else {
    const t = topics.find(t => t.id === activeTopicId);
    if (t) {
      t.comments = [...(t.comments || []), comment];
      save();
      render();
      renderDetailContent(t);
    }
  }
  document.getElementById('comment-text').value = '';
  showToast('💬 Comment posted!');
}

// async function handleScriptUpload(e) {
//   const file = e.target.files[0];
//   if (!file || !activeTopicId) return;
//   showToast('⬆️ Uploading script…');
//   if (useFirebase) {
//     const { ref, uploadBytes, getDownloadURL, doc, updateDoc, arrayUnion } = window._fbFns;
//     const storageRef = ref(window._storage, `scripts/${activeTopicId}/${file.name}`);
//     await uploadBytes(storageRef, file);
//     const url = await getDownloadURL(storageRef);
//     await updateDoc(doc(window._db, 'topics', activeTopicId), {
//       scripts: arrayUnion({ name: file.name, url })
//     });
//   } else {
//     const t = topics.find(t => t.id === activeTopicId);
//     if (t) {
//       t.scripts = [...(t.scripts || []), { name: file.name, url: null }];
//       save();
//       render();
//       renderDetailContent(t);
//     }
//   }
//   showToast('📄 Script uploaded!');
//   e.target.value = '';
// }


// async function handleScriptUpload(e) {
//   const file = e.target.files[0];
//   if (!file) return;

//   if (activeTopicId) {
//     const t = topics.find(x => x.id === activeTopicId);
//     if (t) {
//       if (useFirebase) {
//         try {
//           showToast('⏳ Uploading script to Firebase...');
          
//           // Pull our Firebase functions from the window object
//           const { ref, uploadBytes, getDownloadURL, doc, updateDoc } = window._fbFns;
          
//           // 1. Create a reference in Firebase Storage (saves it in a 'scripts' folder)
//           const storageRef = ref(window._storage, `scripts/${Date.now()}_${file.name}`);
          
//           // 2. Upload the physical file
//           const snapshot = await uploadBytes(storageRef, file);
          
//           // 3. Get the public download URL for the file
//           const downloadURL = await getDownloadURL(snapshot.ref);
          
//           // 4. Update the local UI state
//           t.scripts = [...(t.scripts || []), { name: file.name, url: downloadURL }];
          
//           // 5. Update the database so the link persists
//           const docRef = doc(window._db, 'topics', activeTopicId);
//           await updateDoc(docRef, { scripts: t.scripts });
          
//           showToast('📄 Script uploaded successfully!');
//           renderDetailContent(t);
//         } catch (error) {
//           console.error("Upload error:", error);
//           showToast('❌ Upload failed! Check console.');
//         }
//       } else {
//         // Fallback if Firebase is disconnected
//         t.scripts = [...(t.scripts || []), { name: file.name, url: null }];
//         save();
//         render();
//         renderDetailContent(t);
//         showToast('📄 Script added locally (No Firebase link)!');
//       }
//     }
//   }
//   e.target.value = ''; // Reset the input
// }

async function handleScriptUpload(e) {
  const file = e.target.files[0];
  if (!file || !activeTopicId) return;

  if (useFirebase) {
    try {
      showToast('⏳ Uploading script to Appwrite...');
      const { bucketId, dbId, colId } = window._env;

      // 1. Upload the file to Appwrite Storage
      const uploadedFile = await window._awStorage.createFile(
        bucketId,
        window._awID.unique(),
        file
      );

      // 2. Get the public download link
      const fileUrl = window._awStorage.getFileDownload(bucketId, uploadedFile.$id);

      // 3. Update the local UI state
      const t = topics.find(x => x.id === activeTopicId);
      if (t) {
        t.scripts = [...(t.scripts || []), { name: file.name, url: fileUrl }];
        
        // 4. Save the array to your Appwrite Database as a string
        await window._awDb.updateDocument(
          dbId,
          colId,
          activeTopicId,
          { scripts: JSON.stringify(t.scripts) } 
        );

        save();
        renderDetailContent(t);
        showToast('📄 Script uploaded successfully!');
      }
    } catch (error) {
      console.error("Appwrite Upload Failed:", error);
      showToast('❌ Upload failed! Check console.');
    }
  } else {
    // Fallback if disconnected
    const t = topics.find(x => x.id === activeTopicId);
    if (t) {
      t.scripts = [...(t.scripts || []), { name: file.name, url: null }];
      save();
      render();
      renderDetailContent(t);
      showToast('📄 Script added locally!');
    }
  }
  e.target.value = ''; 
}


function toggleView() {
  listView = !listView;
  document.querySelectorAll('.topics-grid').forEach(g => {
    g.style.gridTemplateColumns = listView ? '1fr' : '';
  });
  const lbl = document.getElementById('view-label');
  if (lbl) lbl.textContent = listView ? 'List' : 'Grid';
}

function showSuccessPopup(msg) {
  const popup = document.getElementById('success-popup');
  const text  = document.getElementById('success-text');
  if (!popup) return;
  text.textContent = msg;
  popup.classList.add('show');
  setTimeout(() => popup.classList.remove('show'), 2200);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeDetailModal(); closeAddModal(); closeEditModal(); closeConfirmModal();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault(); openAddModal();
  }
});

['detail-modal','add-modal','edit-modal','confirm-modal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
});

render();