/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

// Function to get config from localStorage or environment
const getFirebaseConfig = () => {
  // 1. Always prioritize Environment Variables (Vercel/Build-time)
  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
  };

  if (envConfig.projectId) return envConfig;

  // 2. Fallback to localStorage for local testing if no Env Vars
  try {
    const saved = localStorage.getItem('firebaseConfig');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to parse firebaseConfig from localStorage", e);
  }

  return envConfig;
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

const COLLECTION_NAME = "appData";

export const saveToFirebase = async (payload: any) => {
  if (!db) db = initFirebase();
  if (!db) throw new Error("Firebase chưa được cấu hình");

  try {
    const batch: any = {};
    const cleanPayload = JSON.parse(JSON.stringify(payload));

    // Map payload parts to specific documents
    const mapping = {
      students: ['originalData', 'subjectColumns', 'roomData'],
      assignments: ['assignmentData'],
      scores: ['mergedData'],
      auth: ['adminAccounts', 'teacherList', 'englishSpeakingAccounts'],
      config: [
        'examSchedule', 'markingSubjects', 'teacherConfig', 
        'invigilationConfig', 'schoolInfo', 'anonymizationTeam', 
        'secretariatTeam', 'exemptTeachers', 'secretariatPairs',
        'invigilationAssignments'
      ]
    };

    const timestamp = new Date().toISOString();

    // Prepare batch-like updates (using multiple setDoc calls for simplicity in this helper)
    for (const [docId, keys] of Object.entries(mapping)) {
      const docData: any = { updatedAt: timestamp };
      let hasData = false;
      
      keys.forEach(key => {
        if (cleanPayload[key] !== undefined) {
          docData[key] = cleanPayload[key];
          hasData = true;
        }
      });

      if (hasData) {
        await setDoc(doc(db, COLLECTION_NAME, docId), docData, { merge: true });
      }
    }

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
    const documents = ['students', 'assignments', 'scores', 'auth', 'config'];
    const results: any = {};

    for (const docId of documents) {
      const docSnap = await getDoc(doc(db, COLLECTION_NAME, docId));
      if (docSnap.exists()) {
        Object.assign(results, docSnap.data());
      }
    }

    return Object.keys(results).length > 0 ? results : null;
  } catch (error: any) {
    console.error("Error loading from Firebase:", error);
    throw new Error(`Lỗi khi tải từ Firebase: ${error.message}`);
  }
};

export const updateFieldInFirebase = async (field: string, value: any) => {
  if (!db) db = initFirebase();
  if (!db) throw new Error("Firebase chưa được cấu hình");

  try {
    // Determine which document to update
    const mapping: any = {
      originalData: 'students', subjectColumns: 'students', roomData: 'students',
      assignmentData: 'assignments',
      mergedData: 'scores',
      adminAccounts: 'auth', teacherList: 'auth', englishSpeakingAccounts: 'auth',
      examSchedule: 'config', markingSubjects: 'config', teacherConfig: 'config',
      invigilationConfig: 'config', schoolInfo: 'config', anonymizationTeam: 'config',
      secretariatTeam: 'config', exemptTeachers: 'config', secretariatPairs: 'config',
      invigilationAssignments: 'config'
    };

    const docId = mapping[field] || "mainData";
    const dataRef = doc(db, COLLECTION_NAME, docId);
    
    await setDoc(dataRef, {
      [field]: value,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return { status: 'success' };
  } catch (error: any) {
    console.error(`Error updating field ${field} in Firebase:`, error);
    throw new Error(`Lỗi khi cập nhật ${field}: ${error.message}`);
  }
};
