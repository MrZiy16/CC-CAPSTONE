// handlers/authHandler.js
const bcrypt = require('bcrypt');
const Joi = require('joi');
const db = require('../db');
const { Storage } = require('@google-cloud/storage');

// Konfigurasi Google Cloud Storage
const storage = new Storage({
    projectId: 'your-project-id',
    keyFilename: 'path/to/your-service-account.json'
});
const bucketName = 'your-bucket-name';
const bucket = storage.bucket(bucketName);

// Fungsi untuk mengupload gambar dan mengembalikan URL
const uploadImage = async (file) => {
    const { filename, data } = file;
    const uniqueFilename = `${Date.now()}-${filename}`;
    const fileUpload = bucket.file(uniqueFilename);

    await fileUpload.save(data, {
        resumable: false,
        contentType: file.mimetype,
        public: true,
    });

    return `https://storage.googleapis.com/${bucketName}/${uniqueFilename}`;
};

// Handler untuk registrasi
const registerUser = async (request, h) => {
    const { username, email, password } = request.payload;

    // Validasi input
    const schema = Joi.object({
        username: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
    });
    const { error } = schema.validate({ username, email, password });
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
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
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

        return h.response({ message: 'Login successful', userId: user.id }).code(200);
    } catch (err) {
        return h.response({ error: err.message }).code(500);
    }
};

// Handler untuk memperbarui foto profil
const uploadPhoto = async (request, h) => {
    const { userId } = request.auth.credentials; // ID pengguna dari token auth (asumsi Anda menggunakan auth)
    const file = request.payload.photo; // file gambar dari request

    // Validasi input
    const schema = Joi.object({
        photo: Joi.any().required(),
    });
    const { error } = schema.validate({ photo: file });
    if (error) {
        return h.response({ error: error.details[0].message }).code(400);
    }

    // Upload gambar dan dapatkan URL
    const photoUrl = await uploadImage(file);

    // Update URL foto di database
    try {
        await db.query('UPDATE users SET photo = ? WHERE id = ?', [photoUrl, userId]);
        return h.response({ message: 'Photo uploaded successfully', photoUrl }).code(200);
    } catch (err) {
        return h.response({ error: err.message }).code(500);
    }
};

module.exports = { registerUser, loginUser, uploadPhoto };
