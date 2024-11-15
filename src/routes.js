// routes/authRoutes.js
const { registerUser, loginUser } = require('./handler/authHandler');
const { getProfile, updateProfile ,uploadPhoto} = require('./handler/profileHandler');
const { joinClass,assignTask,monitorTasks } = require('./handler/mainHandler');

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
    {
        method: 'GET',
        path: '/profile/{id}',
        handler: getProfile,
    },
    {
        method: 'PUT',
        path: '/profile/{id}',
        handler: updateProfile,
    },
    {
        method: 'POST',
        path: '/join-class/{id}',
        handler: joinClass,
    },
    {
        method: 'POST',
        path: '/assign-task/{id}',
        handler: assignTask,
    },
    {
        method: 'GET',
        path: '/monitor-tasks/{id}',
        handler: monitorTasks,
    },
];

module.exports = authRoutes;
