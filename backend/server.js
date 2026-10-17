require('dotenv').config({
path: require('path').join(__dirname, '.env')
});

const express = require('express');
const cors = require('cors');

const {
initializeDatabase,
getDatabase,
saveDatabase
} = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
res.json({
message: 'Student Timetable and Goals API is running.',
endpoints: {
getAll: 'GET /api/timetable',
getById: 'GET /api/timetable/:id',
create: 'POST /api/timetable',
update: 'PUT /api/timetable/:id',
delete: 'DELETE /api/timetable/:id'
}
});
});

function getTimetableRecords() {
const db = getDatabase();

const result = db.exec(`
    SELECT *
    FROM timetable
    ORDER BY study_date ASC, start_time ASC
`);

if (!result.length) {
    return [];
}

const columns = result[0].columns;
const rows = result[0].values;

return rows.map(row => {
    const record = {};

    columns.forEach((column, index) => {
        record[column] = row[index];
    });

    return record;
});

}

function getTimetableRecord(id) {
const db = getDatabase();

const statement = db.prepare(
    'SELECT * FROM timetable WHERE id = ?'
);

statement.bind([id]);

let record = null;

if (statement.step()) {
    record = statement.getAsObject();
}

statement.free();

return record;

}

function validateTimetableData(data) {
const requiredFields = [
'course_code',
'course_name',
'study_goal',
'study_date',
'start_time',
'duration_minutes'
];

for (const field of requiredFields) {
    if (
        data[field] === undefined ||
        data[field] === null ||
        String(data[field]).trim() === ''
    ) {
        return `${field} is required.`;
    }
}

if (
    !Number.isInteger(Number(data.duration_minutes)) ||
    Number(data.duration_minutes) <= 0
) {
    return 'duration_minutes must be a positive whole number.';
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(data.study_date)) {
    return 'study_date must use YYYY-MM-DD format.';
}

if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.start_time)) {
    return 'start_time must use HH:MM format.';
}

return null;

}

// GET all timetable records
app.get('/api/timetable', (req, res) => {
try {
res.status(200).json({
success: true,
count: getTimetableRecords().length,
data: getTimetableRecords()
});
} catch (error) {
console.error('GET all error:', error);

    res.status(500).json({
        success: false,
        message: 'Failed to retrieve timetable records.'
    });
}

});

// GET one timetable record by ID
app.get('/api/timetable/:id', (req, res) => {
const id = Number(req.params.id);

if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
        success: false,
        message: 'A valid record ID is required.'
    });
}

try {
    const record = getTimetableRecord(id);

    if (!record) {
        return res.status(404).json({
            success: false,
            message: 'Timetable record not found.'
        });
    }

    res.status(200).json({
        success: true,
        data: record
    });
} catch (error) {
    console.error('GET by ID error:', error);

    res.status(500).json({
        success: false,
        message: 'Failed to retrieve timetable record.'
    });
}

});

// POST create a timetable record
app.post('/api/timetable', (req, res) => {
const validationError = validateTimetableData(req.body);

if (validationError) {
    return res.status(400).json({
        success: false,
        message: validationError
    });
}

const {
    course_code,
    course_name,
    study_goal,
    study_date,
    start_time,
    duration_minutes
} = req.body;

try {
    const db = getDatabase();

    db.run(`
        INSERT INTO timetable (
            course_code,
            course_name,
            study_goal,
            study_date,
            start_time,
            duration_minutes
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        String(course_code).trim(),
        String(course_name).trim(),
        String(study_goal).trim(),
        study_date,
        start_time,
        Number(duration_minutes)
    ]);

    const result = db.exec('SELECT last_insert_rowid() AS id');
    const newId = Number(result[0].values[0][0]);

    saveDatabase();

    res.status(201).json({
        success: true,
        message: 'Timetable record created successfully.',
        data: getTimetableRecord(newId)
    });
} catch (error) {
    console.error('POST error:', error);

    res.status(500).json({
        success: false,
        message: 'Failed to create timetable record.'
    });
}

});

// PUT update a timetable record
app.put('/api/timetable/:id', (req, res) => {
const id = Number(req.params.id);

if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
        success: false,
        message: 'A valid record ID is required.'
    });
}

const validationError = validateTimetableData(req.body);

if (validationError) {
    return res.status(400).json({
        success: false,
        message: validationError
    });
}

try {
    const existingRecord = getTimetableRecord(id);

    if (!existingRecord) {
        return res.status(404).json({
            success: false,
            message: 'Timetable record not found.'
        });
    }

    const {
        course_code,
        course_name,
        study_goal,
        study_date,
        start_time,
        duration_minutes
    } = req.body;

    const db = getDatabase();

    db.run(`
        UPDATE timetable
        SET
            course_code = ?,
            course_name = ?,
            study_goal = ?,
            study_date = ?,
            start_time = ?,
            duration_minutes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [
        String(course_code).trim(),
        String(course_name).trim(),
        String(study_goal).trim(),
        study_date,
        start_time,
        Number(duration_minutes),
        id
    ]);

    saveDatabase();

    res.status(200).json({
        success: true,
        message: 'Timetable record updated successfully.',
        data: getTimetableRecord(id)
    });
} catch (error) {
    console.error('PUT error:', error);

    res.status(500).json({
        success: false,
        message: 'Failed to update timetable record.'
    });
}

});

// DELETE a timetable record
app.delete('/api/timetable/:id', (req, res) => {
const id = Number(req.params.id);

if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
        success: false,
        message: 'A valid record ID is required.'
    });
}

try {
    const existingRecord = getTimetableRecord(id);

    if (!existingRecord) {
        return res.status(404).json({
            success: false,
            message: 'Timetable record not found.'
        });
    }

    const db = getDatabase();

    db.run(
        'DELETE FROM timetable WHERE id = ?',
        [id]
    );

    saveDatabase();

    res.status(200).json({
        success: true,
        message: 'Timetable record deleted successfully.',
        data: existingRecord
    });
} catch (error) {
    console.error('DELETE error:', error);

    res.status(500).json({
        success: false,
        message: 'Failed to delete timetable record.'
    });
}

});

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