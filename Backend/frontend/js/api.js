const API_BASE = '/api';                             // base URL for all API requests


// ---------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------

// Returns JWT auth headers for every request
function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// Returns the current user object from localStorage, or null
function getUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

// Clears session and redirects to login
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}


// ---------------------------------------------------------------
// Core fetch wrapper — adds auth, handles 401/403 auto-logout
// ---------------------------------------------------------------
async function apiFetch(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = 'login.html';
    }
    throw new Error(data.message || 'API Error');
  }

  return data;
}


// ---------------------------------------------------------------
// Ticket API helpers
// ---------------------------------------------------------------

// Creates a new ticket and returns the ticket object
async function createTicket(subject, category = 'General') {
  return await apiFetch('/tickets', {
    method: 'POST',
    body: JSON.stringify({ subject, category })
  });
}

// Fetches the list of tickets visible to the current user
// Admin: all tickets (optional ?status=Open&mine=true)
// User:  only their own tickets
async function fetchTickets(params = {}) {
  const query = new URLSearchParams(params).toString();
  return await apiFetch(`/tickets${query ? '?' + query : ''}`);
}

// Fetches a single ticket by ID
async function fetchTicket(ticketId) {
  return await apiFetch(`/tickets/${ticketId}`);
}

// Admin: update ticket fields (status, priority, category, assigned_admin_id)
async function updateTicket(ticketId, fields) {
  return await apiFetch(`/tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify(fields)
  });
}

// User: update ticket subject only
async function updateTicketSubject(ticketId, subject) {
  return await apiFetch(`/tickets/${ticketId}/subject`, {
    method: 'PATCH',
    body: JSON.stringify({ subject })
  });
}

// Admin: delete a ticket
async function deleteTicket(ticketId) {
  return await apiFetch(`/tickets/${ticketId}`, {
    method: 'DELETE'
  });
}


// ---------------------------------------------------------------
// Message API helpers
// ---------------------------------------------------------------

// Fetches the message thread for a ticket
async function fetchMessages(ticketId) {
  return await apiFetch(`/chat/tickets/${ticketId}/messages`);
}

// Deletes a specific message (sender only)
async function deleteMessage(messageId) {
  return await apiFetch(`/chat/messages/${messageId}`, {
    method: 'DELETE'
  });
}

// Admin: marks all messages in a ticket as read
async function markTicketRead(ticketId) {
  return await apiFetch(`/chat/tickets/${ticketId}/read`, {
    method: 'POST'
  });
}


// ---------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------

// Formats DB timestamps into human-readable strings
function formatTimestamp(dateStr) {
  const messageDate = new Date(dateStr);
  if (isNaN(messageDate.getTime())) return '';

  const now = new Date();
  const isToday = messageDate.toDateString() === now.toDateString();

  if (isToday) {
    return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' +
           messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// Maps a ticket status string to a CSS class name
function statusClass(status) {
  const map = {
    'Open':        'status-open',
    'In Progress': 'status-inprogress',
    'On-Hold':     'status-onhold',
    'Closed':      'status-closed',
  };
  return map[status] || 'status-open';
}

// Maps a ticket priority string to a CSS class name
function priorityClass(priority) {
  const map = {
    'Low':    'priority-low',
    'Medium': 'priority-medium',
    'High':   'priority-high',
    'Urgent': 'priority-urgent',
  };
  return map[priority] || 'priority-medium';
}

// Prevents XSS by escaping HTML special characters
function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag])
  );
}
