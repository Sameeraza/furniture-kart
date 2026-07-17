const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');

const app = express();
app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Security Configuration
app.use(session({
    secret: 'furniture_kart_secret_key', 
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 1800000 
    }
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Temporary Local Database (Testing ke liye - Isme uploaded products save honge)
let productsList = [];

// Render Dashboard par jo Environment Variables banaye hain unhe yahan call karein
const secureAdminUsername = process.env.ADMIN_USERNAME || "admin_fk";
const secureAdminPassword = process.env.ADMIN_PASSWORD || "your_password"; // Apni pasand ka password yahan likhein

// Middleware: Isse check hoga ki session active hai ya nahi
function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    } else {
        res.redirect('/login');
    }
}

// ================= ADMIN DASHBOARD HTML (EMBEDDED) =================
// Yeh page sirf login hone par hi backend se deliver hoga. Kisi file ki zarurat nahi hai.
const adminDashboardHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>FurnitureKart - Admin Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto p-6">
        <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold text-gray-800">FurnitureKart - Admin Panel</h1>
            <a href="/api/logout" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition">Logout</a>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Left Side: Upload Form -->
            <div class="bg-white p-6 rounded shadow-md h-fit">
                <h2 class="text-xl font-semibold mb-4 text-blue-600">Add New Furniture</h2>
                <form action="/api/upload-product" method="POST" enctype="multipart/form-data" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium">Furniture Name</label>
                        <input type="text" name="title" required class="w-full border p-2 rounded">
                    </div>
                    <div>
                        <label class="block text-sm font-medium">Price (₹)</label>
                        <input type="number" name="price" required class="w-full border p-2 rounded">
                    </div>
                    <div>
                        <label class="block text-sm font-medium">Upload Image</label>
                        <input type="file" name="image" accept="image/*" required class="w-full border p-2 rounded">
                    </div>
                    <button type="submit" class="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 transition font-semibold">
                        Upload Product
                    </button>
                </form>
            </div>

            <!-- Right Side: Dashboard Current Products List -->
            <div class="col-span-2 bg-white p-6 rounded shadow-md">
                <h2 class="text-xl font-semibold mb-4 text-gray-800">Your Uploaded Products</h2>
                <div id="admin-products" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <!-- Loaded dynamically via JS -->
                </div>
            </div>
        </div>
    </div>

    <script>
        async function loadAdminProducts() {
            const res = await fetch('/api/get-products');
            const products = await res.json();
            const container = document.getElementById('admin-products');
            container.innerHTML = "";

            if (products.length === 0) {
                container.innerHTML = "<p class='text-gray-500'>No products uploaded yet.</p>";
                return;
            }

            products.forEach(p => {
                container.innerHTML += \`
                    <div class="border p-3 rounded flex items-center gap-4 bg-gray-50">
                        <img src="\${p.image}" class="w-16 h-16 object-cover rounded">
                        <div>
                            <h4 class="font-bold text-gray-800">\${p.title}</h4>
                            <p class="text-green-600 font-semibold">₹\${p.price}</p>
                        </div>
                    </div>
                \`;
            });
        }
        loadAdminProducts();
    </script>
</body>
</html>
`;

// ================= PAGES ROUTING =================

// 1. Home Page (Sabhi ke liye)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Admin Login Page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 3. Admin Dashboard (Protected Route - HTML seedhe bhej raha hai)
app.get('/admin', checkAuth, (req, res) => {
    res.send(adminDashboardHTML);
});


// ================= API ENDPOINTS =================

// Login verify karne ka API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
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
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// Multer Setup
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Product upload handle karne ke liye (Secure)
app.post('/api/upload-product', checkAuth, upload.single('image'), (req, res) => {
    const { title, price } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : '';

    if (!title || !price || !imagePath) {
        return res.status(400).send("Please fill all fields.");
    }

    // Array me product save ho raha hai
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
