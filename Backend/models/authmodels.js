const pool = require('../config/db');                   // imports the database connection pool


// Finds a user in the database by their username
const findByUsername = async (username) => {
    const result = await pool.query('SELECT * FROM users WHERE username = ?', [username]); // executes SQL query
    return result.rows[0] || null;                        // returns the user object if found, otherwise returns null
};





// Creates a new user record in the database
const createUser = async (username, passwordHash, role = 'user') => {
    const result = await pool.query(                      // inserts a new row into the users table
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [username, passwordHash, role]                    // parameterized inputs for security
    );

    return {
        id: result.insertId,
        username,
        role,
    };
};


module.exports = {
    findByUsername,
    createUser,
};
