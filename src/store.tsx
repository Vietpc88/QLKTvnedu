import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, OriginalDataRow, AssignmentRow, MergedDataRow, AdminAccountRow, ExamScheduleRow, MatrixAssignment, TeacherConfig, InvigilationConfig, SchoolInfo, TeacherListRow, RoomDataRow, EnglishSpeakingAccount } from './types';

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [originalData, setOriginalData] = useState<OriginalDataRow[]>([]);
  const [assignmentData, setAssignmentData] = useState<AssignmentRow[]>([]);
  const [mergedData, setMergedData] = useState<MergedDataRow[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccountRow[]>([]);
  const [gasUrl, setGasUrl] = useState<string>(() => localStorage.getItem('gasUrl') || 'https://script.google.com/macros/s/AKfycbybKCCmQsaBtIrInVwVrCrtFk7lO380bDxvmQJDspNMmOz9yTgTQYfGd4sv8GDXg2AL5g/exec');
  const [subjectColumns, setSubjectColumns] = useState<string[]>([]);
  const [teachers, setTeachers] = useState<string[]>([]);
  const [teacherList, setTeacherList] = useState<TeacherListRow[]>(() => {
    try {
      const saved = localStorage.getItem('teacherList');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [roomData, setRoomData] = useState<RoomDataRow[]>(() => {
    try {
      const saved = localStorage.getItem('roomData');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [currentFile, setCurrentFile] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // New State for Invigilation
  const [examSchedule, setExamSchedule] = useState<ExamScheduleRow[]>(() => {
    try {
      const saved = localStorage.getItem('examSchedule');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [invigilationAssignments, setInvigilationAssignments] = useState<MatrixAssignment[]>(() => {
    try {
      const saved = localStorage.getItem('invigilationAssignments');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [anonymizationTeam, setAnonymizationTeam] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('anonymizationTeam');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [secretariatTeam, setSecretariatTeam] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('secretariatTeam');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [markingSubjects, setMarkingSubjects] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('markingSubjects');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [exemptTeachers, setExemptTeachers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('exemptTeachers');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [secretariatPairs, setSecretariatPairs] = useState<[string, string][]>(() => {
    try {
      const saved = localStorage.getItem('secretariatPairs');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [teacherConfig, setTeacherConfig] = useState<TeacherConfig[]>(() => {
    try {
      const saved = localStorage.getItem('teacherConfig');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [invigilationConfig, setInvigilationConfig] = useState<InvigilationConfig>(() => {
    try {
      const saved = localStorage.getItem('invigilationConfig');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : { invigilatorsPerRoom: 2 };
    } catch { return { invigilatorsPerRoom: 2 }; }
  });

  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(() => {
    try {
      const saved = localStorage.getItem('schoolInfo');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : {
        authority: 'UBND PHƯỜNG BÌNH ĐỊNH',
        schoolName: 'TRƯỜNG THCS BÌNH ĐỊNH',
        principal: '',
        location: 'Bình Định',
        examName: 'GIỮA HỌC KỲ II',
        schoolYear: '2025-2026'
      };
    } catch { return { authority: '', schoolName: '', principal: '', location: '', examName: '', schoolYear: '' }; }
  });

  const [englishSpeakingAccounts, setEnglishSpeakingAccounts] = useState<EnglishSpeakingAccount[]>(() => {
    try {
      const saved = localStorage.getItem('englishSpeakingAccounts');
      return saved && saved !== 'undefined' ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [loggedInTeacher, setLoggedInTeacher] = useState<string | null>(localStorage.getItem('loggedInTeacher'));
  const [loggedInPhone, setLoggedInPhone] = useState<string | null>(localStorage.getItem('loggedInPhone'));
  const [role, setRole] = useState<'admin' | 'teacher' | null>(() => {
    const saved = localStorage.getItem('userRole');
    return (saved as 'admin' | 'teacher' | null) || null;
  });

  const refreshData = async (showLoading: boolean = false) => {
    setRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    localStorage.setItem('gasUrl', gasUrl);
  }, [gasUrl]);

  useEffect(() => {
    localStorage.setItem('examSchedule', JSON.stringify(examSchedule));
  }, [examSchedule]);

  useEffect(() => {
    localStorage.setItem('teacherList', JSON.stringify(teacherList));
  }, [teacherList]);

  useEffect(() => {
    localStorage.setItem('roomData', JSON.stringify(roomData));
  }, [roomData]);

  useEffect(() => {
    localStorage.setItem('invigilationAssignments', JSON.stringify(invigilationAssignments));
  }, [invigilationAssignments]);

  useEffect(() => {
    localStorage.setItem('anonymizationTeam', JSON.stringify(anonymizationTeam));
  }, [anonymizationTeam]);

  useEffect(() => {
    localStorage.setItem('secretariatTeam', JSON.stringify(secretariatTeam));
  }, [secretariatTeam]);

  useEffect(() => {
    localStorage.setItem('markingSubjects', JSON.stringify(markingSubjects));
  }, [markingSubjects]);

  useEffect(() => {
    localStorage.setItem('exemptTeachers', JSON.stringify(exemptTeachers));
  }, [exemptTeachers]);

  useEffect(() => {
    localStorage.setItem('secretariatPairs', JSON.stringify(secretariatPairs));
  }, [secretariatPairs]);

  useEffect(() => {
    localStorage.setItem('teacherConfig', JSON.stringify(teacherConfig));
  }, [teacherConfig]);

  useEffect(() => {
    localStorage.setItem('invigilationConfig', JSON.stringify(invigilationConfig));
  }, [invigilationConfig]);

  useEffect(() => {
    localStorage.setItem('schoolInfo', JSON.stringify(schoolInfo));
  }, [schoolInfo]);

  useEffect(() => {
    localStorage.setItem('englishSpeakingAccounts', JSON.stringify(englishSpeakingAccounts));
  }, [englishSpeakingAccounts]);

  useEffect(() => {
    if (loggedInTeacher) localStorage.setItem('loggedInTeacher', loggedInTeacher);
    else localStorage.removeItem('loggedInTeacher');
  }, [loggedInTeacher]);

  useEffect(() => {
    if (loggedInPhone) localStorage.setItem('loggedInPhone', loggedInPhone);
    else localStorage.removeItem('loggedInPhone');
  }, [loggedInPhone]);

  useEffect(() => {
    if (role) localStorage.setItem('userRole', role);
    else localStorage.removeItem('userRole');
  }, [role]);

  return (
    <AppContext.Provider value={{
      originalData, setOriginalData,
      assignmentData, setAssignmentData,
      mergedData, setMergedData,
      adminAccounts, setAdminAccounts,
      gasUrl, setGasUrl,
      subjectColumns, setSubjectColumns,
      teachers, setTeachers,
      currentFile, setCurrentFile,
      refreshData,
      refreshTrigger,
      examSchedule, setExamSchedule,
      invigilationAssignments, setInvigilationAssignments,
      anonymizationTeam, setAnonymizationTeam,
      secretariatTeam, setSecretariatTeam,
      exemptTeachers, setExemptTeachers,
      secretariatPairs, setSecretariatPairs,
      markingSubjects, setMarkingSubjects,
      teacherConfig, setTeacherConfig,
      invigilationConfig, setInvigilationConfig,
      schoolInfo, setSchoolInfo,
      englishSpeakingAccounts, setEnglishSpeakingAccounts,
      loggedInTeacher, setLoggedInTeacher,
      loggedInPhone, setLoggedInPhone,
      teacherList, setTeacherList,
      roomData, setRoomData,
      role, setRole
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
