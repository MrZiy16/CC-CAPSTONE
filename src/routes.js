const { registerUser, loginUser, logoutUser } = require('./handler/authHandler');
const { getProfile, updateProfile, uploadImage } = require('./handler/profileHandler');
const {inputClassCode, getUserClasses, inputTaskGuru, getClassTasks, getTaskDetail, editTask, deleteTask, getTaskMurid, updateTaskMurid} = require('./handler/mainHandler');
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
        method: 'PUT',
        path: '/upload-photo-profile',
        handler: uploadImage,
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
        path: '/profile',
        handler: updateProfile,
        options: {
            payload: {
                output: 'stream',
                parse: true,
                allow: 'multipart/form-data',
                multipart: {
                    output: 'stream',
                },
            },
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
        path: '/class/{classId}/add-tasks',  
        handler: inputTaskGuru,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },
    {
        method: 'PUT',
        path: '/class/{classId}/tasks/{taskId}',
        handler: editTask,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    }
,
    {
        method: 'DELETE',
        path: '/class/{classId}/tasks/{taskId}',
        handler: deleteTask,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },
    // ROUTES UNTUK MURID
    
    {
        method: 'POST',
        path: '/tasks-murid/add-tasks',
        handler: inputTaskGuru,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },
    {
        method: 'GET',
        path: '/tasks-murid',
        handler: getTaskMurid,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },
    {
        method: 'GET',
        path: '/tasks-murid/{taskId}',
        handler: getTaskDetail,
        options: {
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    },
    {
        method: 'PUT',
        path: '/tasks-murid/{taskId}/update',
        handler: updateTaskMurid,
        options: {
            payload: {
                output: 'stream',
                maxBytes: 20 * 1024 * 1024,
                parse: true,
                allow: 'multipart/form-data',
                multipart: {
                    output: 'stream',
                },
            },
            pre: [{ method: validateToken }], // Middleware untuk validasi token
        },
    }
  
];

module.exports = authRoutes;
