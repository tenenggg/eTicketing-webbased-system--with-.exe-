const pool = require('../config/db');                   // imports the database connection pool


// ============================================================
// MESSAGE QUERIES
// ============================================================

// Fetches all messages for a specific ticket (chat thread)
// Excludes internal notes for regular users
const getMessagesByTicket = async (ticketId) => {
    let sql = `
        SELECT m.id, m.ticket_id, m.sender_id, m.content, m.is_read,
               m.created_at, u.username AS sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.ticket_id = ?
    `;
    sql += ' ORDER BY m.created_at ASC';

    const result = await pool.query(sql, [ticketId]);
    return result.rows;
};


// Saves a new message linked to a specific ticket
const saveMessage = async (ticketId, senderId, content) => {
    const result = await pool.query(
        `INSERT INTO messages (ticket_id, sender_id, content)
         VALUES (?, ?, ?)`,
        [ticketId, senderId, content]
    );

    // Also update the ticket's updated_at timestamp so it bubbles up in the list
    await pool.query(
        'UPDATE tickets SET updated_at = NOW() WHERE id = ?',
        [ticketId]
    );

    const savedMessage = await getMessageById(result.insertId);
    return savedMessage;
};


// Marks all unread messages in a ticket as read (used by admin opening a ticket)
const markMessagesAsRead = async (ticketId, readerId) => {
    await pool.query(
        `UPDATE messages SET is_read = 1
         WHERE ticket_id = ? AND sender_id != ? AND is_read = 0`,
        [ticketId, readerId]                               // only mark messages from others as read
    );
};


// Finds a single message by its ID
const getMessageById = async (messageId) => {
    const result = await pool.query(
        `SELECT m.*, u.username AS sender_name
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.id = ?`,
        [messageId]
    );
    return result.rows[0] || null;
};


// Removes a message from the database permanently
const deleteMessage = async (messageId) => {
    await pool.query(
        'DELETE FROM messages WHERE id = ?',
        [messageId]
    );
};


module.exports = {
    // Message
    getMessagesByTicket,
    saveMessage,
    markMessagesAsRead,
    getMessageById,
    deleteMessage,
};