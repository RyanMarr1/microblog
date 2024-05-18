const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const canvas = require('canvas');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;

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
app.get('/', (req, res) => {
    const posts = getPosts();
    const user = getCurrentUser(req) || {};
    res.render('home', { posts, user });
});

// Register GET route is used for error response from registration
//
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


app.get('/post/:id', (req, res) => {
    // TODO: Render post detail page
});
app.post('/posts', (req, res) => {
    // TODO: Add a new post and redirect to home
    
    const title = req.body.title;
    const content = req.body.content;
    const user = getCurrentUser(req);
    addPost(title, content, user);
    res.redirect('/');
});
app.post('/like/:id', (req, res) => {
    // TODO: Update post likes
    updatePostLikes();
});
app.get('/profile', isAuthenticated, (req, res) => {
    // TODO: Render profile page
    renderProfile(req, res);
});
app.get('/avatar/:username', (req, res) => {
    // TODO: Serve the avatar image for the user
    console.log(`Generating avatar for username: ${req.params.username}`);
    const username = req.params.username;
    const letter = username.charAt(0).toUpperCase();
    const avatar = generateAvatar(letter);
    res.set('Content-Type', 'image/png');
    res.send(avatar);
});
app.post('/register', (req, res) => {
    registerUser(req, res);
});
app.post('/login', (req, res) => {
    // TODO: Login a user
    loginUser(req, res); // login validation

    req.session.regenerate((err) => {
        if (err) {
            return res.status(500)
                        .send('Failed to regenerate session');
        }
        res.send('Logged in successfully');
    })
});
app.get('/logout', (req, res) => {
    logoutUser(req, res);
});
app.post('/delete/:id', isAuthenticated, (req, res) => {
    // TODO: Delete a post if the current user is the owner
    const user = getCurrentUser(req) || {}; // get current user
    const postId = parseInt(req.params.id); // get post id from url
    const postToDelete = posts.findIndex(post => post.id === postId); // -1 if not found

    if (postToDelete !== -1) {
        if (posts[postIndex].id === user.id) {
            posts.splice(postIndex, 1);
            res.send('Post successfully deleted');
        }
    } else {
        res.status(404).send('Post not found');
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

// Example data for posts and users
let posts = [
    { id: 1, title: 'Sample Post', content: 'This is a sample post.  sadfasdf', username: 'SampleUser', timestamp: '2024-01-01 10:00', likes: 0 },
    { id: 2, title: 'Another Post', content: 'This is another sample post.', username: 'AnotherUser', timestamp: '2024-01-02 12:00', likes: 0 },
];
let users = [
    { id: 1, username: 'SampleUser', avatar_url: '/avatar/SampleUser', memberSince: '2024-01-01 08:00' },
    { id: 2, username: 'AnotherUser', avatar_url: '/avatar/AnotherUser', memberSince: '2024-01-02 09:00' },
];

// Function to find a user by username
function findUserByUsername(username) {
    // TODO: Return user object if found, otherwise return undefined
    return users.find(user => user.username === username);
}

// Function to find a user by user ID
function findUserById(userId) {
    // TODO: Return user object if found, otherwise return undefined
    return users.find(user => user.id === userId);
}

// Function to add a new user
function addUser(username) {
    // TODO: Create a new user object and add to users array
    const idNum = users.length > 0 ? users[users.length - 1].id + 1 : 1;
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const memberDate = year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;

    let newUser = {
        id: idNum,
        username: username,
        avatar_url: `/avatar/${username}`,
        memberSince: memberDate
    };
    users.push(newUser);

    console.log(newUser);
    console.log(users);
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

// Function to register a user
function registerUser(req, res) {
    // TODO: Register a new user and redirect appropriately
    const username = req.body.username;
    console.log("Attempting to register:", username);
    if (findUserByUsername(username)) {
        // Username already exists
        res.redirect('/register?error=Username+already+exists');
    } else {
        addUser(username);
        res.redirect('/login');
    }
}

// Function to login a user
function loginUser(req, res) {
    // TODO: Login a user and redirect appropriately
    const username = req.body.username;
    const user = findUserByUsername(username);
    console.log("Attempting to login:", username);
    if (user) {
        // Successful login
        req.session.userId = user.id;
        req.session.loggedIn = true;
        res.redirect('/'); // redirect to home page upon login
    } else {
        // Invalid username
        res.redirect('/login?error=Invalid+username');
    }
}

// Function to logout a user
function logoutUser(req, res) {
    // TODO: Destroy session and redirect appropriately
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            res.redirect('/error'); // Redirect to an error page
        } else {
            res.clearCookie('sessionId');
            res.redirect('/'); // Redirect to the home page after successful logout
        }
    });
}

// Function to render the profile page
function renderProfile(req, res) {
    // TODO: Fetch user posts and render the profile page
    const currentUser = getCurrentUser(req); // fetch user based on req
    if (currentUser) {
        
    } else {
        res.redirect('/login');
    }
}

// Function to update post likes
function updatePostLikes(req, res) {
    // TODO: Increment post likes if conditions are met
    const postId = parseInt(req.params.id);
    const user = getCurrentUser(req);
    const post = posts.find(post => post.id === postId);
    if (post) { 
        if (post.username !== user.username) {
            // If the current user is not the owner, increment likes
            post.likes++;
            return res.send('Post successfully liked');
        }
    } else {
        // If the post does not exist, send a not found response
        return res.status(404).send('Post not found');
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
function getCurrentUser(req) {
    // TODO: Return the user object if the session user ID matches
    const userId = req.session.userId;
    if (userId) {
        return users.find(user => user.id === userId);
    }
}

// Function to get all posts, sorted by latest first
function getPosts() {
    return posts.slice().reverse();
}

// Function to add a new post
function addPost(title, content, user) {
    // TODO: Create a new post object and add to posts array
    const postIdNum = posts.length > 0 ? posts[posts.length - 1].id + 1 : 1;
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const hours = String(currentDate.getHours()).padStart(2, '0');
    const minutes = String(currentDate.getMinutes()).padStart(2, '0');
    const timestamp = year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;

    let newPost = {
        id: postIdNum,
        title: title,
        content: content,
        username: user.username,
        timestamp: timestamp,
        likes: 0
    }
    posts.push(newPost);   
}
// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
    // TODO: Generate an avatar image with a letter
    // Steps:
    // 1. Choose a color scheme based on the letter
    // 2. Create a canvas with the specified width and height
    // 3. Draw the background color
    // 4. Draw the letter in the center
    // 5. Return the avatar as a PNG buffer
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Choose a background color based on the letter (you can customize this)
    const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#FF9933'];
    const color = colors[letter.charCodeAt(0) % colors.length];
    
    // Draw background
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    // Draw letter
    ctx.fillStyle = '#FFFFFF'; // White text color
    ctx.font = `${width * 0.6}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter.toUpperCase(), width / 2, height / 2);

    return canvas.toBuffer('image/png');
}