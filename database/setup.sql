-- Database Initialization Script for eTicketing
-- MySQL Version


CREATE DATABASE IF NOT EXISTS ticketing
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE ticketing;


-- ============================================================
-- TABLE: users
-- Stores both admin and regular user accounts.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'user'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: tickets
-- Each support request is a ticket.
-- A ticket is created by a user and can be assigned to an admin.
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    ticket_number     VARCHAR(20)  UNIQUE NOT NULL,          -- Human-readable ID e.g. TKT-0001
    user_id           INT          NOT NULL,                 -- Who raised this ticket
    assigned_admin_id INT          DEFAULT NULL,             -- Which admin is handling it (NULL = unassigned)
    subject           VARCHAR(255) NOT NULL,                 -- Short title of the issue
    category          VARCHAR(50)  DEFAULT 'General'
                          CHECK (category IN (
                              'General', 'Technical', 'Billing', 'Bug', 'Other'
                          )),
    status            VARCHAR(20)  NOT NULL DEFAULT 'Open'
                          CHECK (status IN (
                              'Open', 'In Progress', 'On-Hold', 'Closed'
                          )),
    priority          VARCHAR(10)  NOT NULL DEFAULT 'Medium'
                          CHECK (priority IN (
                              'Low', 'Medium', 'High', 'Urgent'
                          )),
    created_at        DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    closed_at         DATETIME    DEFAULT NULL,              -- Set when status becomes Closed

    FOREIGN KEY (user_id)           REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- TABLE: messages
-- Chat messages that belong to a specific ticket.
-- ticket_id links each message to its parent ticket.
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id  INT  NOT NULL,                               -- Every message belongs to a ticket
    sender_id  INT,
    content    TEXT NOT NULL,
    is_read    TINYINT(1)  DEFAULT 0,
    created_at DATETIME    DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- SEED DATA
-- Default password for all seed users: 'password123'
-- ============================================================
INSERT IGNORE INTO users (username, password_hash, role) VALUES
    ('admin', '$2b$10$n6yoARjUhbpX/GTF9SAwzOaHm9hncqtYIAxzlDzr319IxZ0TIchom', 'admin'),
    ('user1',  '$2b$10$n6yoARjUhbpX/GTF9SAwzOaHm9hncqtYIAxzlDzr319IxZ0TIchom', 'user'),
    ('user2',  '$2b$10$n6yoARjUhbpX/GTF9SAwzOaHm9hncqtYIAxzlDzr319IxZ0TIchom', 'user'),
    ('user3',  '$2b$10$n6yoARjUhbpX/GTF9SAwzOaHm9hncqtYIAxzlDzr319IxZ0TIchom', 'user');


-- if want to create new user just register at the website, if want to create new admin
-- also create a new user but change the role at database to admin