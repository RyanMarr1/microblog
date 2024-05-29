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
app.get('/profile', isAuthenticated, (req, res) => {
    // TODO: Render profile page
    renderProfile(req, res);
});
app.get('/avatar/:username', (req, res) => {
    // TODO: Serve the avatar image for the user
    handleAvatar(req,res);
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
            'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
            [username, googleId, `/avatar/${username}`, memberDate]
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
async function renderProfile(req, res) {
    // TODO: Fetch user posts and render the profile page
    const currUser = await getCurrentUser(req); // fetch user based on req
    if (currUser) {
        let userPosts = await db.all('SELECT * FROM posts WHERE username = ?', [currUser.username]);
        userPosts = userPosts.slice().reverse();
        res.render('profile', { posts: userPosts, user: currUser });
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
function handleAvatar(req, res) {
    // TODO: Generate and serve the user's avatar image
    const username = req.params.username;
    const letter = username.charAt(0).toUpperCase();
    const avatar = generateAvatar(letter);
    res.set('Content-Type', 'image/png');
    res.send(avatar);
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
    const posts = await db.all('SELECT * FROM posts');
    return posts.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
