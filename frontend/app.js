// ✅ CORRECCIÓN DEFINITIVA
const API_URL = 'https://your-table.onrender.com/api';  // ← ASEGÚRATE QUE TERMINA EN /api

const STORAGE_KEY_BOARDS = 'kanban_boards_v2';
const STORAGE_KEY_CURRENT = 'kanban_current_board_v2';

let currentUser = localStorage.getItem('kanban_user_id');
let currentUsername = localStorage.getItem('kanban_username');
let isRegistering = false;
let currentBoardId = parseInt(localStorage.getItem(STORAGE_KEY_CURRENT)) || null;
let boards = [];
let currentBoardData = {
    id: null,
    title: 'Mi Tablero',
    tasks: {},
    nextId: 1,
    columnList: [],
    columns: {},
    owner_id: currentUser,
    shared_users: []
};

let currentEditingTaskId = null;
let searchQuery = '';
let draggedColumnId = null;
let pendingShareUsers = [];

const DEFAULT_COLUMNS = [
    { id: 'todo', title: 'Por hacer', color: '#bfdbfe' },
    { id: 'in-progress', title: 'En progreso', color: '#fef08a' },
    { id: 'review', title: 'En revisión', color: '#fbcfe8' },
    { id: 'completed', title: 'Completado', color: '#bbf7d0' }
];

document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    initializeApp();
    setupAuthListeners();
    attachMainEventListeners();
});

function initializeApp() {
    updateUserDisplay();
    loadLocalBoards();
    if (!currentBoardId) {
        createDefaultBoard();
    } else {
        loadBoard(currentBoardId);
    }
    
    if (currentUser) {
        loadInvitations();
    }
}

function loadLocalBoards() {
    const stored = localStorage.getItem(STORAGE_KEY_BOARDS);
    if (stored) {
        try {
            boards = JSON.parse(stored);
        } catch (e) {
            boards = [];
        }
    }
}

function saveLocalBoards() {
    localStorage.setItem(STORAGE_KEY_BOARDS, JSON.stringify(boards));
}

function createDefaultBoard() {
    const board = {
        id: Date.now(),
        title: 'Mi Primer Tablero',
        description: 'Tablero por defecto',
        tasks: {},
        nextId: 1,
        columnList: DEFAULT_COLUMNS.map(c => ({ ...c })),
        columns: {},
        owner_id: currentUser,
        shared_users: [],
        created_at: new Date().toISOString()
    };
    DEFAULT_COLUMNS.forEach(col => {
        board.columns[col.id] = [];
    });
    boards.push(board);
    currentBoardId = board.id;
    currentBoardData = JSON.parse(JSON.stringify(board));
    localStorage.setItem(STORAGE_KEY_CURRENT, currentBoardId);
    saveLocalBoards();
    renderBoard();
}

function loadBoard(boardId) {
    const board = boards.find(b => b.id === boardId);
    if (!board) {
        createDefaultBoard();
        return;
    }
    currentBoardId = boardId;
    currentBoardData = JSON.parse(JSON.stringify(board));
    localStorage.setItem(STORAGE_KEY_CURRENT, currentBoardId);
    document.getElementById('current-board-name').textContent = `/ ${currentBoardData.title}`;
    renderBoard();
}

function saveCurrentBoard() {
    const index = boards.findIndex(b => b.id === currentBoardId);
    if (index !== -1) {
        boards[index] = JSON.parse(JSON.stringify(currentBoardData));
        saveLocalBoards();
    }
}

function setupAuthListeners() {
    const form = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('auth-toggle-btn');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            isRegistering = !isRegistering;
            
            if (isRegistering) {
                document.getElementById('authTitle').innerText = 'Registrarse';
                document.getElementById('auth-submit-btn').innerText = 'Registrarse';
                document.getElementById('auth-toggle-text').innerText = '¿Ya tienes cuenta?';
                toggleBtn.innerText = 'Inicia sesión';
            } else {
                document.getElementById('authTitle').innerText = 'Iniciar Sesión';
                document.getElementById('auth-submit-btn').innerText = 'Entrar';
                document.getElementById('auth-toggle-text').innerText = '¿No tienes cuenta?';
                toggleBtn.innerText = 'Regístrate';
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('auth-username').value.trim();
            const password = document.getElementById('auth-password').value;

            if (!username || !password) {
                alert('Por favor completa todos los campos');
                return;
            }

            try {
                const endpoint = isRegistering ? '/register' : '/login';
                const body = JSON.stringify({ username, password });

                const res = await fetch(`${API_URL}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: body
                });

                const data = await res.json();
                
                if (res.ok) {
                    localStorage.setItem('kanban_user_id', data.id);
                    localStorage.setItem('kanban_username', data.username);
                    
                    currentUser = data.id;
                    currentUsername = data.username;
                    
                    updateUserDisplay();
                    closeAuthModal();
                    
                    if (isRegistering) {
                        alert('¡Cuenta creada! Inicia sesión.');
                        isRegistering = false;
                        document.getElementById('auth-form').reset();
                        openAuthModal();
                    } else {
                        alert('¡Sesión iniciada!');
                    }
                } else {
                    alert(data.detail || 'Error en autenticación');
                }
            } catch (err) {
                console.error(err);
                alert('Error de conexión con servidor');
            }
        });
    }
}

function openAuthModal() {
    document.getElementById('auth-form').reset();
    isRegistering = false;
    document.getElementById('authTitle').innerText = 'Iniciar Sesión';
    document.getElementById('auth-submit-btn').innerText = 'Entrar';
    document.getElementById('auth-toggle-text').innerText = '¿No tienes cuenta?';
    document.getElementById('auth-toggle-btn').innerText = 'Regístrate';
    document.getElementById('authModal').showModal();
}

function closeAuthModal() {
    document.getElementById('authModal').close();
}

function updateUserDisplay() {
    const userDisplay = document.getElementById('logged-user-display');
    const authBtn = document.getElementById('authBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (currentUser) {
        userDisplay.innerText = `👤 ${currentUsername}`;
        authBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-flex';
    } else {
        userDisplay.innerText = 'No conectado';
        authBtn.style.display = 'inline-flex';
        logoutBtn.style.display = 'none';
    }
}

function logout() {
    if (confirm('¿Cerrar sesión?')) {
        localStorage.removeItem('kanban_user_id');
        localStorage.removeItem('kanban_username');
        currentUser = null;
        currentUsername = null;
        updateUserDisplay();
        alert('Sesión cerrada');
    }
}

function openBoardSelector() {
    renderBoardList();
    loadInvitations();
    document.getElementById('boardSelectorModal').showModal();
}

function closeBoardSelector() {
    document.getElementById('boardSelectorModal').close();
}

function openInvitationsModal() {
    document.getElementById('invitationsModal').showModal();
}

function closeInvitationsModal() {
    document.getElementById('invitationsModal').close();
}

function loadInvitations() {
    if (!currentUser) {
        document.getElementById('invitationsBtn').style.display = 'none';
        return;
    }

    fetch(`${API_URL}/invitations`, {
        method: 'GET',
        headers: { 
            'Content-Type': 'application/json',
            'X-User-Id': String(currentUser)
        }
    })
    .then(res => res.json())
    .then(data => {
        const count = data.invitations?.length || 0;
        document.getElementById('invitationsCount').textContent = count;
        
        if (count > 0) {
            document.getElementById('invitationsBtn').style.display = 'inline-flex';
            renderInvitations(data.invitations);
        } else {
            document.getElementById('invitationsBtn').style.display = 'none';
        }
    })
    .catch(err => console.error('Error cargando invitaciones:', err));
}

function renderInvitations(invitations) {
    const container = document.getElementById('invitationsList');
    
    if (!invitations || invitations.length === 0) {
        container.innerHTML = '<div class="empty-invitations">No tienes invitaciones pendientes</div>';
        return;
    }

    container.innerHTML = '';
    invitations.forEach(inv => {
        const card = document.createElement('div');
        card.className = 'invitation-card';
        card.innerHTML = `
            <div class="invitation-info">
                <div class="invitation-title">${escapeHtml(inv.board_title)}</div>
                <div class="invitation-owner">De: ${escapeHtml(inv.owner_username)}</div>
            </div>
            <div class="invitation-actions">
                <button class="btn btn-primary btn-small" onclick="acceptInvitation(${inv.id})">✅ Aceptar</button>
                <button class="btn btn-danger btn-small" onclick="rejectInvitation(${inv.id})">❌ Rechazar</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function acceptInvitation(invitationId) {
    fetch(`${API_URL}/invitations/${invitationId}/accept`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'X-User-Id': String(currentUser)
        }
    })
    .then(res => res.json())
    .then(data => {
        alert('Tablero aceptado');
        loadInvitations();
    })
    .catch(err => {
        console.error('Error:', err);
        alert('Error al aceptar invitación');
    });
}

function rejectInvitation(invitationId) {
    if (!confirm('¿Rechazar esta invitación?')) return;
    
    fetch(`${API_URL}/invitations/${invitationId}/reject`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'X-User-Id': String(currentUser)
        }
    })
    .then(res => res.json())
    .then(data => {
        alert('Invitación rechazada');
        loadInvitations();
    })
    .catch(err => {
        console.error('Error:', err);
        alert('Error al rechazar invitación');
    });
}

function renderBoardList() {
    const container = document.getElementById('boardList');
    container.innerHTML = '';

    boards.forEach(board => {
        const isOwner = board.owner_id === currentUser;
        const isShared = board.shared_users && board.shared_users.length > 0;
        const badge = isOwner ? '<span class="board-card-badge">Propietario</span>' : 
                     isShared ? '<span class="board-card-badge" style="background-color: #8b5cf6;">Compartido</span>' : 
                     '<span class="board-card-badge" style="background-color: #64748b;">Local</span>';

        const card = document.createElement('div');
        card.className = 'board-card';
        card.innerHTML = `
            <div class="board-card-header">
                <span class="board-card-title">${escapeHtml(board.title)}</span>
                ${badge}
            </div>
            ${board.description ? `<div class="board-card-description">${escapeHtml(board.description)}</div>` : ''}
            <div class="board-card-meta">
                <span>${board.columnList.length} columnas</span>
                <span>${Object.keys(board.tasks).length} tareas</span>
            </div>
            <div class="board-card-actions" onclick="event.stopPropagation();">
                ${isOwner ? `<button class="btn btn-secondary btn-small" onclick="openBoardSettings(${board.id})">⚙️</button>` : ''}
                ${isOwner ? `<button class="btn btn-danger btn-small" onclick="deleteBoard(${board.id})">🗑️</button>` : ''}
            </div>
        `;
        
        card.onclick = () => {
            loadBoard(board.id);
            closeBoardSelector();
        };
        
        container.appendChild(card);
    });
}

function createNewBoard() {
    if (!currentUser) {
        alert('Debes iniciar sesión para crear tableros');
        closeBoardSelector();
        openAuthModal();
        return;
    }

    document.getElementById('boardForm').reset();
    document.getElementById('boardModalTitle').innerText = 'Crear Tablero';
    document.getElementById('sharedUsersList').innerHTML = '';
    document.getElementById('shareSection').style.display = 'block';
    document.getElementById('boardModal').dataset.editBoardId = '';
    document.getElementById('boardModal').showModal();
}

function openBoardSettings(boardId) {
    const board = boards.find(b => b.id === boardId);
    if (!board || board.owner_id !== currentUser) return;

    document.getElementById('boardSettingsTitle').value = board.title;
    document.getElementById('boardSettingsDescription').value = board.description || '';
    document.getElementById('boardSettingsForm').dataset.boardId = boardId;
    
    renderCurrentSharedUsers(boardId);
    document.getElementById('boardSettingsModal').showModal();
}

function closeBoardSettings() {
    document.getElementById('boardSettingsModal').close();
}

function renderCurrentSharedUsers(boardId) {
    const board = boards.find(b => b.id === boardId);
    const container = document.getElementById('currentSharedUsers');
    container.innerHTML = '';

    if (!board || !board.shared_users || board.shared_users.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Sin usuarios compartidos</p>';
        return;
    }

    board.shared_users.forEach(username => {
        const item = document.createElement('div');
        item.className = 'shared-user-item';
        item.innerHTML = `
            <span>${username}</span>
            <button type="button" class="shared-user-remove" onclick="removeSharedUser(${boardId}, '${username}')">✕</button>
        `;
        container.appendChild(item);
    });
}

function addBoardShareUser(boardId) {
    if (!currentUser) {
        alert('Debes iniciar sesión');
        return;
    }
    
    const shareInput = document.getElementById('shareUsernameInput');
    const username = shareInput ? shareInput.value.trim() : '';
    if (!username) {
        alert('Ingrese un nombre de usuario');
        return;
    }

    const board = boards.find(b => b.id === boardId);
    if (!board || board.owner_id !== currentUser) {
        alert('No tienes permiso para compartir este tablero');
        return;
    }

    if (username === currentUsername) {
        alert('No puedes compartir un tablero contigo mismo');
        return;
    }

    console.log('Verificando usuario:', username);
    console.log('URL:', `${API_URL}/user/${username}/exists`);

    // ✅ RUTA ARREGLADA - Con headers consistentes
    fetch(`${API_URL}/user/${username}/exists`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Id': String(currentUser)
        }
    })
        .then(res => {
            console.log('Respuesta verificar usuario:', res.status);
            return res.json();
        })
        .then(data => {
            console.log('Datos verificar usuario:', data);
            if (!data.exists) {
                alert('El usuario no existe');
                return;
            }

            if (board.shared_users && board.shared_users.includes(username)) {
                alert('Este usuario ya tiene acceso');
                return;
            }

            console.log('Enviando invitación a:', username);
            // ✅ RUTA ARREGLADA - Con headers consistentes
            fetch(`${API_URL}/boards/${boardId}/share?username=${encodeURIComponent(username)}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-User-Id': String(currentUser)
                }
            })
            .then(res => {
                console.log('Respuesta compartir:', res.status);
                return res.json();
            })
            .then(data => {
                console.log('Datos compartir:', data);
                if (data.ok || data.message) {
                    if (board.shared_users && board.shared_users.includes(username)) {
                        alert('Este usuario ya tiene acceso');
                        return;
                    }
                    board.shared_users = board.shared_users || [];
                    board.shared_users.push(username);
                    shareInput.value = '';
                    saveLocalBoards();
                    renderCurrentSharedUsers(boardId);
                    alert(`Invitación enviada a ${username}`);
                } else {
                    alert(data.detail || data.message || 'Error al compartir');
                }
            })
            .catch(err => {
                console.error('Error en compartir:', err);
                alert('Error al compartir el tablero: ' + err.message);
            });
        })
        .catch(err => {
            console.error('Error verificando usuario:', err);
            alert('Error al verificar usuario: ' + err.message);
        });
}

function removeSharedUser(boardId, username) {
    const board = boards.find(b => b.id === boardId);
    if (!board || board.owner_id !== currentUser) return;

    board.shared_users = board.shared_users.filter(u => u !== username);
    saveLocalBoards();
    renderCurrentSharedUsers(boardId);
}

function saveBoardSettings() {
    const boardId = parseInt(document.getElementById('boardSettingsForm').dataset.boardId);
    const board = boards.find(b => b.id === boardId);
    
    if (!board || board.owner_id !== currentUser) {
        alert('No tienes permiso');
        return;
    }

    const title = document.getElementById('boardSettingsTitle').value.trim();
    const description = document.getElementById('boardSettingsDescription').value.trim();

    if (!title) {
        alert('El título no puede estar vacío');
        return;
    }

    board.title = title;
    board.description = description;
    
    if (board.id === currentBoardId) {
        currentBoardData.title = title;
        currentBoardData.description = description;
        document.getElementById('current-board-name').textContent = `/ ${title}`;
    }

    saveLocalBoards();
    closeBoardSettings();
    renderBoardList();
    alert('Configuración guardada');
}

function deleteBoard(boardId) {
    if (!confirm('¿Eliminar este tablero?')) return;
    boards = boards.filter(b => b.id !== boardId);
    saveLocalBoards();
    if (currentBoardId === boardId) {
        currentBoardId = null;
        localStorage.removeItem(STORAGE_KEY_CURRENT);
        createDefaultBoard();
    }
    renderBoardList();
    alert('Tablero eliminado');
}

function applyTheme() {
    const theme = localStorage.getItem('kanban_theme_v2') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
        toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

function renderBoard() {
    const container = document.getElementById('boardColumns');
    if (!container) return;
    container.innerHTML = '';

    currentBoardData.columnList.forEach(column => {
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

    const taskIds = currentBoardData.columns[column.id] || [];
    const cards = taskIds.map(id => currentBoardData.tasks[id]).filter(task => task && matchesSearch(task));

    const headerDiv = document.createElement('div');
    headerDiv.className = 'column-header';
    headerDiv.style.backgroundColor = column.color;
    
    const canDelete = currentBoardData.columnList.length > 1;
    const deleteBtnHtml = canDelete ? `<button class="btn btn-danger btn-small" onclick="deleteColumn('${column.id}')">🗑️</button>` : '';

    headerDiv.innerHTML = `
        <div class="column-title-wrapper">
            <input type="color" class="column-color-picker" value="${column.color}" onchange="updateColumnColor('${column.id}', this.value)">
            <span class="column-title">${escapeHtml(column.title)}</span>
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

    columnDiv.addEventListener('dragstart', handleColumnDragStart);
    columnDiv.addEventListener('dragend', handleColumnDragEnd);
    columnDiv.addEventListener('dragover', handleColumnDragOver);
    columnDiv.addEventListener('drop', handleColumnDrop);

    return columnDiv;
}

function handleColumnDragStart(e) {
    if (e.target.closest('.card') || e.target.closest('button') || e.target.closest('input')) {
        e.preventDefault();
        return;
    }
    draggedColumnId = e.currentTarget.dataset.columnId;
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
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

    const oldIndex = currentBoardData.columnList.findIndex(c => c.id === draggedColumnId);
    const newIndex = currentBoardData.columnList.findIndex(c => c.id === targetColumnId);

    if (oldIndex !== -1 && newIndex !== -1) {
        const [movedCol] = currentBoardData.columnList.splice(oldIndex, 1);
        currentBoardData.columnList.splice(newIndex, 0, movedCol);
        saveCurrentBoard();
        renderBoard();
    }
}

function addNewColumn() {
    const title = prompt('Nombre de la nueva tabla:');
    if (!title || !title.trim()) return;

    const pastelColors = ['#bfdbfe', '#fef08a', '#fbcfe8', '#bbf7d0', '#ddd6fe', '#fed7aa', '#99f6e4'];
    const randomColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];

    const newCol = {
        id: 'col_' + Date.now(),
        title: title.trim(),
        color: randomColor
    };
    
    currentBoardData.columnList.push(newCol);
    currentBoardData.columns[newCol.id] = [];
    saveCurrentBoard();
    renderBoard();
}

function deleteColumn(columnId) {
    if (!confirm('¿Eliminar esta columna y sus tareas?')) return;

    const taskIds = currentBoardData.columns[columnId] || [];
    taskIds.forEach(taskId => {
        delete currentBoardData.tasks[taskId];
    });

    delete currentBoardData.columns[columnId];
    currentBoardData.columnList = currentBoardData.columnList.filter(col => col.id !== columnId);

    saveCurrentBoard();
    renderBoard();
}

function updateColumnColor(columnId, color) {
    const col = currentBoardData.columnList.find(c => c.id === columnId);
    if (col) {
        col.color = color;
        saveCurrentBoard();
        renderBoard();
    }
}

function createCardElement(task) {
    const cardDiv = document.createElement('article');
    cardDiv.className = 'card';
    cardDiv.draggable = true;
    cardDiv.dataset.taskId = task.id;

    const priorityText = { high: 'Alta', medium: 'Media', low: 'Baja' }[task.priority];
    const dueDateHtml = task.dueDate ? `<div class="due-date">📅 ${task.dueDate}</div>` : '';
    const specsHtml = task.specs && task.specs.length > 0 ? `<div class="card-specs">${task.specs.map(s => `<span class="spec-tag">${escapeHtml(s.key)}: ${escapeHtml(s.value)}</span>`).join('')}</div>` : '';

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
    return task.title.toLowerCase().includes(query) || (task.description && task.description.toLowerCase().includes(query));
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
    const task = currentBoardData.tasks[taskId];
    if (!task) return;

    const oldColumnId = Object.keys(currentBoardData.columns).find(colId =>
        currentBoardData.columns[colId].includes(taskId)
    );

    if (oldColumnId !== newColumnId) {
        currentBoardData.columns[oldColumnId] = currentBoardData.columns[oldColumnId].filter(id => id !== taskId);
        if (!currentBoardData.columns[newColumnId]) {
            currentBoardData.columns[newColumnId] = [];
        }
        currentBoardData.columns[newColumnId].push(taskId);
        saveCurrentBoard();
        renderBoard();
    }
}

function addSpecField(containerId, key = '', value = '') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const row = document.createElement('div');
    row.className = 'spec-row';
    row.innerHTML = `
        <input type="text" class="form-input spec-key" placeholder="Clave" value="${escapeHtml(key)}">
        <input type="text" class="form-input spec-val" placeholder="Valor" value="${escapeHtml(value)}">
        <button type="button" class="btn btn-danger btn-small" onclick="this.closest('.spec-row').remove()">✕</button>
    `;
    container.appendChild(row);
}

function getSpecsFromContainer(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    
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
    const form = document.getElementById('taskForm');
    if (form) form.reset();
    const container = document.getElementById('taskSpecsContainer');
    if (container) {
        container.innerHTML = '';
        addSpecField('taskSpecsContainer');
    }
    document.getElementById('taskModal').showModal();
}

function closeTaskModal() {
    document.getElementById('taskModal').close();
}

function closeBoardModal() {
    document.getElementById('boardModal').close();
}

function openEditModal(taskId) {
    const task = currentBoardData.tasks[taskId];
    if (!task) return;

    currentEditingTaskId = taskId;
    document.getElementById('editTitle').value = task.title;
    document.getElementById('editDescription').value = task.description || '';
    document.getElementById('editPriority').value = task.priority;
    document.getElementById('editDueDate').value = task.dueDate || '';
    
    const container = document.getElementById('editSpecsContainer');
    if (container) {
        container.innerHTML = '';
        if (task.specs && task.specs.length > 0) {
            task.specs.forEach(s => addSpecField('editSpecsContainer', s.key, s.value));
        } else {
            addSpecField('editSpecsContainer');
        }
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
    if (!confirm('¿Eliminar?')) return;

    const columnId = Object.keys(currentBoardData.columns).find(colId =>
        currentBoardData.columns[colId].includes(taskId)
    );

    if (columnId) {
        currentBoardData.columns[columnId] = currentBoardData.columns[columnId].filter(id => id !== taskId);
    }

    delete currentBoardData.tasks[taskId];
    saveCurrentBoard();
    renderBoard();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function closeSettingsModal() {
    document.getElementById('settingsModal').close();
}

function openSettingsModal() {
    const content = document.getElementById('boardSettingsContent');
    const isOwner = currentBoardData.owner_id === currentUser;
    
    content.innerHTML = `
        <div class="settings-info">
            <h3>Información del Tablero</h3>
            <p><strong>Título:</strong> ${escapeHtml(currentBoardData.title)}</p>
            <p><strong>Descripción:</strong> ${escapeHtml(currentBoardData.description || 'Sin descripción')}</p>
            <p><strong>Estado:</strong> ${isOwner ? 'Eres propietario' : 'Compartido contigo'}</p>
            ${currentBoardData.shared_users && currentBoardData.shared_users.length > 0 ? `<p><strong>Compartido con:</strong> ${currentBoardData.shared_users.join(', ')}</p>` : ''}
        </div>
    `;
    
    document.getElementById('settingsModal').showModal();
}

function attachMainEventListeners() {
    document.getElementById('newTaskBtn')?.addEventListener('click', openTaskModal);
    document.getElementById('boardsBtn')?.addEventListener('click', openBoardSelector);
    document.getElementById('authBtn')?.addEventListener('click', openAuthModal);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('settingsBtn')?.addEventListener('click', openSettingsModal);

    document.getElementById('taskForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const taskId = currentBoardData.nextId++;
        const task = {
            id: taskId,
            title: document.getElementById('taskTitle').value,
            description: document.getElementById('taskDescription').value,
            priority: document.getElementById('taskPriority').value,
            dueDate: document.getElementById('taskDueDate').value,
            specs: getSpecsFromContainer('taskSpecsContainer'),
            createdAt: new Date().toISOString()
        };

        currentBoardData.tasks[taskId] = task;
        const firstColId = currentBoardData.columnList[0]?.id || 'todo';
        if (!currentBoardData.columns[firstColId]) currentBoardData.columns[firstColId] = [];
        currentBoardData.columns[firstColId].push(taskId);

        saveCurrentBoard();
        renderBoard();
        closeTaskModal();
    });

    document.getElementById('editForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (currentEditingTaskId === null) return;

        const task = currentBoardData.tasks[currentEditingTaskId];
        task.title = document.getElementById('editTitle').value;
        task.description = document.getElementById('editDescription').value;
        task.priority = document.getElementById('editPriority').value;
        task.dueDate = document.getElementById('editDueDate').value;
        task.specs = getSpecsFromContainer('editSpecsContainer');

        saveCurrentBoard();
        renderBoard();
        closeEditModal();
    });

    document.getElementById('boardForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('boardTitle').value;
        const description = document.getElementById('boardDescription').value;

        if (!title.trim()) {
            alert('El título no puede estar vacío');
            return;
        }

        // Si estamos logueados, guardar en backend
        if (currentUser) {
            fetch(`${API_URL}/boards`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': String(currentUser)
                },
                body: JSON.stringify({
                    title: title.trim(),
                    description: description
                })
            })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                console.log('Tablero creado en backend:', data);
                
                // Crear objeto local con ID del backend
                const newBoard = {
                    id: data.id,  // ✅ ID del backend, no timestamp
                    title: data.title,
                    description: data.description,
                    owner_id: data.owner_id,
                    tasks: {},
                    nextId: 1,
                    columnList: DEFAULT_COLUMNS.map(c => ({ ...c })),
                    columns: {},
                    shared_users: [],
                    created_at: data.created_at
                };

                DEFAULT_COLUMNS.forEach(col => {
                    newBoard.columns[col.id] = [];
                });

                boards.push(newBoard);
                saveLocalBoards();
                closeBoardModal();
                renderBoardList();
                alert('Tablero creado');
            })
            .catch(err => {
                console.error('Error creando tablero:', err);
                alert('Error al crear tablero en servidor');
            });
        } else {
            // Sin login: solo localStorage
            const newBoard = {
                id: Date.now(),
                title: title.trim(),
                description: description,
                tasks: {},
                nextId: 1,
                columnList: DEFAULT_COLUMNS.map(c => ({ ...c })),
                columns: {},
                owner_id: null,
                shared_users: [],
                created_at: new Date().toISOString()
            };

            DEFAULT_COLUMNS.forEach(col => {
                newBoard.columns[col.id] = [];
            });

            boards.push(newBoard);
            saveLocalBoards();
            closeBoardModal();
            renderBoardList();
            alert('Tablero creado localmente');
        }
    });

    document.getElementById('boardSettingsForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveBoardSettings();
    });

    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderBoard();
    });

    document.getElementById('themeToggle')?.addEventListener('click', () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('kanban_theme_v2', newTheme);
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
