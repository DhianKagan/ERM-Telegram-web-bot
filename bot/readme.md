Telegram Task Manager Bot with JWT Authentication

    This project is a Telegram bot for managing tasks within a group. It allows admins to create and assign tasks to group members, and group members can view and update their task statuses. The bot is secured with JWT authentication for API endpoints.

Features

Admin Features

    - Create tasks and assign them to specific users.

    - View tasks assigned to users and overall task progress.

User Features

    - List tasks assigned to them.

    - Update task statuses (in-progress, completed).

API Features

    - Provides RESTful API endpoints to retrieve tasks and their statuses.

    - Secured with JWT authentication.

Project Structure

telegram-task-bot/
|
├── src/                # Core application logic
│   ├── bot/            # Telegram bot logic
│   ├── services/       # Business logic (task creation, assignment, status updates)
│   ├── db/             # Database models and connection setup
│   ├── api/            # REST API implementation
│   └── auth/           # Authentication and authorization logic
|
├── config/             # Configuration files (e.g., environment variables, secrets)
├── tests/              # Unit and integration tests
├── Dockerfile          # Dockerfile for containerization
├── cloudbuild.yaml     # Google Cloud Build configuration
└── README.md           # Project documentation

Getting Started

Prerequisites

Node.js

npm

Docker

Google Cloud SDK (for deployment)

Installation

Clone the repository:

    - git clone https://github.com/a-kashif-ahmed/telegram-task-bot.git
    - cd telegram-task-bot

Install dependencies:

    - npm install

Set up environment variables in a .env file:



Start the bot:

    - node src/bot/bot.js

