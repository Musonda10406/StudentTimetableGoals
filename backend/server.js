require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { initializeDatabase, getDatabase, saveDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Check that the API is running.
app.get('/', (req, res) => {
res.json({
message: 'Student Timetable & Goals API is running.',
endpoints: [
'GET /api/timetable',
'GET /api/timetable/:id',
'POST /api/timetable',
'PUT /api/timetable/:id',
'DELETE /api/timetable/:id'
]
});
});

// GET: Retrieve all timetable records.
app.get('/api/timetable', (req, res) => {
try {
const db = getDatabase();
const result = db.exec('SELECT * FROM timetable ORDER BY id');

    const records = result.length
        ? result[0].values.map(row => {
            const record = {};
            result[0].columns.forEach((column, index) => {
                record[column] = row[index];
            });
            return record;
        })
        : [];

    res.json(records);
} catch (error) {
    res.status(500).json({ error: error.message });
}

});

// GET: Retrieve one timetable record by ID.
app.get('/api/timetable/:id', (req, res) => {
try {
const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'A valid record ID is required.' });
    }

    const db = getDatabase();
    const statement = db.prepare('SELECT * FROM timetable WHERE id = ?');
    statement.bind([id]);

    let record = null;

    if (statement.step()) {
        record = statement.getAsObject();
    }

    statement.free();

    if (!record) {
        return res.status(404).json({ error: 'Timetable record not found.' });
    }

    res.json(record);
} catch (error) {
    res.status(500).json({ error: error.message });
}

});

// POST: Create a timetable record.
app.post('/api/timetable', (req, res) => {
try {
const {
course_code,
course_name,
study_goal,
study_date,
start_time,
duration_minutes
} = req.body;

    if (
        typeof course_code !== 'string' || !course_code.trim() ||
        typeof course_name !== 'string' || !course_name.trim() ||
        typeof study_goal !== 'string' || !study_goal.trim() ||
        typeof study_date !== 'string' || !study_date.trim() ||
        typeof start_time !== 'string' || !start_time.trim() ||
        !Number.isInteger(Number(duration_minutes)) ||
        Number(duration_minutes) <= 0
    ) {
        return res.status(400).json({
            error: 'Provide course_code, course_name, study_goal, study_date, start_time, and a positive duration_minutes.'
        });
    }

    const db = getDatabase();

    const statement = db.prepare(`
        INSERT INTO timetable
        (course_code, course_name, study_goal, study_date, start_time, duration_minutes)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    statement.run([
        course_code.trim(),
        course_name.trim(),
        study_goal.trim(),
        study_date.trim(),
        start_time.trim(),
        Number(duration_minutes)
    ]);

    statement.free();

    const result = db.exec('SELECT last_insert_rowid() AS id');
    const id = result[0].values[0][0];

    saveDatabase();

    res.status(201).json({
        message: 'Timetable record created successfully.',
        record: {
            id,
            course_code: course_code.trim(),
            course_name: course_name.trim(),
            study_goal: study_goal.trim(),
            study_date: study_date.trim(),
            start_time: start_time.trim(),
            duration_minutes: Number(duration_minutes)
        }
    });
} catch (error) {
    res.status(500).json({ error: error.message });
}

});

// PUT: Update an existing timetable record.
app.put('/api/timetable/:id', (req, res) => {
try {
const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'A valid record ID is required.' });
    }

    const {
        course_code,
        course_name,
        study_goal,
        study_date,
        start_time,
        duration_minutes
    } = req.body;

    if (
        typeof course_code !== 'string' || !course_code.trim() ||
        typeof course_name !== 'string' || !course_name.trim() ||
        typeof study_goal !== 'string' || !study_goal.trim() ||
        typeof study_date !== 'string' || !study_date.trim() ||
        typeof start_time !== 'string' || !start_time.trim() ||
        !Number.isInteger(Number(duration_minutes)) ||
        Number(duration_minutes) <= 0
    ) {
        return res.status(400).json({
            error: 'Provide all six fields with a positive duration_minutes.'
        });
    }

    const db = getDatabase();
    const check = db.prepare('SELECT id FROM timetable WHERE id = ?');
    check.bind([id]);

    const exists = check.step();
    check.free();

    if (!exists) {
        return res.status(404).json({ error: 'Timetable record not found.' });
    }

    const statement = db.prepare(`
        UPDATE timetable
        SET course_code = ?,
            course_name = ?,
            study_goal = ?,
            study_date = ?,
            start_time = ?,
            duration_minutes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `);

    statement.run([
        course_code.trim(),
        course_name.trim(),
        study_goal.trim(),
        study_date.trim(),
        start_time.trim(),
        Number(duration_minutes),
        id
    ]);

    statement.free();
    saveDatabase();

    const updatedStatement = db.prepare('SELECT * FROM timetable WHERE id = ?');
    updatedStatement.bind([id]);

    let updatedRecord = null;

    if (updatedStatement.step()) {
        updatedRecord = updatedStatement.getAsObject();
    }

    updatedStatement.free();

    res.json({
        message: 'Timetable record updated successfully.',
        record: updatedRecord
    });
} catch (error) {
    res.status(500).json({ error: error.message });
}

});

// DELETE: Delete a timetable record.
app.delete('/api/timetable/:id', (req, res) => {
try {
const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
        return res.status(400).json({ error: 'A valid record ID is required.' });
    }

    const db = getDatabase();
    const statement = db.prepare('SELECT id FROM timetable WHERE id = ?');
    statement.bind([id]);

    const exists = statement.step();
    statement.free();

    if (!exists) {
        return res.status(404).json({ error: 'Timetable record not found.' });
    }

    const deleteStatement = db.prepare('DELETE FROM timetable WHERE id = ?');
    deleteStatement.run([id]);
    deleteStatement.free();

    saveDatabase();

    res.json({ message: 'Timetable record deleted successfully.', id });
} catch (error) {
    res.status(500).json({ error: error.message });
}

});

// Initialize the database before accepting API requests.
async function startServer() {
try {
await initializeDatabase();

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
} catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
}

}

startServer();