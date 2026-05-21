// ---------------------------------------------------------------
// Support Request Dashboard (dashboard.js)
// ---------------------------------------------------------------

const currentUser = getUser();
if (!currentUser) {
  window.location.href = 'login.html';
}

// State
let allTickets = [];
let dashboardCurrentPage = 1;
const DASHBOARD_PAGE_SIZE = 20;
const selectedTicketIds = new Set();
let pageToggle = false;
let allToggle = false;

// Boot
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('identityName').textContent = `${currentUser.username} (${currentUser.role})`;
  
  if (currentUser.role === 'admin') {
    document.getElementById('pageTitle').textContent = 'Support Request';
    // Physically remove the button and modal from the DOM for admins
    const newTicketBtn = document.getElementById('newTicketBtn');
    if (newTicketBtn) newTicketBtn.remove();
    
    const ticketModal = document.getElementById('createTicketModal');
    if (ticketModal) ticketModal.remove();
    const dashboardActions = document.getElementById('dashboardActions');
    if (dashboardActions) dashboardActions.style.display = 'flex';
  } else {
    document.getElementById('pageTitle').textContent = 'My Ticket';
    // hide admin-only table headers and cells
    document.querySelectorAll('.admin-only-th').forEach(el => el.style.display = 'none');
  }

  bindUIEvents();
  await loadTickets();
});

// Load
async function loadTickets() {
  try {
    allTickets = await fetchTickets();
    renderTable();
  } catch (err) {
    console.error('Failed to load tickets', err);
    showToast('Failed to load tickets');
  }
}

// Bind Events
function bindUIEvents() {
  // Search & Filters
  document.getElementById('globalSearch').addEventListener('input', () => { dashboardCurrentPage = 1; renderTable(); });
  document.getElementById('filterCategory').addEventListener('change', () => { dashboardCurrentPage = 1; renderTable(); });
  document.getElementById('filterStatus').addEventListener('change', () => { dashboardCurrentPage = 1; renderTable(); });
  document.getElementById('filterPriority').addEventListener('change', () => { dashboardCurrentPage = 1; renderTable(); });
  document.getElementById('sortTickets').addEventListener('change', () => { dashboardCurrentPage = 1; renderTable(); });

  const selectPageBtn = document.getElementById('selectPageBtn');
  if (selectPageBtn) {
    selectPageBtn.addEventListener('click', () => {
      const pageTickets = getCurrentPageTickets().map(t => Number(t.id));
      if (!pageToggle) {
        pageTickets.forEach(id => selectedTicketIds.add(id));
        pageToggle = true;
      } else {
        pageTickets.forEach(id => selectedTicketIds.delete(id));
        pageToggle = false;
      }
      // Recompute allToggle based on current filtered tickets
      const filtered = getFilteredTickets().map(t => Number(t.id));
      allToggle = filtered.every(id => selectedTicketIds.has(id));
      renderTable();
    });
  }

  const selectAllBtn = document.getElementById('selectAllBtn');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      const filteredIds = getFilteredTickets().map(t => Number(t.id));
      if (!allToggle) {
        filteredIds.forEach(id => selectedTicketIds.add(id));
        allToggle = true;
      } else {
        filteredIds.forEach(id => selectedTicketIds.delete(id));
        allToggle = false;
      }
      // Recompute pageToggle based on current page tickets
      const pageIds = getCurrentPageTickets().map(t => Number(t.id));
      pageToggle = pageIds.every(id => selectedTicketIds.has(id));
      renderTable();
    });
  }
  // Clear selection button removed; select buttons now toggle selection on/off.

  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', async () => {
      const ids = Array.from(selectedTicketIds);
      if (ids.length === 0) return;
      if (!confirm(`Delete ${ids.length} ticket(s)? This also removes their messages.`)) return;

      try {
        await Promise.all(ids.map(id => deleteTicket(id)));
        selectedTicketIds.clear();
        await loadTickets();
      } catch (err) {
        showToast('Failed to delete selected ticket(s)');
      }
    });
  }

  const filterAssignedBtn = document.getElementById('filterAssigned');
  if (filterAssignedBtn && currentUser.role === 'admin') {
    filterAssignedBtn.style.display = 'inline-block';
    filterAssignedBtn.addEventListener('click', () => {
      filterAssignedBtn.classList.toggle('btn-primary');
      filterAssignedBtn.classList.toggle('btn-secondary');
      dashboardCurrentPage = 1;
      renderTable();
    });
  }

  // Create Ticket Modal
  const createBtn = document.getElementById('newTicketBtn');
  const cancelBtn = document.getElementById('cancelCreateBtn');
  const form = document.getElementById('createTicketForm');
  const modal = document.getElementById('createTicketModal');

  if (createBtn) createBtn.addEventListener('click', () => modal.style.display = 'flex');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { modal.style.display = 'none'; form.reset(); });
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const subject = document.getElementById('ticketSubject').value.trim();
      const category = document.getElementById('ticketCategory').value;
      if (!subject) return;
      try {
        const t = await createTicket(subject, category);
        modal.style.display = 'none';
        form.reset();
        // Go straight to workspace
        window.location.href = `workspace.html?id=${t.id}`;
      } catch (err) {
        showToast('Error creating ticket: ' + err.message);
      }
    });
  }
}

function getFilteredTickets() {
  const q = document.getElementById('globalSearch').value.toLowerCase();
  const cat = document.getElementById('filterCategory').value;
  const stat = document.getElementById('filterStatus').value;
  const prio = document.getElementById('filterPriority').value;
  const sort = document.getElementById('sortTickets').value;
  const filterAssignedBtn = document.getElementById('filterAssigned');
  const isAssignedToMe = filterAssignedBtn && filterAssignedBtn.classList.contains('btn-primary');

  let filtered = allTickets.filter(t => {
    if (q && !t.subject.toLowerCase().includes(q) && !t.ticket_number.toLowerCase().includes(q)) return false;
    if (cat && t.category !== cat) return false;
    if (stat && t.status !== stat) return false;
    if (prio && t.priority !== prio) return false;
    if (isAssignedToMe && Number(t.assigned_admin_id) !== Number(currentUser.id)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const timeA = new Date(a.last_message_time || a.created_at).getTime();
    const timeB = new Date(b.last_message_time || b.created_at).getTime();
    const createA = new Date(a.created_at).getTime();
    const createB = new Date(b.created_at).getTime();

    if (sort === 'newest') {
      return createB - createA;
    }
    return timeB - timeA;
  });

  return filtered;
}

function getCurrentPageTickets() {
  const filtered = getFilteredTickets();
  const startIndex = (dashboardCurrentPage - 1) * DASHBOARD_PAGE_SIZE;
  return filtered.slice(startIndex, startIndex + DASHBOARD_PAGE_SIZE);
}

// Render
function renderTable() {
  const tbody = document.getElementById('ticketTableBody');
  const emptyState = document.getElementById('emptyState');
  const pagination = document.getElementById('dashboardPagination');
  tbody.innerHTML = '';

  const filtered = getFilteredTickets();

  if (filtered.length === 0) {
    emptyState.style.display = 'flex';
    pagination.style.display = 'none';
    updateSelectionCount();
    return;
  }
  
  emptyState.style.display = 'none';

  const totalPages = Math.max(1, Math.ceil(filtered.length / DASHBOARD_PAGE_SIZE));
  if (dashboardCurrentPage > totalPages) {
    dashboardCurrentPage = totalPages;
  }

  const startIndex = (dashboardCurrentPage - 1) * DASHBOARD_PAGE_SIZE;
  const pageTickets = filtered.slice(startIndex, startIndex + DASHBOARD_PAGE_SIZE);

  pageTickets.forEach(t => {
    const tr = document.createElement('tr');
    tr.className = 'ticket-row';
    tr.onclick = () => window.location.href = `workspace.html?id=${t.id}`;

    // Styling logic from API helpers
    const statBadge = `<span class="ticket-badge ${statusClass(t.status)}">${escapeHTML(t.status)}</span>`;
    const prioBadge = `<span class="ticket-badge ${priorityClass(t.priority)}">${escapeHTML(t.priority)}</span>`;
    const activityStr = formatTimestamp(t.last_message_time || t.created_at);
    const submittedStr = formatTimestamp(t.created_at);
    const isSelected = selectedTicketIds.has(Number(t.id));
    const subjectHTML = currentUser.role === 'admin'
      ? `<span>${escapeHTML(t.subject)}</span>`
      : `<span>${escapeHTML(t.subject)}</span><button type="button" class="btn-secondary edit-subject-btn" data-ticket-id="${t.id}">Edit</button>`;

    let unreadDot = t.unread_count > 0 ? `<span class="unread-dot" title="${t.unread_count} unread"></span>` : '';
    
    let rowHTML = `
      <td class="row-select-cell admin-only-td"><input type="checkbox" class="row-select-checkbox" data-ticket-id="${t.id}" ${isSelected ? 'checked' : ''}></td>
      <td class="t-id">${unreadDot}${escapeHTML(t.ticket_number)}</td>
      <td class="t-subject"><div class="subject-cell">${subjectHTML}</div></td>
      <td>${statBadge}</td>
      <td>${prioBadge}</td>
      <td>${escapeHTML(t.category)}</td>
      <td class="admin-only-td">${escapeHTML(t.user_username || 'User')}</td>
      <td class="t-assignee">${escapeHTML(t.admin_username || 'Unassigned')}</td>
      <td class="t-time">${activityStr}</td>
      <td class="t-time">${submittedStr}</td>
    `;
    
    tr.innerHTML = rowHTML;
    // hide admin-only tds if user
    if (currentUser.role !== 'admin') {
      tr.querySelectorAll('.admin-only-td').forEach(el => el.style.display = 'none');
    }

    tr.querySelectorAll('.row-select-checkbox').forEach(checkbox => {
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        const ticketId = Number(checkbox.dataset.ticketId);
        if (checkbox.checked) {
          selectedTicketIds.add(ticketId);
        } else {
          selectedTicketIds.delete(ticketId);
        }
        updateSelectionCount();
      });
    });

    const editBtn = tr.querySelector('.edit-subject-btn');
    if (editBtn) {
      editBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ticketId = Number(editBtn.dataset.ticketId);
        const currentSubject = t.subject;
        const nextSubject = prompt('Edit ticket subject', currentSubject);
        if (nextSubject === null) return;

        const trimmed = nextSubject.trim();
        if (!trimmed) {
          showToast('Subject cannot be empty');
          return;
        }

        try {
          await updateTicketSubject(ticketId, trimmed);
          await loadTickets();
        } catch (err) {
          showToast('Failed to update subject');
        }
      });
    }

    tbody.appendChild(tr);
  });

  pagination.style.display = 'flex';
  pagination.innerHTML = `
    <div class="pagination-info">Showing ${startIndex + 1}-${Math.min(startIndex + DASHBOARD_PAGE_SIZE, filtered.length)} of ${filtered.length}</div>
    <div class="pagination-controls">
      <button class="btn-secondary pagination-btn" id="dashboardPrevPage" ${dashboardCurrentPage === 1 ? 'disabled' : ''}>Prev</button>
      <div class="pagination-info">Page ${dashboardCurrentPage} of ${totalPages}</div>
      <button class="btn-secondary pagination-btn" id="dashboardNextPage" ${dashboardCurrentPage === totalPages ? 'disabled' : ''}>Next</button>
    </div>
  `;

  document.getElementById('dashboardPrevPage').onclick = () => {
    if (dashboardCurrentPage > 1) {
      dashboardCurrentPage -= 1;
      renderTable();
    }
  };

  document.getElementById('dashboardNextPage').onclick = () => {
    if (dashboardCurrentPage < totalPages) {
      dashboardCurrentPage += 1;
      renderTable();
    }
  };

  updateSelectionCount();
}

function updateSelectionCount() {
  const selectionCount = document.getElementById('selectionCount');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  if (!selectionCount || !deleteSelectedBtn) return;

  const count = selectedTicketIds.size;
  selectionCount.textContent = `${count} selected`;
  deleteSelectedBtn.disabled = count === 0;

  // Recompute toggle booleans based on current selection
  const filteredIds = getFilteredTickets().map(t => Number(t.id));
  const pageIds = getCurrentPageTickets().map(t => Number(t.id));
  allToggle = filteredIds.length > 0 && filteredIds.every(id => selectedTicketIds.has(id));
  pageToggle = pageIds.length > 0 && pageIds.every(id => selectedTicketIds.has(id));

  // Update toggle button visual states
  const selectPageBtn = document.getElementById('selectPageBtn');
  const selectAllBtn = document.getElementById('selectAllBtn');
  if (selectPageBtn) {
    if (pageToggle) selectPageBtn.classList.add('btn-active'); else selectPageBtn.classList.remove('btn-active');
  }
  if (selectAllBtn) {
    if (allToggle) selectAllBtn.classList.add('btn-active'); else selectAllBtn.classList.remove('btn-active');
  }
}

// Simple toast for dashboard
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
