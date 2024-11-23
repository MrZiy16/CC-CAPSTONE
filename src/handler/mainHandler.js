const Joi = require('joi');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;
const db = require('../db');

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
        const { userId } = request.auth.credentials;

        // Get existing class data with the same code to check validity and get the name
        const [existingClasses] = await db.query(
            'SELECT * FROM class WHERE code = ?',
            [classCode]
        );

        if (existingClasses.length === 0) {
            return h.response({ error: 'Class code is invalid' }).code(404);
        }

        // Get the name from existing class with the same code
        const className = existingClasses[0].name;

        // Check if user is already registered in this class using the User_Class table
        const [userClassEntry] = await db.query(
            'SELECT * FROM User_Class WHERE class_id = (SELECT id FROM class WHERE code = ?) AND user_id = ?',
            [classCode, userId]
        );

        if (userClassEntry.length > 0) {
            return h.response({ 
                error: 'You are already registered in this class' 
            }).code(400);
        }

        // Insert new entry into User_Class to link the user to the class
        const [classEntry] = await db.query(
            'SELECT id FROM class WHERE code = ?',
            [classCode]
        );

        const classId = classEntry[0].id;

        await db.query(
            'INSERT INTO User_Class (user_id, class_id) VALUES (?, ?)',
            [userId, classId]
        );

        // Get the newly created class data for response
        return h.response({
            message: 'Successfully entered the class',
            class: { code: classCode, name: className }
        }).code(200);

    } catch (err) {
        console.error('Error:', err);
        return h.response({ 
            error: 'An error occurred while processing your request' 
        }).code(500);
    }
};

// Fetching all classes the user belongs to
const getUserClasses = async (request, h) => {
    const { userId } = request.auth.credentials;

    try {
        // Query to fetch all classes the user belongs to
        const [rows] = await db.query(
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
            'SELECT title,description,deadline FROM task WHERE class_id = ?',
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


// Validation schema for task creation
const taskSchema = Joi.object({
    title: Joi.string().max(30).required(),
    description: Joi.string().max(255).required(),
    type: Joi.string().valid('individu', 'kelas').required(),
    priority: Joi.number().integer().min(1).max(5).required(),
    progress: Joi.number().integer().min(0).max(100).required(),
    deadline: Joi.date().required(),
});

const inputTaskGuru = async (request, h) => {
    try {
        const { userId } = request.auth.credentials;
        let { classId } = request.params; // Check for classId in the URL

        // If classId is not in the URL, fetch the user's classId
        if (!classId) {
            const [userClassEntry] = await db.query(
                'SELECT class_id FROM user_class WHERE user_id = ? LIMIT 1',
                [userId]
            );

            if (!userClassEntry || userClassEntry.length === 0) {
                return h.response({ error: 'User is not enrolled in any class' }).code(400);
            }

            classId = userClassEntry[0].class_id;
        }

        const { title, description, type, priority, progress, deadline } = request.payload;

        // Validate task input
        const { error, value } = taskSchema.validate({
            title,
            description,
            type,
            priority,
            progress,
            deadline,
        });

        if (error) {
            return h.response({ error: error.details[0].message }).code(400);
        }

        // Insert new task into the database
        await db.query(
            'INSERT INTO task (title, description, type,priority, progress, deadline, class_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [title, description, type, priority, progress, deadline, classId, userId]
        );

        // Get the newly created task data for response
        const [newTaskData] = await db.query(
            'SELECT title, description, type, priority, progress, deadline FROM task WHERE id = LAST_INSERT_ID()'
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
    const { taskId } = request.params;

    try {
        // Fetch task detail from database
        const [rows] = await db.query(
            'SELECT title, description, type, start_time, end_time, priority, progress, deadline FROM task WHERE id = ?',
            [taskId]
        );

        if (rows.length === 0) {
            return h.response({ error: 'Task not found' }).code(404);
        }

        // Return the task detail
        return h.response({
            message: 'Task detail retrieved successfully',
            data: rows,
        }).code(200);
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
};
