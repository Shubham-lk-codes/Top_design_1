/**
 * TOP DESIGN - Production Server
 * Express.js server for website deployment
 * Supports: Static files, API routes, Admin panel, Contact form handling
 */

const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');

const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ==================== MIDDLEWARE ====================

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
        }
    },
    crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'https://www.topdesign.co.in'],
    credentials: true
}));

// Compression
app.use(compression({
    level: 6,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: require('fs').createWriteStream(path.join(__dirname, 'logs', 'access.log'), { flags: 'a' })
}));
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'tiny'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter rate limit for contact form
const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 submissions per hour
    message: { error: 'Too many contact submissions. Please try again later.' }
});

// ==================== STATIC FILES ====================

app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: NODE_ENV === 'production' ? '1y' : 0,
    etag: true,
    lastModified: true
}));

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        version: require('./package.json').version
    });
});

// Contact/Enquiry form submission
app.post('/api/contact', contactLimiter, async (req, res) => {
    try {
        const { name, email, phone, service, budget, message } = req.body;

        // Validation
        if (!name || !email || !phone || !service || !message) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['name', 'email', 'phone', 'service', 'message']
            });
        }

        // Email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        // Phone validation (Indian format)
        const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
        if (!phoneRegex.test(phone.replace(/\s/g, ''))) {
            return res.status(400).json({ error: 'Invalid phone number' });
        }

        // Store enquiry (in production, use a database)
        const enquiry = {
            id: Date.now().toString(),
            name,
            email,
            phone,
            service,
            budget: budget || 'Not specified',
            message,
            status: 'new',
            createdAt: new Date().toISOString(),
            ip: req.ip,
            userAgent: req.headers['user-agent']
        };

        // Save to JSON file (replace with DB in production)
        const fs = require('fs').promises;
        const dataPath = path.join(__dirname, 'data', 'enquiries.json');

        let enquiries = [];
        try {
            const data = await fs.readFile(dataPath, 'utf8');
            enquiries = JSON.parse(data);
        } catch (err) {
            // File doesn't exist yet
        }

        enquiries.unshift(enquiry);
        await fs.mkdir(path.dirname(dataPath), { recursive: true });
        await fs.writeFile(dataPath, JSON.stringify(enquiries, null, 2));

        // Send email notification (if configured)
        if (process.env.SMTP_HOST) {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            await transporter.sendMail({
                from: process.env.FROM_EMAIL || 'noreply@topdesign.co.in',
                to: process.env.ADMIN_EMAIL || 'info@topdesign.co.in',
                subject: `New Enquiry: ${service} from ${name}`,
                html: `
                    <h2>New Enquiry Received</h2>
                    <table style="border-collapse: collapse; width: 100%;">
                        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Name:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${name}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Email:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${email}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Phone:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${phone}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Service:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${service}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Budget:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${budget || 'Not specified'}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Message:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${message}</td></tr>
                        <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Date:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td></tr>
                    </table>
                `
            });
        }

        res.status(201).json({
            success: true,
            message: 'Enquiry submitted successfully',
            enquiryId: enquiry.id
        });

    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ error: 'Failed to submit enquiry. Please try again.' });
    }
});

// Get all enquiries (admin endpoint - add auth middleware in production)
app.get('/api/enquiries', (req, res) => {
    try {
        const fs = require('fs');
        const dataPath = path.join(__dirname, 'data', 'enquiries.json');

        if (!fs.existsSync(dataPath)) {
            return res.json([]);
        }

        const data = fs.readFileSync(dataPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Failed to load enquiries' });
    }
});

// Blog API
app.get('/api/blog', (req, res) => {
    try {
        const fs = require('fs');
        const dataPath = path.join(__dirname, 'data', 'blog.json');

        if (!fs.existsSync(dataPath)) {
            return res.json([]);
        }

        const data = fs.readFileSync(dataPath, 'utf8');
        const posts = JSON.parse(data);

        // Filter by category if provided
        const { category } = req.query;
        if (category) {
            return res.json(posts.filter(p => p.category.toLowerCase() === category.toLowerCase()));
        }

        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load blog posts' });
    }
});

// Portfolio API
app.get('/api/portfolio', (req, res) => {
    try {
        const fs = require('fs');
        const dataPath = path.join(__dirname, 'data', 'portfolio.json');

        if (!fs.existsSync(dataPath)) {
            return res.json([]);
        }

        const data = fs.readFileSync(dataPath, 'utf8');
        const items = JSON.parse(data);

        const { category } = req.query;
        if (category && category !== 'all') {
            return res.json(items.filter(i => i.category === category));
        }

        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load portfolio' });
    }
});

// ==================== SPA ROUTING ====================

// Serve main HTML for all routes (SPA behavior)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
        error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
        ...(NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   TOP DESIGN SERVER                                        ║
║   =================                                        ║
║   Environment: ${NODE_ENV.padEnd(30)}║
║   Port: ${PORT.toString().padEnd(39)}║
║   URL: http://localhost:${PORT.toString().padEnd(30)}║
║                                                            ║
║   Services:                                                ║
║   • Website Design                                         ║
║   • App Design                                             ║
║   • Digital Marketing                                      ║
║   • SEO Services                                           ║
║   • Interior Design                                        ║
║   • Printing Services                                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
