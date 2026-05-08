/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, query, getDocs } from "firebase/firestore";

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
    const cleanPayload = JSON.parse(JSON.stringify(payload));
    const timestamp = new Date().toISOString();

    // 1. Handle regular categories
    const mapping = {
      students: ['originalData', 'subjectColumns', 'roomData'],
      assignments: ['assignmentData'],
      auth: ['adminAccounts', 'teacherList', 'englishSpeakingAccounts'],
      config: [
        'examSchedule', 'markingSubjects', 'teacherConfig', 
        'invigilationConfig', 'schoolInfo', 'anonymizationTeam', 
        'secretariatTeam', 'exemptTeachers', 'secretariatPairs',
        'invigilationAssignments'
      ]
    };

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

    // 2. Special handling for mergedData (Scores) to avoid 1MB limit
    if (cleanPayload.mergedData && Array.isArray(cleanPayload.mergedData)) {
      const subjects = [...new Set(cleanPayload.mergedData.map((d: any) => d.subject))];
      
      // Save each subject in a separate document
      for (const sub of subjects) {
        if (!sub) continue;
        const subData = cleanPayload.mergedData.filter((d: any) => d.subject === sub);
        await setDoc(doc(db, COLLECTION_NAME, `score_${sub}`), { 
          data: subData,
          updatedAt: timestamp 
        }, { merge: true });
      }

      // Save an index of subjects to know what to load
      await setDoc(doc(db, COLLECTION_NAME, 'scores_index'), { 
        subjects,
        updatedAt: timestamp 
      }, { merge: true });
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
    const results: any = {};

    // 1. Load by categories (Optimized way)
    const categories = ['students', 'assignments', 'auth', 'config', 'scores', 'mainData'];
    for (const docId of categories) {
      const docSnap = await getDoc(doc(db, COLLECTION_NAME, docId));
      if (docSnap.exists()) {
        Object.assign(results, docSnap.data());
      }
    }

    // 2. Load split scores
    const indexSnap = await getDoc(doc(db, COLLECTION_NAME, 'scores_index'));
    if (indexSnap.exists()) {
      const { subjects } = indexSnap.data();
      if (Array.isArray(subjects)) {
        const allScores: any[] = results.mergedData || [];
        for (const sub of subjects) {
          const subSnap = await getDoc(doc(db, COLLECTION_NAME, `score_${sub}`));
          if (subSnap.exists()) {
            const subData = subSnap.data().data;
            if (Array.isArray(subData)) allScores.push(...subData);
          }
        }
        results.mergedData = allScores;
      }
    }

    // 3. EMERGENCY FALLBACK: Scan the entire collection if still missing critical data
    if (!results.originalData || results.originalData.length === 0) {
      console.log("Critical data missing, performing full collection scan...");
      const q = query(collection(db, COLLECTION_NAME));
      const querySnapshot = await getDocs(q);
      console.log(`Found ${querySnapshot.size} documents in ${COLLECTION_NAME}`);
      
      querySnapshot.forEach((doc) => {
        const docId = doc.id;
        const data = doc.data();
        console.log(`Processing document: ${docId}`, Object.keys(data));
        
        // Merge anything that looks like our data
        if (data.originalData) {
          console.log(`Found originalData in ${docId}`);
          results.originalData = data.originalData;
        }
        if (data.mergedData && (!results.mergedData || results.mergedData.length === 0)) {
          console.log(`Found mergedData in ${docId}`);
          results.mergedData = data.mergedData;
        }
        if (data.assignmentData) results.assignmentData = data.assignmentData;
        if (data.subjectColumns) results.subjectColumns = data.subjectColumns;
        
        // Merge top-level fields
        Object.assign(results, data);
      });
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
    if (field === 'mergedData' && Array.isArray(value)) {
      return await saveToFirebase({ mergedData: value });
    }

    const mapping: any = {
      originalData: 'students', subjectColumns: 'students', roomData: 'students',
      assignmentData: 'assignments',
      adminAccounts: 'auth', teacherList: 'auth', englishSpeakingAccounts: 'auth',
      examSchedule: 'config', markingSubjects: 'config', teacherConfig: 'config',
      invigilationConfig: 'config', schoolInfo: 'config', anonymizationTeam: 'config',
      secretariatTeam: 'config', exemptTeachers: 'config', secretariatPairs: 'config',
      invigilationAssignments: 'config'
    };

    const docId = mapping[field] || "mainData";
    await setDoc(doc(db, COLLECTION_NAME, docId), {
      [field]: value,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    return { status: 'success' };
  } catch (error: any) {
    console.error(`Error updating field ${field} in Firebase:`, error);
    throw new Error(`Lỗi khi cập nhật ${field}: ${error.message}`);
  }
};
