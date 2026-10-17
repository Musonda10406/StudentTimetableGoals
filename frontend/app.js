'use strict';

cconst API_URL = 'https://musonda-study-plan.onrender.com';

const $ = selector => document.querySelector(selector);

let records = [];
let editingId = null;

// Load saved browser data or use the default data.
function loadLocal(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    } catch {
        return fallback;
    }
}

function saveLocal(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

let goals = loadLocal('studentGoals', [
    { id: 1, title: 'Complete ICT221', progress: 100 },
    { id: 2, title: 'Finish Java OOP exercises', progress: 100 },
    { id: 3, title: 'Improve in Statistics', progress: 50 },
    { id: 4, title: 'Build my final year project', progress: 0 },
    { id: 5, title: 'Get A+ in all courses', progress: 0 }
]);

let courses = loadLocal('studentCourses', [
    { code: 'ICT221', name: 'Computer Architecture' },
    { code: 'ICT261', name: 'Introduction to OOP & Java' },
    { code: 'ICT281', name: 'Statistics & Empirical Methods for Computing' },
    { code: 'ICT241', name: 'Digital Design' },
    { code: 'MSM111', name: 'Mathematical Methods I' },
    { code: 'ICT251', name: 'Web Technologies I' }
]);

let tasks = loadLocal('studentTasks', [
    { id: 1, title: 'OOP Assignment 1', course: 'ICT261', due: '2026-10-18', done: false },
    { id: 2, title: 'Web Project Setup', course: 'ICT251', due: '2026-10-20', done: false },
    { id: 3, title: 'Statistics Quiz', course: 'ICT281', due: '2026-10-22', done: false },
    { id: 4, title: 'Read Chapter 4', course: 'MSM111', due: '2026-10-25', done: false }
]);

let activity = loadLocal('studentActivity', []);


// Display messages on the dashboard.
function showNotice(message, error = false) {
    const notice = $('#notice');

    notice.textContent = message;
    notice.classList.toggle('error', error);
    notice.style.display = 'block';

    clearTimeout(showNotice.timer);

    showNotice.timer = setTimeout(() => {
        notice.style.display = 'none';
    }, 4500);
}


// Escape user-provided text before inserting it into HTML.
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}


// Record actions in the Recent Activity section.
function addActivity(message) {
    activity.unshift({
        text: message,
        time: new Date().toLocaleString()
    });

    activity = activity.slice(0, 30);

    saveLocal('studentActivity', activity);
    renderActivity();
}


// Update dashboard statistics.
function updateStats() {
    $('#courseCount').textContent = courses.length;

    $('#completedGoals').textContent =
        goals.filter(goal => goal.progress >= 100).length;

    $('#pendingTasks').textContent =
        tasks.filter(task => !task.done).length;

    const progress = goals.length
        ? Math.round(
            goals.reduce((total, goal) => total + goal.progress, 0) /
            goals.length
        )
        : 0;

    $('#overallProgress').textContent = progress + '%';
}


// NAVIGATION
function navigate(section) {
    const allowedSections = [
        'dashboard',
        'timetable',
        'goals',
        'courses',
        'tasks',
        'settings',
        'activity'
    ];

    if (!allowedSections.includes(section)) return;

    document.querySelectorAll('.section-view').forEach(view => {
        view.classList.toggle(
            'active',
            view.id === 'view-' + section
        );
    });

    document.querySelectorAll('.nav [data-section]').forEach(button => {
        button.classList.toggle(
            'active',
            button.dataset.section === section
        );
    });

    if (section === 'timetable') renderFullTimetable();
    if (section === 'goals') renderGoals();
    if (section === 'courses') renderCourses();
    if (section === 'tasks') renderTasks();
    if (section === 'activity') renderActivity(true);

    window.scrollTo({
        top: 0,
        behavior: document.body.classList.contains('no-animations')
            ? 'auto'
            : 'smooth'
    });
}


// API REQUEST FUNCTION
async function requestApi(url, options = {}) {
    let response;

    try {
        response = await fetch(url, {
            ...options,
            headers: {
                ...(options.body
                    ? { 'Content-Type': 'application/json' }
                    : {}),
                ...options.headers
            }
        });
    } catch {
        throw new Error(
            'Cannot connect to the API. Check that your backend is running.'
        );
    }

    const text = await response.text();

    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error('The server returned an invalid response.');
        }
    }

    if (!response.ok) {
        throw new Error(data?.error || `Request failed: ${response.status}`);
    }

    return data;
}


// CREATE TABLE CELLS
function createCell(value) {
    const cell = document.createElement('td');
    cell.textContent = value ?? '';
    return cell;
}


// CREATE EDIT AND DELETE BUTTONS
function createActions(record) {
    const cell = document.createElement('td');
    const wrapper = document.createElement('div');

    wrapper.className = 'row-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';

    editButton.addEventListener('click', () => {
        openRecordModal(record);
    });

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'delete-btn';

    deleteButton.addEventListener('click', () => {
        deleteRecord(record.id);
    });

    wrapper.append(editButton, deleteButton);
    cell.append(wrapper);

    return cell;
}


// DISPLAY RECORDS IN A TABLE
function renderTable(tableBody, fullTable = false) {
    if (!tableBody) return;

    tableBody.replaceChildren();

    if (records.length === 0) {
        const row = document.createElement('tr');
        const cell = createCell(
            'No study sessions found. Click Add session to create one.'
        );

        cell.colSpan = fullTable ? 7 : 5;
        cell.className = 'empty';

        row.append(cell);
        tableBody.append(row);

        return;
    }

    records.forEach(record => {
        const row = document.createElement('tr');

        if (fullTable) {
            row.append(
                createCell(record.id),
                createCell(record.course_code + ' — ' + record.course_name),
                createCell(record.study_goal),
                createCell(record.study_date),
                createCell(record.start_time),
                createCell(record.duration_minutes + ' minutes'),
                createActions(record)
            );
        } else {
            row.append(
                createCell(
                    record.course_code + ' — ' +
                    record.course_name + '\n' +
                    record.study_goal
                ),
                createCell(record.study_date),
                createCell(record.start_time),
                createCell(record.duration_minutes + ' min'),
                createActions(record)
            );
        }

        tableBody.append(row);
    });
}


// READ: LOAD ALL RECORDS FROM THE BACKEND
async function loadRecords() {
    const tableBody = $('#timetableBody');
    const fullBody = $('#fullTimetableBody');

    try {
        const data = await requestApi(API_URL);

        if (!Array.isArray(data)) {
            throw new Error('The API did not return a list of records.');
        }

        records = data;

        renderTable(tableBody);
        renderTable(fullBody, true);

        showNotice('Timetable loaded successfully.');

    } catch (error) {
        console.error(error);

        [tableBody, fullBody].forEach(body => {
            if (!body) return;

            body.innerHTML = '';

            const row = document.createElement('tr');
            const cell = createCell(
                'Unable to load records. Check that the backend is running.'
            );

            cell.colSpan = body.id === 'fullTimetableBody' ? 7 : 5;
            cell.className = 'empty';

            row.append(cell);
            body.append(row);
        });

        showNotice(error.message, true);
    }
}


function renderFullTimetable() {
    renderTable($('#fullTimetableBody'), true);
}


// OPEN ADD/EDIT MODAL
function openRecordModal(record = null) {
    editingId = record ? record.id : null;

    $('#recordForm').reset();

    $('#recordId').value = record ? record.id : '';

    $('#modalTitle').textContent = record
        ? 'Edit study session'
        : 'Add study session';

    $('#saveRecordBtn').textContent = record
        ? 'Save changes'
        : 'Save session';

    $('#course_code').value = record?.course_code || '';
    $('#course_name').value = record?.course_name || '';
    $('#study_goal').value = record?.study_goal || '';

    $('#study_date').value = record?.study_date ||
        new Date().toISOString().slice(0, 10);

    $('#start_time').value = record?.start_time || '08:00';

    $('#duration_minutes').value = record?.duration_minutes || 60;

    $('#modalBackdrop').classList.add('open');

    document.body.style.overflow = 'hidden';
}


function closeRecordModal() {
    $('#modalBackdrop').classList.remove('open');

    document.body.style.overflow = '';

    editingId = null;
}


// CREATE OR UPDATE RECORD
$('#recordForm').addEventListener('submit', async event => {
    event.preventDefault();

    const record = {
        course_code: $('#course_code').value.trim(),
        course_name: $('#course_name').value.trim(),
        study_goal: $('#study_goal').value.trim(),
        study_date: $('#study_date').value,
        start_time: $('#start_time').value,
        duration_minutes: Number($('#duration_minutes').value)
    };

    if (
        !record.course_code ||
        !record.course_name ||
        !record.study_goal ||
        !record.study_date ||
        !record.start_time ||
        !Number.isInteger(record.duration_minutes) ||
        record.duration_minutes < 1 ||
        record.duration_minutes > 1440
    ) {
        showNotice('Please complete every field correctly.', true);
        return;
    }

    const updating = editingId !== null;

    try {
        if (updating) {
            await requestApi(API_URL + '/' + editingId, {
                method: 'PUT',
                body: JSON.stringify(record)
            });

            addActivity('Updated study session: ' + record.course_code);

        } else {
            await requestApi(API_URL, {
                method: 'POST',
                body: JSON.stringify(record)
            });

            addActivity('Added study session: ' + record.course_code);
        }

        closeRecordModal();

        await loadRecords();

        showNotice(
            updating
                ? 'Study session updated successfully.'
                : 'Study session added successfully.'
        );

    } catch (error) {
        showNotice(error.message, true);
    }
});


// DELETE RECORD
async function deleteRecord(id) {
    const record = records.find(item => Number(item.id) === Number(id));

    const confirmed = confirm(
        'Delete this study session' +
        (record ? ' for ' + record.course_code : '') +
        '? This cannot be undone.'
    );

    if (!confirmed) return;

    try {
        await requestApi(API_URL + '/' + id, {
            method: 'DELETE'
        });

        addActivity('Deleted study session #' + id);

        await loadRecords();

        showNotice('Study session deleted.');

    } catch (error) {
        showNotice(error.message, true);
    }
}


// GOALS
function renderGoals() {
    const dashboard = $('#dashboardGoals');
    const page = $('#goalsPageList');

    dashboard.replaceChildren();
    page.replaceChildren();

    goals.forEach(goal => {
        const percentage = Math.max(
            0,
            Math.min(100, Number(goal.progress) || 0)
        );

        // Dashboard goal
        const row = document.createElement('div');
        row.className = 'goal-row';

        const check = document.createElement('button');
        check.type = 'button';
        check.className = 'check' +
            (percentage >= 100 ? ' done' : '');

        check.textContent = percentage >= 100 ? '✓' : '○';

        check.addEventListener('click', () => toggleGoal(goal.id));

        const content = document.createElement('div');

        content.innerHTML = `
            <div>${escapeHtml(goal.title)}</div>
            <div class="progress">
                <span style="width:${percentage}%"></span>
            </div>
            <small class="goal-percent">${percentage}%</small>
        `;

        row.append(check, content);
        dashboard.append(row);

        // Goals page
        const item = document.createElement('div');
        item.className = 'list-item';

        const info = document.createElement('div');

        info.innerHTML = `
            <strong>${escapeHtml(goal.title)}</strong>
            <small>${percentage}% complete</small>
            <div class="progress">
                <span style="width:${percentage}%"></span>
            </div>
        `;

        const actions = document.createElement('div');

        const toggle = document.createElement('button');
        toggle.className = 'small-btn';
        toggle.textContent = percentage >= 100 ? 'Reopen' : 'Complete';

        toggle.addEventListener('click', () => toggleGoal(goal.id));

        const remove = document.createElement('button');
        remove.className = 'danger-btn';
        remove.textContent = 'Delete';

        remove.addEventListener('click', () => {
            goals = goals.filter(g => g.id !== goal.id);

            saveLocal('studentGoals', goals);

            renderGoals();
            updateStats();

            addActivity('Removed a study goal');
        });

        actions.append(toggle, remove);
        item.append(info, actions);

        page.append(item);
    });

    if (goals.length === 0) {
        dashboard.innerHTML =
            '<p class="empty">No goals yet. Add one from the Goals page.</p>';

        page.innerHTML =
            '<p class="empty">Add your first study goal above.</p>';
    }

    updateStats();
}


function toggleGoal(id) {
    const goal = goals.find(item => item.id === id);

    if (!goal) return;

    goal.progress = goal.progress >= 100 ? 0 : 100;

    saveLocal('studentGoals', goals);

    renderGoals();
    updateStats();

    addActivity(
        (goal.progress >= 100 ? 'Completed goal: ' : 'Reopened goal: ') +
        goal.title
    );
}


$('#goalForm').addEventListener('submit', event => {
    event.preventDefault();

    const title = $('#goalInput').value.trim();

    if (!title) return;

    goals.push({
        id: Date.now(),
        title,
        progress: 0
    });

    saveLocal('studentGoals', goals);

    $('#goalForm').reset();

    renderGoals();
    updateStats();

    addActivity('Added goal: ' + title);

    showNotice('Study goal added.');
});


// COURSES
function renderCourses() {
    const container = $('#coursesList');

    container.replaceChildren();

    courses.forEach(course => {
        const item = document.createElement('div');
        item.className = 'list-item';

        const info = document.createElement('div');

        info.innerHTML = `
            <strong>${escapeHtml(course.code)} — ${escapeHtml(course.name)}</strong>
            <small>Semester course</small>
        `;

        const remove = document.createElement('button');

        remove.className = 'danger-btn';
        remove.textContent = 'Remove';

        remove.addEventListener('click', () => {
            if (!confirm('Remove ' + course.code + ' from your course list?')) {
                return;
            }

            courses = courses.filter(c => c.code !== course.code);

            saveLocal('studentCourses', courses);

            renderCourses();
            updateCourseOptions();
            updateStats();
        });

        item.append(info, remove);

        container.append(item);
    });

    if (courses.length === 0) {
        container.innerHTML = '<p class="empty">No courses added yet.</p>';
    }

    updateStats();
}


$('#courseForm').addEventListener('submit', event => {
    event.preventDefault();

    const code = $('#courseCodeInput').value.trim().toUpperCase();
    const name = $('#courseNameInput').value.trim();

    if (!code || !name) return;

    if (courses.some(course => course.code.toUpperCase() === code)) {
        showNotice('That course code already exists.', true);
        return;
    }

    courses.push({ code, name });

    saveLocal('studentCourses', courses);

    $('#courseForm').reset();

    renderCourses();
    updateCourseOptions();
    updateStats();

    addActivity('Added course: ' + code);

    showNotice('Course added successfully.');
});


function updateCourseOptions() {
    const select = $('#taskCourseInput');

    select.replaceChildren();

    courses.forEach(course => {
        const option = document.createElement('option');

        option.value = course.code;
        option.textContent = course.code + ' — ' + course.name;

        select.append(option);
    });

    if (courses.length === 0) {
        const option = document.createElement('option');

        option.value = '';
        option.textContent = 'Add a course first';

        select.append(option);
    }
}


// TASKS
function renderTasks() {
    const page = $('#tasksPageList');
    const dashboard = $('#dashboardTasks');

    page.replaceChildren();
    dashboard.replaceChildren();

    const sortedTasks = [...tasks].sort((a, b) =>
        a.due.localeCompare(b.due)
    );

    sortedTasks.forEach((task, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';

        const info = document.createElement('div');

        info.innerHTML = `
            <strong>${escapeHtml(task.title)}</strong>
            <small>${escapeHtml(task.course)} · Due ${escapeHtml(task.due)}</small>
            <small>${task.done ? 'Completed' : 'Pending'}</small>
        `;

        const actions = document.createElement('div');

        const toggle = document.createElement('button');
        toggle.className = 'small-btn';
        toggle.textContent = task.done ? 'Reopen' : 'Complete';

        toggle.addEventListener('click', () => {
            task.done = !task.done;

            saveLocal('studentTasks', tasks);

            renderTasks();
            updateStats();

            addActivity(
                (task.done ? 'Completed task: ' : 'Reopened task: ') +
                task.title
            );
        });

        const remove = document.createElement('button');
        remove.className = 'danger-btn';
        remove.textContent = 'Delete';

        remove.addEventListener('click', () => {
            tasks = tasks.filter(t => t.id !== task.id);

            saveLocal('studentTasks', tasks);

            renderTasks();
            updateStats();

            addActivity('Deleted task: ' + task.title);
        });

        actions.append(toggle, remove);

        item.append(info, actions);

        page.append(item);

        // Show the first four tasks on the dashboard.
        if (index < 4) {
            const card = document.createElement('div');
            card.className = 'list-item';

            const dashboardInfo = document.createElement('div');

            dashboardInfo.innerHTML = `
                <strong>${escapeHtml(task.title)}</strong>
                <small>${escapeHtml(task.course)} · ${escapeHtml(task.due)}</small>
            `;

            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = task.done ? 'Done' : 'Pending';

            card.append(dashboardInfo, badge);

            dashboard.append(card);
        }
    });

    if (tasks.length === 0) {
        page.innerHTML = '<p class="empty">No tasks yet. Add one above.</p>';
        dashboard.innerHTML = '<p class="empty">No upcoming tasks.</p>';
    }

    updateStats();
}


$('#taskForm').addEventListener('submit', event => {
    event.preventDefault();

    const title = $('#taskNameInput').value.trim();
    const course = $('#taskCourseInput').value;
    const due = $('#taskDueInput').value;

    if (!title || !course || !due) {
        showNotice('Enter the task, course and due date.', true);
        return;
    }

    tasks.push({
        id: Date.now(),
        title,
        course,
        due,
        done: false
    });

    saveLocal('studentTasks', tasks);

    $('#taskForm').reset();

    renderTasks();
    updateStats();

    addActivity('Added task: ' + title);

    showNotice('Task added successfully.');
});


// RECENT ACTIVITY
function renderActivity(showAll = false) {
    const containers = showAll
        ? [$('#allActivityList')]
        : [$('#activityList'), $('#allActivityList')];

    containers.filter(Boolean).forEach(container => {
        container.replaceChildren();

        const entries = activity.length
            ? activity
            : [{
                text: 'Dashboard initialized',
                time: new Date().toLocaleString()
            }];

        entries.slice(0, showAll ? 30 : 5).forEach(entry => {
            const row = document.createElement('div');
            row.className = 'activity';

            const icon = document.createElement('span');
            icon.className = 'activity-icon';
            icon.textContent = '✓';

            const text = document.createElement('span');
            text.textContent = entry.text;

            const time = document.createElement('time');
            time.textContent = entry.time;

            row.append(icon, text, time);

            container.append(row);
        });
    });
}


// BUTTONS AND NAVIGATION
function bindEvents() {
    document.querySelectorAll('.nav [data-section]').forEach(button => {
        button.addEventListener('click', () => {
            navigate(button.dataset.section);
        });
    });

    // All Add Session buttons open the same form.
    ['navAdd', 'addRecordBtn', 'floatingAdd'].forEach(id => {
        $('#' + id).addEventListener('click', () => openRecordModal());
    });

    document.querySelectorAll('[data-open-form]').forEach(button => {
        button.addEventListener('click', () => openRecordModal());
    });

    $('#manageGoalsBtn').addEventListener('click', () => navigate('goals'));
    $('#viewTasksBtn').addEventListener('click', () => navigate('tasks'));
    $('#viewActivityBtn').addEventListener('click', () => navigate('activity'));

    $('#cancelModal').addEventListener('click', closeRecordModal);
    $('#closeModal').addEventListener('click', closeRecordModal);

    $('#modalBackdrop').addEventListener('click', event => {
        if (event.target === $('#modalBackdrop')) {
            closeRecordModal();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closeRecordModal();
        }
    });

    $('#logoutBtn').addEventListener('click', () => {
        alert(
            'This project does not have a login system yet. ' +
            'Your dashboard is still open.'
        );
    });

    $('#animationToggle').addEventListener('click', () => {
        const disabled = document.body.classList.toggle('no-animations');

        $('#animationToggle').textContent = disabled
            ? 'Enable animations'
            : 'Disable animations';

        showNotice(disabled
            ? 'Animations disabled.'
            : 'Animations enabled.');
    });

    $('#refreshDataBtn').addEventListener('click', loadRecords);

    $('#clearLocalBtn').addEventListener('click', () => {
        const confirmed = confirm(
            'Clear saved goals, courses, tasks and activity? ' +
            'This will NOT delete timetable records from the API.'
        );

        if (!confirmed) return;

        ['studentGoals', 'studentCourses', 'studentTasks', 'studentActivity']
            .forEach(key => localStorage.removeItem(key));

        goals = [];
        courses = [];
        tasks = [];
        activity = [];

        renderGoals();
        renderCourses();
        renderTasks();
        renderActivity();
        updateCourseOptions();
        updateStats();

        showNotice('Browser data cleared. Timetable records remain safe.');
    });
}


// START THE APPLICATION
function init() {
    $('#todayDate').textContent = new Date().toLocaleDateString(
        undefined,
        {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }
    );

    bindEvents();

    updateCourseOptions();
    renderGoals();
    renderCourses();
    renderTasks();
    renderActivity();

    loadRecords();

    console.log('Student Timetable & Goals dashboard started.');
}

init();