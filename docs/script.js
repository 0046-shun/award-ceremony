// script.js
import { firestore } from './firebaseConfig.js';

// グローバル変数の定義
let fileManager, taskManager, scheduleManager, tabManager;

// タブ管理クラス
class TabManager {
    constructor() {
        this.initializeTabs();
        this.showInitialTab();
    }

    initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(button);
            });
        });
    }

    showInitialTab() {
        const firstTab = document.querySelector('.tab-button');
        if (firstTab) {
            this.switchTab(firstTab);
        }
    }

    switchTab(selectedButton) {
        console.log('Switching tab to:', selectedButton.dataset.tab);

        // タブボタンのアクティブ状態を切り替え
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        selectedButton.classList.add('active');

        // コンテンツの表示を切り替え
        const targetId = selectedButton.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            content.style.display = 'none';
        });

        const targetContent = document.getElementById(targetId);
        if (targetContent) {
            targetContent.classList.add('active');
            targetContent.style.display = 'block';

            // カレンダーの再描画（スケジュールタブの場合）
            if (targetId === 'schedule-management' && scheduleManager && scheduleManager.calendar) {
                scheduleManager.calendar.render();
                window.dispatchEvent(new Event('resize'));
            }
        }
    }
}

// ファイル管理クラス
class FileManager {
    constructor() {
        const defaultCategories = [
            '会場情報', '準備物', 'タイムテーブル', '台本',
            '席次', '役員', '参加者', '配信文書'
        ];

        const savedCategories = localStorage.getItem('categories');
        this.categories = savedCategories ? JSON.parse(savedCategories) : defaultCategories;
        this.files = JSON.parse(localStorage.getItem('files')) || {};
        
        this.categories.forEach(category => {
            if (!this.files[category]) {
                this.files[category] = [];
            }
        });

        this.renderCategories();
    }

    addCategory() {
        const input = document.getElementById('categoryInput');
        const categoryName = input.value.trim();

        if (categoryName) {
            if (this.categories.includes(categoryName)) {
                alert('同名のカテゴリーが既に存在します。');
                return;
            }
            this.categories.push(categoryName);
            this.files[categoryName] = [];
            this.saveToLocalStorage();
            this.renderCategories();
            input.value = '';
        }
    }

    deleteCategory(categoryName) {
        if (confirm(`カテゴリー「${categoryName}」を削除してもよろしいですか？\nこのカテゴリー内のファイルもすべて削除されます。`)) {
            this.categories = this.categories.filter(cat => cat !== categoryName);
            delete this.files[categoryName];
            this.saveToLocalStorage();
            this.renderCategories();
        }
    }

    saveToLocalStorage() {
        localStorage.setItem('categories', JSON.stringify(this.categories));
        localStorage.setItem('files', JSON.stringify(this.files));
    }

    renderCategories() {
        const categoryList = document.getElementById('categoryList');
        if (!categoryList) return;

        categoryList.innerHTML = '';

        this.categories.forEach(category => {
            const categoryElement = document.createElement('div');
            categoryElement.className = 'category-container';
            
            categoryElement.innerHTML = `
                <div class="category-header">
                    <h4>${category}</h4>
                    <div class="category-actions">
                        <label class="file-upload-label">
                            ファイルを追加
                            <input type="file" class="file-input" multiple>
                        </label>
                        <button class="delete-category-btn" type="button">
                            カテゴリー削除
                        </button>
                    </div>
                </div>
                <div class="file-list">
                    ${this.renderFiles(category)}
                </div>
            `;

            const deleteButton = categoryElement.querySelector('.delete-category-btn');
            deleteButton.addEventListener('click', () => this.deleteCategory(category));

            const fileInput = categoryElement.querySelector('.file-input');
            fileInput.addEventListener('change', (e) => this.handleFileUpload(category, e));

            categoryList.appendChild(categoryElement);
        });
    }
    renderFiles(category) {
        if (!this.files[category] || this.files[category].length === 0) {
            return '<p class="no-files">ファイルはありません</p>';
        }

        return this.files[category].map(file => `
            <div class="file-item">
                <span class="file-icon">${this.getFileIcon(file.name)}</span>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-meta">
                        バージョン: ${file.version} | 
                        更新日: ${new Date(file.date).toLocaleDateString()}
                    </div>
                </div>
                <div class="file-actions">
                    <a href="${file.content}" download="${file.name}" class="download-btn">
                        <button>ダウンロード</button>
                    </a>
                    <button class="delete-btn" onclick="fileManager.deleteFile('${category}', ${file.id})">
                        削除
                    </button>
                </div>
            </div>
        `).join('');
    }

    getFileIcon(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const icons = {
            'pdf': '📄', 'doc': '📝', 'docx': '📝',
            'xls': '📊', 'xlsx': '📊', 'ppt': '📺', 'pptx': '📺'
        };
        return icons[extension] || '📎';
    }

    handleFileUpload(category, event) {
        const files = event.target.files;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileData = {
                    id: Date.now(),
                    name: file.name,
                    content: e.target.result,
                    date: new Date().toISOString(),
                    version: 1
                };
                
                const existingFileIndex = this.files[category].findIndex(f => f.name === file.name);
                if (existingFileIndex !== -1) {
                    fileData.version = this.files[category][existingFileIndex].version + 1;
                    this.files[category][existingFileIndex] = fileData;
                } else {
                    this.files[category].push(fileData);
                }
                
                this.saveToLocalStorage();
                this.renderCategories();
            };
            reader.readAsDataURL(file);
        });
    }

    deleteFile(category, fileId) {
        if (confirm('このファイルを削除してもよろしいですか？')) {
            this.files[category] = this.files[category].filter(file => file.id !== fileId);
            this.saveToLocalStorage();
            this.renderCategories();
        }
    }
}

// タスク管理クラス
class TaskManager {
    constructor() {
        this.tasks = JSON.parse(localStorage.getItem('tasks')) || [];
        this.renderTasks();
    }

    addTask(text, date, priority, category) {
        const task = {
            id: Date.now(),
            text: text,
            date: date,
            priority: priority,
            category: category,
            completed: false,
            created: new Date().toISOString()
        };
        this.tasks.push(task);
        this.saveTasks();
        this.renderTasks();
    }

    saveTasks() {
        localStorage.setItem('tasks', JSON.stringify(this.tasks));
    }

    renderTasks() {
        const taskList = document.getElementById('taskList');
        if (!taskList) return;

        taskList.innerHTML = '';
        
        const filteredTasks = this.filterTasks();
        filteredTasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `task-item ${task.priority}-priority`;
            taskElement.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''}>
                <div class="task-info">
                    <div class="task-text">${task.text}</div>
                    <div class="task-meta">
                        期限: ${task.date || '未設定'} | 
                        優先度: ${task.priority} | 
                        カテゴリー: ${task.category}
                    </div>
                </div>
                <button class="delete-btn">削除</button>
            `;

            const checkbox = taskElement.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => this.toggleTask(task.id));

            const deleteButton = taskElement.querySelector('.delete-btn');
            deleteButton.addEventListener('click', () => this.deleteTask(task.id));

            taskList.appendChild(taskElement);
        });
    }

    filterTasks() {
        const priorityFilter = document.getElementById('filterPriority');
        const categoryFilter = document.getElementById('filterCategory');

        if (!priorityFilter || !categoryFilter) return this.tasks;

        const priorityValue = priorityFilter.value;
        const categoryValue = categoryFilter.value;

        return this.tasks.filter(task => {
            const priorityMatch = priorityValue === 'all' || task.priority === priorityValue;
            const categoryMatch = categoryValue === '全て' || task.category === categoryValue;
            return priorityMatch && categoryMatch;
        });
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.renderTasks();
        }
    }

    deleteTask(id) {
        if (confirm('このタスクを削除してもよろしいですか？')) {
            this.tasks = this.tasks.filter(task => task.id !== id);
            this.saveTasks();
            this.renderTasks();
        }
    }
}
// スケジュール管理クラス
class ScheduleManager {
    constructor() {
        this.events = [];
        this.calendar = null;
        this.currentEditingEventId = null;
        this.initializeCalendar();
        this.setupFirebaseListener();
    }

    setupFirebaseListener() {
        firestore.subscribeToEvents((events) => {
            this.events = events;
            if (this.calendar) {
                this.calendar.removeAllEvents();
                this.calendar.addEventSource(this.events);
            }
        });
    }

    initializeCalendar() {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;

        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'ja',
            height: 'auto',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            buttonText: {
                today: '今日',
                month: '月',
                week: '週',
                day: '日'
            },
            events: this.getAllEvents(),
            eventClick: this.handleEventClick.bind(this),
            dateClick: this.handleDateClick.bind(this),
            editable: true,
            selectable: true,
            selectMirror: true,
            dayMaxEvents: true,
            eventTimeFormat: {
                hour: 'numeric',
                minute: '2-digit',
                meridiem: false
            }
        });

        this.calendar.render();
        window.dispatchEvent(new Event('resize'));
    }

    getAllEvents() {
        const taskEvents = taskManager ? taskManager.tasks
            .filter(task => task.date)
            .map(task => ({
                title: task.text,
                start: task.date,
                allDay: true,
                backgroundColor: this.getPriorityColor(task.priority),
                extendedProps: {
                    type: 'task'
                }
            })) : [];

        return [...this.events, ...taskEvents];
    }

    getPriorityColor(priority) {
        const colors = {
            high: '#dc3545',
            medium: '#ffc107',
            low: '#28a745'
        };
        return colors[priority] || colors.low;
    }

    async addEvent() {
        const title = document.getElementById('eventTitle').value;
        const date = document.getElementById('eventDate').value;
        const startTime = document.getElementById('eventStartTime').value;
        const endTime = document.getElementById('eventEndTime').value;
        const location = document.getElementById('eventLocation').value;
        const type = document.getElementById('eventType').value;
        const description = document.getElementById('eventDescription').value;

        if (!title || !date) {
            alert('タイトルと日付は必須です。');
            return;
        }

        const newEvent = {
            title: title,
            start: startTime ? `${date}T${startTime}` : date,
            end: endTime ? `${date}T${endTime}` : date,
            allDay: !startTime,
            extendedProps: {
                location: location,
                type: type,
                description: description
            }
        };

        try {
            await firestore.addEvent(newEvent);
            this.clearEventForm();
        } catch (error) {
            console.error('Error adding event:', error);
            alert('イベントの追加中にエラーが発生しました。');
        }
    }

    clearEventForm() {
        const elements = [
            'eventTitle', 'eventDate', 'eventStartTime', 
            'eventEndTime', 'eventLocation', 'eventDescription'
        ];
        
        elements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) element.value = '';
        });

        const typeSelect = document.getElementById('eventType');
        if (typeSelect) typeSelect.value = 'other';
    }

    handleEventClick(info) {
        const event = info.event;
        this.showEventModal(event);
    }

    handleDateClick(info) {
        const dateInput = document.getElementById('eventDate');
        if (dateInput) dateInput.value = info.dateStr;
    }

    showEventModal(event) {
        console.log('Showing event modal for event:', event);
        const modal = document.getElementById('eventModal');
        if (!modal) return;

        this.currentEditingEventId = event.id;

        const elements = {
            modalTitle: event.title,
            modalDateTime: this.formatDateTime(event),
            modalLocation: event.extendedProps?.location || '',
            modalDescription: event.extendedProps?.description || ''
        };

        Object.entries(elements).forEach(([elementId, value]) => {
            const element = document.getElementById(elementId);
            if (element) element.textContent = value;
        });

        const editButton = document.getElementById('editEventButton');
        if (editButton) {
            editButton.onclick = () => {
                this.closeModal();
                this.showEditModal(event);
            };
        }

        const deleteButton = document.getElementById('deleteEventButton');
        if (deleteButton) {
            deleteButton.onclick = () => this.deleteEvent(event.id);
        }

        modal.style.display = 'block';
    }
    showEditModal(event) {
        console.log('Opening edit modal for event:', event);
        const modal = document.getElementById('editEventModal');
        if (!modal) return;

        try {
            this.currentEditingEventId = event.id;
            console.log('Current editing event ID:', this.currentEditingEventId);

            document.getElementById('editEventTitle').value = event.title;
            
            const startDate = new Date(event.start);
            document.getElementById('editEventDate').value = startDate.toISOString().split('T')[0];

            if (!event.allDay) {
                document.getElementById('editEventStartTime').value = startDate.toTimeString().slice(0, 5);
                if (event.end) {
                    const endDate = new Date(event.end);
                    document.getElementById('editEventEndTime').value = endDate.toTimeString().slice(0, 5);
                }
            }

            document.getElementById('editEventLocation').value = event.extendedProps?.location || '';
            document.getElementById('editEventType').value = event.extendedProps?.type || 'other';
            document.getElementById('editEventDescription').value = event.extendedProps?.description || '';

            modal.setAttribute('data-event-id', this.currentEditingEventId);
            modal.style.display = 'block';
        } catch (error) {
            console.error('Error in showEditModal:', error);
            alert('イベントの編集画面の表示中にエラーが発生しました。');
        }
    }

    async updateEvent() {
        try {
            if (!this.currentEditingEventId) {
                throw new Error('更新するイベントのIDが見つかりません。');
            }

            const updatedEvent = {
                title: document.getElementById('editEventTitle').value,
                start: document.getElementById('editEventDate').value,
                allDay: !document.getElementById('editEventStartTime').value,
                extendedProps: {
                    location: document.getElementById('editEventLocation').value,
                    type: document.getElementById('editEventType').value,
                    description: document.getElementById('editEventDescription').value
                }
            };

            const startTime = document.getElementById('editEventStartTime').value;
            const endTime = document.getElementById('editEventEndTime').value;
            
            if (startTime) {
                updatedEvent.start = `${updatedEvent.start}T${startTime}`;
                if (endTime) {
                    updatedEvent.end = `${updatedEvent.start.split('T')[0]}T${endTime}`;
                }
            }

            await firestore.updateEvent(this.currentEditingEventId, updatedEvent);
            this.closeEditModal();
            
        } catch (error) {
            console.error('Error updating event:', error);
            alert(`イベントの更新中にエラーが発生しました: ${error.message}`);
        }
    }

    async deleteEvent(eventId) {
        if (confirm('この予定を削除してもよろしいですか？')) {
            try {
                await firestore.deleteEvent(eventId);
                this.closeModal();
            } catch (error) {
                console.error('Error deleting event:', error);
                alert('イベントの削除中にエラーが発生しました。');
            }
        }
    }

    closeModal() {
        const modal = document.getElementById('eventModal');
        if (modal) modal.style.display = 'none';
    }

    closeEditModal() {
        const modal = document.getElementById('editEventModal');
        if (modal) {
            modal.style.display = 'none';
            modal.removeAttribute('data-event-id');
            this.currentEditingEventId = null;
        }
    }

    formatDateTime(event) {
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
        };
        
        const start = new Date(event.start);
        const end = event.end ? new Date(event.end) : null;

        if (event.allDay) {
            return start.toLocaleDateString('ja-JP', options);
        }

        return `${start.toLocaleDateString('ja-JP', options)}${end ? ` - ${end.toLocaleTimeString('ja-JP')}` : ''}`;
    }
}

// イベントリスナーの設定
function setupEventListeners() {
    const addCategoryButton = document.getElementById('addCategoryButton');
    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', () => fileManager.addCategory());
    }

    const addTaskButton = document.getElementById('addTaskButton');
    if (addTaskButton) {
        addTaskButton.addEventListener('click', () => {
            const input = document.getElementById('taskInput');
            const date = document.getElementById('taskDate').value;
            const priority = document.getElementById('taskPriority').value;
            const category = document.getElementById('taskCategory').value;
            
            if (input && input.value.trim()) {
                taskManager.addTask(input.value, date, priority, category);
                input.value = '';
            }
        });
    }

    const addEventButton = document.getElementById('addEventButton');
    if (addEventButton) {
        addEventButton.addEventListener('click', () => scheduleManager.addEvent());
    }

    const updateEventButton = document.getElementById('updateEventButton');
    if (updateEventButton) {
        updateEventButton.addEventListener('click', () => {
            console.log('Update button clicked');
            if (scheduleManager) {
                scheduleManager.updateEvent();
            }
        });
    }

    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) {
                if (modal.id === 'editEventModal' && scheduleManager) {
                    scheduleManager.closeEditModal();
                } else {
                    modal.style.display = 'none';
                }
            }
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            if (event.target.id === 'editEventModal' && scheduleManager) {
                scheduleManager.closeEditModal();
            } else {
                event.target.style.display = 'none';
            }
        }
    });

    const cancelButtons = document.querySelectorAll('.cancel-btn');
    cancelButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal && modal.id === 'editEventModal' && scheduleManager) {
                scheduleManager.closeEditModal();
            }
        });
    });
}

// フィルターの設定
function setupFilters() {
    const priorityFilter = document.getElementById('filterPriority');
    const categoryFilter = document.getElementById('filterCategory');

    if (priorityFilter) {
        priorityFilter.addEventListener('change', () => taskManager.renderTasks());
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => taskManager.renderTasks());
    }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        fileManager = new FileManager();
        taskManager = new TaskManager();
        scheduleManager = new ScheduleManager();
        tabManager = new TabManager();

        setupEventListeners();
        setupFilters();

        const activeTab = document.querySelector('.tab-button.active');
        if (!activeTab) {
            tabManager.showInitialTab();
        }

        console.log('Application initialized with Firebase integration');
    } catch (error) {
        console.error('Error initializing application:', error);
        alert('アプリケーションの初期化中にエラーが発生しました。');
    }
});

