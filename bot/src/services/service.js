const mysql = require('mysql2/promise');

// Create a MySQL connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'telegram_task_bot'
});

// Function to create a task
async function createTask(description) {
    const [rows] = await pool.execute(
        'INSERT INTO tasks (task_description, status) VALUES (?, ?)', 
        [description, 'pending']
    );
    if(err) throw err;
    return rows;
}

// Function to assign a task to a user
async function assignTask(userId, taskId) {
    await pool.execute(
        'UPDATE tasks SET assigned_user_id = ? WHERE task_id = ?',
        [userId, taskId]
    );
    if(err) throw err;
}

// Function to list tasks assigned to a user
async function listUserTasks(userId) {
    const [rows] = await pool.execute(
        'SELECT * FROM tasks WHERE assigned_user_id = ?',
        [userId]
    );
    if(err) throw err;
    return rows;
}

// Function to update the status of a task
async function updateTaskStatus(taskId, status) {
    await pool.execute(
        'UPDATE tasks SET status = ? WHERE task_id = ?',
        [status, taskId]
    );
    if(err) throw err;
}

module.exports = { createTask, assignTask, listUserTasks, updateTaskStatus };
