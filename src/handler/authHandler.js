const bcrypt = require('bcrypt');
const Joi = require('joi');
const db = require('../db');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;

// Handler untuk registrasi
const registerUser = async (request, h) => {
    const { username, email, password, role } = request.payload;

    // Validasi input
    const schema = Joi.object({
        username: Joi.string().max(50).required(),
        email: Joi.string().email().max(50).required(),
        password: Joi.string().min(6).max(100).required(),
        role: Joi.string().valid('guru', 'murid').required(),
    });

    const { error } = schema.validate({ username, email, password, role });
    if (error) {
        return h.response({ error: error.details[0].message }).code(400);
    }

    // Periksa apakah user sudah terdaftar
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (rows.length > 0) {
            return h.response({ error: 'User already registered' }).code(409);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Simpan user ke database tanpa token
        const [result] = await db.query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, role]
        );

        // Generate JWT Token setelah user berhasil disimpan
        const token = jwt.sign({ 
            userId: result.insertId,
            username, 
            role 
        }, JWT_SECRET, { expiresIn: '1y' });

        return h.response({
            message: 'User registered successfully',
            token,
        }).code(201);
    } catch (err) {
        return h.response({ error: err.message }).code(500);
    }
};

// Handler untuk login
const loginUser = async (request, h) => {
    const { email, password } = request.payload;

    // Validasi input
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
    });

    const { error } = schema.validate({ email, password });
    if (error) {
        return h.response({ error: error.details[0].message }).code(400);
    }

    // Cek user di database
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];
        if (!user) {
            return h.response({ error: 'User not found' }).code(404);
        }

        // Verifikasi password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return h.response({ error: 'Invalid password' }).code(401);
        }

        // Generate JWT Token
        const token = jwt.sign({ 
            userId: user.id, 
            role: user.role 
        }, JWT_SECRET, { expiresIn: '1y' });

        return h.response({
            message: 'Login successful',
            token,
            userId: user.id,
            role: user.role,
        }).code(200);
    } catch (err) {
        return h.response({ error: err.message }).code(500);
    }
};

// Handler untuk logout
const logoutUser = async (request, h) => {
    // Karena token tidak disimpan di database, 
    // client harus menghapus token dari storage-nya sendiri
    return h.response({ 
        message: 'Logout successful' 
    }).code(200);
};

module.exports = { 
    registerUser, 
    loginUser, 
    logoutUser 
};