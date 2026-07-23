const STORAGE_KEY = 'kanban_board_data_dynamic_tables_v2';

let boardData = {
    tasks: {},
    nextId: 1,
    columnList: [],
    columns: {}
};

let currentEditingTaskId = null;
let searchQuery = '';
let draggedColumnId = null;

const DEFAULT_COLUMNS = [
    { id: 'todo', title: 'Por hacer', color: '#bfdbfe' },
    { id: 'in-progress', title: 'En progreso', color: '#fef08a' },
    { id: 'review', title: 'En revisión', color: '#fbcfe8' },
    { id: 'completed', title: 'Completado', color: '#bbf7d0' }
];

function initializeBoard() {
    loadFromStorage();
    renderBoard();
    attachEventListeners();
    applyTheme();
}

function loadFromStorage() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            boardData = JSON.parse(stored);
            if (!boardData.columnList || boardData.columnList.length === 0) {
                initializeEmptyBoard();
            }
        } catch (e) {
            console.error('Error parsing stored data:', e);
            initializeEmptyBoard();
        }
    } else {
        initializeEmptyBoard();
    }
}

function initializeEmptyBoard() {
    boardData = {
        tasks: {},
        nextId: 1,
        columnList: [...DEFAULT_COLUMNS],
        columns: {}
    };
    DEFAULT_COLUMNS.forEach(col => {
        boardData.columns[col.id] = [];
    });
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boardData));
}

function renderBoard() {
    const container = document.getElementById('boardColumns');
    container.innerHTML = '';

    boardData.columnList.forEach(column => {
        const columnEl = createColumnElement(column);
        container.appendChild(columnEl);
    });

    const addColCard = document.createElement('div');
    addColCard.className = 'add-column-card';
    addColCard.innerHTML = '➕ Añadir nueva tabla';
    addColCard.addEventListener('click', addNewColumn);
    container.appendChild(addColCard);
}

function createColumnElement(column) {
    const columnDiv = document.createElement('section');
    columnDiv.className = 'column';
    columnDiv.dataset.columnId = column.id;
    columnDiv.draggable = true;

    const taskIds = boardData.columns[column.id] || [];
    const cards = taskIds
        .map(id => boardData.tasks[id])
        .filter(task => task && matchesSearch(task));

    const headerDiv = document.createElement('div');
    headerDiv.className = 'column-header';
    headerDiv.style.backgroundColor = column.color;
    
    const canDelete = boardData.columnList.length > 1;
    const deleteBtnHtml = canDelete ? `<button class="btn btn-danger btn-small" title="Eliminar tabla" onclick="deleteColumn('${column.id}')">🗑️</button>` : '';

    headerDiv.innerHTML = `
        <div class="column-title-wrapper">
            <input type="color" class="column-color-picker" value="${column.color}" title="Cambiar color de pestaña" onchange="updateColumnColor('${column.id}', this.value)">
            <span class="column-title" title="${escapeHtml(column.title)}">${escapeHtml(column.title)}</span>
        </div>
        <div class="column-header-actions">
            <span class="column-count">${cards.length}</span>
            ${deleteBtnHtml}
        </div>
    `;

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'cards-container';
    cardsContainer.dataset.columnId = column.id;

    if (cards.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = 'Sin tareas';
        cardsContainer.appendChild(emptyDiv);
    } else {
        cards.forEach(task => {
            cardsContainer.appendChild(createCardElement(task));
        });
    }

    columnDiv.appendChild(headerDiv);
    columnDiv.appendChild(cardsContainer);

    // Eventos de arrastre para mover las tablas completas
    columnDiv.addEventListener('dragstart', handleColumnDragStart);
    columnDiv.addEventListener('dragend', handleColumnDragEnd);
    columnDiv.addEventListener('dragover', handleColumnDragOver);
    columnDiv.addEventListener('drop', handleColumnDrop);

    return columnDiv;
}

// Lógica para arrastrar y reordenar columnas con sus tareas
function handleColumnDragStart(e) {
    if (e.target.closest('.card') || e.target.closest('button') || e.target.closest('input')) {
        e.preventDefault();
        return;
    }
    draggedColumnId = e.currentTarget.dataset.columnId;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.currentTarget.classList.add('dragging'), 0);
}

function handleColumnDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    draggedColumnId = null;
    document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
}

function handleColumnDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const targetColumn = e.target.closest('.column');
    if (targetColumn && draggedColumnId) {
        document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
        targetColumn.classList.add('drag-over');
    }
}

function handleColumnDrop(e) {
    e.preventDefault();
    const targetColumnEl = e.target.closest('.column');
    if (!targetColumnEl || !draggedColumnId) return;

    const targetColumnId = targetColumnEl.dataset.columnId;
    if (draggedColumnId === targetColumnId) return;

    const oldIndex = boardData.columnList.findIndex(c => c.id === draggedColumnId);
    const newIndex = boardData.columnList.findIndex(c => c.id === targetColumnId);

    if (oldIndex !== -1 && newIndex !== -1) {
        const [movedCol] = boardData.columnList.splice(oldIndex, 1);
        boardData.columnList.splice(newIndex, 0, movedCol);
        saveToStorage();
        renderBoard();
    }
}

function addNewColumn() {
    const title = prompt('Nombre de la nueva tabla / columna:');
    if (!title || !title.trim()) return;

    const id = 'col_' + Date.now();
    const pastelColors = ['#bfdbfe', '#fef08a', '#fbcfe8', '#bbf7d0', '#ddd6fe', '#fed7aa', '#99f6e4'];
    const randomColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];

    boardData.columnList.push({
        id: id,
        title: title.trim(),
        color: randomColor
    });

    boardData.columns[id] = [];
    saveToStorage();
    renderBoard();
}

function deleteColumn(columnId) {
    if (!confirm('¿Estás seguro de eliminar esta tabla y todas sus tareas?')) return;

    const taskIds = boardData.columns[columnId] || [];
    taskIds.forEach(taskId => {
        delete boardData.tasks[taskId];
    });

    delete boardData.columns[columnId];
    boardData.columnList = boardData.columnList.filter(col => col.id !== columnId);

    saveToStorage();
    renderBoard();
}

function updateColumnColor(columnId, color) {
    const col = boardData.columnList.find(c => c.id === columnId);
    if (col) {
        col.color = color;
        saveToStorage();
        renderBoard();
    }
}

function createCardElement(task) {
    const cardDiv = document.createElement('article');
    cardDiv.className = 'card';
    cardDiv.draggable = true;
    cardDiv.dataset.taskId = task.id;

    const priorityText = { high: 'Alta', medium: 'Media', low: 'Baja' }[task.priority];

    const dueDateHtml = task.dueDate ? (() => {
        const dueDate = new Date(task.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        let className = 'due-date';
        if (dueDate < today) className += ' overdue';
        else if (dueDate - today <= 86400000) className += ' due-soon';

        return `<div class="${className}">📅 ${task.dueDate}</div>`;
    })() : '';

    const specsHtml = (task.specs && task.specs.length > 0) ? `
        <div class="card-specs">
            ${task.specs.map(s => `<span class="spec-tag"><strong>${escapeHtml(s.key)}:</strong> ${escapeHtml(s.value)}</span>`).join('')}
        </div>
    ` : '';

    cardDiv.innerHTML = `
        <div class="card-header">
            <div class="card-title">${escapeHtml(task.title)}</div>
            <span class="priority-badge priority-${task.priority}">${priorityText}</span>
        </div>
        ${task.description ? `<div class="card-description">${escapeHtml(task.description)}</div>` : ''}
        ${specsHtml}
        <div class="card-meta">
            <div></div>
            ${dueDateHtml}
        </div>
        <div class="card-actions">
            <button class="btn btn-secondary btn-small" onclick="editTask(${task.id})">✏️</button>
            <button class="btn btn-danger btn-small" onclick="deleteTask(${task.id})">🗑️</button>
        </div>
    `;

    cardDiv.addEventListener('dragstart', handleCardDragStart);
    cardDiv.addEventListener('dragend', handleCardDragEnd);

    return cardDiv;
}

function matchesSearch(task) {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const matchTitleDesc = task.title.toLowerCase().includes(query) || task.description.toLowerCase().includes(query);
    const matchSpecs = task.specs && task.specs.some(s => s.key.toLowerCase().includes(query) || s.value.toLowerCase().includes(query));
    return matchTitleDesc || matchSpecs;
}

function handleCardDragStart(e) {
    e.stopPropagation();
    const taskId = parseInt(e.target.closest('.card').dataset.taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    e.target.closest('.card').classList.add('dragging');
}

function handleCardDragEnd(e) {
    e.stopPropagation();
    e.target.closest('.card').classList.remove('dragging');
}

function handleCardDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleCardDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const taskIdStr = e.dataTransfer.getData('text/plain');
    if (!taskIdStr) return;
    const taskId = parseInt(taskIdStr);
    const targetContainer = e.target.closest('.cards-container');
    const newColumnId = targetContainer?.dataset.columnId;

    if (newColumnId && !isNaN(taskId)) {
        moveTask(taskId, newColumnId);
    }
}

function moveTask(taskId, newColumnId) {
    const task = boardData.tasks[taskId];
    if (!task) return;

    const oldColumnId = Object.keys(boardData.columns).find(colId =>
        boardData.columns[colId].includes(taskId)
    );

    if (oldColumnId !== newColumnId) {
        boardData.columns[oldColumnId] = boardData.columns[oldColumnId].filter(id => id !== taskId);
        if (!boardData.columns[newColumnId]) {
            boardData.columns[newColumnId] = [];
        }
        boardData.columns[newColumnId].push(taskId);
        saveToStorage();
        renderBoard();
    }
}

function addSpecField(containerId, key = '', value = '') {
    const container = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'spec-row';
    row.innerHTML = `
        <input type="text" class="form-input spec-key" placeholder="Ej: Horas, Cliente..." value="${key}">
        <input type="text" class="form-input spec-val" placeholder="Ej: 4h, Juan Pérez..." value="${value}">
        <button type="button" class="btn btn-danger btn-small" onclick="this.closest('.spec-row').remove()">✕</button>
    `;
    container.appendChild(row);
}

function getSpecsFromContainer(containerId) {
    const container = document.getElementById(containerId);
    const rows = container.querySelectorAll('.spec-row');
    const specs = [];
    rows.forEach(row => {
        const k = row.querySelector('.spec-key').value.trim();
        const v = row.querySelector('.spec-val').value.trim();
        if (k || v) {
            specs.push({ key: k || 'Campo', value: v || '' });
        }
    });
    return specs;
}

function openTaskModal() {
    document.getElementById('taskForm').reset();
    document.getElementById('taskSpecsContainer').innerHTML = '';
    addSpecField('taskSpecsContainer');
    document.getElementById('taskModal').showModal();
}

function closeTaskModal() {
    document.getElementById('taskModal').close();
}

function openEditModal(taskId) {
    const task = boardData.tasks[taskId];
    if (!task) return;

    currentEditingTaskId = taskId;
    document.getElementById('editTitle').value = task.title;
    document.getElementById('editDescription').value = task.description || '';
    document.getElementById('editPriority').value = task.priority;
    document.getElementById('editDueDate').value = task.dueDate || '';
    
    const container = document.getElementById('editSpecsContainer');
    container.innerHTML = '';
    if (task.specs && task.specs.length > 0) {
        task.specs.forEach(s => addSpecField('editSpecsContainer', s.key, s.value));
    } else {
        addSpecField('editSpecsContainer');
    }

    document.getElementById('editModal').showModal();
}

function closeEditModal() {
    document.getElementById('editModal').close();
    currentEditingTaskId = null;
}

function editTask(taskId) {
    openEditModal(taskId);
}

function deleteTask(taskId) {
    if (!confirm('¿Eliminar esta tarea?')) return;

    const columnId = Object.keys(boardData.columns).find(colId =>
        boardData.columns[colId].includes(taskId)
    );

    if (columnId) {
        boardData.columns[columnId] = boardData.columns[columnId].filter(id => id !== taskId);
    }

    delete boardData.tasks[taskId];
    saveToStorage();
    renderBoard();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function attachEventListeners() {
    document.getElementById('newTaskBtn').addEventListener('click', openTaskModal);

    document.getElementById('taskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const taskId = boardData.nextId++;
        const task = {
            id: taskId,
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            priority: document.getElementById('taskPriority').value,
            dueDate: document.getElementById('taskDueDate').value,
            specs: getSpecsFromContainer('taskSpecsContainer'),
            createdAt: new Date().toISOString()
        };

        boardData.tasks[taskId] = task;
        const firstColId = boardData.columnList[0]?.id || 'todo';
        if (!boardData.columns[firstColId]) boardData.columns[firstColId] = [];
        boardData.columns[firstColId].push(taskId);

        saveToStorage();
        renderBoard();
        closeTaskModal();
    });

    document.getElementById('editForm').addEventListener('submit', (e) => {
        e.preventDefault();
        if (currentEditingTaskId === null) return;

        const task = boardData.tasks[currentEditingTaskId];
        task.title = document.getElementById('editTitle').value;
        task.description = document.getElementById('editDescription').value;
        task.priority = document.getElementById('editPriority').value;
        task.dueDate = document.getElementById('editDueDate').value;
        task.specs = getSpecsFromContainer('editSpecsContainer');

        saveToStorage();
        renderBoard();
        closeEditModal();
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderBoard();
    });

    document.getElementById('themeToggle').addEventListener('click', () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('kanban_theme_dynamic_tables', newTheme);
        document.getElementById('themeToggle').textContent = newTheme === 'dark' ? '☀️' : '🌙';
    });

    document.addEventListener('dragover', (e) => {
        if (e.target.closest('.cards-container')) {
            handleCardDragOver(e);
        }
    });

    document.addEventListener('drop', (e) => {
        if (e.target.closest('.cards-container')) {
            handleCardDrop(e);
        }
    });
}

function applyTheme() {
    const theme = localStorage.getItem('kanban_theme_dynamic_tables') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('themeToggle').textContent = theme === 'dark' ? '☀️' : '🌙';
}

document.addEventListener('DOMContentLoaded', initializeBoard);