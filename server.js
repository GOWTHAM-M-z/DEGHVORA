const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON body-parsing middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Track Mongoose connection state dynamically to handle offline fallbacks
app.set('dbConnectionState', 0); // 0 = disconnected, 1 = connected

// MongoDB Connection Bootstrap
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/deghvora';

mongoose.connect(MONGODB_URI)
    .then(() => {
        app.set('dbConnectionState', 1);
        console.log('Successfully connected to MongoDB database.');
    })
    .catch(err => {
        app.set('dbConnectionState', 0);
        console.error('\n================================================================');
        console.error('⚠️  DATABASE CONNECTION WARNING: MongoDB could not be reached!');
        console.error(`Error details: ${err.message}`);
        console.error('================================================================');
        console.error('\n💡 CHOOSE ONE OF THE FOLLOWING SOLUTIONS TO CONNECT YOUR DATABASE:');
        console.error('\n👉 OPTION A: Setup a Free MongoDB Atlas Cloud Database (RECOMMENDED)');
        console.error('   1. Sign up for a free account at: https://www.mongodb.com/cloud/atlas');
        console.error('   2. Deploy a free tier cluster and click "Connect" -> "Drivers".');
        console.error('   3. Copy your connection string (mongodb+srv://...).');
        console.error('   4. Open your ".env" file in the DEGHVORA folder and update the MONGODB_URI line:');
        console.error('      MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/deghvora');
        console.error('   5. Restart this server (npm start).');
        console.error('\n👉 OPTION B: Start Your Local MongoDB Community Server');
        console.error('   - Windows: Press Win+R, type "services.msc", find "MongoDB Server" in the list, right-click, and click "Start".');
        console.error('   - If you do not have it installed, download it from: https://www.mongodb.com/try/download/community');
        console.error('     Ensure you check the box "Install MongoDB as a Service" during the setup wizard.');
        console.error('\nℹ️  CRITICAL RESILIENCY: Note that your server is STILL RUNNING! Any form entries');
        console.error('   submitted while MongoDB is offline will be saved locally inside "contacts.json"');
        console.error('   so your client leads are never lost!\n');
    });

// Monitor mongoose state changes after initial connection
mongoose.connection.on('connected', () => app.set('dbConnectionState', 1));
mongoose.connection.on('disconnected', () => app.set('dbConnectionState', 0));
mongoose.connection.on('reconnected', () => app.set('dbConnectionState', 1));

// Security Filter Middleware: Keep configuration files private from web downloads
app.use((req, res, next) => {
    const requestPath = req.path.toLowerCase();
    const blockedFiles = [
        '.env', 
        'package.json', 
        'package-lock.json', 
        'server.js', 
        'node_modules', 
        '.git'
    ];
    
    const isBlocked = blockedFiles.some(file => requestPath.includes(file));
    if (isBlocked) {
        return res.status(403).send('Access Denied: You do not have permission to download configuration assets.');
    }
    next();
});

// Serve static frontend files
app.use(express.static(path.join(__dirname)));

// Root redirection defaults to index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Import and mount modular Contact Router
const contactRouter = require('./routes/contact');
app.use('/contact', contactRouter);

// Boot server listener
app.listen(PORT, () => {
    console.log(`-----------------------------------------------------------------`);
    console.log(`DEGHVORA Senior Backend Server running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/contact.html to test your integration!`);
    console.log(`-----------------------------------------------------------------`);
});
