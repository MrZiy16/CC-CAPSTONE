// routes/authRoutes.js
const { registerUser, loginUser, uploadPhoto } = require('./handler/authHandler');

const authRoutes = [
    {
        method: 'POST',
        path: '/register',
        handler: registerUser,
    },
    {
        method: 'POST',
        path: '/login',
        handler:loginUser,
    },
    {
        method: 'POST',
        path: '/upload-photo-profile',
        handler: uploadPhoto,
    },
];

module.exports = authRoutes;
