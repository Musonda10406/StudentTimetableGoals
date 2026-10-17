
'use strict';

/* =========================================================
   STUDYFLOW — STUDENT TIMETABLE & GOALS
   Backend: Node.js + Express + SQLite REST API
   ========================================================= */

const API_URL = 'https://musonda-study-plan.onrender.com/api/timetable';

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

let records = [];
let editingId = null;

let goals = loadLocal('studentGoals', [
    { id: 1, title: 'Complete ICT221', course: 'ICT221', description: '', progress: 100 },
    { id: 2, title: 'Finish Java OOP exercises', course: 'ICT261', description: '', progress: 100 },
    { id: 3, title: 'Improve in Statistics', course: 'ICT281', description: '', progress: 50 },
    { id: 4, title: 'Build my final year project', course: '', description: '', progress: 0 },
    { id: 5, title: 'Get A+ in all courses', course: '', description: '', progress: 0 }
]);

let tasks = loadLocal('studentTasks', [
    { id: 1, title: 'OOP Assignment 1', course: 'ICT261', due: '2026-10-18', done: false },
    { id: 2, title: 'Web Project Setup', course: 'ICT251', due: '2026-10-20', done: false },
    { id: 3, title: 'Statistics Quiz', course: 'ICT281', due: '2026-10-22', done: false },
    { id: 4, title: 'Read Chapter 4', course: 'MSM111', due: '2026-10-25', done: false }
]);

let activity = loadLocal('studentActivity', []);

/* -------------------- LOCAL STORAGE -------------------- */

function loadLocal(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved === null ? fallback : JSON.parse(saved);
    } catch (error) {
        console.warn(`Could not load ${key}:`, error);
        return fallback;
    }
}

function saveLocal(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error(`Could not save ${key}:`, error);
        showNotice('Could not save information in this browser.', true);
    }
}

/* -------------------- GENERAL HELPERS -------------------- */

function firstElement(selectors) {
    for (const selector of selectors) {
        const element = $(selector);
        if (element) return element;
    }
    return null;
}

function setText(selectors, value) {
    const element = Array.isArray(selectors)
        ? firstElement(selectors)
        : $(selectors);

    if (element) element.textContent = String(value ?? '');
}

function todayString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function showNotice(message, isError = false) {
    const notice = $('#globalNotice');

    if (notice) {
        notice.textContent = message;
        notice.classList.add('show');
        notice.classList.toggle('error', isError);
        notice.setAttribute('role', 'status');

        clearTimeout(showNotice.timer);
        showNotice.timer = setTimeout(() => {
            notice.classList.remove('show');
        }, 5000);
    } else {
        console[isError ? 'error' : 'log'](message);
    }
}

/* -------------------- API -------------------- */

async function requestApi(url, options = {}) {
    let response;

    try {
        response = await fetch(url, {
            ...options,
            headers: {
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...options.headers
            }
        });
    } catch (error) {
        throw new Error(
            'Could not connect to the API. Check your internet connection and Render service.'
        );
    }

    const responseText = await response.text();
    let data = null;

    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch {
            throw new Error('The API returned invalid JSON.');
        }
    }

    if (!response.ok) {
        throw new Error(
            data?.error ||
            data?.message ||
            `API request failed with status ${response.status}.`
        );
    }

    return data;
}

function extractRecords(response) {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.records)) return response.records;
    if (Array.isArray(response?.timetable)) return response.timetable;

    throw new Error('The API response does not contain a timetable list.');
}

/* -------------------- ACTIVITY -------------------- */

function addActivity(message) {
    activity.unshift({
        text: message,
        time: new Date().toLocaleString()
    });

    activity = activity.slice(0, 30);
    saveLocal('studentActivity', activity);
    renderActivity();
}

function renderActivity(showAll = false) {
    const containers = [
        $('#activityList'),
        $('#dashboardActivity'),
        $('#allActivityList'),
        $('#activityPageList')
    ].filter(Boolean);

    const uniqueContainers = [...new Set(containers)];

    uniqueContainers.forEach(container => {
        container.replaceChildren();

        const entries = activity.length
            ? activity.slice(0, showAll ? 30 : 5)
            : [{
                text: 'Welcome to your study dashboard.',
                time: new Date().toLocaleString()
            }];

        entries.forEach(entry => {
            const row = document.createElement('div');
            row.className = 'activity list-item';

            const message = document.createElement('span');
            message.textContent = entry.text;

            const time = document.createElement('small');
            time.textContent = entry.time;

            row.append(message, time);
            container.append(row);
        });
    });
}

/* -------------------- DASHBOARD STATISTICS -------------------- */

function updateStats() {
    setText('#totalSessions', records.length);

    const totalMinutes = records.reduce(
        (sum, record) => sum + (Number(record.duration_minutes) || 0),
        0
    );

    setText('#totalHours', (totalMinutes / 60).toFixed(1));

    setText(
        '#totalCourses',
        new Set(records.map(record => record.course_code).filter(Boolean)).size
    );

    setText(
        '#completedTasks',
        tasks.filter(task => task.done).length
    );

    setText(
        ['#completedGoals', '#goalsCompleted'],
        goals.filter(goal => Number(goal.progress) >= 100).length
    );

    setText(
        ['#pendingTasks', '#tasksPending'],
        tasks.filter(task => !task.done).length
    );

    const progress = goals.length
        ? Math.round(
            goals.reduce(
                (sum, goal) => sum + (Number(goal.progress) || 0),
                0
            ) / goals.length
        )
        : 0;

    setText(['#overallProgress', '#studyProgress'], `${progress}%`);
}

/* -------------------- SESSION MODAL -------------------- */

function getRecordForm() {
    return $('#sessionForm');
}

function openRecordModal(record = null) {
    const form = getRecordForm();
    const modal = $('#sessionModal');

    if (!form || !modal) {
        showNotice('The session form or modal is missing from index.html.', true);
        return;
    }

    editingId = record ? record.id : null;
    form.reset();

    $('#sessionId').value = record?.id ?? '';
    $('#courseCode').value = record?.course_code ?? '';
    $('#courseName').value = record?.course_name ?? '';
    $('#studyGoal').value = record?.study_goal ?? '';
    $('#studyDate').value = record?.study_date ?? todayString();
    $('#startTime').value = record?.start_time ?? '08:00';
    $('#durationMinutes').value = record?.duration_minutes ?? 60;

    setText('#modalTitle', record ? 'Edit study session' : 'Add study session');

    const saveButton = $('#saveSessionButton');
    if (saveButton) {
        saveButton.textContent = record ? 'Save changes' : 'Save session';
        saveButton.disabled = false;
    }

    const formNotice = $('#formNotice');
    if (formNotice) {
        formNotice.textContent = '';
        formNotice.classList.remove('show', 'error');
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    $('#courseCode')?.focus();
}

function closeRecordModal() {
    const modal = $('#sessionModal');

    if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    getRecordForm()?.reset();
    document.body.style.overflow = '';
    editingId = null;

    const saveButton = $('#saveSessionButton');
    if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = 'Save session';
    }
}

/* Compatibility with the existing inline script in index.html */
window.openSessionModal = () => openRecordModal();

/* -------------------- CREATE / UPDATE SESSION -------------------- */

async function saveRecord(event) {
    event.preventDefault();

    const record = {
        course_code: $('#courseCode').value.trim(),
        course_name: $('#courseName').value.trim(),
        study_goal: $('#studyGoal').value.trim(),
        study_date: $('#studyDate').value,
        start_time: $('#startTime').value,
        duration_minutes: Number($('#durationMinutes').value)
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
        showNotice('Complete all session fields correctly.', true);
        return;
    }

    const updating = editingId !== null;
    const saveButton = $('#saveSessionButton');

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
    }

    try {
        const url = updating ? `${API_URL}/${editingId}` : API_URL;

        await requestApi(url, {
            method: updating ? 'PUT' : 'POST',
            body: JSON.stringify(record)
        });

        addActivity(
            `${updating ? 'Updated' : 'Added'} study session: ${record.course_code}`
        );

        closeRecordModal();
        await loadRecords();

        showNotice(
            updating
                ? 'Study session updated successfully.'
                : 'Study session added successfully.'
        );
    } catch (error) {
        console.error('Could not save session:', error);
        showNotice(error.message, true);
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save session';
        }
    }
}

/* -------------------- DELETE SESSION -------------------- */

async function deleteRecord(id) {
    const record = records.find(item => String(item.id) === String(id));

    const confirmed = confirm(
        `Delete study session${record ? ` for ${record.course_code}` : ''}? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
        await requestApi(`${API_URL}/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });

        addActivity(`Deleted study session #${id}`);
        await loadRecords();
        showNotice('Study session deleted successfully.');
    } catch (error) {
        console.error('Could not delete session:', error);
        showNotice(error.message, true);
    }
}

/* -------------------- TIMETABLE DISPLAY -------------------- */

function createSessionCard(record) {
    const card = document.createElement('article');
    card.className = 'list-item session-card';

    const info = document.createElement('div');

    const heading = document.createElement('strong');
    heading.textContent = `${record.course_code} — ${record.course_name}`;

    const goal = document.createElement('p');
    goal.textContent = record.study_goal;

    const details = document.createElement('small');
    details.textContent =
        `${record.study_date} · ${record.start_time} · ${record.duration_minutes} minutes`;

    info.append(heading, goal, details);

    const actions = document.createElement('div');
    actions.className = 'row-actions';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => openRecordModal(record));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.className = 'danger-btn';
    deleteButton.addEventListener('click', () => deleteRecord(record.id));

    actions.append(editButton, deleteButton);
    card.append(info, actions);

    return card;
}

function getFilteredRecords() {
    const search = ($('#searchInput')?.value || '').trim().toLowerCase();
    const course = $('#courseFilter')?.value || '';
    const dateFilter = $('#dateFilter')?.value || '';
    const today = todayString();

    return records.filter(record => {
        const searchable = [
            record.course_code,
            record.course_name,
            record.study_goal
        ].join(' ').toLowerCase();

        if (search && !searchable.includes(search)) return false;
        if (course && record.course_code !== course) return false;

        if (dateFilter === 'today' && record.study_date !== today) return false;
        if (dateFilter === 'upcoming' && record.study_date < today) return false;
        if (dateFilter === 'past' && record.study_date >= today) return false;

        return true;
    });
}

function renderSessionsInto(container, list) {
    if (!container) return;

    container.replaceChildren();

    if (!list.length) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = records.length
            ? 'No sessions match your filters.'
            : 'No study sessions yet. Add your first session.';

        container.append(empty);
        return;
    }

    list.forEach(record => container.append(createSessionCard(record)));
}

function updateCourseFilter() {
    const select = $('#courseFilter');
    if (!select) return;

    const previous = select.value;
    const codes = [
        ...new Set(records.map(record => record.course_code).filter(Boolean))
    ].sort();

    select.replaceChildren();

    const all = document.createElement('option');
    all.value = '';
    all.textContent = 'All courses';
    select.append(all);

    codes.forEach(code => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = code;
        select.append(option);
    });

    if (codes.includes(previous)) select.value = previous;
}

function renderTimetable() {
    renderSessionsInto($('#timetableContainer'), getFilteredRecords());

    const today = todayString();

    const upcoming = [...records]
        .filter(record => record.study_date >= today)
        .sort((a, b) =>
            `${a.study_date} ${a.start_time}`.localeCompare(
                `${b.study_date} ${b.start_time}`
            )
        )
        .slice(0, 4);

    renderSessionsInto($('#dashboardSessions'), upcoming);
    updateStats();
}

async function loadRecords() {
    const containers = [
        $('#timetableContainer'),
        $('#dashboardSessions')
    ].filter(Boolean);

    containers.forEach(container => {
        container.replaceChildren();

        const loading = document.createElement('p');
        loading.className = 'loading';
        loading.textContent = 'Loading timetable...';
        container.append(loading);
    });

    try {
        const response = await requestApi(API_URL);
        records = extractRecords(response);

        updateCourseFilter();
        renderTimetable();
    } catch (error) {
        console.error('Timetable loading failed:', error);

        containers.forEach(container => {
            container.replaceChildren();

            const message = document.createElement('p');
            message.className = 'empty';
            message.textContent = 'Could not load timetable. ' + error.message;

            const retry = document.createElement('button');
            retry.type = 'button';
            retry.textContent = 'Try again';
            retry.addEventListener('click', loadRecords);

            container.append(message, retry);
        });

        showNotice(error.message, true);
    }
}

/* -------------------- GOALS -------------------- */

function renderGoals() {
    const containers = [
        $('#dashboardGoals'),
        $('#goalsContainer')
    ].filter(Boolean);

    containers.forEach(container => {
        container.replaceChildren();

        if (!goals.length) {
            const empty = document.createElement('p');
            empty.className = 'empty';
            empty.textContent = 'No goals yet. Add a study goal below.';
            container.append(empty);
            return;
        }

        goals.forEach(goal => {
            const percentage = Math.max(
                0,
                Math.min(100, Number(goal.progress) || 0)
            );

            const row = document.createElement('div');
            row.className = 'goal-row list-item';

            const info = document.createElement('div');

            const title = document.createElement('strong');
            title.textContent = goal.title;

            const course = document.createElement('p');
            course.textContent = goal.course ? `Course: ${goal.course}` : 'Personal goal';

            const description = document.createElement('p');
            description.textContent = goal.description || '';

            const progress = document.createElement('progress');
            progress.max = 100;
            progress.value = percentage;

            const percent = document.createElement('small');
            percent.textContent = `${percentage}% complete`;

            info.append(title, course, description, progress, percent);

            const actions = document.createElement('div');
            actions.className = 'row-actions';

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.textContent = percentage >= 100 ? 'Reopen' : 'Complete';

            toggle.addEventListener('click', () => {
                goal.progress = percentage >= 100 ? 0 : 100;

                saveLocal('studentGoals', goals);
                renderGoals();
                updateStats();

                addActivity(
                    `${goal.progress >= 100 ? 'Completed' : 'Reopened'} goal: ${goal.title}`
                );
            });

            const remove = document.createElement('button');
            remove.type = 'button';
            remove.textContent = 'Delete';
            remove.className = 'danger-btn';

            remove.addEventListener('click', () => {
                if (!confirm(`Delete goal "${goal.title}"?`)) return;

                goals = goals.filter(item => item.id !== goal.id);

                saveLocal('studentGoals', goals);
                renderGoals();
                updateStats();

                addActivity(`Deleted goal: ${goal.title}`);
            });

            actions.append(toggle, remove);
            row.append(info, actions);
            container.append(row);
        });
    });

    updateStats();
}

function addGoal(event) {
    event.preventDefault();

    const title = $('#goalTitle')?.value.trim();
    const course = $('#goalCourse')?.value.trim() || '';
    const description = $('#goalDescription')?.value.trim() || '';

    if (!title) {
        showNotice('Enter a goal title.', true);
        return;
    }

    goals.push({
        id: Date.now(),
        title,
        course,
        description,
        progress: 0
    });

    saveLocal('studentGoals', goals);
    $('#goalForm')?.reset();

    renderGoals();
    addActivity(`Added goal: ${title}`);
    showNotice('Study goal added.');
}

/* -------------------- TASKS -------------------- */

function renderTasks() {
    const list = $('#taskList');

    if (!list) {
        updateStats();
        return;
    }

    list.replaceChildren();

    tasks.forEach(task => {
        const item = document.createElement('li');
        item.className = 'list-item task-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = Boolean(task.done);
        checkbox.setAttribute('aria-label', `Complete ${task.title}`);

        const info = document.createElement('div');

        const title = document.createElement('strong');
        title.textContent = task.title;

        const details = document.createElement('small');
        details.textContent = [
            task.course || '',
            task.due ? `Due ${task.due}` : ''
        ].filter(Boolean).join(' · ');

        const status = document.createElement('small');
        status.textContent = task.done ? 'Completed' : 'Pending';

        info.append(title, details, status);

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Delete';
        remove.className = 'danger-btn';

        checkbox.addEventListener('change', () => {
            task.done = checkbox.checked;

            saveLocal('studentTasks', tasks);
            renderTasks();
            updateStats();

            addActivity(
                `${task.done ? 'Completed' : 'Reopened'} task: ${task.title}`
            );
        });

        remove.addEventListener('click', () => {
            if (!confirm(`Delete task "${task.title}"?`)) return;

            tasks = tasks.filter(item => item.id !== task.id);

            saveLocal('studentTasks', tasks);
            renderTasks();
            updateStats();

            addActivity(`Deleted task: ${task.title}`);
        });

        item.append(checkbox, info, remove);
        list.append(item);
    });

    const empty = $('#emptyTasks');
    if (empty) empty.style.display = tasks.length ? 'none' : 'block';

    updateStats();
}

function addTask(event) {
    event.preventDefault();

    const title = $('#taskInput')?.value.trim();

    if (!title) {
        showNotice('Enter a task first.', true);
        return;
    }

    tasks.push({
        id: Date.now(),
        title,
        course: '',
        due: '',
        done: false
    });

    saveLocal('studentTasks', tasks);
    $('#taskForm')?.reset();

    renderTasks();
    addActivity(`Added task: ${title}`);
    showNotice('Task added successfully.');
}

/* -------------------- NAVIGATION -------------------- */

function navigate(section) {
    const name = String(section || '').replace(/^view-/, '');

    $$('.section-view').forEach(view => {
        view.classList.toggle('active', view.id === `view-${name}`);
    });

    $$('.nav-button[data-section], .nav [data-section], [data-section].nav-link')
        .forEach(button => {
            button.classList.toggle('active', button.dataset.section === name);
        });

    const titles = {
        dashboard: ['Dashboard', 'Your study overview'],
        timetable: ['Timetable', 'Manage your study sessions'],
        goals: ['Study Goals', 'Track your academic progress'],
        tasks: ['Tasks', 'Manage your study tasks']
    };

    if (titles[name]) {
        setText('#pageTitle', titles[name][0]);
        setText('#pageSubtitle', titles[name][1]);
    }

    if (name === 'dashboard') {
        renderTimetable();
        renderGoals();
        renderTasks();
        renderActivity();
    } else if (name === 'timetable') {
        renderTimetable();
    } else if (name === 'goals') {
        renderGoals();
    } else if (name === 'tasks') {
        renderTasks();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* -------------------- EVENT BINDING -------------------- */

function bindEvents() {
    // Navigation buttons
    $$('.nav-button[data-section], .nav [data-section], [data-section].nav-link')
        .forEach(button => {
            button.addEventListener('click', () => {
                navigate(button.dataset.section);
            });
        });

    // Navigation links elsewhere on the page
    $$('[data-go-section]').forEach(button => {
        button.addEventListener('click', () => {
            navigate(button.dataset.goSection);
        });
    });

    // Add session buttons
    [
        '#topAddButton',
        '#welcomeAddButton',
        '#addSessionButton'
    ].forEach(selector => {
        $(selector)?.addEventListener('click', event => {
            event.preventDefault();
            openRecordModal();
        });
    });

    // Session form
    getRecordForm()?.addEventListener('submit', saveRecord);

    // Modal controls
    $('#closeModalButton')?.addEventListener('click', closeRecordModal);
    $('#cancelModalButton')?.addEventListener('click', closeRecordModal);

    $('#sessionModal')?.addEventListener('click', event => {
        if (event.target === $('#sessionModal')) {
            closeRecordModal();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeRecordModal();
    });

    // Goals and tasks
    $('#goalForm')?.addEventListener('submit', addGoal);
    $('#taskForm')?.addEventListener('submit', addTask);

    // Refresh timetable
    $('#refreshButton')?.addEventListener('click', loadRecords);

    // Search and filters
    ['#searchInput', '#courseFilter', '#dateFilter'].forEach(selector => {
        $(selector)?.addEventListener('input', renderTimetable);
        $(selector)?.addEventListener('change', renderTimetable);
    });

    // Sidebar toggle
    $('#menuToggle')?.addEventListener('click', () => {
        $('#sidebar')?.classList.toggle('open');
    });
}

/* -------------------- START APPLICATION -------------------- */

function init() {
    setText(
        '#todayLabel',
        new Date().toLocaleDateString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    );

    bindEvents();

    renderGoals();
    renderTasks();
    renderActivity();
    renderTimetable();

    loadRecords();

    console.log('StudyFlow application started.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
