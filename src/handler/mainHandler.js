const Joi = require('joi');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;
const db = require('../db');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs').promises;

// Validation schema for class code
const inputSchema = Joi.object({
    classCode: Joi.string().required()
});

const inputClassCode = async (request, h) => {
    try {
        // Validate input
        const { error, value } = inputSchema.validate(request.payload);
        if (error) {
            return h.response({ error: error.details[0].message }).code(400);
        }

        const { classCode } = value;
        const { userId, role } = request.auth.credentials;

        // Get existing class data with the same code to check validity and get the name
        const [existingClasses] = await db.query(
            'SELECT * FROM class WHERE code_teacher = ? OR code_student = ?',
            [classCode, classCode]
        );

        if (existingClasses.length === 0) {
            return h.response({ error: 'Class code is invalid' }).code(404);
        }

        const classData = existingClasses[0];
        const className = classData.name;

        // Validate role based on the code type
        if (
            (classCode === classData.code_teacher && role !== 'guru')
        ) {
            return h.response({
                error: 'Your role does not match the class code',
            }).code(403);
        }

        // Check if user is already registered in this class
        const [userClassEntry] = await db.query(
            'SELECT * FROM User_Class WHERE class_id = ? AND user_id = ?',
            [classData.id, userId]
        );

        if (userClassEntry.length > 0) {
            return h.response({
                error: 'You are already registered in this class',
            }).code(400);
        }

        // Insert new entry into User_Class to link the user to the class
        await db.query(
            'INSERT INTO User_Class (user_id, class_id) VALUES (?, ?)',
            [userId, classData.id]
        );

        // Respond with success message and class details
        return h.response({
            message: 'Successfully entered the class',
            class: { code: classCode, name: className },
        }).code(200);

    } catch (err) {
        console.error('Error:', err);
        return h.response({
            error: 'An error occurred while processing your request',
        }).code(500);
    }
};


// Fetching all classes the user belongs to
const getUserClasses = async (request, h) => {
    const { userId } = request.auth.credentials;

    try {
        // Query to fetch all classes the user belongs to
        const [rows] = await db.query( 
            'SELECT id, name FROM class WHERE id IN (SELECT class_id FROM user_class)',
            [userId]
        );

        if (rows.length === 0) {
            return h.response({ error: 'No classes found for this user' }).code(404);
        }

        // Return the list of classes
        return h.response({
            message: 'Classes retrieved successfully',
            data: rows,
        }).code(200);
    } catch (err) {
        console.error('Error fetching user classes:', err.message);
        return h.response({
            error: 'Internal Server Error',
            details: err.message,
        }).code(500);
    }
};

// Fetching tasks for a specific class
const getClassTasks = async (request, h) => {
    const { userId } = request.auth.credentials; // Get the user ID from the authenticated credentials
    const { classId } = request.params; // Get the classId from the URL parameters

    try {
        // Step 1: Check if the user is enrolled in the specified class
        const [userClassEntry] = await db.query(
            'SELECT 1 FROM user_class WHERE user_id = ? AND class_id = ? LIMIT 1',
            [userId, classId]
        );

        // Step 2: If the user is not enrolled in the class, return a 403 error
        if (!userClassEntry || userClassEntry.length === 0) {
            return h.response({ error: 'You are not enrolled in this class' }).code(403);
        }

        // Step 3: Query to fetch tasks for the class
        const [rows] = await db.query(
            'SELECT * FROM task WHERE class_id = ?',
            [classId]
        );

        // Step 4: If no tasks are found, return a 404 error
        if (rows.length === 0) {
            return h.response({ error: 'No tasks found for this class' }).code(404);
        }

        // Step 5: Return the list of tasks
        return h.response({
            message: 'Tasks retrieved successfully',
            data: rows,
        }).code(200);
    } catch (err) {
        console.error('Error fetching tasks for class:', err.message);
        return h.response({
            error: 'Internal Server Error',
            details: err.message,
        }).code(500);
    }
};


// Schema sederhana untuk validasi input tugas
const taskSchema = Joi.object({
    title: Joi.string().max(30).required(),
    description: Joi.string().max(255).required(),
    type: Joi.string().valid('individu', 'kelas').required(),
    mapel: Joi.string().max(30).required(),
    category: Joi.string().max(30).required(),
    deadline: Joi.date().required(),
});


const inputTaskGuru = async (request, h) => {
    try {
        const { userId, role } = request.auth.credentials;
        let { classId } = request.params; // Check for classId in the URL

        // Fetch classId if not provided in the URL
        if (!classId) {
            const [userClassEntry] = await db.query(
                'SELECT class_id FROM user_class WHERE user_id = ? LIMIT 1',
                [userId]
            );
        
            if (!userClassEntry || userClassEntry.length === 0) {
                // Set classId to null if user is not enrolled in any class
                classId = null;
            } else {
                classId = userClassEntry[0].class_id;
            }
        }
        

        let { title, description, type, mapel, deadline, category } = request.payload;

        // Automatically set task type based on user role
        if (role === 'guru') {
            type = 'kelas'; // Guru can only create tasks for classes
        } else if (role === 'murid') {
            type = 'individu'; // Murid can only create individual tasks
        } else {
            return h.response({ error: 'Invalid user role' }).code(403);
        }

        // Validate task input
        const { error } = taskSchema.validate({
            title,
            description,
            type,
            mapel,
            category,
            deadline,
        });

        if (error) {
            return h.response({ error: error.details[0].message }).code(400);
        }

        // Insert new task into the database
        await db.query(
            'INSERT INTO task (title, description, type, mapel, category, deadline, class_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, description, type, mapel, category, deadline, classId, userId]
        );

        // Get the newly created task data for response
        const [newTaskData] = await db.query(
            'SELECT title, description, type, mapel, category, deadline FROM task WHERE id = LAST_INSERT_ID()'
        );

        return h.response({
            message: 'Task created successfully',
            data: newTaskData,
        }).code(201);
    } catch (err) {
        console.error('Error:', err);
        return h.response({ error: 'An error occurred while processing your request' }).code(500);
    }
};



const getTaskDetail = async (request, h) => {
    try {
        // Ambil classId dan taskId dari URL
        const { classId, taskId } = request.params;

        // Jalankan query untuk mengambil detail tugas berdasarkan classId dan taskId
        const [rows] = await db.query(`
            SELECT 
                task.id AS task_id,
                task.title,
                task.description,
                task.type,
                task.priority,
                task.deadline,
                task_user.user_id,
                task_user.upload_file,
                task_user.progress,
                task_user.start_time,
                task_user.end_time,
                users.username AS user_name
            FROM task
            LEFT JOIN task_user ON task.id = task_user.task_id
            LEFT JOIN users ON task_user.user_id = users.id
            WHERE task.id = ? AND task.class_id = ?
        `, [taskId, classId]); // Gunakan parameter untuk filter berdasarkan classId dan taskId

        if (rows.length === 0) {
            return h.response({
                message: `No task found with class_id = ${classId} and task_id = ${taskId}`,
                data: null,
            }).code(404);
        }

        // Gabungkan data berdasarkan taskId
        const taskDetails = rows.reduce((acc, row) => {
            if (!acc.task_id) {
                acc.task_id = row.task_id;
                acc.title = row.title;
                acc.description = row.description;
                acc.type = row.type;
                acc.priority = row.priority;
                acc.deadline = row.deadline;
                acc.users_with_progress_2 = [];
            }

            // Tambahkan pengguna jika progress = 2
            if (row.progress === "2") {
                acc.users_with_progress_2.push({
                    user_id: row.user_id,
                    upload_file: row.upload_file,
                    progress: row.progress,
                    start_time: row.start_time,
                    end_time: row.end_time,
                    user_name: row.user_name,
                });
            }

            return acc;
        }, {});

        return h.response({
            message: 'Task details retrieved successfully',
            data: taskDetails,
        }).code(200);
    } catch (err) {
        console.error('Error:', err);
        return h.response({ error: 'An error occurred while processing your request' }).code(500);
    }
};



const editTask = async (request, h) => {
    const { taskId } = request.params;

    try {
        // Validate task input
        const { error, value } = taskSchema.validate(request.payload);

        if (error) {
            return h.response({ error: error.details[0].message }).code(400);
        }

        // Update task in the database
        await db.query(
            'UPDATE task SET title = ?, description = ?, mapel = ?,category = ?, deadline = ? WHERE id = ?',
            [
                value.title,
                value.description,
                value.mapel,
                value.category,
                value.deadline,
                taskId,
            ]
        );

        // Get the updated task data for response
        const [updatedTaskData] = await db.query(
            'SELECT title, description, mapel, category, deadline FROM task WHERE id = ?',
            [taskId]
        );

        return h.response({
            message: 'Task updated successfully',
            data: updatedTaskData,
        }).code(200);
    } catch (err) {
        console.error('Error:', err);
        return h.response({ error: 'An error occurred while processing your request' }).code(500);
    }
};

const deleteTask = async (request, h) => {
    const { taskId } = request.params;

    try {
        // Delete task from database
        await db.query(
            'DELETE FROM task WHERE id = ?',
            [taskId]
        );

        return h.response({
            message: 'Task deleted successfully',
        }).code(200);
    } catch (err) {
        console.error('Error:', err);
        return h.response({ error: 'An error occurred while processing your request' }).code(500);
    }
};
/******************************************************HANDLER BUAT MURID DIBAWAH***************************************************/
const getTaskMurid = async (request, h) => {
    try {
        const { userId } = request.auth.credentials;

        // Query untuk mengambil tugas berdasarkan user ID
        const [rows] = await db.query(
          `
            SELECT 
                t.id AS task_id,
                t.title,
                t.description,
                t.type,
                t.created_by,
                t.class_id,
                t.deadline,
                t.category,
                t.mapel
            FROM task t
            WHERE 
                (t.type = 'individu' AND t.created_by = ?) -- Task individu hanya pembuat
                OR (
                    t.type = 'kelas' 
                    AND t.class_id IN (SELECT class_id FROM user_class WHERE user_id = ?) -- Task kelas untuk anggota kelas
                )
            `,
            [userId, userId]
        );

        if (rows.length === 0) {
            return h.response({ message: 'No tasks found for this user' }).code(404);
        }

        // Mengembalikan daftar tugas
        return h.response({
            message: 'Tasks retrieved successfully',
            data: rows,
        }).code(200);
    } catch (err) {
        console.error('Error:', err);
        return h.response({ error: 'An error occurred while processing your request' }).code(500);
    }
};
const storage = new Storage({
    projectId: process.env.GCLOUD_PROJECT_ID, // Ambil dari .env
});
const bucketName = process.env.GCLOUD_BUCKET_NAME; // Ambil dari .env
const bucket = storage.bucket(bucketName);
const uploadImage = async (file) => {
    if (!file || !file._data || !file.hapi.filename) {
        throw new Error('File data is missing or invalid');
    }

    const uniqueFilename = `${Date.now()}-${file.hapi.filename}`;
    const fileUpload = bucket.file(uniqueFilename);

    await fileUpload.save(file._data, {
        resumable: false,
        contentType: file.hapi.headers['content-type'], // Pastikan content-type diambil dari headers
        public: true,
    });

    return `https://storage.googleapis.com/${bucketName}/${uniqueFilename}`;
};
const updateTaskMurid = async (request, h) => {
    const { taskId } = request.params; // Get task_id from URL parameter
    const { userId } = request.auth.credentials; // Get user_id from authentication

    try {
        // Validate payload without task_id and user_id
        const taskSchema = Joi.object({
            progress: Joi.string().valid('0', '1', '2').required(),
            start_time: Joi.date().required(),
            end_time: Joi.date().allow(null),
            upload_file: Joi.any().optional(), // Add upload_file field validation
        });
        const { error, value } = taskSchema.validate(request.payload);
        // If validation fails
        if (error) {
            return h.response({ error: error.details[0].message }).code(400);
        }

        // Check if task already exists in the database for this user
        const [existingTask] = await db.query(
            'SELECT * FROM task_user WHERE task_id = ? AND user_id = ?',
            [taskId, userId]
        );

        // Handle file upload
        let fileUrl = null;
        if (request.payload.upload_file && request.payload.upload_file._data) {
            // Assuming uploadImage handles file upload and returns the URL
            fileUrl = await uploadImage(request.payload.upload_file);
        }

        if (existingTask.length === 0) {
            // If task doesn't exist, insert a new one
            await db.query(
                'INSERT INTO task_user (task_id, user_id, progress, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
                [
                    taskId,
                    userId,
                    value.progress, 
                    value.start_time,
                    value.end_time,
                ]
            );
            return h.response({
                message: 'Task created successfully',
            }).code(201);
        } else {
            // If task already exists, update it
            await db.query(
                'UPDATE task_user SET progress = ?, start_time = ?, end_time = ?, upload_file = ? WHERE task_id = ? AND user_id = ?',
                [
                    value.progress,
                    value.start_time,
                    value.end_time,
                    fileUrl || existingTask[0].upload_file, // Retain existing file URL if no new file
                    taskId,
                    userId,
                ]
            );
            return h.response({
                message: 'Task updated successfully',
            }).code(200);
        }
    } catch (err) {
        console.error('Error:', err);
        return h.response({ error: 'An error occurred while processing your request' }).code(500);
    }
};





module.exports = {
    inputTaskGuru,
    inputClassCode,
    getUserClasses,
    getClassTasks,
    getTaskDetail,
    editTask,
    deleteTask,
    getTaskMurid,
    updateTaskMurid
};
