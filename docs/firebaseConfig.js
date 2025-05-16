// Firebase SDKsのインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    doc, 
    updateDoc,
    onSnapshot,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

// Firebaseの設定情報
const firebaseConfig = {
    apiKey: "AIzaSyDYVob4sZz_FNiiRAjDG8ohy2OYKOnyOdk",
    authDomain: "sx-hyousyousiki.firebaseapp.com",
    projectId: "sx-hyousyousiki",
    storageBucket: "sx-hyousyousiki.firebasestorage.app",
    messagingSenderId: "544928461149",
    appId: "1:544928461149:web:f2e31e11339981303af8b4",
    measurementId: "G-6D83RK0F8C"
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Firestoreの操作関数をエクスポート
export const firestore = {
    // イベントの取得
    async getEvents() {
        try {
            const eventsCollection = collection(db, 'events');
            const snapshot = await getDocs(eventsCollection);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting events:', error);
            throw error;
        }
    },

    // リアルタイムでイベントを監視
    subscribeToEvents(callback) {
        const eventsCollection = collection(db, 'events');
        return onSnapshot(eventsCollection, (snapshot) => {
            const events = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(events);
        });
    },

    // イベントの追加
    async addEvent(eventData) {
        try {
            const eventsCollection = collection(db, 'events');
            return await addDoc(eventsCollection, eventData);
        } catch (error) {
            console.error('Error adding event:', error);
            throw error;
        }
    },

    // イベントの更新
    async updateEvent(eventId, eventData) {
        try {
            const eventRef = doc(db, 'events', eventId);
            await updateDoc(eventRef, eventData);
            return eventData;
        } catch (error) {
            console.error('Error updating event:', error);
            throw error;
        }
    },

    // イベントの削除
    async deleteEvent(eventId) {
        try {
            const eventRef = doc(db, 'events', eventId);
            await deleteDoc(eventRef);
            return true;
        } catch (error) {
            console.error('Error deleting event:', error);
            throw error;
        }
    },

    // カテゴリー関連の関数
    async getCategories() {
        try {
            const categoriesDoc = await getDocs(collection(db, 'categories'));
            return categoriesDoc.docs.map(doc => doc.data().categories)[0] || [];
        } catch (error) {
            console.error('Error getting categories:', error);
            throw error;
        }
    },

    async saveCategories(categories) {
        try {
            await setDoc(doc(db, 'categories', 'main'), { categories });
        } catch (error) {
            console.error('Error saving categories:', error);
            throw error;
        }
    },

    subscribeToCategories(callback) {
        return onSnapshot(collection(db, 'categories'), (snapshot) => {
            const categories = snapshot.docs.map(doc => doc.data().categories)[0] || [];
            callback(categories);
        });
    },

    // ファイル関連の関数
    async getFiles() {
        try {
            const filesDoc = await getDocs(collection(db, 'files'));
            return filesDoc.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting files:', error);
            throw error;
        }
    },

    async saveFile(categoryName, fileData) {
        try {
            return await addDoc(collection(db, 'files'), {
                categoryName,
                ...fileData
            });
        } catch (error) {
            console.error('Error saving file:', error);
            throw error;
        }
    },

    async deleteFile(fileId) {
        try {
            await deleteDoc(doc(db, 'files', fileId));
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            throw error;
        }
    },

    subscribeToFiles(callback) {
        return onSnapshot(collection(db, 'files'), (snapshot) => {
            const files = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(files);
        });
    },

    // タスク関連の関数
    async getTasks() {
        try {
            const tasksDoc = await getDocs(collection(db, 'tasks'));
            return tasksDoc.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting tasks:', error);
            throw error;
        }
    },

    async addTask(taskData) {
        try {
            return await addDoc(collection(db, 'tasks'), taskData);
        } catch (error) {
            console.error('Error adding task:', error);
            throw error;
        }
    },

    async updateTask(taskId, taskData) {
        try {
            await updateDoc(doc(db, 'tasks', taskId), taskData);
            return taskData;
        } catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    },

    async deleteTask(taskId) {
        try {
            await deleteDoc(doc(db, 'tasks', taskId));
            return true;
        } catch (error) {
            console.error('Error deleting task:', error);
            throw error;
        }
    },

    subscribeToTasks(callback) {
        return onSnapshot(collection(db, 'tasks'), (snapshot) => {
            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(tasks);
        });
    }
};

// データベースインスタンスをエクスポート（必要に応じて）
export { db };
