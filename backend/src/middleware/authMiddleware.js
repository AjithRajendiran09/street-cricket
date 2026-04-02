const jwt = require('jsonwebtoken');

// A dynamic getter is required because the module requires the router file which houses state
const isAdmin = (req, res, next) => {
    const { getActiveSession, JWT_SECRET } = require('../routes/authRoutes');
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ error: 'Admin access required. No token provided.' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Enforce SINGLE Session Rule
    if (token !== getActiveSession()) {
        return res.status(401).json({ error: 'Admin session has been terminated by another active login.' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'admin') {
            req.user = decoded;
            next();
        } else {
            return res.status(403).json({ error: 'Forbidden. Admin privileges required.' });
        }
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired admin token.' });
    }
};

module.exports = { isAdmin };
