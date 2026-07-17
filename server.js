const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Security Configuration
app.use(session({
    secret: 'furniture_kart_secret_key', // Kisi ko na batayein
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1800000 } // 30 minutes session timeout
}));

// static files (images, css) ko access karne ke liye
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Mock Database (Aap isme MongoDB ya local file system add kar sakte hain)
let productsList = [];

// Secure Admin Info
const secureAdminUsername = "admin_fk";
const secureAdminPasswordHash = "$2a$10$X8K7B9XmE01c..."; // Encrypted password (bcrypt)

// Middleware: Page ki security check karne ke liye
function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    } else {
        // Agar admin logged in nahi hai, toh login page par bhej dein
        res.redirect('/login');
    }
}

// ================= PAGES ROUTING =================

// 1. Home Page (Sabhi ke liye)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Admin Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 3. Admin Dashboard (Yeh secure hai, bina login ke access nahi hoga)
app.get('/admin', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});


// ================= API ENDPOINTS =================

// Login verify karne ka API
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === secureAdminUsername) {
        const isMatch = await bcrypt.compare(password, secureAdminPasswordHash);
        if (isMatch) {
            req.session.isAdmin = true;
            return res.json({ success: true, message: "Logged in successfully" });
        }
    }
    res.status(401).json({ success: false, message: "Invalid credentials" });
});

// Logout API
app.get('/api/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Product upload handle karne ke liye (Secure)
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.post('/api/upload-product', checkAuth, upload.single('image'), (req, res) => {
    const { title, price } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

    if (!title || !price || !imagePath) {
        return res.status(400).send("Please fill all fields.");
    }

    productsList.push({ id: Date.now(), title, price, image: imagePath });
    res.redirect('/admin'); // Upload ke baad wapas dashboard par bhejein
});

// Products fetch karne ki API
app.get('/api/get-products', (req, res) => {
    res.json(productsList);
});

app.listen(3000, () => {
    console.log("FurnitureKart is running on http://localhost:3000");
});