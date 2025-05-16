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

        this.categories = defaultCategories;
        this.files = {};
        
        this.categories.forEach(category => {
            this.files[category] = [];
        });

        // Firestoreからデータを取得
        this.loadFromFirestore();
        
        // リアルタイム更新をセットアップ
        this.setupFirestoreListeners();
    }

    async loadFromFirestore() {
        try {
            // カテゴリーの取得
            const categories = await firestore.getCategories();
            if (categories && categories.length > 0) {
                this.categories = categories;
            } else {
                // 初期カテゴリーを保存
                await firestore.saveCategories(this.categories);
            }

            // ファイルの取得
            const files = await firestore.getFiles();
            this.files = {};
            this.categories.forEach(category => {
                this.files[category] = files.filter(file => file.categoryName === category);
            });

            this.renderCategories();
        } catch (error) {
            console.error('Error loading from Firestore:', error);
        }
    }

    setupFirestoreListeners() {
        // カテゴリーの変更を監視
        firestore.subscribeToCategories((categories) => {
            this.categories = categories;
            this.renderCategories();
        });

        // ファイルの変更を監視
        firestore.subscribeToFiles((files) => {
            this.files = {};
            this.categories.forEach(category => {
                this.files[category] = files.filter(file => file.categoryName === category);
            });
            this.renderCategories();
        });
    }

    async addCategory() {
        try {
            const input = document.getElementById('categoryInput');
            const categoryName = input.value.trim();

            if (!categoryName) {
                alert('カテゴリー名を入力してください。');
                return;
            }

            if (this.categories.includes(categoryName)) {
                alert('同名のカテゴリーが既に存在します。');
                return;
            }

            // カテゴリー名の長さチェック
            if (categoryName.length > 50) {
                alert('カテゴリー名は50文字以内で入力してください。');
                return;
            }

            const newCategories = [...this.categories, categoryName];
            await firestore.saveCategories(newCategories);
            
            this.categories = newCategories;
            this.files[categoryName] = [];
            input.value = '';
            
            // 成功メッセージを表示
            const message = document.createElement('div');
            message.className = 'success-message';
            message.textContent = `カテゴリー「${categoryName}」を追加しました。`;
            input.parentElement.appendChild(message);
            setTimeout(() => message.remove(), 3000);

            this.renderCategories();
        } catch (error) {
            console.error('Error adding category:', error);
            alert('カテゴリーの追加中にエラーが発生しました。');
        }
    }

    async deleteCategory(categoryName) {
        if (confirm(`カテゴリー「${categoryName}」を削除してもよろしいですか？\nこのカテゴリー内のファイルもすべて削除されます。`)) {
            // カテゴリーに属するファイルを削除
            const filesToDelete = this.files[categoryName] || [];
            for (const file of filesToDelete) {
                await firestore.deleteFile(file.id);
            }

            // カテゴリーを削除
            this.categories = this.categories.filter(cat => cat !== categoryName);
            delete this.files[categoryName];
            await firestore.saveCategories(this.categories);
        }
    }

    async handleFileUpload(category, event) {
        const files = event.target.files;
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const fileData = {
                    name: file.name,
                    content: e.target.result,
                    date: new Date().toISOString(),
                    version: 1
                };
                
                // 既存のファイルをチェック
                const existingFile = this.files[category].find(f => f.name === file.name);
                if (existingFile) {
                    fileData.version = existingFile.version + 1;
                    await firestore.deleteFile(existingFile.id);
                }
                
                await firestore.saveFile(category, fileData);
            };
            reader.readAsDataURL(file);
        });
    }

    async deleteFile(category, fileId) {
        try {
            if (!fileId) {
                console.error('ファイルIDが指定されていません。');
                return;
            }

            if (confirm('このファイルを削除してもよろしいですか？')) {
                await firestore.deleteFile(fileId);
                
                // ローカルの状態も更新
                if (this.files[category]) {
                    this.files[category] = this.files[category].filter(file => file.id !== fileId);
                }

                // 成功メッセージを表示
                const message = document.createElement('div');
                message.className = 'success-message';
                message.textContent = 'ファイルを削除しました。';
                document.body.appendChild(message);
                setTimeout(() => message.remove(), 3000);
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            alert('ファイルの削除中にエラーが発生しました。');
        }
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
                    <button class="delete-btn" data-category="${category}" data-file-id="${file.id}">
                        削除
                    </button>
                </div>
            </div>
        `).join('');
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

            // ファイル削除ボタンのイベントリスナーを追加
            const fileDeleteButtons = categoryElement.querySelectorAll('.delete-btn');
            fileDeleteButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const fileId = button.dataset.fileId;
                    const category = button.dataset.category;
                    this.deleteFile(category, fileId);
                });
            });

            categoryList.appendChild(categoryElement);
        });
    }

    getFileIcon(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const icons = {
            'pdf': '📄', 'doc': '📝', 'docx': '📝',
            'xls': '📊', 'xlsx': '📊', 'ppt': '📺', 'pptx': '📺'
        };
        return icons[extension] || '📎';
    }
}

// タスク管理クラス
class TaskManager {
    constructor() {
        this.tasks = [];
        this.loadFromFirestore();
        this.setupFirestoreListeners();
    }

    async loadFromFirestore() {
        try {
            this.tasks = await firestore.getTasks();
            this.renderTasks();
        } catch (error) {
            console.error('Error loading tasks from Firestore:', error);
        }
    }

    setupFirestoreListeners() {
        firestore.subscribeToTasks((tasks) => {
            this.tasks = tasks;
            this.renderTasks();
        });
    }

    async addTask(text, date, priority, category) {
        const task = {
            text: text,
            date: date,
            priority: priority,
            category: category,
            completed: false,
            created: new Date().toISOString()
        };
        
        try {
            await firestore.addTask(task);
        } catch (error) {
            console.error('Error adding task:', error);
            alert('タスクの追加中にエラーが発生しました。');
        }
    }

    async toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            try {
                await firestore.updateTask(id, {
                    ...task,
                    completed: !task.completed
                });
            } catch (error) {
                console.error('Error toggling task:', error);
                alert('タスクの更新中にエラーが発生しました。');
            }
        }
    }

    async deleteTask(id) {
        if (confirm('このタスクを削除してもよろしいですか？')) {
            try {
                await firestore.deleteTask(id);
            } catch (error) {
                console.error('Error deleting task:', error);
                alert('タスクの削除中にエラーが発生しました。');
            }
        }
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
            const categoryMatch = categoryValue === 'all' || task.category === categoryValue;
            return priorityMatch && categoryMatch;
        });
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
    // Add category button event listener
    const addCategoryButton = document.getElementById('addCategoryButton');
    if (addCategoryButton) {
        addCategoryButton.addEventListener('click', () => {
            fileManager.addCategory();
        });
    }

    // Category input enter key event listener
    const categoryInput = document.getElementById('categoryInput');
    if (categoryInput) {
        categoryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                fileManager.addCategory();
            }
        });
    }

    const addTaskButton = document.getElementById('addTaskButton');
    if (addTaskButton) {
        addTaskButton.addEventListener('click', async () => {
            const input = document.getElementById('taskInput');
            const date = document.getElementById('taskDate').value;
            const priority = document.getElementById('taskPriority').value;
            const category = document.getElementById('taskCategory').value;
            
            if (input && input.value.trim()) {
                await taskManager.addTask(input.value, date, priority, category);
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

        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Error initializing application:', error);
        alert('アプリケーションの初期化中にエラーが発生しました。');
    }
});

