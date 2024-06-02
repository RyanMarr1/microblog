// populatedb.js

const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');

// Placeholder for the database file name
const dbFileName = 'your_database_file.db';

async function initializeDB() {
    const db = await sqlite.open({ filename: dbFileName, driver: sqlite3.Database });

    // await db.exec(`
    //   DELETE FROM users;
    //   DELETE FROM posts;
    // `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            hashedGoogleId TEXT NOT NULL UNIQUE,
            avatar_url TEXT,
            memberSince DATETIME NOT NULL,
            bio TEXT
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            username TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            likes INTEGER NOT NULL,
            likedBy TEXT DEFAULT '[]'
        );
        
        CREATE TABLE IF NOT EXISTS replies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            username TEXT NOT NULL,
            repliedToId INTEGER NOT NULL,
            timestamp DATETIME NOT NULL,
            FOREIGN KEY(repliedToId) REFERENCES posts(id) ON DELETE CASCADE
        );
    `);

    // Sample data - Replace these arrays with your own data
    const users = [
      { username: 'SampleUser', hashedGoogleId: '8d945a9691fae136b71eea807c440005ebecba389c5bc', avatar_url: '', memberSince: '2024-01-01 12:00:00'},
      { username: 'AnotherUser', hashedGoogleId: '9a845a9791fae136b71eea807c440005ebecba389c5b', avatar_url: '', memberSince: '2024-01-02 12:00:00'}
    ];
  
    const posts = [
        { title: 'First Post', content: 'This is the first post', username: 'SampleUser', timestamp: '2024-01-01 12:30:00', likes: 0 , likedBy: '[]' },
        { title: 'Second Post', content: 'This is the second post', username: 'AnotherUser', timestamp: '2024-01-02 12:30:00', likes: 0 , likedBy: '[]' },
    ];

    const replies = [
        { content: 'First reply to first post', username: 'AnotherUser', repliedToId: 1, timestamp: '2024-01-01 13:00:00' },
        { content: 'Second reply to first post', username: 'SampleUser', repliedToId: 1, timestamp: '2024-01-01 13:05:00' }
    ];

    // Insert sample data into the database
    await Promise.all(users.map(user => {
        return db.run(
            'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
            [user.username, user.hashedGoogleId, user.avatar_url, user.memberSince]
        );
    }));

    await Promise.all(posts.map(post => {
        return db.run(
            'INSERT INTO posts (title, content, username, timestamp, likes, likedBy) VALUES (?, ?, ?, ?, ?, ?)',
            [post.title, post.content, post.username, post.timestamp, post.likes, post.likedBy]
        );
    }));

    await Promise.all(replies.map(reply => {
        return db.run(
            'INSERT INTO replies (content, username, repliedToId, timestamp) VALUES (?, ?, ?, ?)',
            [reply.content, reply.username, reply.repliedToId, reply.timestamp]
        );
    }));

    console.log('Database populated with initial data.');
    await db.close();
}

// initializeDB().catch(err => {
//     console.error('Error initializing database:', err);
// });

module.exports =  { initializeDB };