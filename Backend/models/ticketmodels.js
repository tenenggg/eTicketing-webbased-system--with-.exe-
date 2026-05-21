const pool = require('../config/db');                   // imports the database connection pool


// ============================================================
// TICKET QUERIES
// ============================================================

// Generates the next ticket number in the format TKT-0001
const getNextTicketNumber = async () => {
    const result = await pool.query(
        'SELECT MAX(id) AS max_id FROM tickets'
    );
    const maxId = result.rows[0].max_id || 0;
    const nextId = maxId + 1;
    return `TKT-${String(nextId).padStart(4, '0')}`;    // e.g. TKT-0001, TKT-0042
};


// Creates a new ticket in the database
const createTicket = async (userId, subject, category = 'General') => {
    const ticketNumber = await getNextTicketNumber();
    const result = await pool.query(
        `INSERT INTO tickets (ticket_number, user_id, subject, category, status, priority)
         VALUES (?, ?, ?, ?, 'Open', 'Medium')`,
        [ticketNumber, userId, subject, category]
    );
    const ticket = await getTicketById(result.insertId);
    return ticket;
};


// Normalizes incoming status values to the canonical database values.
const normalizeStatus = (status) => {
    if (status === undefined || status === null) {
        return status;
    }

    const compact = String(status).trim().toLowerCase().replace(/[-\s_]+/g, '');

    if (compact === 'onhold') return 'On-Hold';
    if (compact === 'inprogress') return 'In Progress';
    if (compact === 'closed') return 'Closed';
    if (compact === 'open') return 'Open';

    return status;
};


// Fetches a single ticket by its primary key ID
const getTicketById = async (ticketId) => {
    const result = await pool.query(
        `SELECT t.*, 
                u.username AS user_username,
                a.username AS admin_username
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN users a ON t.assigned_admin_id = a.id
         WHERE t.id = ?`,
        [ticketId]
    );
    return result.rows[0] || null;
};


// Fetches all tickets — used by admin dashboard
// Optionally filter by status or assigned admin
const getAllTickets = async ({ status, assignedAdminId } = {}) => {
    let sql = `
        SELECT t.*,
               u.username AS user_username,
               a.username AS admin_username,
               (SELECT COUNT(*) FROM messages m 
                WHERE m.ticket_id = t.id AND m.is_read = 0 AND m.sender_id = t.user_id) AS unread_count,
               (SELECT MAX(m2.created_at) FROM messages m2 WHERE m2.ticket_id = t.id) AS last_message_time
        FROM tickets t
        JOIN users u ON t.user_id = u.id
        LEFT JOIN users a ON t.assigned_admin_id = a.id
        WHERE 1=1
    `;
    const params = [];

    if (status) {
        sql += ' AND t.status = ?';
        params.push(status);
    }
    if (assignedAdminId) {
        sql += ' AND t.assigned_admin_id = ?';
        params.push(assignedAdminId);
    }

    sql += ' ORDER BY (last_message_time IS NULL), last_message_time DESC, t.created_at DESC';

    const result = await pool.query(sql, params);
    return result.rows;
};


// Fetches all tickets created by a specific user — used by the user dashboard
const getTicketsByUser = async (userId) => {
    const result = await pool.query(
        `SELECT t.*,
                a.username AS admin_username,
                (SELECT COUNT(*) FROM messages m WHERE m.ticket_id = t.id AND m.is_read = 0 AND m.sender_id != t.user_id) AS unread_count,
                (SELECT MAX(m.created_at) FROM messages m WHERE m.ticket_id = t.id) AS last_message_time
         FROM tickets t
         LEFT JOIN users a ON t.assigned_admin_id = a.id
         WHERE t.user_id = ?
         ORDER BY (last_message_time IS NULL), last_message_time DESC, t.created_at DESC`,
        [userId]
    );
    return result.rows;
};


// Updates a ticket's status, priority, category, or assigned admin
const updateTicket = async (ticketId, fields) => {
    // Dynamically build the SET clause from the provided fields
    const allowed = ['status', 'priority', 'category', 'assigned_admin_id'];
    const setClauses = [];
    const params = [];

    const normalizedFields = {
        ...fields,
        status: normalizeStatus(fields.status),
    };

    for (const key of allowed) {
        if (normalizedFields[key] !== undefined) {
            setClauses.push(`${key} = ?`);
            params.push(normalizedFields[key]);
        }
    }

    // Automatically set closed_at when ticket is closed
    if (normalizedFields.status === 'Closed') {
        setClauses.push('closed_at = NOW()');
    } else if (normalizedFields.status && normalizedFields.status !== 'Closed') {
        setClauses.push('closed_at = NULL');  // reopen clears the close time
    }

    if (setClauses.length === 0) return null;

    params.push(ticketId);
    await pool.query(
        `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = ?`,
        params
    );
    return getTicketById(ticketId);
};


// Updates only the ticket subject
const updateTicketSubject = async (ticketId, subject) => {
    const trimmedSubject = String(subject || '').trim();
    if (!trimmedSubject) {
        return null;
    }

    await pool.query(
        'UPDATE tickets SET subject = ? WHERE id = ?',
        [trimmedSubject, ticketId]
    );
    return getTicketById(ticketId);
};


// Deletes a ticket and its messages via cascading foreign keys
const deleteTicket = async (ticketId) => {
    const ticket = await getTicketById(ticketId);
    if (!ticket) {
        return null;
    }

    await pool.query('DELETE FROM tickets WHERE id = ?', [ticketId]);
    return ticket;
};


module.exports = {
    // Ticket
    createTicket,
    getTicketById,
    getAllTickets,
    getTicketsByUser,
    updateTicket,
    updateTicketSubject,
    deleteTicket,
};
