// ---------------------------------------------------------------
// Ticket Workspace (workspace.js)
// ---------------------------------------------------------------

const currentUser = getUser();
if (!currentUser) {
  window.location.href = 'login.html';
}

const isAdmin = currentUser.role === 'admin';

// State
let allTickets = [];
let activeTicketId = null;
let currentTicket = null;
let sidebarCurrentPage = 1;
const SIDEBAR_PAGE_SIZE = 20;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Apply role classes
  if (isAdmin) {
    document.body.classList.add('is-admin');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
    document.querySelectorAll('.admin-only-select').forEach(el => el.disabled = false);
  } else {
    document.body.classList.add('is-user');
    // Hide right panel for users
    const rp = document.getElementById('rightPanel');
    if (rp) rp.style.display = 'none';
    document.querySelectorAll('.user-only').forEach(el => el.style.display = '');
  }

  // Back button
  document.getElementById('backToDashBtn').addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });

  // Get Ticket ID from URL
  const params = new URLSearchParams(window.location.search);
  const tId = params.get('id');

  socket = initializeSocket();
  bindSocketEvents();
  bindUIEvents();

  await loadSidebarTickets();

  if (tId) {
    await openTicket(tId);
  } else if (allTickets.length > 0) {
    // Open first by default
    await openTicket(allTickets[0].id);
  }
});

// Load Sidebar
async function loadSidebarTickets() {
  try {
    allTickets = await fetchTickets();
    renderSidebar();
  } catch (err) {
    console.error('Failed to load tickets', err);
  }
}

// Render Sidebar
function renderSidebar() {
  const list = document.getElementById('sidebarTicketList');
  const pagination = document.getElementById('sidebarPagination');

  const q = document.getElementById('sidebarSearch').value.toLowerCase();
  const sort = document.getElementById('sidebarSort').value;
  const filterPrio = document.getElementById('sidebarFilterPriority') ? document.getElementById('sidebarFilterPriority').value : '';
  const filterType = document.getElementById('sidebarFilterType') ? document.getElementById('sidebarFilterType').value : '';

  let filtered = allTickets.filter(t => {
    if (q && !t.subject.toLowerCase().includes(q) && !t.ticket_number.toLowerCase().includes(q)) return false;
    if (filterPrio && t.priority !== filterPrio) return false;
    if (filterType && t.category !== filterType) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const timeA = new Date(a.last_message_time || a.created_at).getTime();
    const timeB = new Date(b.last_message_time || b.created_at).getTime();
    const createA = new Date(a.created_at).getTime();
    const createB = new Date(b.created_at).getTime();
    return sort === 'newest' ? createB - createA : timeB - timeA;
  });

  if (filtered.length === 0) {
    sidebarCurrentPage = 1;
    list.innerHTML = `<div class="sidebar-empty">No tickets found</div>`;
    pagination.style.display = 'none';
    return;
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / SIDEBAR_PAGE_SIZE));
  if (sidebarCurrentPage > totalPages) {
    sidebarCurrentPage = totalPages;
  }

  const startIndex = (sidebarCurrentPage - 1) * SIDEBAR_PAGE_SIZE;
  const pageTickets = filtered.slice(startIndex, startIndex + SIDEBAR_PAGE_SIZE);

  list.innerHTML = '';
  pageTickets.forEach(t => {
    const li = document.createElement('li');
    li.className = `sidebar-item ${Number(t.id) === Number(activeTicketId) ? 'active' : ''}`;

    // Check if unread (from API count for admin)
    if (t.unread_count > 0) li.classList.add('unread');

    const timeStr = formatTimestamp(t.last_message_time || t.created_at);

    li.innerHTML = `
      <div class="si-top">
        <span class="si-id">${t.unread_count ? `<span class="unread-dot" title="${t.unread_count} unread"></span>` : ''}${escapeHTML(t.ticket_number)}</span>
        <span class="si-time">${timeStr}</span>
      </div>
      <div class="si-subject">${escapeHTML(t.subject)}</div>
      <div class="si-bottom">
        <span class="ticket-badge ${statusClass(t.status)}">${escapeHTML(t.status)}</span>
      </div>
    `;

    li.onclick = () => {
      // Update URL without reload
      window.history.pushState({}, '', `workspace.html?id=${t.id}`);
      openTicket(t.id);
    };

    list.appendChild(li);
  });

  pagination.style.display = 'flex';
  pagination.innerHTML = `
    <div class="pagination-controls">
      <button class="btn-secondary pagination-btn" id="sidebarPrevPage" ${sidebarCurrentPage === 1 ? 'disabled' : ''}>Prev</button>
      <div class="pagination-info">Page ${sidebarCurrentPage} of ${totalPages}</div>
      <button class="btn-secondary pagination-btn" id="sidebarNextPage" ${sidebarCurrentPage === totalPages ? 'disabled' : ''}>Next</button>
    </div>
  `;

  document.getElementById('sidebarPrevPage').onclick = () => {
    if (sidebarCurrentPage > 1) {
      sidebarCurrentPage -= 1;
      renderSidebar();
    }
  };

  document.getElementById('sidebarNextPage').onclick = () => {
    if (sidebarCurrentPage < totalPages) {
      sidebarCurrentPage += 1;
      renderSidebar();
    }
  };
}

// Open Specific Ticket
async function openTicket(ticketId) {
  if (activeTicketId && activeTicketId !== ticketId) {
    leaveTicketRoom(activeTicketId);
  }

  activeTicketId = ticketId;
  joinTicketRoom(ticketId);

  // Update active state in sidebar immediately
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  renderSidebar(); // re-render to set active class

  try {
    const [ticket, messages] = await Promise.all([
      fetchTicket(ticketId),
      fetchMessages(ticketId)
    ]);
    currentTicket = ticket;

    // Mark as read for both users and admins when opening the ticket
    await markTicketRead(ticketId);

    renderWorkspace(ticket, messages);
  } catch (err) {
    console.error('Error opening ticket', err);
    showToast('Failed to load ticket details');
  }
}

// Render Workspace (Middle + Right)
function renderWorkspace(ticket, messages) {
  // Topbar
  document.getElementById('topbarTicketId').textContent = ticket.ticket_number;
  document.getElementById('topbarSubject').textContent = ticket.subject;

  if (!isAdmin) {
    document.getElementById('topbarUserAssignee').textContent = `Assigned Admin: ${ticket.admin_username || 'Unassigned'}`;
  }

  // Middle (Messages)
  renderMessages(messages);

  // Handle closed state input locking
  const isClosed = ticket.status === 'Closed';
  document.getElementById('chatInputArea').style.display = isClosed ? 'none' : 'flex';
  document.getElementById('closedBanner').style.display = isClosed ? 'flex' : 'none';

  // Right Panel (Admin Controls)
  if (isAdmin) {
    // Section 1: User Credentials
    document.getElementById('detailUserId').textContent = ticket.user_id;
    document.getElementById('detailUserName').textContent = ticket.user_username;
    document.getElementById('detailUserDate').textContent = formatTimestamp(ticket.created_at);

    document.getElementById('detailAssignee').textContent = ticket.admin_username || 'Unassigned';

    // Show/hide Assign To Me button
    const assignBtn = document.getElementById('assignToMeBtn');
    if (Number(ticket.assigned_admin_id) === Number(currentUser.id)) {
      assignBtn.style.display = 'none';
    } else {
      assignBtn.style.display = 'inline-block';
    }

    document.getElementById('detailType').value = ticket.category;
    document.getElementById('detailStatus').value = ticket.status;

    // Priority pills
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    const pBtn = document.querySelector(`.pill-btn[data-val="${ticket.priority}"]`);
    if (pBtn) pBtn.classList.add('active');
  }
}

function renderMessages(messages) {
  const list = document.getElementById('messagesList');
  list.innerHTML = '';

  if (messages.length === 0) {
    list.innerHTML = `<div class="empty-state">No messages yet.</div>`;
    return;
  }

  messages.forEach(msg => {
    const isSent = msg.sender_id === currentUser.id;
    const div = document.createElement('div');
    div.className = `message ${isSent ? 'sent' : 'received'}`;
    div.dataset.id = msg.id;

    div.innerHTML = `
      <div class="content">${escapeHTML(msg.content)}</div>
      <div class="meta">
        ${isSent ? 'You' : escapeHTML(msg.sender_name || 'System')} • ${formatTimestamp(msg.created_at)}
        ${isSent ? `<button class="delete-btn" title="Delete">×</button>` : ''}
      </div>
    `;

    const deleteBtn = div.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (confirm('Delete message?')) {
          try {
            await deleteMessage(msg.id);
            div.remove();
          } catch (e) { }
        }
      };
    }
    list.appendChild(div);
  });

  list.scrollTop = list.scrollHeight;
}

// Bind UI Events
function bindUIEvents() {
  document.getElementById('sidebarSearch').addEventListener('input', () => { sidebarCurrentPage = 1; renderSidebar(); });
  document.getElementById('sidebarSort').addEventListener('change', () => { sidebarCurrentPage = 1; renderSidebar(); });
  if (document.getElementById('sidebarFilterPriority')) {
    document.getElementById('sidebarFilterPriority').addEventListener('change', () => { sidebarCurrentPage = 1; renderSidebar(); });
  }
  if (document.getElementById('sidebarFilterType')) {
    document.getElementById('sidebarFilterType').addEventListener('change', () => { sidebarCurrentPage = 1; renderSidebar(); });
  }

  // Chat form
  document.getElementById('chatForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !activeTicketId) return;

    if (isAdmin) {
      socket.emit('admin_reply', { ticketId: activeTicketId, content });
    } else {
      socket.emit('send_message', { ticketId: activeTicketId, content });
    }
    input.value = '';
  });

  // Admin Controls
  if (isAdmin) {
    document.getElementById('assignToMeBtn').addEventListener('click', () => {
      updateActiveTicket({ assigned_admin_id: currentUser.id });
    });

    document.getElementById('detailType').addEventListener('change', (e) => {
      updateActiveTicket({ category: e.target.value });
    });

    document.getElementById('detailStatus').addEventListener('change', (e) => {
      updateActiveTicket({ status: e.target.value });
    });

    document.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        updateActiveTicket({ priority: e.target.dataset.val });
      });
    });
  }
}

async function updateActiveTicket(updates) {
  if (!activeTicketId) return;
  try {
    const updated = await updateTicket(activeTicketId, updates);
    currentTicket = updated;
    const msgs = await fetchMessages(activeTicketId);
    renderWorkspace(currentTicket, msgs);
    // Socket 'ticket_updated' also handles broadcast refresh
  } catch (err) {
    showToast('Failed to update ticket');
  }
}

// Socket Events
function bindSocketEvents() {
  socket.on('receive_message', async (msg) => {
    if (Number(msg.ticket_id) === Number(activeTicketId)) {
      if (msg.sender_id !== currentUser.id) {
        await markTicketRead(activeTicketId);
      }
      fetchMessages(activeTicketId).then(renderMessages); // easy way to refresh and keep order
    }
    loadSidebarTickets(); // refresh sidebar snippet/time
  });

  socket.on('message_deleted', () => {
    if (activeTicketId) fetchMessages(activeTicketId).then(renderMessages);
  });

  socket.on('ticket_updated', (t) => {
    if (Number(t.id) === Number(activeTicketId)) {
      currentTicket = t;
      fetchMessages(activeTicketId).then(msgs => renderWorkspace(t, msgs));
    }
    loadSidebarTickets();
  });

  socket.on('ticket_deleted', (payload) => {
    const deletedId = Number(payload?.id);
    if (Number(activeTicketId) === deletedId) {
      activeTicketId = null;
      currentTicket = null;
      showToast('This ticket was deleted');
      window.location.href = 'dashboard.html';
      return;
    }

    loadSidebarTickets();
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
