const { registerUser, loginUser, logoutUser } = require('./handler/authHandler');
const { getProfile, updateProfile, uploadPhoto } = require('./handler/profileHandler');
const {inputClassCode, getUserClasses, inputTaskGuru, getClassTasks, getTaskDetail} = require('./handler/mainHandler');
const validateToken = require('./validatetoken'); // Import middleware untuk validasi token

const authRoutes = [
    // Rute Publik (Tidak Perlu Token)
    {
        method: 'POST',
        path: '/register',
        handler: registerUser,
    },
    {
        method: 'POST',
        path: '/login',
        handler: loginUser,
    },

    // Rute yang Memerlukan Token
    {
        method: 'POST',
        path: '/upload-photo-profile',
        handler: uploadPhoto,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },
    {
        method: 'GET',
        path: '/profile/{id}',
        handler: getProfile,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },
    {
        method: 'PUT',
        path: '/profile/{id}',
        handler: updateProfile,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },
    {
        method: 'POST',
        path: '/logout',
        handler: logoutUser,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },
    {
        method: 'POST',
        path: '/join-class',
        handler: inputClassCode,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },
    {
        method: 'GET',
        path: '/class',
        handler: getUserClasses,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },
    {
        method: 'GET',
        path: '/class/{classId}',
        handler: getClassTasks,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },
    {
        method: 'GET',
        path: '/class/{classId}/tasks/{taskId}',
        handler: getTaskDetail,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },

    {
        method: 'POST',
        path: '/class/{classId}/addtasks',  
        handler: inputTaskGuru,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    }
                     
  
];

module.exports = authRoutes;
