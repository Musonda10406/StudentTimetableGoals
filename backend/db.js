const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const databasePath = path.join(__dirname, 'database.sqlite');

let db;

async function initializeDatabase() {
const SQL = await initSqlJs();

if (fs.existsSync(databasePath)) {
    const fileBuffer = fs.readFileSync(databasePath);
    db = new SQL.Database(fileBuffer);
} else {
    db = new SQL.Database();
}

db.run(`
    CREATE TABLE IF NOT EXISTS timetable (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_code TEXT NOT NULL,
        course_name TEXT NOT NULL,
        study_goal TEXT NOT NULL,
        study_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);

const result = db.exec('SELECT COUNT(*) AS total FROM timetable');
const total = result[0].values[0][0];

if (total === 0) {
    const sampleRecords = [
        ['ICT221', 'Computer Architecture', 'Study CPU performance', '2026-10-19', '08:00', 60],
        ['ICT261', 'Object-Oriented Programming', 'Practice Java classes', '2026-10-19', '10:00', 90],
        ['ICT281', 'Statistics and Empirical Methods', 'Revise probability', '2026-10-19', '14:00', 60],
        ['ICT241', 'Digital Design', 'Practise Boolean algebra', '2026-10-20', '08:00', 60],
        ['MSM111', 'Mathematical Methods I', 'Practise functions', '2026-10-20', '10:00', 90],
        ['ICT251', 'Web Technologies I', 'Build a Node.js API', '2026-10-20', '14:00', 120],
        ['ICT221', 'Computer Architecture', 'Revise memory hierarchy', '2026-10-21', '08:00', 60],
        ['ICT261', 'Object-Oriented Programming', 'Practise inheritance', '2026-10-21', '10:00', 90],
        ['ICT241', 'Digital Design', 'Practise logic gates', '2026-10-22', '09:00', 60],
        ['ICT251', 'Web Technologies I', 'Practise REST API requests', '2026-10-22', '14:00', 120]
    ];

    const insert = db.prepare(`
        INSERT INTO timetable
        (course_code, course_name, study_goal, study_date, start_time, duration_minutes)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    sampleRecords.forEach(record => {
        insert.run(record);
    });

    insert.free();
}

saveDatabase();

console.log('SQLite database initialized successfully.');

}

function saveDatabase() {
if (!db) {
throw new Error('Database has not been initialized.');
}

const data = db.export();
fs.writeFileSync(databasePath, Buffer.from(data));

}

function getDatabase() {
if (!db) {
throw new Error('Database has not been initialized.');
}

return db;

}

module.exports = {
initializeDatabase,
getDatabase,
saveDatabase
};