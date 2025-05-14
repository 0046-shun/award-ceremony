// script.js
import { firestore, db } from './firebaseConfig.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    updateDoc, 
    onSnapshot,
    query,
    where 
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

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
        this.categories = [];
        this.files = {};
        this.defaultCategories = [
            '会場情報', '準備物', 'タイムテーブル', '台本',
            '席次', '役員', '参加者', '配信文書'
        ];
        this.setupFirebaseListener();
        this.initializeDefaultCategories();
    }

    async initializeDefaultCategories() {
        try {
            const categoriesRef = collection(db, 'categories');
            const snapshot = await getDocs(categoriesRef);
            
            // カテゴリーが存在しない場合のみデフォルトカテゴリーを追加
            if (snapshot.empty) {
                for (const category of this.defaultCategories) {
                    await addDoc(categoriesRef, { name: category });
                }
            }
        } catch (error) {
            console.error('Error initializing default categories:', error);
        }
    }

    setupFirebaseListener() {
        try {
            // カテゴリーの監視
            const categoriesRef = collection(db, 'categories');
            onSnapshot(categoriesRef, (snapshot) => {
                this.categories = snapshot.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name
                }));
                this.renderCategories();
            });

            // ファイルの監視
            const filesRef = collection(db, 'files');
            onSnapshot(filesRef, (snapshot) => {
                this.files = {};
                snapshot.docs.forEach(doc => {
                    const fileData = doc.data();
                    if (!this.files[fileData.category]) {
                        this.files[fileData.category] = [];
                    }
                    this.files[fileData.category].push({
                        id: doc.id,
                        ...fileData
                    });
                });
                this.renderCategories();
            });
        } catch (error) {
            console.error('Error setting up Firebase listeners:', error);
        }
    }
    async addCategory() {
        const input = document.getElementById('categoryInput');
        const categoryName = input.value.trim();

        if (categoryName) {
            try {
                // 重複チェック
                const exists = this.categories.some(cat => cat.name === categoryName);
                if (exists) {
                    alert('同名のカテゴリーが既に存在します。');
                    return;
                }

                // カテゴリーを追加
                const categoriesRef = collection(db, 'categories');
                await addDoc(categoriesRef, { name: categoryName });
                input.value = '';
            } catch (error) {
                console.error('Error adding category:', error);
                alert('カテゴリーの追加中にエラーが発生しました。');
            }
        }
    }

    async deleteCategory(categoryId, categoryName) {
        if (confirm(`カテゴリー「${categoryName}」を削除してもよろしいですか？\nこのカテゴリー内のファイルもすべて削除されます。`)) {
            try {
                // カテゴリーの削除
                const categoryRef = doc(db, 'categories', categoryId);
                await deleteDoc(categoryRef);

                // カテゴリーに属するファイルの削除
                const filesRef = collection(db, 'files');
                const q = query(filesRef, where('category', '==', categoryName));
                const snapshot = await getDocs(q);
                
                const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);

            } catch (error) {
                console.error('Error deleting category:', error);
                alert('カテゴリーの削除中にエラーが発生しました。');
            }
        }
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
                    <h4>${category.name}</h4>
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
                    ${this.renderFiles(category.name)}
                </div>
            `;

            const deleteButton = categoryElement.querySelector('.delete-category-btn');
            deleteButton.addEventListener('click', () => this.deleteCategory(category.id, category.name));

            const fileInput = categoryElement.querySelector('.file-input');
            fileInput.addEventListener('change', (e) => this.handleFileUpload(category.name, e));

            categoryList.appendChild(categoryElement);
        });
    }

    renderFiles(categoryName) {
        const categoryFiles = this.files[categoryName] || [];
        if (categoryFiles.length === 0) {
            return '<p class="no-files">ファイルはありません</p>';
        }

        return categoryFiles.map(file => `
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
                    <button class="delete-btn" onclick="fileManager.deleteFile('${categoryName}', '${file.id}')">
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

    async handleFileUpload(categoryName, event) {
        const files = event.target.files;
        const maxFileSize = 5 * 1024 * 1024; // 5MB制限

        for (const file of Array.from(files)) {
            try {
                // ファイルサイズチェック
                if (file.size > maxFileSize) {
                    alert(`ファイル "${file.name}" は5MBを超えています。`);
                    continue;
                }

                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        // 既存のファイルチェック
                        const filesRef = collection(db, 'files');
                        const q = query(
                            filesRef, 
                            where('category', '==', categoryName),
                            where('name', '==', file.name)
                        );
                        const snapshot = await getDocs(q);

                        let version = 1;
                        if (!snapshot.empty) {
                            // 既存のファイルがある場合、バージョンを更新
                            const existingFile = snapshot.docs[0];
                            version = (existingFile.data().version || 0) + 1;
                            await deleteDoc(existingFile.ref);
                        }

                        // 新しいファイルを追加
                        await addDoc(filesRef, {
                            name: file.name,
                            content: e.target.result,
                            category: categoryName,
                            date: new Date().toISOString(),
                            version: version,
                            size: file.size,
                            type: file.type
                        });

                    } catch (error) {
                        console.error('Error saving file:', error);
                        alert(`ファイル "${file.name}" の保存中にエラーが発生しました。`);
                    }
                };

                reader.readAsDataURL(file);

            } catch (error) {
                console.error('Error processing file:', error);
                alert(`ファイル "${file.name}" の処理中にエラーが発生しました。`);
            }
        }
    }

    async deleteFile(categoryName, fileId) {
        if (confirm('このファイルを削除してもよろしいですか？')) {
            try {
                const fileRef = doc(db, 'files', fileId);
                await deleteDoc(fileRef);
            } catch (error) {
                console.error('Error deleting file:', error);
                alert('ファイルの削除中にエラーが発生しました。');
            }
        }
    }
}
// タスク管理クラス
class TaskManager {
    constructor() {
        this.tasks = [];
        this.setupFirebaseListener();
    }

    setupFirebaseListener() {
        try {
            const tasksRef = collection(db, 'tasks');
            onSnapshot(tasksRef, (snapshot) => {
                this.tasks = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.renderTasks();
            }, (error) => {
                console.error('Error in tasks listener:', error);
            });
        } catch (error) {
            console.error('Error setting up tasks listener:', error);
        }
    }

    async addTask(text, date, priority, category) {
        if (!text.trim()) return;

        try {
            const tasksRef = collection(db, 'tasks');
            await addDoc(tasksRef, {
                text: text,
                date: date,
                priority: priority,
                category: category,
                completed: false,
                created: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error adding task:', error);
            alert('タスクの追加中にエラーが発生しました。');
        }
    }

    async toggleTask(id) {
        try {
            const task = this.tasks.find(t => t.id === id);
            if (!task) return;

            const taskRef = doc(db, 'tasks', id);
            await updateDoc(taskRef, {
                completed: !task.completed,
                lastUpdated: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error toggling task:', error);
            alert('タスクの状態更新中にエラーが発生しました。');
        }
    }

    async deleteTask(id) {
        if (confirm('このタスクを削除してもよろしいですか？')) {
            try {
                const taskRef = doc(db, 'tasks', id);
                await deleteDoc(taskRef);
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
        const sortedTasks = this.sortTasks(filteredTasks);

        sortedTasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `task-item ${task.priority}-priority`;
            if (task.completed) {
                taskElement.classList.add('completed');
            }

            taskElement.innerHTML = `
                <input type="checkbox" ${task.completed ? 'checked' : ''}>
                <div class="task-info">
                    <div class="task-text">${this.escapeHtml(task.text)}</div>
                    <div class="task-meta">
                        期限: ${task.date || '未設定'} | 
                        優先度: ${this.getPriorityLabel(task.priority)} | 
                        カテゴリー: ${this.escapeHtml(task.category)} |
                        最終更新: ${new Date(task.lastUpdated).toLocaleString()}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="edit-btn">編集</button>
                    <button class="delete-btn">削除</button>
                </div>
            `;

            const checkbox = taskElement.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => this.toggleTask(task.id));

            const editButton = taskElement.querySelector('.edit-btn');
            editButton.addEventListener('click', () => this.showEditTaskModal(task));

            const deleteButton = taskElement.querySelector('.delete-btn');
            deleteButton.addEventListener('click', () => this.deleteTask(task.id));

            taskList.appendChild(taskElement);
        });

        this.updateTaskCounters();
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

    sortTasks(tasks) {
        return [...tasks].sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            if (a.date && b.date) {
                return new Date(a.date) - new Date(b.date);
            }
            if (a.date) return -1;
            if (b.date) return 1;
            
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    getPriorityLabel(priority) {
        const labels = {
            high: '高',
            medium: '中',
            low: '低'
        };
        return labels[priority] || priority;
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    updateTaskCounters() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;

        const countersElement = document.getElementById('taskCounters');
        if (countersElement) {
            countersElement.innerHTML = `
                <div>全タスク: ${total}</div>
                <div>完了: ${completed}</div>
                <div>未完了: ${pending}</div>
            `;
        }
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

