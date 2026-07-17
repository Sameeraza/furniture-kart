const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');

const app = express();

// Render ke proxy setup ke liye session trust enable karein
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Security Configuration
app.use(session({
    secret: 'furniture_kart_secret_key', 
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Local testing aur HTTP ke liye false rakhein
        maxAge: 1800000 // 30 minutes session timeout
    }
}));

// Static files (public files jaise index aur login hi publicly access ho sakegi)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

let productsList = [];

// Render Dashboard par jo Environment Variables banaye hain unhe yahan call karein
// Agar Render par variables nahi milte toh default fallback value use hogi
const secureAdminUsername = process.env.ADMIN_USERNAME || "admin_fk";
const secureAdminPassword = process.env.ADMIN_PASSWORD || "your_fallback_password";

// Middleware: Isse check hoga ki session active hai ya nahi
function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    } else {
        // Agar admin logged in nahi hai, toh direct login page par bhej dein
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

// 3. Admin Dashboard (Ab hum ise static ki jagah private folder se bhej rahe hain)
app.get('/admin', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'private', 'admin.html'));
});


// ================= API ENDPOINTS =================

// Login verify karne ka API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    // Render ke variables se match karna
    if (username === secureAdminUsername && password === secureAdminPassword) {
        req.session.isAdmin = true;
        return res.json({ success: true, message: "Logged in successfully" });
    }
    res.status(401).json({ success: false, message: "Invalid credentials" });
});

// Logout API
app.get('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if(err) {
            return res.status(500).send("Logout failed");
        }
        res.clearCookie('connect.sid'); // Session cookie ko browser se delete karein
        res.redirect('/login');
    });
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
    res.redirect('/admin'); 
});

// Products fetch karne ki API
app.get('/api/get-products', (req, res) => {
    res.json(productsList);
});

// Port config for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`FurnitureKart is running on port ${PORT}`);
});