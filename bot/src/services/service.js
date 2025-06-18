// Работа с задачами через MySQL
require('dotenv').config()
const mysql = require('mysql2/promise')
const pool = mysql.createPool(process.env.MYSQL_DATABASE_URL)

// Function to create a task
async function createTask(description) {
    const [rows] = await pool.execute(
        'INSERT INTO tasks (task_description, status) VALUES (?, ?)',
        [description, 'pending']
    )
    return rows
}

// Function to assign a task to a user
async function assignTask(userId, taskId) {
    await pool.execute(
        'UPDATE tasks SET assigned_user_id = ? WHERE task_id = ?',
        [userId, taskId]
    )
}

// Function to list tasks assigned to a user
async function listUserTasks(userId) {
    const [rows] = await pool.execute(
        'SELECT * FROM tasks WHERE assigned_user_id = ?',
        [userId]
    )
    return rows
}

// Function to update the status of a task
async function updateTaskStatus(taskId, status) {
    await pool.execute(
        'UPDATE tasks SET status = ? WHERE task_id = ?',
        [status, taskId]
    )
}

module.exports = { createTask, assignTask, listUserTasks, updateTaskStatus };

