/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

// Function to get config from localStorage or environment
const getFirebaseConfig = () => {
  try {
    const saved = localStorage.getItem('firebaseConfig');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to parse firebaseConfig from localStorage", e);
  }

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
  };
};

let app: any;
let db: any;

export const initFirebase = (config?: any) => {
  const finalConfig = config || getFirebaseConfig();
  if (!finalConfig.projectId) return null;
  
  try {
    app = initializeApp(finalConfig);
    db = getFirestore(app);
    return db;
  } catch (e) {
    console.error("Firebase initialization failed", e);
    return null;
  }
};

// Initialize on load if config exists
db = initFirebase();

const DATA_DOC_ID = "mainData";
const COLLECTION_NAME = "appData";

export const saveToFirebase = async (payload: any) => {
  if (!db) db = initFirebase();
  if (!db) throw new Error("Firebase chưa được cấu hình");

  try {
    const dataRef = doc(db, COLLECTION_NAME, DATA_DOC_ID);
    
    // We filter out functions or undefined values if any
    const cleanPayload = JSON.parse(JSON.stringify(payload));
    
    await setDoc(dataRef, {
      ...cleanPayload,
      updatedAt: new Date().toISOString()
    });
    return { status: 'success' };
  } catch (error: any) {
    console.error("Error saving to Firebase:", error);
    throw new Error(`Lỗi khi lưu lên Firebase: ${error.message}`);
  }
};

export const loadFromFirebase = async () => {
  if (!db) db = initFirebase();
  if (!db) throw new Error("Firebase chưa được cấu hình");

  try {
    const dataRef = doc(db, COLLECTION_NAME, DATA_DOC_ID);
    const docSnap = await getDoc(dataRef);
    if (docSnap.exists()) {
      return docSnap.data();
    } else {
      return null;
    }
  } catch (error: any) {
    console.error("Error loading from Firebase:", error);
    throw new Error(`Lỗi khi tải từ Firebase: ${error.message}`);
  }
};

export const updateFieldInFirebase = async (field: string, value: any) => {
  if (!db) db = initFirebase();
  if (!db) throw new Error("Firebase chưa được cấu hình");

  try {
    const dataRef = doc(db, COLLECTION_NAME, DATA_DOC_ID);
    await updateDoc(dataRef, {
      [field]: value,
      updatedAt: new Date().toISOString()
    });
    return { status: 'success' };
  } catch (error: any) {
    console.error(`Error updating field ${field} in Firebase:`, error);
    throw new Error(`Lỗi khi cập nhật ${field}: ${error.message}`);
  }
};
