const bcrypt = require('bcrypt');
const Joi = require('joi'); // Memanggil modul Joi
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

// Handler untuk mendapatkan data profile dan mengedit profile user
const getProfile = async (request, h) => {
    const { id } = request.params;

    try {
        const [rows] = await db.query(
            'SELECT username, email, photo FROM users WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return h.response({ error: 'User not found' }).code(404);
        }

        return h.response({
            message: 'Profile retrieved successfully',
            data: rows[0]
        }).code(200);

    } catch (err) {
        return h.response({ error: err.message }).code(500);
    }
};

const updateProfile = async (request, h) => {
    const { id } = request.params;
    const { username, email, currentPassword, newPassword } = request.payload;

    // Validasi input
    const schema = Joi.object({
        username: Joi.string().optional(),
        email: Joi.string().email().optional(),
        currentPassword: Joi.string().min(6).optional(),
        newPassword: Joi.string().min(6).optional()
    }).with('newPassword', 'currentPassword'); // Jika newPassword ada, currentPassword harus ada

    const { error } = schema.validate({ username, email, currentPassword, newPassword });
    if (error) {
        return h.response({ error: error.details[0].message }).code(400);
    }

    try {
        // Cek apakah user exists dan ambil data lengkap termasuk password
        const [existingUser] = await db.query(
            'SELECT * FROM users WHERE id = ?',
            [id]
        );

        if (existingUser.length === 0) {
            return h.response({ error: 'User not found' }).code(404);
        }

        // Cek apakah username/email sudah digunakan user lain
        if (username || email) {
            const [duplicateCheck] = await db.query(
                'SELECT * FROM users WHERE (username = ? OR email = ?) AND id != ?',
                [username, email, id]
            );

            if (duplicateCheck.length > 0) {
                return h.response({
                    error: 'Username or email already in use'
                }).code(409);
            }
        }

        // Verifikasi password lama jika akan mengganti password
        if (currentPassword && newPassword) {
            const isValidPassword = await bcrypt.compare(
                currentPassword,
                existingUser[0].password
            );

            if (!isValidPassword) {
                return h.response({
                    error: 'Current password is incorrect'
                }).code(401);
            }
        }

        // Build query berdasarkan field yang diupdate
        let updateQuery = 'UPDATE users SET ';
        const updateValues = [];

        if (username) {
            updateQuery += 'username = ?, ';
            updateValues.push(username);
        }

        if (email) {
            updateQuery += 'email = ?, ';
            updateValues.push(email);
        }

        if (newPassword) {
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            updateQuery += 'password = ?, ';
            updateValues.push(hashedNewPassword);
        }

        // Hapus koma terakhir
        updateQuery = updateQuery.slice(0, -2);
        updateQuery += ' WHERE id = ?';
        updateValues.push(id);

        // Update profile
        await db.query(updateQuery, updateValues);

        // Get updated profile
        const [updatedProfile] = await db.query(
            'SELECT username, email, photo FROM users WHERE id = ?',
            [id]
        );

        return h.response({
            message: 'Profile updated successfully',
            data: updatedProfile[0]
        }).code(200);

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

// Update exports untuk include handler baru
module.exports = {
    getProfile,
    updateProfile,
    uploadPhoto, // Added the uploadPhoto handler here
};
