/**
 * TOP DESIGN - Vercel Serverless Adapter
 * Optimized for Vercel serverless functions
 */

const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');

const app = express();

// Security
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'"],
        }
    },
    crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), platform: 'vercel' });
});

app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, service, budget, message } = req.body;

        if (!name || !email || !phone || !service || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        console.log('New enquiry:', { name, email, phone, service, budget, message });

        res.status(201).json({
            success: true,
            message: 'Enquiry submitted successfully',
            enquiryId: Date.now().toString()
        });
    } catch (error) {
        console.error('Contact form error:', error);
        res.status(500).json({ error: 'Failed to submit enquiry' });
    }
});

app.get('/api/blog', (req, res) => {
    const posts = [
        { id: 1, title: '10 Web Design Trends 2024', category: 'Design', author: 'TOP DESIGN', date: '2024-07-10', excerpt: 'Latest trends...', image: 'https://images.unsplash.com/photo-1468056709990-75f315717b99?w=800' },
        { id: 2, title: 'SEO Guide 2024', category: 'SEO', author: 'Rajesh', date: '2024-07-08', excerpt: 'Complete SEO guide...', image: 'https://images.unsplash.com/photo-1572177812156-58036aae439c?w=800' },
        { id: 3, title: 'Digital Marketing Tips', category: 'Marketing', author: 'Priya', date: '2024-07-05', excerpt: 'Marketing strategies...', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800' }
    ];
    res.json(posts);
});

app.get('/api/portfolio', (req, res) => {
    const items = [
        { id: 1, title: 'TechCorp', category: 'web', description: 'Corporate site', image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800' },
        { id: 2, title: 'Fitness App', category: 'app', description: 'Mobile app', image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800' },
        { id: 3, title: 'Brand Campaign', category: 'marketing', description: 'Social media', image: 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=800' }
    ];
    res.json(items);
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Export for Vercel serverless
module.exports = app;
