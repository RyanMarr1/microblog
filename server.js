const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const canvas = require('canvas');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const crypto = require('crypto');
require('dotenv').config();
const accessToken = process.env.EMOJI_API_KEY;
const { initializeDB } = require('./populatedb');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const { readdirSync } = require('fs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// Configure passport
passport.use(new GoogleStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: `http://localhost:${PORT}/auth/google/callback`
}, (token, tokenSecret, profile, done) => {
    console.log(profile);
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

// Establish connection to database
async function getDBConnection() {
    const db = await sqlite.open({
        filename: 'your_database_file.db',
        driver: sqlite3.Database
    });
    return db;
}

// Fetch posts and useres arrays from db
async function initializeData() {
    try {
        await initializeDB();
        console.log('Data initialized from database.');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// assign database and call init posts and users in initializeData()
let db;
(async () => {
    try {
        db = await getDBConnection();
        console.log('Database connection established successfully!');
        await initializeData();
    } catch (error) {
        console.error('Error establishing database connection:', error);
    }
})();

/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers

    Handlebars helpers are custom functions that can be used within the templates 
    to perform specific tasks. They enhance the functionality of templates and 
    help simplify data manipulation directly within the view files.

    In this project, two helpers are provided:
    
    1. toLowerCase:
       - Converts a given string to lowercase.
       - Usage example: {{toLowerCase 'SAMPLE STRING'}} -> 'sample string'

    2. ifCond:
       - Compares two values for equality and returns a block of content based on 
         the comparison result.
       - Usage example: 
            {{#ifCond value1 value2}}
                <!-- Content if value1 equals value2 -->
            {{else}}
                <!-- Content if value1 does not equal value2 -->
            {{/ifCond}}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

// Set up Handlebars view engine with custom helpers
//
app.engine(
    'handlebars',
    expressHandlebars.engine({
        helpers: {
            toLowerCase: function (str) {
                return str.toLowerCase();
            },
            ifCond: function (v1, v2, options) {
                if (v1 === v2) {
                    return options.fn(this);
                }
                return options.inverse(this);
            },
        },
    })
);

app.set('view engine', 'handlebars');
app.set('views', './views');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.use(
    session({
        secret: 'oneringtorulethemall',     // Secret key to sign the session ID cookie
        resave: false,                      // Don't save session if unmodified
        saveUninitialized: false,           // Don't create session until something stored
        cookie: { secure: false },          // True if using https. Set to false for development without https
    })
);

// Replace any of these variables below with constants for your application. These variables
// should be used in your template files. 
// 
app.use((req, res, next) => {
    res.locals.appName = 'RennyGram';
    res.locals.copyrightYear = 2024;
    res.locals.postNeoType = 'Post';
    res.locals.loggedIn = req.session.loggedIn || false;
    res.locals.userId = req.session.userId || '';
    next();
});

app.use(express.static('public'));                  // Serve static files
app.use(express.urlencoded({ extended: true }));    // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json());                            // Parse JSON bodies (as sent by API clients)

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//
app.get('/', async (req, res) => {
    const posts = await getPosts();
    const user = await getCurrentUser(req) || {};
    res.render('home', { posts, user, apikey: accessToken});
});

app.post('/deleteReply/:id', isAuthenticated, async (req, res) => {
    // TODO: Delete a reply if the current user is the owner
    const user = await getCurrentUser(req) || {}; // get current user
    const replyId = parseInt(req.params.id); // get post id from url
    
    try {
        const replyToDelete = await db.get('SELECT * FROM replies WHERE id = ?', [replyId]);

        if (!replyToDelete) { // if reply doesn't exist
            return res.status(404).send('Reply not found');
        }

        if (replyToDelete.username !== user.username) { // safeguard against deleting others replies
            return res.status(403).send('You are not allowed to delete other users\' posts');
        }

        await db.run('DELETE FROM replies WHERE id = ?', [replyId]); // delete from database
        res.send('Reply successfully deleted');
    } catch (error) {
        console.error('Error deleting reply:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/postReply',async (req, res) => {
    //TODO: Add a new reply and redirect to home

    const title = req.body.title;
    const content = req.body.content;
    const user = await getCurrentUser(req);
    const postId = req.body.postId;

    if (user) {
        await addReply(content, user, postId);
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

// Function to add a new reply
async function addReply(content, user, postId) {    
    // TODO: Create a new reply object and add to reply array
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');
    const timestamp = year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
    
    try {
        await db.run('INSERT INTO replies (content, username, repliedToId, timestamp) VALUES (?, ?, ?, ?)', [content, user.username, postId, timestamp]);
        console.log('reply added to database.');
    } catch (error) {
        console.error('Error adding reply to database:', error);
    }
}

// Function to update user profile
async function updateUserProfile(req, res) {
    try {
        const oldUser = await findUserById(req.session.userId);
        const oldUsername = oldUser.username;
        console.log("old user name is " + oldUsername);
        const newUsername = req.body.username;
        req.session.username = newUsername;
        const newBio = req.body.bio;
        const existingUser = await findUserByUsername(newUsername);
        if (existingUser && existingUser.username != oldUsername) { // allows keeping old username
            return res.redirect('/profile?error=Username+already+exists');
        }

        //await db.run('UPDATE users SET username = ?, avatar_url = ?, bio = ? WHERE id = ?', [newUsername, newAvatarUrl, newBio, req.session.userId]);
        await db.run('UPDATE users SET username = ?, bio = ? WHERE id = ?', [newUsername, newBio, req.session.userId]);
        await db.run('UPDATE posts SET username = ? WHERE username = ?', [newUsername, oldUsername]);
        await db.run('UPDATE replies SET username = ? WHERE username = ?', [newUsername, oldUsername]);
        res.redirect('/profile');
    } catch (error) {
        res.redirect('/error');
    }
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public', 'avatars');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const userId = req.session.userId;
        const ext = path.extname(file.originalname);
        cb(null, `${userId}${ext}`);
    }
});

const upload = multer({ storage: storage });

// Profile update route
app.post('/profile', isAuthenticated, async (req, res) => {
    updateUserProfile(req, res);
});

app.get('/sort-likes', async (req, res) => {
    const posts = await getPostsSortedByLikes();
    const user = await getCurrentUser(req) || {};
    res.render('home', { posts, user, apikey: accessToken });
});

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Handle Google callback
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    async (req, res) => {
        const googleId = req.user.id;
        const hashedGoogleId = hash(googleId);
        req.session.hashedGoogleId = hashedGoogleId;

        console.log(googleId);
        console.log(hashedGoogleId);

        // Check if user already exists
        try {
            let localUser = await findUserByHashedGoogleId(hashedGoogleId);
            console.log('Local user found:', localUser);
            if (localUser) {
                req.session.userId = localUser.id;
                req.session.loggedIn = true;
                res.redirect('/');
            } else {
                res.redirect('/registerUsername');
            }
        }
        catch (err) {
            console.error('Error finding user:', er);
            res.redirect('/error');
        }
});

// Register GET route is used for error response from registration
//
app.get('/registerUsername', (req, res) => {
    res.render('registerUsername', { regError: req.query.error });
});

app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

// Error route: render error page
//
app.get('/error', (req, res) => {
    res.render('error');
});

// Additional routes that you must implement

app.post('/posts',async (req, res) => {
    //TODO: Add a new post and redirect to home

    const title = req.body.title;
    const content = req.body.content;
    const user = await getCurrentUser(req);

    if (user) {
        await addPost(title, content, user);
        res.redirect('/');
    } else {
        res.redirect('/login');
    }

});
app.post('/like/:id', isAuthenticated, (req, res) => {
    // TODO: Update post likes
    updatePostLikes(req, res);
});
app.get('/profile', isAuthenticated, async (req, res) => {
    // TODO: Render profile page
    const regError = req.query.error || '';
    await renderProfile(req, res, regError);
});
app.get('/avatar/:username',async (req, res) => {
    // TODO: Serve the avatar image for the user
    await handleAvatar(req,res);
});
app.post('/profile/avatar', isAuthenticated, upload.single('myImage'), async (req, res) => {
    const userId = req.session.userId;
    // const filePath = `/avatars/${req.file.filename}`;
    const uploadPath = path.join(__dirname, 'public', 'avatars');
    const inputFilePath = req.file.path; // Input file path
    const outputFilePath = path.join(uploadPath, `${userId}.png`); // Output file path
    
    try {
        await sharp(inputFilePath)
            .rotate()
            .resize({
                fit: 'cover',
                width: 100,
                height: 100,
            })
            .toFile(outputFilePath); // Save the resized image to the output file

        // Update the database with the new avatar URL
        const filePath = `/avatars/${userId}.png`;
        await db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [filePath, userId]);
        res.redirect('/profile');
    } catch (error) {
        console.error('Error updating avatar:', error);
        res.redirect('/error');
    }
});
app.post('/registerUsername', (req, res) => {
    registerUsername(req, res);
});
app.post('/register', (req, res) => {
    registerUser(req, res);
});
app.post('/login', (req, res) => {
    // TODO: Login a user
    loginUser(req, res);
});
app.get('/logout', (req, res) => {
    logoutUser(req, res);
});
app.get('/googleLogout', (req, res) => {
    res.render('googleLogout');
});
app.post('/delete/:id', isAuthenticated, async (req, res) => {
    // TODO: Delete a post if the current user is the owner
    const user = await getCurrentUser(req) || {}; // get current user
    const postId = parseInt(req.params.id); // get post id from url
    
    try {
        const postToDelete = await db.get('SELECT * FROM posts WHERE id = ?', [postId]);

        if (!postToDelete) { // if post doesn't exist
            return res.status(404).send('Post not found');
        }

        if (postToDelete.username !== user.username) { // safeguard against deleting others posts
            return res.status(403).send('You are not allowed to delete other users\' posts');
        }

        await db.run('DELETE FROM posts WHERE id = ?', [postId]); // delete from database
        res.send('Post successfully deleted');
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).send('Internal Server Error');
    }
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Function to find a user by username
async function findUserByUsername(username) {
    // TODO: Return user object if found, otherwise return undefined
    try {
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
        return user;
    } catch (error) {
        console.error('Error finding user by username:', error);
        throw error; // throws error to caller 
    }
}

// Function to find a user by user ID
async function findUserById(userId) {
    // TODO: Return user object if found, otherwise return undefined
    try {
        const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
        return user;
    } catch (error) {
        console.error('Error finding user by ID:', error);
        throw error; // throws error to caller 
    }
}

// Function to add a new user
async function addUser(username, req) {
    // TODO: Create a new user object and add to users array
    const googleId = req.session.hashedGoogleId;
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const memberDate = year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;

    try {
        await db.run(
            'INSERT INTO users (username, hashedGoogleId, memberSince) VALUES (?, ?, ?)',
            [username, googleId, memberDate]
        );
    } catch (error) {
        console.error('Error adding user to database:', error);
        throw error; // throws error to caller
    }
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    console.log(req.session.userId);
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// SQL DATABASE REGISTER CREATING A USERNAME AFTER LOGGING IN GMAIL
async function registerUsername(req, res) {
    // TODO: Register a new user and redirect appropriately
    const username = req.body.username;
    console.log("Attempting to register:", username);
    let user = await findUserByUsername(username);
    if (user) {
        res.redirect('/registerUsername?error=Username+already+exists');
    } else {
        try {
            await addUser(username, req);
            const newUser = await findUserByUsername(username);
            req.session.userId = newUser.id;
            req.session.loggedIn = true;
            res.redirect('/');
        } catch (error) {
            res.redirect('/error');
        }
    }
}

// Function to logout a user
function logoutUser(req, res) {
    // TODO: Destroy session and redirect appropriately
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            res.redirect('/error'); // redirect to error page
        } else {
            res.clearCookie('sessionId');
            res.redirect('/googleLogout'); // redirect to home page
        }
    });
}

// Function to render the profile page
async function renderProfile(req, res, regError) {
    // TODO: Fetch user posts and render the profile page
    const currUser = await getCurrentUser(req); // fetch user based on req
    if (currUser) {
        let userPosts = await db.all('SELECT * FROM posts WHERE username = ?', [currUser.username]);
        let userPostsWithReplies = await Promise.all(userPosts.map(async (post) => {
            const replies = await db.all('SELECT * FROM replies WHERE repliedToId = ?', post.id);
            return { ...post, replies };
        }));
        userPostsWithReplies = userPostsWithReplies.slice().reverse();
        res.render('profile', { posts: userPostsWithReplies, user: currUser, regError });
    } else {
        res.redirect('/login');
    }
}

// Function to update post likes
async function updatePostLikes(req, res) {
    // TODO: Increment post likes if conditions are met
    const postId = parseInt(req.params.id);
    const user = await getCurrentUser(req);
    try {
        const post = await db.get('SELECT * FROM posts WHERE id = ?', [postId]);

        if (post) {
            const likedByUsers = post.likedBy ? JSON.parse(post.likedBy) : [];

            if (likedByUsers.includes(user.id)) {
                // User already liked the post, so unlike it
                likedByUsers.splice(likedByUsers.indexOf(user.id), 1);
                post.likes--;

                await db.run('UPDATE posts SET likes = ?, likedBy = ? WHERE id = ?', [post.likes, JSON.stringify(likedByUsers), post.id]);
                return res.status(200).json({ likes: post.likes, liked: false });
            } else {
                // User hasn't liked the post, so like it
                likedByUsers.push(user.id);
                post.likes++;

                await db.run('UPDATE posts SET likes = ?, likedBy = ? WHERE id = ?', [post.likes, JSON.stringify(likedByUsers), post.id]);
                return res.status(200).json({ likes: post.likes, liked: true });
            }
        } else {
            return res.status(404).send('Post not found');
        }
    } catch (error) {
        console.error('Error updating post likes:', error);
        return res.status(500).send('Internal Server Error');
    }
}

// Function to handle avatar generation and serving
async function handleAvatar(req, res) {
    // TODO: Generate and serve the user's avatar image
    const username = req.params.username;
    try {
        const user = await findUserByUsername(username);

        if (user) {
            if (user.avatar_url && !user.avatar_url.endsWith(user.username)) {
                // Serve the custom avatar if it exists
                const avatarPath = path.join(__dirname, 'public', user.avatar_url);
                return res.sendFile(avatarPath);
            } else {
                // Generate and serve the default avatar
                const letter = username.charAt(0).toUpperCase();
                const avatar = generateAvatar(letter);
                res.set('Content-Type', 'image/png');
                return res.send(avatar);
            }
        } else {
            return res.status(404).send('User not found');
        }
    } catch (error) {
        console.error('Error handling avatar:', error);
        return res.status(500).send('Internal Server Error');
    }
}

// Function to get the current user from session
async function getCurrentUser(req) {
    const userId = req.session.userId;
    if (userId) {
        const user = await findUserById(userId);
        return user;
    }
    return null;
}

// Function to get all posts, sorted by most recent first
async function getPosts() {
    // const posts = await db.all('SELECT * FROM posts');
    // return posts.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    try {
        const posts = await db.all('SELECT * FROM posts');

        const postsWithReplies = await Promise.all(posts.map(async (post) => {
            const replies = await db.all('SELECT * FROM replies WHERE repliedToId = ?', post.id);
            return { ...post, replies };
        }));
        
        return postsWithReplies.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
        console.error('Error fetching posts:', error);
        return [];
    }
}

async function getPostsSortedByLikes() {
    const posts = await db.all('SELECT * FROM posts');
    return posts.slice().sort((a, b) => b.likes - a.likes);
}

// Function to add a new post
async function addPost(title, content, user) {    
    // TODO: Create a new post object and add to posts array
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const seconds = String(currentDate.getSeconds()).padStart(2, '0');
    const timestamp = year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;

    try {
        await db.run('INSERT INTO posts (title, content, username, timestamp, likes) VALUES (?, ?, ?, ?, ?)', [title, content, user.username, timestamp, 0]);
        console.log('Post added to database.');
    } catch (error) {
        console.error('Error adding post to database:', error);
    }
}
// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
    // TODO: Generate an avatar image with a letter
    
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FF9933'];
    const color = colors[letter.charCodeAt(0) % colors.length];
    
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `${width * 0.6}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter.toUpperCase(), width / 2, height / 2);

    return canvas.toBuffer('image/png');
}

function hash(input) {
    return crypto.createHash('sha256').update(input).digest('hex');
}

async function findUserByHashedGoogleId(hashedGoogleId) {
    try {
        const currUser = await db.get('SELECT * FROM users WHERE hashedGoogleId = ?', [hashedGoogleId]);
        return currUser; // undefined if no user is found
    } catch (err) {
        throw err;
    }
}
