export interface OriginalDataRow {
  [key: string]: any;
}

export interface TeacherListRow {
  name: string;
  phone: string;
}

export interface RoomDataRow {
  stt: string;
  room: string;
  [key: string]: any; // Subject columns with package barcodes
}

export interface AssignmentRow {
  grade: string;
  subject: string;
  teacher: string;
  phone?: string;
  package: string;
  stt: string;
  room: string;
  color?: string;
  timestamp?: string;
  status?: string;
}

export interface MergedDataRow {
  stt: string;
  name: string;
  gender: string;
  dob: string;
  pob: string;
  className: string;
  sbd: string;
  phach: string;
  tui: string;
  subject: string;
  speakingScore?: string;
  [key: string]: any;
}

export interface EnglishSpeakingAccount {
  username: string; // e.g. "GV_TiengAnh_Lop6A"
  password: string;
  teacherName: string;
  assignedClasses: string[]; // List of class names, e.g. ["6A", "6B"]
}

export interface ExamScheduleRow {
  day?: string;
  date: string;
  session: 'Sáng' | 'Chiều';
  grade: string;
  subject: string;
  [key: string]: any;
}

export interface TeacherConfig {
  subject: string;
  grade?: string;
  teachers: string[];
}

export interface InvigilationConfig {
  invigilatorsPerRoom: number;
}

export interface SchoolInfo {
  authority: string;   // Cơ quan chủ quản: "UBND PHƯỜNG BÌNH ĐỊNH"
  schoolName: string;  // Tên trường: "TRƯỜNG THCS BÌNH ĐỊNH"
  principal: string;   // Hiệu trưởng: "Nguyễn Văn A"
  location: string;    // Địa danh: "Bình Định"
  examName: string;    // Tên kỳ thi: "GIỮA HỌC KỲ II"
  schoolYear: string;  // Năm học: "2025-2026"
}

export interface MatrixAssignment {
  teacherName: string;
  sessions: Record<string, 'X' | 'CB' | 'TK' | ''>;
  roomAssignments: Record<string, string>; // sessionKey -> room name (e.g. "Phòng 3 Khối 6")
  total: number;
  isExempt?: boolean;
  isSecretariat?: boolean;
  isAnonymization?: boolean;
}

export interface AdminAccountRow {
  [key: string]: any;
}

export interface AppState {
  originalData: OriginalDataRow[];
  setOriginalData: (data: OriginalDataRow[]) => void;
  assignmentData: AssignmentRow[];
  setAssignmentData: (data: AssignmentRow[]) => void;
  mergedData: MergedDataRow[];
  setMergedData: (data: MergedDataRow[]) => void;
  adminAccounts: AdminAccountRow[];
  setAdminAccounts: (data: AdminAccountRow[]) => void;
  gasUrl: string;
  setGasUrl: (url: string) => void;
  subjectColumns: string[];
  setSubjectColumns: (cols: string[]) => void;
  teachers: string[];
  setTeachers: (teachers: string[]) => void;
  currentFile: string;
  setCurrentFile: (file: string) => void;
  refreshData: (showLoading?: boolean) => Promise<void>;
  refreshTrigger: number;
  
  teacherList: TeacherListRow[];
  setTeacherList: (list: TeacherListRow[]) => void;
  roomData: RoomDataRow[];
  setRoomData: (data: RoomDataRow[]) => void;

  examSchedule: ExamScheduleRow[];
  setExamSchedule: (data: ExamScheduleRow[]) => void;
  invigilationAssignments: MatrixAssignment[];
  setInvigilationAssignments: (data: MatrixAssignment[]) => void;
  anonymizationTeam: string[];
  setAnonymizationTeam: (teachers: string[]) => void;
  secretariatTeam: string[];
  setSecretariatTeam: (teachers: string[]) => void;
  exemptTeachers: string[];
  setExemptTeachers: (teachers: string[]) => void;
  secretariatPairs: [string, string][];
  setSecretariatPairs: (pairs: [string, string][]) => void;
  markingSubjects: string[];
  setMarkingSubjects: (subjects: string[]) => void;

  teacherConfig: TeacherConfig[];
  setTeacherConfig: (data: TeacherConfig[]) => void;
  invigilationConfig: InvigilationConfig;
  setInvigilationConfig: (data: InvigilationConfig) => void;
  schoolInfo: SchoolInfo;
  setSchoolInfo: (data: SchoolInfo) => void;

  englishSpeakingAccounts: EnglishSpeakingAccount[];
  setEnglishSpeakingAccounts: (data: EnglishSpeakingAccount[]) => void;

  // Authentication
  loggedInTeacher: string | null;
  setLoggedInTeacher: (name: string | null) => void;
  loggedInPhone: string | null;
  setLoggedInPhone: (phone: string | null) => void;
  role: 'admin' | 'teacher' | 'speaking_teacher' | null;
  setRole: (role: 'admin' | 'teacher' | 'speaking_teacher' | null) => void;
}
