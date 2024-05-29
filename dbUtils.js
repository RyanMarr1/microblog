const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');

const dbFileName = 'your_database_file.db';

async function findUserByHashedGoogleId(hashedGoogleId) {
    const db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });
    console.log("hash function reached");
    try {
        const query = 'SELECT * FROM users WHERE hashedGoogleId = ?';
        const row = await db.get(query, [hashedGoogleId]);
        return row; // row will be undefined if no user is found
    } catch (err) {
        throw err;
    } finally {
        await db.close();
    }
}

module.exports = { findUserByHashedGoogleId };