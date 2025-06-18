const mysql = require('mysql2');

const conn = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "1234",
});

const sql = [
    "CREATE DATABASE IF NOT EXISTS telegram_task_bot",
    "USE telegram_task_bot",
    `CREATE TABLE IF NOT EXISTS users (
        user_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
        task_id INT AUTO_INCREMENT PRIMARY KEY,
        assigned_user_id INT,
        task_description VARCHAR(255) NOT NULL,
        status ENUM('pending', 'in-progress', 'completed') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_user_id) REFERENCES users(user_id)
    )`,
    `INSERT INTO users (user_id, username, is_admin) VALUES (1234,'example_user', false)`,
    `INSERT INTO tasks (task_id, assigned_user_id, task_description, status) VALUES (4321,1234,'Example task description', 'pending');
`
];
function setupsql(){
conn.connect(function (err) {
    if (err) throw err;
    console.log("Connected to MySQL");

    sql.forEach(query => {
        conn.query(query, function (err, result) {
            if (err) throw err;
            console.log(`${query} Executed Successfully`);
        });
    });
});
}

module.exports = setupsql;