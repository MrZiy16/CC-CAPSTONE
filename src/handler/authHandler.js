const bcrypt = require('bcrypt');
const Joi = require('joi'); // Memanggil modul Joi
const db = require('../db');

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
            // Jika user sudah terdaftar
            return h.response({ error: 'User already registered' }).code(409);
        }
    } catch (err) {
        return h.response({ error: err.message }).code(500);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan ke database
    try {
        await db.query(
            'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, role]
        );
        return h.response({ message: 'User registered successfully' }).code(201);
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

        return h.response({ message: 'Login successful', userId: user.id, role: user.role }).code(200);
    } catch (err) {
        return h.response({ error: err.message }).code(500);
    }
};

module.exports = { registerUser, loginUser };
