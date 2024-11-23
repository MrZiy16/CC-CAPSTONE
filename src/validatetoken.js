const jwt = require('jsonwebtoken');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

const validateToken = async (request, h) => {
    try {
        // Ambil token dari header Authorization
        const authorization = request.headers.authorization;

        if (!authorization) {
            return h.response({ error: 'Authorization header is missing' }).code(401).takeover();
        }

        const token = authorization.split(' ')[1]; // Format: "Bearer <token>"

        if (!token) {
            return h.response({ error: 'Token is missing' }).code(401).takeover();
        }

        // Verifikasi token tanpa memeriksa di database
        const decoded = jwt.verify(token, JWT_SECRET);

        // Simpan informasi dari token ke `request.auth.credentials`
        request.auth = { credentials: decoded };

        // Lanjutkan ke handler berikutnya
        return h.continue;
    } catch (err) {
        return h.response({ error: 'Invalid or expired token' }).code(401).takeover();
    }
};

module.exports = validateToken;
