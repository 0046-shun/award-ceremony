// firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    onSnapshot,
    enableIndexedDbPersistence  // 追加
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

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

// オフライン永続化を有効化
enableIndexedDbPersistence(db)
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code == 'unimplemented') {
            console.log('The current browser doesn\'t support all of the features required to enable persistence');
        }
    });

// Firestoreの操作関数
const firestore = {
    // イベントの取得
    async getEvents() {
        try {
            const eventsRef = collection(db, 'events');
            const snapshot = await getDocs(eventsRef);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting events:', error);
            return [];
        }
    },

    // イベントの追加
    async addEvent(eventData) {
        try {
            const eventsRef = collection(db, 'events');
            const docRef = await addDoc(eventsRef, {
                ...eventData,
                timestamp: new Date().toISOString()
            });
            console.log('Event added with ID:', docRef.id);
            return { id: docRef.id, ...eventData };
        } catch (error) {
            console.error('Error adding event:', error);
            throw error;
        }
    },

    // イベントの更新
    async updateEvent(eventId, eventData) {
        try {
            const eventRef = doc(db, 'events', eventId);
            await updateDoc(eventRef, {
                ...eventData,
                lastUpdated: new Date().toISOString()
            });
            console.log('Event updated:', eventId);
            return { id: eventId, ...eventData };
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
            console.log('Event deleted:', eventId);
            return true;
        } catch (error) {
            console.error('Error deleting event:', error);
            throw error;
        }
    },

    // リアルタイムリスナー
    subscribeToEvents(callback) {
        try {
            const eventsRef = collection(db, 'events');
            return onSnapshot(eventsRef, (snapshot) => {
                const events = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log('Realtime update received:', events);
                callback(events);
            }, (error) => {
                console.error('Error in realtime listener:', error);
            });
        } catch (error) {
            console.error('Error setting up realtime listener:', error);
        }
    }
};

export { firestore, db };
