import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAppContext } from '../store';
import { saveToGas } from '../lib/gas';
import { Upload, Save, Download, Search, Trash2, Calendar, Users, User, Briefcase, Play, FileText, CheckCircle2, AlertCircle, Plus, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { ExamScheduleRow, MatrixAssignment, TeacherConfig } from '../types';

export const TabInvigilation: React.FC = () => {
  const {
    roomData,
    teachers,
    subjectColumns,
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
    gasUrl
  } = useAppContext();

  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'schedule' | 'config' | 'assignment'>('schedule');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual Schedule States
  const [manualDay, setManualDay] = useState('2');
  const [manualDate, setManualDate] = useState('');
  const [manualSession, setManualSession] = useState<'Sáng' | 'Chiều'>('Sáng');
  const [manualGrade, setManualGrade] = useState('');
  const [manualSubject, setManualSubject] = useState('');
  
  // Teacher Config States
  const [selectedConfigSubject, setSelectedConfigSubject] = useState('');
  const [selectedConfigGrade, setSelectedConfigGrade] = useState('');
  const [teacherConfigSearch, setTeacherConfigSearch] = useState('');
  const [anonymizationSearch, setAnonymizationSearch] = useState('');
  const [secretariatSearch, setSecretariatSearch] = useState('');
  const [exemptSearch, setExemptSearch] = useState('');

  const normalizeGrade = (val: any): string => {
    const s = String(val || '').toLowerCase();
    const match = s.match(/\d+/);
    return match ? match[0] : s.trim();
  };

  // Extract grade from room name like "Phòng 1 Khối 6" → "6", "6A1" → "6", "K9 P3" → "9"
  const extractGradeFromRoom = (roomStr: string): string => {
    const s = String(roomStr || '').toLowerCase().trim();
    // Pattern: "khối X" or "khoi X"
    const khoiMatch = s.match(/kh[ốo]i\s*(\d+)/);
    if (khoiMatch) return khoiMatch[1];
    // Pattern: starts with digit(s) like "6A1" → grade is "6"
    const startMatch = s.match(/^(\d+)/);
    if (startMatch) return startMatch[1];
    // Fallback: last number in string
    const nums = s.match(/\d+/g);
    return nums ? nums[nums.length - 1] : s;
  };

  const formatDate = (val: any): string => {
    if (!val) return '';
    
    // Xử lý nếu là đối tượng Date
    if (val instanceof Date) {
      const d = val.getDate().toString().padStart(2, '0');
      const m = (val.getMonth() + 1).toString().padStart(2, '0');
      const y = val.getFullYear();
      return `${d}/${m}/${y}`;
    }

    // Xử lý nếu là số (Excel Serial Date - ví dụ: 46150)
    if (typeof val === 'number' || (!isNaN(Number(val)) && !String(val).includes('/') && !String(val).includes('-'))) {
      const n = Number(val);
      if (n > 30000 && n < 60000) { // Phạm vi ngày hợp lệ (khoảng năm 1982 - 2064)
        const date = new Date((n - 25569) * 86400 * 1000);
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
      }
    }

    const s = String(val).trim();
    if (s.includes('/')) return s; // Nếu đã có định dạng dd/mm/yyyy thì giữ nguyên
    
    // Thử parse các định dạng khác (ISO, v.v.)
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return s;
  };

  const sortedSessionKeys = useMemo(() => {
    const keys = Array.from(new Set(examSchedule.map(s => `${s.date}|${s.session}`))) as string[];
    return keys.sort((a, b) => {
        const parseDate = (d: string) => {
           const parts = d.split('/');
           return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        };
        const [d1, s1] = a.split('|');
        const [d2, s2] = b.split('|');
        const t1 = parseDate(d1).getTime();
        const t2 = parseDate(d2).getTime();
        if (t1 !== t2) return t1 - t2;
        return s1 === 'Sáng' ? -1 : 1;
    });
  }, [examSchedule]);

  // Matrix-style grouping for display
  const scheduleMatrix = useMemo(() => {
    const byDate: Record<string, { day: string, sessions: Record<string, Record<string, string[]>> }> = {};
    
    examSchedule.forEach(exam => {
      const g = normalizeGrade(exam.grade);
      if (!byDate[exam.date]) {
        byDate[exam.date] = { day: exam.day, sessions: {} };
      }
      if (!byDate[exam.date].sessions[exam.session]) {
        byDate[exam.date].sessions[exam.session] = {};
      }
      if (!byDate[exam.date].sessions[exam.session][g]) {
        byDate[exam.date].sessions[exam.session][g] = [];
      }
      byDate[exam.date].sessions[exam.session][g].push(exam.subject);
    });

    const parseDate = (d: string) => {
      const parts = d.split('/');
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
    };

    const sortedDates = Object.keys(byDate).sort((a, b) => parseDate(a) - parseDate(b));

    return sortedDates.map(date => {
      const dateInfo = byDate[date];
      const sessionNames = Object.keys(dateInfo.sessions).sort((a, b) => a === 'Sáng' ? -1 : 1);
      return {
        date,
        day: dateInfo.day,
        sessions: sessionNames.map(sName => ({
          name: sName,
          grades: dateInfo.sessions[sName]
        }))
      };
    });
  }, [examSchedule]);

  // Helper to get grades from originalData
  const grades = useMemo(() => {
    const gSet = new Set<string>();
    roomData.forEach(r => {
      const room = String(r.room || '').toLowerCase();
      if (room.includes('khối')) {
        gSet.add(room.split('khối').pop()?.trim() || '');
      }
    });
    return (Array.from(gSet) as string[]).sort();
  }, [roomData]);

  // Handle Exam Schedule Upload
  const handleScheduleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (json.length === 0) {
        alert("File không có dữ liệu!");
        return;
      }

      // Map to standard format: Thu, Date, Session, Grade, Subject
      const mapped = json.map((row: any) => {
        const keys = Object.keys(row);
        const findVal = (possibleKeys: string[]) => {
          const key = keys.find(k => possibleKeys.includes(k.toLowerCase().trim()));
          return key ? String(row[key]).trim() : '';
        };

        return {
          day: String(findVal(['thứ', 'thu', 'day']) || ''),
          date: formatDate(findVal(['ngày', 'ngày thi', 'date', 'ngay'])),
          session: String(findVal(['buổi', 'buoi', 'session']) || ''),
          grade: String(findVal(['khối', 'khoi', 'grade', 'lớp', 'lop']) || ''),
          subject: String(findVal(['môn', 'mon', 'subject', 'môn thi']) || '')
        };
      }).filter(r => r.date && r.subject);

      setExamSchedule([...examSchedule, ...mapped]);
      alert(`Đã tải thêm ${mapped.length} buổi thi.`);
    } catch (error: any) {
      alert("Lỗi khi đọc file: " + error.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleManualAddSchedule = () => {
    if (!manualDate || !manualGrade || !manualSubject) {
      alert("Vui lòng nhập Ngày, Khối và Môn!");
      return;
    }
    const newEntry: ExamScheduleRow = {
      day: manualDay,
      date: formatDate(manualDate),
      session: manualSession,
      grade: manualGrade,
      subject: manualSubject
    };
    setExamSchedule([...examSchedule, newEntry]);
    // Don't clear manualSubject automatically to allow fast entry if needed
  };

  const handleRemoveSchedule = (index: number) => {
    const newSchedule = [...examSchedule];
    newSchedule.splice(index, 1);
    setExamSchedule(newSchedule);
  };

  const handleClearSchedule = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch thi hiện tại?")) {
      setExamSchedule([]);
    }
  };

  const handleMoveSchedule = (index: number, direction: 'up' | 'down') => {
    const newSchedule = [...examSchedule];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSchedule.length) return;
    [newSchedule[index], newSchedule[targetIndex]] = [newSchedule[targetIndex], newSchedule[index]];
    setExamSchedule(newSchedule);
  };

  // Toggle Anonymization Team member
  const toggleTeamMember = (teacher: string) => {
    if (anonymizationTeam.includes(teacher)) {
      setAnonymizationTeam(anonymizationTeam.filter(t => t !== teacher));
    } else {
      setAnonymizationTeam([...anonymizationTeam, teacher]);
    }
  };

  // Toggle Secretariat Team member
  const toggleSecretariatMember = (teacher: string) => {
    if (secretariatTeam.includes(teacher)) {
      setSecretariatTeam(secretariatTeam.filter(t => t !== teacher));
      // Also remove from pairs if member is removed from team
      setSecretariatPairs(secretariatPairs.filter(p => p[0] !== teacher && p[1] !== teacher));
    } else {
      setSecretariatTeam([...secretariatTeam, teacher]);
    }
  };

  // Toggle Exempt Teachers
  const toggleExemptMember = (teacher: string) => {
    if (exemptTeachers.includes(teacher)) {
      setExemptTeachers(exemptTeachers.filter(t => t !== teacher));
    } else {
      setExemptTeachers([...exemptTeachers, teacher]);
    }
  };

  // Secretariat Pairing Logic
  const [pairingSelection, setPairingSelection] = useState<string[]>([]);
  const togglePairSelection = (teacher: string) => {
    if (pairingSelection.includes(teacher)) {
      setPairingSelection(pairingSelection.filter(t => t !== teacher));
    } else {
      if (pairingSelection.length < 2) {
        const newSelection = [...pairingSelection, teacher];
        if (newSelection.length === 2) {
          setSecretariatPairs([...secretariatPairs, [newSelection[0], newSelection[1]] as [string, string]]);
          setPairingSelection([]);
        } else {
          setPairingSelection(newSelection);
        }
      }
    }
  };

  // Manage Teacher-Subject Config
  const handleTeacherSubjectToggle = (teacher: string) => {
    if (!selectedConfigSubject) return;

    const existingConfigIndex = teacherConfig.findIndex(c => c.subject === selectedConfigSubject && (c.grade || '') === selectedConfigGrade);
    let newConfigs = [...teacherConfig];

    if (existingConfigIndex >= 0) {
      const config = newConfigs[existingConfigIndex];
      if (config.teachers.includes(teacher)) {
        config.teachers = config.teachers.filter(t => t !== teacher);
      } else {
        config.teachers.push(teacher);
      }
    } else {
      newConfigs.push({
        subject: selectedConfigSubject,
        grade: selectedConfigGrade || undefined,
        teachers: [teacher]
      });
    }

    setTeacherConfig(newConfigs.filter(c => c.teachers.length > 0));
  };

  const activeSubjectTeachers = useMemo(() => {
    if (!selectedConfigSubject) return [];
    const config = teacherConfig.find(c => c.subject === selectedConfigSubject && (c.grade || '') === selectedConfigGrade);
    return config ? config.teachers : [];
  }, [selectedConfigSubject, selectedConfigGrade, teacherConfig]);

  // Server Sync
  const handleSaveConfigToServer = async () => {
    if (!gasUrl) {
      alert("Chưa cấu hình URL hệ thống (GAS)!");
      return;
    }
    setLoading(true);
    try {
      await saveToGas(gasUrl, {
        examSchedule,
        anonymizationTeam,
        secretariatTeam,
        exemptTeachers,
        secretariatPairs,
        markingSubjects,
        teacherConfig,
        invigilationConfig,
        invigilationAssignments // Gửi cả kết quả phân công lên để lưu trữ
      }, 'sync');
      alert("Lưu cấu hình lên hệ thống thành công!");
    } catch (e: any) {
      alert(`Lỗi khi lưu cấu hình: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Automated Assignment Logic
  const generateAssignments = () => {
    if (examSchedule.length === 0) {
      alert("Vui lòng tải hoặc thêm lịch thi trước!");
      return;
    }

    setLoading(true);

    // 1. Build Teacher Subject Map from Explicit Config
    const teacherMap = new Map<string, { subjectGrades: Set<string> }>();
    if (teacherConfig.length > 0) {
      teacherConfig.forEach(cfg => {
        cfg.teachers.forEach(teacherName => {
          if (!teacherMap.has(teacherName)) teacherMap.set(teacherName, { subjectGrades: new Set() });
          const info = teacherMap.get(teacherName)!;
          if (cfg.grade) {
             info.subjectGrades.add(`${cfg.subject}|${cfg.grade}`);
          } else {
             grades.forEach(g => info.subjectGrades.add(`${cfg.subject}|${g}`));
          }
        });
      });
    } else {
      roomData.forEach(row => {
        const teacherName = String(row['giáo viên'] || row['Giáo viên'] || '').trim();
        if (!teacherName) return;
        const roomRaw = String(row.room || '').toLowerCase();
        const grade = roomRaw.includes('khối') ? roomRaw.split('khối').pop()?.trim() || '' : '';
        if (!teacherMap.has(teacherName)) teacherMap.set(teacherName, { subjectGrades: new Set() });
        const teacherInfo = teacherMap.get(teacherName)!;
        subjectColumns.forEach(sub => {
          if (row[sub] && String(row[sub]).trim()) {
            teacherInfo.subjectGrades.add(`${sub}|${grade}`);
          }
        });
      });
    }

    // 2. Identify Unique Sessions and Sort Chronologically
    const parseDate = (d: string) => {
       const parts = d.split('/');
       if (parts.length < 3) return new Date(0);
       return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    };

    const sessionKeys = Array.from(new Set(examSchedule.map(s => `${s.date}|${s.session}`))) as string[];
    const sortedSessions = sessionKeys.sort((a: string, b: string) => {
       const [dateA, sessA] = a.split('|');
       const [dateB, sessB] = b.split('|');
       const dA = parseDate(dateA);
       const dB = parseDate(dateB);
       if (dA.getTime() !== dB.getTime()) return dA.getTime() - dB.getTime();
       return sessA === 'Sáng' ? -1 : 1;
    });

    // 3. Eligible teachers = ALL teachers MINUS phách team MINUS secretariat team MINUS exempt teachers
    const excludedFromInvigilation = new Set([...anonymizationTeam, ...secretariatTeam, ...exemptTeachers]);
    const eligibleTeachers = teachers.filter(t => !excludedFromInvigilation.has(t));

    // 4. Prepare Assignment Matrix (include everyone for overview, but only eligible get X/CB)
    const matrix: Record<string, Record<string, 'X' | 'CB' | 'TK' | ''>> = {};
    teachers.forEach(t => { matrix[t] = {}; });

    // 5. Special Assignments: Secretariat (TK) by Pairs
    if (secretariatPairs.length > 0) {
      sortedSessions.forEach((sessionKey, idx) => {
        // Rotate through pairs: one pair per session
        const pairIndex = idx % secretariatPairs.length;
        const pair = secretariatPairs[pairIndex];
        pair.forEach(member => {
          if (matrix[member]) matrix[member][sessionKey] = 'TK';
        });
      });
    } else if (secretariatTeam.length > 0) {
      // If no pairs, just show them as TK roughly balanced (simple fallback)
      sortedSessions.forEach((sessionKey, idx) => {
         const member = secretariatTeam[idx % secretariatTeam.length];
         if (matrix[member]) matrix[member][sessionKey] = 'TK';
      });
    }

    // 5. Pre-compute CB assignments (forward-looking rule):
    //    If teacher's subject is tested in session[i], mark CB in session[i+1]
    //    Sáng → Chiều cùng ngày; Chiều → Sáng hôm sau
    sortedSessions.forEach((sessionKey, idx) => {
      const [date, session] = sessionKey.split('|');
      const sessionExams = examSchedule.filter(s => s.date === date && s.session === session);

      // Find the NEXT session key
      const nextSessionKey = idx < sortedSessions.length - 1 ? sortedSessions[idx + 1] : null;

      if (nextSessionKey) {
        eligibleTeachers.forEach(t => {
          const info = teacherMap.get(t);
          if (info) {
            const teachesExamThisSession = sessionExams.some(exam => {
              const examG = normalizeGrade(exam.grade);
              // Only assign CB if the subject is in markingSubjects
              if (!markingSubjects.includes(exam.subject)) return false;
              
              return Array.from(info.subjectGrades).some(sg => {
                const [s, g] = sg.split('|');
                return s === exam.subject && normalizeGrade(g) === examG;
              });
            });

            if (teachesExamThisSession) {
              matrix[t][nextSessionKey] = 'CB';
            }
          }
        });
      }
    });

    // 6. Process each session for invigilation (X) with specific room assignments
    const roomMap: Record<string, Record<string, string>> = {}; // teacher -> sessionKey -> room
    eligibleTeachers.forEach(t => { roomMap[t] = {}; });

    sortedSessions.forEach((sessionKey) => {
      const [date, session] = sessionKey.split('|');
      const sessionExams = examSchedule.filter(s => s.date === date && s.session === session);
      const sessionGrades = new Set(sessionExams.map(s => s.grade));

      // Get all rooms for the grades being tested this session
      const normalizedSessionGrades = new Set(Array.from(sessionGrades).map(g => normalizeGrade(g)));
      const allRooms = Array.from(new Set(roomData.map(r => String(r.room || '')).filter(Boolean))) as string[];
      const activeRooms = allRooms.filter(r => {
         const roomGrade = extractGradeFromRoom(r);
         return normalizedSessionGrades.has(roomGrade);
      }).sort(); // Sort rooms for consistent assignment

      // Available = eligible teachers who don't already have CB for this session
      let available = eligibleTeachers.filter(t => !matrix[t][sessionKey]);
      
      // Load-balancing sort: prioritize teachers with lowest X count
      available.sort((a, b) => {
         const getCount = (name: string) => {
            return Object.values(matrix[name] || {}).filter(v => v === 'X').length;
         };
         const countA = getCount(a);
         const countB = getCount(b);
         if (countA !== countB) return countA - countB;
         return Math.random() - 0.5;
      });

      // Assign teachers per room based on config
      const perRoom = invigilationConfig.invigilatorsPerRoom || 1;
      
      activeRooms.forEach((room) => {
        for (let i = 1; i <= perRoom; i++) {
          if (available.length > 0) {
            const t = available.shift()!;
            matrix[t][sessionKey] = 'X';
            roomMap[t][sessionKey] = perRoom > 1 ? `${room} (GT${i})` : room;
          }
        }
      });
    });

    // 7. Build final result
    const finalResult = teachers.map(t => {
       const sessionsAsg = matrix[t];
       const totalX = Object.values(sessionsAsg).filter(v => v === 'X').length;
       const totalTK = Object.values(sessionsAsg).filter(v => v === 'TK').length;
       return {
         teacherName: t,
         sessions: sessionsAsg,
         roomAssignments: roomMap[t] || {},
         total: totalX + totalTK, // Sum of all working sessions
         isExempt: exemptTeachers.includes(t),
         isSecretariat: secretariatTeam.includes(t),
         isAnonymization: anonymizationTeam.includes(t)
       };
    });

    setInvigilationAssignments(finalResult);
    setLoading(false);
    
    const totalRooms = sortedSessions.reduce((sum, sk) => {
      const [d, s] = sk.split('|');
      const exams = examSchedule.filter(e => e.date === d && e.session === s);
      const ngs = new Set(exams.map(e => normalizeGrade(e.grade)));
      const allR = Array.from(new Set(roomData.map(r => String(r.room || '')).filter(Boolean)));
      return sum + allR.filter(r => ngs.has(extractGradeFromRoom(r as string))).length;
    }, 0);
    alert(`Phân công ${eligibleTeachers.length} GV coi ${totalRooms} lượt phòng (${sortedSessions.length} buổi). Đã loại ${excludedFromInvigilation.size} GV phách/thư ký/miễn.`);
    setActiveSubTab('assignment');
  };

  const handleExportMarkingSchedule = async () => {
    if (examSchedule.length === 0) return;
    setLoading(true);
    try {
      const ExcelJS: any = await new Promise((resolve, reject) => {
        if ((window as any).ExcelJS) { resolve((window as any).ExcelJS); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
        script.onload = () => resolve((window as any).ExcelJS);
        script.onerror = () => reject(new Error('Failed to load ExcelJS'));
        document.head.appendChild(script);
      });

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Lịch chấm thi', {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1 }
      });

      ws.getColumn(1).width = 15; // Ngày
      ws.getColumn(2).width = 10; // Buổi
      ws.getColumn(3).width = 20; // Môn
      ws.getColumn(4).width = 50; // GV chấm
      ws.getColumn(5).width = 12; // Ghi chú

      // Header
      const headerRow1 = ws.getRow(1);
      headerRow1.getCell(1).value = schoolInfo.authority;
      headerRow1.getCell(3).value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
      const headerRow2 = ws.getRow(2);
      headerRow2.getCell(1).value = schoolInfo.schoolName;
      headerRow2.getCell(3).value = 'Độc lập - Tự do - Hạnh phúc';
      ws.mergeCells(1, 1, 1, 2); ws.mergeCells(1, 3, 1, 5);
      ws.mergeCells(2, 1, 2, 2); ws.mergeCells(2, 3, 2, 5);
      [headerRow1, headerRow2].forEach(r => {
        r.alignment = { horizontal: 'center' };
        r.font = { bold: true, name: 'Times New Roman', size: 11 };
      });

      // Title
      const titleRow = ws.getRow(4);
      titleRow.getCell(1).value = `LỊCH CHẤM TẬP TRUNG BÀI KIỂM TRA ${schoolInfo.examName}`;
      ws.mergeCells(4, 1, 4, 5);
      titleRow.alignment = { horizontal: 'center' };
      titleRow.font = { bold: true, name: 'Times New Roman', size: 14 };

      const yearRow = ws.getRow(5);
      yearRow.getCell(1).value = `NĂM HỌC: ${schoolInfo.schoolYear}`;
      ws.mergeCells(5, 1, 5, 5);
      yearRow.alignment = { horizontal: 'center' };
      yearRow.font = { bold: true, name: 'Times New Roman', size: 12 };

      // Table Head
      const tableHead = ws.getRow(7);
      ['Ngày tháng', 'Buổi', 'Môn chấm', 'Giáo viên chấm', 'Ghi chú'].forEach((h, i) => {
        const cell = tableHead.getCell(i + 1);
        cell.value = h;
        cell.font = { bold: true, name: 'Times New Roman' };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });

      // Data Logic: Iterate from the second session onwards (since the first session has no "prior" exams to mark)
      let currentRow = 8;
      for (let j = 1; j < sortedSessionKeys.length; j++) {
        const markingSk = sortedSessionKeys[j];
        const examSk = sortedSessionKeys[j - 1];
        
        const [markingDate, markingSession] = markingSk.split('|');
        const [examDate, examSession] = examSk.split('|');
        
        const mInfo = examSchedule.find(s => s.date === markingDate);
        // Find exams from the PREVIOUS session that are in markingSubjects
        const examsToMark = examSchedule.filter(e => e.date === examDate && e.session === examSession && markingSubjects.includes(e.subject));
        
        if (examsToMark.length === 0) continue;

        const startRow = currentRow;
        examsToMark.forEach((exam) => {
          const row = ws.getRow(currentRow++);
          row.getCell(3).value = `${exam.subject} ${exam.grade}`;
          
          // Find teachers who have 'CB' for this specific exam subject/grade in the CURRENT (marking) session
          // We look into teacherConfig for people assigned to this subject-grade
          const config = teacherConfig.find(c => c.subject === exam.subject && (normalizeGrade(c.grade) === normalizeGrade(exam.grade) || !c.grade));
          const teachers = config ? config.teachers.sort().join(', ') : '';
          row.getCell(4).value = teachers;

          for (let c = 1; c <= 5; c++) {
            row.getCell(c).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            row.getCell(c).font = { name: 'Times New Roman', size: 11 };
            row.getCell(c).alignment = { wrapText: true, vertical: 'middle' };
          }
        });

        // Merge Date and Session for the Marking session
        ws.mergeCells(startRow, 1, currentRow - 1, 1);
        ws.mergeCells(startRow, 2, currentRow - 1, 2);
        const dateCell = ws.getCell(startRow, 1);
        dateCell.value = `${mInfo?.day ? 'THỨ ' + mInfo.day : ''}\n${markingDate}`;
        dateCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        dateCell.font = { bold: true, name: 'Times New Roman' };

        const sessCell = ws.getCell(startRow, 2);
        sessCell.value = markingSession;
        sessCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Footer
      currentRow += 2;
      const footerRow = ws.getRow(currentRow);
      footerRow.getCell(3).value = `${schoolInfo.location}, ngày ${formatDate(new Date())}`;
      footerRow.getCell(3).font = { italic: true, name: 'Times New Roman' };
      footerRow.alignment = { horizontal: 'center' };
      ws.mergeCells(currentRow, 3, currentRow, 5);

      currentRow++;
      const signRow = ws.getRow(currentRow);
      signRow.getCell(3).value = 'HIỆU TRƯỞNG';
      signRow.getCell(3).font = { bold: true, name: 'Times New Roman' };
      signRow.alignment = { horizontal: 'center' };
      ws.mergeCells(currentRow, 3, currentRow, 5);

      currentRow += 4;
      const nameRow = ws.getRow(currentRow);
      nameRow.getCell(3).value = schoolInfo.principal;
      nameRow.getCell(3).font = { bold: true, name: 'Times New Roman' };
      nameRow.alignment = { horizontal: 'center' };
      ws.mergeCells(currentRow, 3, currentRow, 5);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `LichChamThi_${schoolInfo.examName}.xlsx`;
      link.click();
    } catch (e: any) {
      alert("Lỗi xuất file: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (invigilationAssignments.length === 0) return;

    setLoading(true);
    try {
      // Dynamic Library Loading via CDN
      const ExcelJS: any = await new Promise((resolve, reject) => {
        if ((window as any).ExcelJS) {
          resolve((window as any).ExcelJS);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
        script.onload = () => resolve((window as any).ExcelJS);
        script.onerror = () => reject(new Error('Không thể tải thư viện ExcelJS từ CDN. Vui lòng kiểm tra kết nối internet.'));
        document.head.appendChild(script);
      });

      const parseDate = (d: string) => {
        const parts = d.split('/');
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      };

      const sessionKeysSorted = (Array.from(new Set(examSchedule.map(s => `${s.date}|${s.session}`))) as string[]).sort((a: string, b: string) => {
        const [d1, s1] = a.split('|');
        const [d2, s2] = b.split('|');
        const t1 = parseDate(d1).getTime();
        const t2 = parseDate(d2).getTime();
        if (t1 !== t2) return t1 - t2;
        return s1 === 'Sáng' ? -1 : 1;
      });

      const workbook = new ExcelJS.Workbook();

      // ============ SHEET 1: BẢNG TỔNG HỢP COI THI (Chỉ ghi GV có coi) ============
      // Lọc danh sách: Chỉ lấy giáo viên có ít nhất 1 buổi coi thi (X)
      const invigilatorsOnly = invigilationAssignments.filter(asg => 
        Object.values(asg.sessions).some(v => v === 'X')
      );

      const wsSummary = workbook.addWorksheet('Tổng hợp Coi thi', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
      });

      const uniqueDates = Array.from(new Set(sessionKeysSorted.map(k => k.split('|')[0])));
      const totalCols = sessionKeysSorted.length + 3; // TT + Name + sessions + SỐ BUỔI
      const midCol = Math.floor(totalCols / 2);

      // Official header
      const row1 = wsSummary.getRow(1);
      row1.getCell(1).value = schoolInfo.authority;
      row1.getCell(midCol + 1).value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
      
      const row2 = wsSummary.getRow(2);
      row2.getCell(1).value = schoolInfo.schoolName;
      row2.getCell(midCol + 1).value = 'Độc lập - Tự do - Hạnh phúc';
      
      wsSummary.mergeCells(1, 1, 1, midCol);
      wsSummary.mergeCells(1, midCol + 1, 1, totalCols);
      wsSummary.mergeCells(2, 1, 2, midCol);
      wsSummary.mergeCells(2, midCol + 1, 2, totalCols);
      
      [row1, row2].forEach(r => {
        r.alignment = { horizontal: 'center', vertical: 'middle' };
        r.font = { bold: true, name: 'Times New Roman', size: 12 };
      });

      // Title
      const row4 = wsSummary.getRow(4);
      row4.getCell(1).value = `DANH SÁCH GIÁO VIÊN COI KIỂM TRA ${schoolInfo.examName}`;
      wsSummary.mergeCells(4, 1, 4, totalCols);
      row4.alignment = { horizontal: 'center' };
      row4.font = { bold: true, name: 'Times New Roman', size: 14 };

      const row5 = wsSummary.getRow(5);
      row5.getCell(1).value = `Năm học: ${schoolInfo.schoolYear}`;
      wsSummary.mergeCells(5, 1, 5, totalCols);
      row5.alignment = { horizontal: 'center' };
      row5.font = { italic: true, name: 'Times New Roman', size: 12 };

      // Table Header
      const headerRow7 = wsSummary.getRow(7);
      const headerRow8 = wsSummary.getRow(8);
      headerRow7.getCell(1).value = 'TT';
      headerRow7.getCell(2).value = 'Họ và tên giáo viên';
      
      let colIdx = 3;
      uniqueDates.forEach(date => {
        const sInfo = examSchedule.find(s => s.date === date);
        const sessionsForDate = sessionKeysSorted.filter(k => k.split('|')[0] === date);
        const cell = headerRow7.getCell(colIdx);
        cell.value = `${sInfo?.day ? 'Thứ ' + sInfo.day : ''} (${date})`;
        
        if (sessionsForDate.length > 1) {
          wsSummary.mergeCells(7, colIdx, 7, colIdx + sessionsForDate.length - 1);
        }
        
        sessionsForDate.forEach((sk, i) => {
          headerRow8.getCell(colIdx + i).value = sk.split('|')[1];
        });
        colIdx += sessionsForDate.length;
      });
      headerRow7.getCell(colIdx).value = 'SỐ BUỔI';
      
      wsSummary.mergeCells(7, 1, 8, 1);
      wsSummary.mergeCells(7, 2, 8, 2);
      wsSummary.mergeCells(7, colIdx, 8, colIdx);

      [headerRow7, headerRow8].forEach(r => {
        r.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        r.font = { bold: true, name: 'Times New Roman', size: 11 };
        r.eachCell(c => {
          c.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Data Rows
      let currentRow = 9;
      invigilatorsOnly.forEach((asg, idx) => {
        const row = wsSummary.getRow(currentRow++);
        row.getCell(1).value = idx + 1;
        row.getCell(2).value = asg.teacherName;
        
        let cIdx = 3;
        sessionKeysSorted.forEach(sk => {
          const val = (asg.sessions as any)[sk];
          const cell = row.getCell(cIdx++);
          cell.value = val === 'X' ? 'X' : val === 'CB' ? 'CB' : '';
          cell.alignment = { horizontal: 'center' };
        });
        row.getCell(cIdx).value = Object.values(asg.sessions).filter(v => v === 'X').length;
        row.getCell(cIdx).alignment = { horizontal: 'center' };
        
        row.eachCell(c => {
          c.font = { name: 'Times New Roman', size: 11 };
          c.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });

      // Total Row
      const totalRow = wsSummary.getRow(currentRow++);
      totalRow.getCell(2).value = 'TỔNG';
      let tcIdx = 3;
      sessionKeysSorted.forEach(sk => {
        const count = invigilatorsOnly.filter(a => (a.sessions as any)[sk] === 'X').length;
        const cell = totalRow.getCell(tcIdx++);
        cell.value = count;
        cell.alignment = { horizontal: 'center' };
      });
      totalRow.getCell(tcIdx).value = invigilatorsOnly.reduce((sum, a) => sum + Object.values(a.sessions).filter(v => v === 'X').length, 0);
      totalRow.getCell(tcIdx).alignment = { horizontal: 'center' };
      
      totalRow.eachCell(c => {
        c.font = { bold: true, name: 'Times New Roman', size: 11 };
        c.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // Footer
      currentRow += 2;
      const fDateRow = wsSummary.getRow(currentRow++);
      fDateRow.getCell(midCol + 1).value = `${schoolInfo.location}, ngày .... tháng .... năm ....`;
      wsSummary.mergeCells(currentRow-1, midCol+1, currentRow-1, totalCols);
      fDateRow.alignment = { horizontal: 'center' };
      fDateRow.font = { italic: true, name: 'Times New Roman', size: 12 };

      const fRoleRow = wsSummary.getRow(currentRow++);
      fRoleRow.getCell(midCol + 1).value = 'HIỆU TRƯỞNG';
      wsSummary.mergeCells(currentRow-1, midCol+1, currentRow-1, totalCols);
      fRoleRow.alignment = { horizontal: 'center' };
      fRoleRow.font = { bold: true, name: 'Times New Roman', size: 12 };

      currentRow += 4;
      const fNameRow = wsSummary.getRow(currentRow);
      fNameRow.getCell(midCol + 1).value = schoolInfo.principal;
      wsSummary.mergeCells(currentRow, midCol+1, currentRow, totalCols);
      fNameRow.alignment = { horizontal: 'center' };
      fNameRow.font = { bold: true, name: 'Times New Roman', size: 12 };

      wsSummary.getColumn(1).width = 5;
      wsSummary.getColumn(2).width = 35; // Increased from 30
      for (let i = 3; i <= totalCols; i++) wsSummary.getColumn(i).width = 10;

      // ============ SHEETS 2+: CHI TIẾT TỪNG BUỔI ============
      sessionKeysSorted.forEach((sk, sheetIdx) => {
        const [date, session] = sk.split('|');
        const sInfo = examSchedule.find(s => s.date === date);
        const sessionExams = examSchedule.filter(s => s.date === date && s.session === session);
        const sessionGrades = Array.from(new Set(sessionExams.map(e => e.grade))).join(',');
        
        const safeDate = date.replace(/\//g, '-');
        const sheetName = `Buổi ${sheetIdx+1} - ${session} ${safeDate}`.slice(0, 31);
        const wsDetail = workbook.addWorksheet(sheetName, {
          pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });

        wsDetail.getColumn(1).width = 6;
        wsDetail.getColumn(2).width = 25; // Increased from 20
        wsDetail.getColumn(3).width = 35; // Increased from 32
        wsDetail.getColumn(4).width = 20; // Increased from 15

        const dRow1 = wsDetail.getRow(1);
        dRow1.getCell(1).value = schoolInfo.authority;
        dRow1.getCell(3).value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
        wsDetail.mergeCells(1, 1, 1, 2); wsDetail.mergeCells(1, 3, 1, 4);

        const dRow2 = wsDetail.getRow(2);
        dRow2.getCell(1).value = schoolInfo.schoolName;
        dRow2.getCell(3).value = 'Độc lập - Tự do - Hạnh phúc';
        wsDetail.mergeCells(2, 1, 2, 2); wsDetail.mergeCells(2, 3, 2, 4);

        [dRow1, dRow2].forEach(r => {
          r.alignment = { horizontal: 'center' };
          r.font = { bold: true, name: 'Times New Roman', size: 11 };
        });

        const dRow4 = wsDetail.getRow(4);
        dRow4.getCell(1).value = `PHÂN CÔNG GIÁO VIÊN COI KIỂM TRA ${schoolInfo.examName}`;
        wsDetail.mergeCells(4, 1, 4, 4);
        dRow4.alignment = { horizontal: 'center' }; dRow4.font = { bold: true, name: 'Times New Roman', size: 13 };

        const dRow6 = wsDetail.getRow(6);
        dRow6.getCell(1).value = `${session} Thứ ${sInfo?.day || ''} ngày ${date} (Khối ${sessionGrades})`;
        wsDetail.mergeCells(6, 1, 6, 4);
        dRow6.alignment = { horizontal: 'center' }; dRow6.font = { bold: true, italic: true, name: 'Times New Roman', size: 11 };

        // Detail Table Header
        const dTableHead = wsDetail.getRow(8);
        ['TT', 'Phòng thi', 'Giáo viên coi thi', 'Ghi chú'].forEach((h, i) => {
          const cell = dTableHead.getCell(i + 1);
          cell.value = h;
          cell.font = { bold: true, name: 'Times New Roman', size: 11 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        const extractGradeVal = (r: string) => {
          // Look specifically for the number after "Khối" (e.g. "Phòng 1 - Khối 9" -> 9)
          const gradeMatch = String(r).match(/Khối\s*(\d+)/i);
          if (gradeMatch) return parseInt(gradeMatch[1]);
          
          // Fallback to first number if "Khối" string not found
          const m = String(r).match(/\d+/);
          return m ? parseInt(m[0]) : 999;
        };

        const assigned = invigilationAssignments
          .filter((a: any) => a.sessions[sk] === 'X' && a.roomAssignments?.[sk])
          .map((a: any) => ({ name: a.teacherName, room: a.roomAssignments[sk] }))
          .sort((a: any, b: any) => {
            const gradeA = extractGradeVal(a.room);
            const gradeB = extractGradeVal(b.room);
            if (gradeA !== gradeB) return gradeA - gradeB;
            return a.room.localeCompare(b.room, undefined, { numeric: true, sensitivity: 'base' });
          });

        let dIdx = 9;
        assigned.forEach((asg, i) => {
          const row = wsDetail.getRow(dIdx++);
          row.getCell(1).value = i + 1;
          row.getCell(2).value = asg.room;
          row.getCell(3).value = asg.name;
          row.getCell(4).value = '';
          
          for (let c = 1; c <= 4; c++) {
            const cell = row.getCell(c);
            cell.font = { name: 'Times New Roman', size: 11 };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            if (c === 1 || c === 2) cell.alignment = { horizontal: 'center' };
          }
        });
        
        // Removed CB Section as requested by user


        dIdx += 2;
        wsDetail.getCell(dIdx, 3).value = `${schoolInfo.location}, ngày ${date}`;
        wsDetail.getCell(dIdx, 3).font = { italic: true, name: 'Times New Roman' };
        wsDetail.getCell(dIdx, 3).alignment = { horizontal: 'center' };
        dIdx++;
        wsDetail.getCell(dIdx, 3).value = 'HIỆU TRƯỞNG';
        wsDetail.getCell(dIdx, 3).font = { bold: true, name: 'Times New Roman' };
        wsDetail.getCell(dIdx, 3).alignment = { horizontal: 'center' };
        dIdx += 4;
        wsDetail.getCell(dIdx, 3).value = schoolInfo.principal;
        wsDetail.getCell(dIdx, 3).font = { bold: true, name: 'Times New Roman' };
        wsDetail.getCell(dIdx, 3).alignment = { horizontal: 'center' };
      });

      // ============ SHEET 3: LỊCH TRỰC THƯ KÝ ============
      if (secretariatTeam.length > 0) {
        const wsTK = workbook.addWorksheet('Lịch Thư ký', {
          pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });
        
        // Use similar header as Summary but for TK
        const tkTitleRow = wsTK.getRow(4);
        tkTitleRow.getCell(1).value = `DANH SÁCH GIÁO VIÊN TRỰC THƯ KÝ ${schoolInfo.examName}`;
        wsTK.mergeCells(4, 1, 4, totalCols);
        tkTitleRow.alignment = { horizontal: 'center' };
        tkTitleRow.font = { bold: true, name: 'Times New Roman', size: 14 };

        // Duplicate table header logic for TK
        const tkH7 = wsTK.getRow(7); const tkH8 = wsTK.getRow(8);
        tkH7.getCell(1).value = 'TT'; tkH7.getCell(2).value = 'Họ và tên giáo viên';
        let tkCIdx = 3;
        uniqueDates.forEach(date => {
          const sessions = sessionKeysSorted.filter(k => k.split('|')[0] === date);
          tkH7.getCell(tkCIdx).value = `(${date})`;
          if (sessions.length > 1) wsTK.mergeCells(7, tkCIdx, 7, tkCIdx + sessions.length - 1);
          sessions.forEach((sk, i) => { tkH8.getCell(tkCIdx + i).value = sk.split('|')[1]; });
          tkCIdx += sessions.length;
        });
        tkH7.getCell(tkCIdx).value = 'TỔNG BUỔI';
        wsTK.mergeCells(7, 1, 8, 1); wsTK.mergeCells(7, 2, 8, 2); wsTK.mergeCells(7, tkCIdx, 8, tkCIdx);

        [tkH7, tkH8].forEach(r => {
          r.alignment = { horizontal: 'center', vertical: 'middle' };
          r.font = { bold: true, name: 'Times New Roman', size: 11 };
          r.eachCell(c => c.border = { top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'} });
        });

        let tkCurrRow = 9;
        const tkMembers = invigilationAssignments.filter(a => secretariatTeam.includes(a.teacherName));
        tkMembers.forEach((asg, idx) => {
          const row = wsTK.getRow(tkCurrRow++);
          row.getCell(1).value = idx + 1;
          row.getCell(2).value = asg.teacherName;
          let cIdx = 3;
          sessionKeysSorted.forEach(sk => {
            const val = (asg.sessions as any)[sk];
            const cell = row.getCell(cIdx++);
            cell.value = val === 'TK' ? 'TK' : '';
            cell.alignment = { horizontal: 'center' };
          });
          row.getCell(cIdx).value = Object.values(asg.sessions).filter(v => v === 'TK').length;
          row.eachCell(c => {
             c.font = { name:'Times New Roman', size:11 };
             c.border = { top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'} };
          });
        });

        wsTK.getColumn(1).width = 5; wsTK.getColumn(2).width = 30;
        for (let i = 3; i <= totalCols; i++) wsTK.getColumn(i).width = 10;
      }

      // ============ SHEET 4: TỔ LÀM PHÁCH ============
      if (anonymizationTeam.length > 0) {
        const wsPhach = workbook.addWorksheet('Tổ Làm phách', {
          pageSetup: { paperSize: 9, orientation: 'portrait' }
        });
        wsPhach.getColumn(1).width = 8; wsPhach.getColumn(2).width = 40;

        const pRow4 = wsPhach.getRow(4);
        pRow4.getCell(1).value = `DANH SÁCH TỔ LÀM PHÁCH KIỂM TRA ${schoolInfo.examName}`;
        wsPhach.mergeCells(4, 1, 4, 3);
        pRow4.alignment = { horizontal: 'center' }; pRow4.font = { bold: true, name: 'Times New Roman', size: 14 };

        const pHead = wsPhach.getRow(7);
        ['STT', 'Họ và tên giáo viên', 'Ghi chú'].forEach((h, i) => {
           const cell = pHead.getCell(i+1);
           cell.value = h; cell.font = { bold:true, name:'Times New Roman' };
           cell.alignment = { horizontal:'center' };
           cell.border = { top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'} };
        });

        anonymizationTeam.forEach((t, i) => {
           const row = wsPhach.getRow(8 + i);
           row.getCell(1).value = i + 1;
           row.getCell(2).value = t;
           for (let c = 1; c <= 3; c++) {
              row.getCell(c).font = { name:'Times New Roman', size:11 };
              row.getCell(c).border = { top:{style:'thin'},left:{style:'thin'},bottom:{style:'thin'},right:{style:'thin'} };
           }
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PhanCongCoiThi_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Lỗi xuất Excel: ' + (err?.message || err));
      console.error('Export error:', err);
    } finally {
      setLoading(false);
    }
  };

  const DayOptions = ['2', '3', '4', '5', '6', '7', 'CN'];

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveSubTab('schedule')}
          className={cn(
            "px-6 py-3 font-medium text-sm transition-colors relative",
            activeSubTab === 'schedule' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <div className="flex items-center gap-2">
            <Calendar size={18} /> Lịch thi
          </div>
          {activeSubTab === 'schedule' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
        <button
          onClick={() => setActiveSubTab('config')}
          className={cn(
            "px-6 py-3 font-medium text-sm transition-colors relative",
            activeSubTab === 'config' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <div className="flex items-center gap-2">
            <Briefcase size={18} /> Cấu hình
          </div>
          {activeSubTab === 'config' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
        <button
          onClick={() => setActiveSubTab('assignment')}
          className={cn(
            "px-6 py-3 font-medium text-sm transition-colors relative",
            activeSubTab === 'assignment' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
          )}
        >
          <div className="flex items-center gap-2">
            <FileText size={18} /> Bảng phân công
          </div>
          {activeSubTab === 'assignment' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4 bg-gray-50 rounded-lg border border-gray-200">
        {activeSubTab === 'schedule' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <div className="bg-white p-6 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center gap-4 shadow-sm h-[220px]">
                <Upload className="text-blue-500" size={48} />
                <div className="text-center">
                  <h3 className="font-bold text-lg">Tải lên lịch thi</h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Chọn file Excel chứa các cột: Thứ, Ngày, Buổi, Khối, Môn.
                  </p>
                </div>
                <input 
                  type="file" ref={fileInputRef} onChange={handleScheduleUpload} accept=".xlsx,.xls" className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
                  disabled={loading}
                >
                  {loading ? 'Đang xử lý...' : 'Chọn file Excel'}
                </button>
              </div>

              {/* Manual Entry Form */}
              <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                   <Plus size={18} className="text-green-600" /> Thêm lịch thi thủ công
                </h3>
                <div className="grid grid-cols-2 gap-3">
                   <div>
                     <label className="text-[11px] uppercase font-bold text-gray-500 mb-1 block">Thứ</label>
                     <select value={manualDay} onChange={e => setManualDay(e.target.value)} className="w-full border rounded p-1.5 text-sm">
                        {DayOptions.map(d => <option key={d}>{d}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="text-[11px] uppercase font-bold text-gray-500 mb-1 block">Ngày (VD: 08/05/2026)</label>
                     <input type="text" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full border rounded p-1.5 text-sm" placeholder="DD/MM/YYYY"/>
                   </div>
                   <div>
                     <label className="text-[11px] uppercase font-bold text-gray-500 mb-1 block">Buổi</label>
                     <select value={manualSession} onChange={e => setManualSession(e.target.value as any)} className="w-full border rounded p-1.5 text-sm">
                        <option>Sáng</option>
                        <option>Chiều</option>
                     </select>
                   </div>
                   <div>
                     <label className="text-[11px] uppercase font-bold text-gray-500 mb-1 block">Khối</label>
                     <select value={manualGrade} onChange={e => setManualGrade(e.target.value)} className="w-full border rounded p-1.5 text-sm">
                        <option value="">Chọn khối</option>
                        {grades.map(g => <option key={g}>{g}</option>)}
                     </select>
                   </div>
                   <div className="col-span-2">
                     <label className="text-[11px] uppercase font-bold text-gray-500 mb-1 block">Môn (Gõ hoặc chọn từ danh sách)</label>
                     <input 
                       list="subject-options"
                       value={manualSubject} 
                       onChange={e => setManualSubject(e.target.value)} 
                       className="w-full border rounded p-1.5 text-sm"
                       placeholder="Nhập tên môn..."
                     />
                     <datalist id="subject-options">
                        {subjectColumns.map(s => <option key={s} value={s} />)}
                     </datalist>
                   </div>
                </div>
                <button 
                  onClick={handleManualAddSchedule}
                  className="mt-2 w-full py-2 bg-green-50 text-green-700 border border-green-200 rounded font-bold hover:bg-green-100 transition-colors"
                >Thêm lịch thi</button>
              </div>

              {/* Manual Schedule List View */}
              {examSchedule.length > 0 && (
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-3 flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                       <Calendar size={18} className="text-blue-600" /> Danh sách buổi thi ({examSchedule.length})
                    </h3>
                    <button 
                      onClick={handleClearSchedule}
                      className="text-[10px] text-red-500 font-bold hover:bg-red-50 px-2 py-1 rounded transition-colors"
                    >
                      Xóa tất cả
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto border border-gray-100 rounded">
                    <table className="w-full text-xs">
                       <thead className="bg-gray-50 text-gray-500 font-bold sticky top-0 border-b">
                         <tr>
                           <th className="px-2 py-2 text-left w-8">STT</th>
                           <th className="px-2 py-2 text-left">Chi tiết buổi thi</th>
                           <th className="px-2 py-2 text-right w-24">Thao tác</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y">
                         {examSchedule.map((s, idx) => (
                           <tr key={idx} className="hover:bg-gray-50 group">
                             <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                             <td className="px-2 py-2">
                               <div className="font-bold text-gray-800">Thứ {s.day} ({s.date})</div>
                               <div className="text-gray-500">{s.session} - Khối {s.grade} - {s.subject}</div>
                             </td>
                             <td className="px-2 py-2 text-right">
                               <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                 <button onClick={() => handleMoveSchedule(idx, 'up')} disabled={idx === 0} className="p-1 hover:text-blue-600 disabled:opacity-30">
                                   <Plus size={14} className="rotate-180" />
                                 </button>
                                 <button onClick={() => handleMoveSchedule(idx, 'down')} disabled={idx === examSchedule.length - 1} className="p-1 hover:text-blue-600 disabled:opacity-30">
                                   <Plus size={14} />
                                 </button>
                                 <button onClick={() => handleRemoveSchedule(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                                   <Trash2 size={14} />
                                 </button>
                               </div>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm h-full flex flex-col min-h-[500px]">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center shrink-0">
                <h4 className="font-bold text-gray-700">Lịch thi hệ thống ({examSchedule.length})</h4>
                <button onClick={() => setExamSchedule([])} className="text-red-500 hover:text-red-700">
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-slate-50 p-4">
                <div className="bg-white rounded shadow-md border border-slate-300 p-6 min-w-[700px] mx-auto">
                  <div className="text-center mb-6">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-1">Lịch thi chính thức</h5>
                    <h3 className="text-xl font-black text-slate-800 uppercase tabular-nums">{schoolInfo.examName}</h3>
                    <div className="h-1 w-20 bg-indigo-600 mx-auto mt-2 rounded-full"></div>
                  </div>
                  
                  <table className="w-full border-collapse border border-slate-300">
                    <thead className="bg-slate-100 table-fixed">
                      <tr>
                        <th className="border border-slate-300 px-3 py-3 text-[11px] font-black text-slate-700 uppercase w-[120px]">Ngày tháng</th>
                        <th className="border border-slate-300 px-3 py-3 text-[11px] font-black text-slate-700 uppercase w-[80px]">Buổi</th>
                        {['6', '7', '8', '9'].map(g => (
                          <th key={g} className="border border-slate-300 px-3 py-3 text-[11px] font-black text-slate-700 uppercase">Khối {g}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleMatrix.map((dateRow, dateIdx) => (
                        <React.Fragment key={dateRow.date}>
                          {dateRow.sessions.map((session, sessIdx) => (
                            <tr key={session.name} className="hover:bg-slate-50/50 transition-colors">
                              {sessIdx === 0 && (
                                <td 
                                  rowSpan={dateRow.sessions.length} 
                                  className="border border-slate-300 px-3 py-4 text-center align-middle bg-slate-50/30"
                                >
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Thứ {dateRow.day || ''}</span>
                                    <span className="text-sm font-bold text-indigo-700 tabular-nums">{dateRow.date}</span>
                                  </div>
                                </td>
                              )}
                              <td className={cn(
                                "border border-slate-300 px-2 py-4 text-center font-bold text-[10px] uppercase tracking-wider",
                                session.name === 'Sáng' ? "text-amber-600 bg-amber-50/20" : "text-blue-600 bg-blue-50/20"
                              )}>
                                {session.name}
                              </td>
                              {['6', '7', '8', '9'].map(g => {
                                const subjects = session.grades[g] || [];
                                return (
                                  <td key={g} className="border border-slate-300 px-2 py-3 align-middle text-center min-w-[100px]">
                                    <div className="flex flex-col gap-1">
                                      {subjects.map((s, si) => (
                                        <div key={si} className="text-[11px] font-bold text-slate-700 bg-indigo-50/50 rounded py-1 px-1.5 border border-indigo-100/50">
                                          {s}
                                        </div>
                                      ))}
                                      {subjects.length === 0 && <span className="text-slate-300 font-mono">-</span>}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                      {examSchedule.length === 0 && (
                          <tr><td colSpan={6} className="text-center py-20 text-slate-400 font-medium italic bg-slate-50/10">Vui lòng tải lịch thi hoặc nhập thủ công để xem ma trận...</td></tr>
                      )}
                    </tbody>
                  </table>
                  
                  <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-end opacity-60 italic text-[10px] text-slate-400">
                    <div>* Lịch thi có thể thay đổi tùy theo điều kiện thực tế.</div>
                    <div className="font-bold text-indigo-500 uppercase tracking-widest">{schoolInfo.schoolName}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'config' && (
          <div className="flex flex-col gap-4">
             {/* School Info Config */}
             <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
               <div className="flex items-center gap-2 mb-3">
                 <Settings className="text-indigo-500" size={20} />
                 <h3 className="font-bold text-gray-800">Thông tin trường (dùng cho xuất Excel)</h3>
               </div>
               <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                 <div>
                   <label className="text-xs text-gray-500 font-medium">Cơ quan chủ quản</label>
                   <input 
                     value={schoolInfo.authority} 
                     onChange={e => setSchoolInfo({ ...schoolInfo, authority: e.target.value })}
                     className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-0.5 outline-none focus:border-blue-400"
                     placeholder="UBND PHƯỜNG BÌNH ĐỊNH"
                   />
                 </div>
                 <div>
                   <label className="text-xs text-gray-500 font-medium">Tên trường</label>
                   <input 
                     value={schoolInfo.schoolName} 
                     onChange={e => setSchoolInfo({ ...schoolInfo, schoolName: e.target.value })}
                     className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-0.5 outline-none focus:border-blue-400"
                     placeholder="TRƯỜNG THCS BÌNH ĐỊNH"
                   />
                 </div>
                 <div>
                   <label className="text-xs text-gray-500 font-medium">Kỳ thi</label>
                   <input 
                     value={schoolInfo.examName} 
                     onChange={e => setSchoolInfo({ ...schoolInfo, examName: e.target.value })}
                     className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-0.5 outline-none focus:border-blue-400"
                     placeholder="GIỮA HỌC KỲ II"
                   />
                 </div>
                 <div>
                   <label className="text-xs text-gray-500 font-medium">Năm học</label>
                   <input 
                     value={schoolInfo.schoolYear} 
                     onChange={e => setSchoolInfo({ ...schoolInfo, schoolYear: e.target.value })}
                     className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-0.5 outline-none focus:border-blue-400"
                     placeholder="2025-2026"
                   />
                 </div>
                 <div>
                   <label className="text-xs text-gray-500 font-medium">Địa danh</label>
                   <input 
                     value={schoolInfo.location} 
                     onChange={e => setSchoolInfo({ ...schoolInfo, location: e.target.value })}
                     className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-0.5 outline-none focus:border-blue-400"
                     placeholder="Bình Định"
                   />
                 </div>
                 <div>
                   <label className="text-xs text-gray-500 font-medium">Hiệu trưởng</label>
                   <input 
                     value={schoolInfo.principal} 
                     onChange={e => setSchoolInfo({ ...schoolInfo, principal: e.target.value })}
                     className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm mt-0.5 outline-none focus:border-blue-400"
                     placeholder="Nguyễn Văn A"
                   />
                 </div>
               </div>
             </div>

             <div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-wrap justify-between items-center shadow-sm gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="bg-white border border-gray-300 rounded overflow-hidden flex items-center shadow-sm">
                    <div className="px-3 py-1.5 bg-gray-50 border-r text-[11px] font-bold text-gray-500 uppercase tracking-wider">Số giám thị / phòng</div>
                    <select 
                      value={invigilationConfig.invigilatorsPerRoom}
                      onChange={e => setInvigilationConfig({ ...invigilationConfig, invigilatorsPerRoom: parseInt(e.target.value) })}
                      className="px-3 py-1.5 text-sm font-bold text-blue-700 outline-none focus:bg-blue-50 transition-colors"
                    >
                      <option value="1">1 giám thị / phòng</option>
                      <option value="2">2 giám thị / phòng</option>
                    </select>
                  </div>
                  {/* Backup/Restore Config */}
                  <button 
                    onClick={() => {
                      const configData = { teacherConfig, anonymizationTeam, secretariatTeam, schoolInfo };
                      const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `CauHinh_CoiCham_${new Date().toISOString().slice(0, 10)}.json`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded font-medium text-sm border border-indigo-200 transition-colors"
                  >
                    <Download size={16} /> Sao lưu cấu hình
                  </button>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded font-medium text-sm border border-amber-200 transition-colors cursor-pointer">
                    <Upload size={16} /> Phục hồi cấu hình
                    <input 
                      type="file" accept=".json" className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          try {
                            const data = JSON.parse(ev.target?.result as string);
                            if (data.teacherConfig) setTeacherConfig(data.teacherConfig);
                            if (data.anonymizationTeam) setAnonymizationTeam(data.anonymizationTeam);
                            if (data.secretariatTeam) setSecretariatTeam(data.secretariatTeam);
                            if (data.exemptTeachers) setExemptTeachers(data.exemptTeachers);
                            if (data.secretariatPairs) setSecretariatPairs(data.secretariatPairs);
                            if (data.schoolInfo) setSchoolInfo(data.schoolInfo);
                            alert('Phục hồi cấu hình thành công!');
                          } catch { alert('File không hợp lệ!'); }
                        };
                        reader.readAsText(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={handleSaveConfigToServer} disabled={loading} className="flex items-center gap-2 bg-blue-600 text-white font-medium text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                   <Save size={18}/> {loading ? 'Đang lưu...' : 'Lưu lên hệ thống'}
                 </button>
                 <button 
                  onClick={generateAssignments}
                  className="flex items-center gap-2 py-2 px-4 bg-green-600 text-white rounded font-bold hover:bg-green-700 shadow-md transition-all active:scale-95 disabled:opacity-50"
                  disabled={loading || examSchedule.length === 0}
                >
                  <Play size={18} /> TẠO BẢNG PHÂN CÔNG
                </button>
               </div>
             </div>

            {/* === ROW 1: GV - Môn dạy (2 columns) === */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Config - Chọn GV cho Môn */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col h-[480px]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Briefcase className="text-blue-600" size={20} />
                        <h3 className="font-bold text-gray-800">Cấu hình GV → Môn dạy</h3>
                    </div>
                    <button 
                      onClick={() => {
                        const ws = XLSX.utils.json_to_sheet(teacherConfig.map(c => ({ 'Môn': c.subject, 'Khối': c.grade || 'Tất cả', 'Giáo viên': c.teachers.join(', ') })));
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "CauHinhMon");
                        XLSX.writeFile(wb, "CauHinhGiaoVienMon.xlsx");
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Xuất Excel"
                    >
                      <Download size={16} />
                    </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                    Chọn môn & khối, sau đó tick giáo viên giảng dạy. GV dạy môn thi sẽ được miễn coi để chấm bài buổi kế tiếp.
                </p>
                <div className="flex gap-2 mb-2 shrink-0">
                    <select 
                    value={selectedConfigSubject}
                    onChange={e => setSelectedConfigSubject(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm font-medium"
                    >
                        <option value="">-- Chọn Môn --</option>
                        {subjectColumns.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select 
                    value={selectedConfigGrade}
                    onChange={e => setSelectedConfigGrade(e.target.value)}
                    className="w-32 border border-gray-300 rounded px-2 py-1.5 text-sm font-medium"
                    >
                        <option value="">Tất cả khối</option>
                        {grades.map(g => <option key={g} value={g}>Khối {g}</option>)}
                    </select>
                </div>
                
                <div className="relative mb-2 shrink-0">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                    type="text" placeholder="Tìm giáo viên..." 
                    value={teacherConfigSearch} onChange={e => setTeacherConfigSearch(e.target.value)}
                    className="w-full border border-gray-300 rounded pl-7 pr-3 py-1.5 text-sm"
                    />
                </div>

                {selectedConfigSubject ? (
                    <div className="flex-1 overflow-auto border border-gray-100 rounded">
                        <div className="bg-gray-50 text-[10px] uppercase text-gray-500 font-bold px-3 py-1.5 sticky top-0 border-b border-gray-200">
                            {selectedConfigSubject} {selectedConfigGrade ? `(Khối ${selectedConfigGrade})` : '(Tất cả)'}
                        </div>
                        {teachers.filter(t => t.toLowerCase().includes(teacherConfigSearch.toLowerCase())).map(t => {
                            const isActive = activeSubjectTeachers.includes(t);
                            return (
                            <div 
                                key={t} 
                                onClick={() => handleTeacherSubjectToggle(t)}
                                className={cn(
                                "flex items-center justify-between px-3 py-1.5 border-b last:border-0 cursor-pointer transition-colors",
                                isActive ? "bg-blue-50" : "hover:bg-gray-50"
                                )}
                            >
                                <span className={cn("text-sm", isActive ? "font-bold text-blue-700" : "text-gray-700")}>{t}</span>
                                {isActive ? <CheckCircle2 className="text-blue-600" size={16} /> : <div className="w-[16px] border-gray-300 border rounded-sm h-[16px]" />}
                            </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center border border-gray-100 rounded bg-gray-50">
                        <p className="text-gray-400 text-sm">Chọn môn để bắt đầu cấu hình</p>
                    </div>
                )}
                </div>

                {/* Right: View - Danh sách GV đã cấu hình */}
                <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm flex flex-col h-[480px]">
                <div className="flex items-center gap-2 mb-3">
                    <Search className="text-blue-500" size={20} />
                    <h3 className="font-bold text-gray-800">Theo dõi GV - Môn dạy</h3>
                </div>
                <p className="text-xs text-gray-400 mb-3">Tổng hợp tất cả GV đã cấu hình theo từng Môn/Khối.</p>
                <div className="flex-1 overflow-auto border border-gray-100 rounded">
                  {teacherConfig.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">Chưa có cấu hình nào</div>
                  ) : (
                    teacherConfig
                      .filter(cfg => {
                        const matchesSubject = !selectedConfigSubject || cfg.subject === selectedConfigSubject;
                        const matchesGrade = !selectedConfigGrade || cfg.grade === selectedConfigGrade;
                        return matchesSubject && matchesGrade;
                      })
                      .map((cfg, idx) => (
                      <div key={idx} className="border-b last:border-0">
                        <div className="bg-blue-50 text-[10px] uppercase text-blue-600 font-bold px-3 py-1.5 flex justify-between items-center sticky top-0">
                          <span>{cfg.subject} {cfg.grade ? `- Khối ${cfg.grade}` : '(Tất cả khối)'}</span>
                          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[9px]">{cfg.teachers.length} GV</span>
                        </div>
                        {cfg.teachers.map(t => (
                          <div key={t} className="px-3 py-1.5 text-sm text-gray-700 border-b border-gray-50 last:border-0 flex items-center gap-1.5">
                            <CheckCircle2 className="text-blue-400" size={14} /> {t}
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
                </div>
            </div>

            {/* === ROW 2: Tổ làm phách (2 columns) === */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Config - Chọn GV làm phách */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col h-[420px]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Users className="text-purple-600" size={20} />
                        <h3 className="font-bold text-gray-800">Tổ làm phách</h3>
                    </div>
                    <button 
                      onClick={() => {
                        const ws = XLSX.utils.json_to_sheet(anonymizationTeam.map((t, idx) => ({ 'TT': idx + 1, 'Họ tên': t })));
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "LamPhach");
                        XLSX.writeFile(wb, "DanhSachToLamPhach.xlsx");
                      }}
                      className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors" title="Xuất Excel"
                    >
                      <Download size={16} />
                    </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                    GV trong tổ phách sẽ <strong>không coi thi</strong> trong toàn bộ kì thi để tập trung làm phách.
                </p>
                <div className="relative mb-2 shrink-0">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                    type="text" placeholder="Tìm giáo viên..." 
                    value={anonymizationSearch} onChange={e => setAnonymizationSearch(e.target.value)}
                    className="w-full border border-gray-300 rounded pl-7 pr-3 py-1.5 text-sm"
                    />
                </div>
                <div className="flex-1 overflow-auto border border-gray-100 rounded">
                    <div className="bg-gray-50 text-[10px] uppercase text-gray-500 font-bold px-3 py-1.5 sticky top-0 border-b border-gray-200 flex justify-between">
                        <span>Tất cả giáo viên</span>
                        <span className="text-purple-600 font-bold">{anonymizationTeam.length} đã chọn</span>
                    </div>
                    {teachers.filter(t => t.toLowerCase().includes(anonymizationSearch.toLowerCase())).map(t => {
                        const isTeam = anonymizationTeam.includes(t);
                        return (
                        <div 
                            key={t} 
                            onClick={() => toggleTeamMember(t)}
                            className={cn(
                            "flex items-center justify-between px-3 py-1.5 border-b last:border-0 cursor-pointer transition-colors",
                            isTeam ? "bg-purple-50" : "hover:bg-gray-50"
                            )}
                        >
                            <span className={cn("text-sm", isTeam ? "font-bold text-purple-700" : "text-gray-700")}>{t}</span>
                            {isTeam ? <CheckCircle2 className="text-purple-600" size={16} /> : <div className="w-[16px] border-gray-300 border rounded-full h-[16px]" />}
                        </div>
                        )
                    })}
                </div>
                </div>

                {/* Right: View - Danh sách tổ phách đã chọn */}
                <div className="bg-white p-4 rounded-lg border border-purple-100 shadow-sm flex flex-col h-[420px]">
                <div className="flex items-center gap-2 mb-3">
                    <Users className="text-purple-500" size={20} />
                    <h3 className="font-bold text-gray-800">Danh sách Tổ Phách ({anonymizationTeam.length} GV)</h3>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                    Các giáo viên được miễn coi thi, chuyên trách làm phách.
                </p>
                <div className="flex-1 overflow-auto border border-gray-100 rounded">
                  {anonymizationTeam.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">Chưa chọn giáo viên nào</div>
                  ) : (
                    anonymizationTeam.map((t, idx) => (
                      <div key={t} className="flex items-center gap-2 px-3 py-2 border-b last:border-0 hover:bg-purple-50 transition-colors">
                        <span className="text-xs text-purple-400 font-bold w-6 text-right">{idx + 1}.</span>
                        <CheckCircle2 className="text-purple-500" size={14} />
                        <span className="text-sm font-medium text-gray-800">{t}</span>
                      </div>
                    ))
                  )}
                </div>
                </div>
            </div>

            {/* === ROW 3: Tổ thư ký (2 columns) === */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left: Config - Chọn GV thư ký */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col h-[420px]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <User className="text-amber-600" size={20} />
                        <h3 className="font-bold text-gray-800">Tổ thư ký</h3>
                    </div>
                    <button 
                      onClick={() => {
                        const ws = XLSX.utils.json_to_sheet(secretariatTeam.map((t, idx) => ({ 'TT': idx + 1, 'Họ tên': t })));
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, "ThuKy");
                        XLSX.writeFile(wb, "DanhSachToThuKy.xlsx");
                      }}
                      className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Xuất Excel"
                    >
                      <Download size={16} />
                    </button>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                    GV thư ký sẽ <strong>không coi thi</strong>. Ký hiệu "TK" trên bảng phân công.
                </p>
                <div className="relative mb-2 shrink-0">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input 
                    type="text" placeholder="Tìm giáo viên..." 
                    value={secretariatSearch} onChange={e => setSecretariatSearch(e.target.value)}
                    className="w-full border border-gray-300 rounded pl-7 pr-3 py-1.5 text-sm"
                    />
                </div>
                <div className="flex-1 overflow-auto border border-gray-100 rounded">
                    <div className="bg-gray-50 text-[10px] uppercase text-gray-500 font-bold px-3 py-1.5 sticky top-0 border-b border-gray-200 flex justify-between">
                        <span>Tất cả giáo viên</span>
                        <span className="text-amber-600 font-bold">{secretariatTeam.length} đã chọn</span>
                    </div>
                    {teachers.filter(t => t.toLowerCase().includes(secretariatSearch.toLowerCase())).map(t => {
                        const isTeam = secretariatTeam.includes(t);
                        return (
                        <div 
                            key={t} 
                            onClick={() => toggleSecretariatMember(t)}
                            className={cn(
                            "flex items-center justify-between px-3 py-1.5 border-b last:border-0 cursor-pointer transition-colors",
                            isTeam ? "bg-amber-50" : "hover:bg-gray-50"
                            )}
                        >
                            <span className={cn("text-sm", isTeam ? "font-bold text-amber-700" : "text-gray-700")}>{t}</span>
                            {isTeam ? <CheckCircle2 className="text-amber-600" size={16} /> : <div className="w-[16px] border-gray-300 border rounded-full h-[16px]" />}
                        </div>
                        )
                    })}
                </div>
                </div>

                {/* Right: View - Danh sách thư ký & Ghép cặp */}
                <div className="bg-white p-4 rounded-lg border border-amber-100 shadow-sm flex flex-col h-[420px]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <User className="text-amber-500" size={20} />
                        <h3 className="font-bold text-gray-800">Cặp Thư ký ({secretariatPairs.length})</h3>
                    </div>
                    <button 
                      onClick={() => setSecretariatPairs([])}
                      className="text-[10px] text-red-500 font-bold hover:underline"
                    >
                      Xóa tất cả cặp
                    </button>
                </div>
                <p className="text-[10px] text-amber-600 mb-2 font-medium bg-amber-50 p-1.5 rounded">
                  Cách ghép cặp: Sau khi chọn tổ thư ký bên trái, nhấn vào 2 tên bất kì trong danh sách dưới đây để tạo thành 1 cặp trực cùng nhau.
                </p>
                <div className="flex-1 overflow-auto border border-gray-100 rounded">
                  {secretariatTeam.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm">Chưa chọn giáo viên thư ký nào</div>
                  ) : (
                    <div className="p-2 flex flex-col gap-2">
                      {/* Current Pairs */}
                      {secretariatPairs.map((pair, pIdx) => (
                        <div key={pIdx} className="bg-amber-50 border border-amber-200 rounded p-2 flex justify-between items-center">
                          <div className="flex items-center gap-2 flex-1">
                             <div className="bg-amber-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0">{pIdx+1}</div>
                             <div className="text-xs font-bold text-amber-900 truncate">{pair[0]} & {pair[1]}</div>
                          </div>
                          <button onClick={() => setSecretariatPairs(secretariatPairs.filter((_, idx) => idx !== pIdx))} className="text-red-400 hover:text-red-600 ml-2">
                             <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {/* Unpaired Members */}
                      <div className="mt-2 border-t pt-2">
                        <p className="text-[10px] font-bold text-gray-400 mb-1 uppercase">GV Thư ký chưa ghép cặp:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {secretariatTeam.filter(t => !secretariatPairs.some(p => p[0] === t || p[1] === t)).map(t => (
                            <button 
                              key={t}
                              onClick={() => togglePairSelection(t)}
                              className={cn(
                                "px-2 py-1 rounded text-xs border transition-all",
                                pairingSelection.includes(t) ? "bg-amber-600 border-amber-600 text-white shadow-md animate-pulse" : "bg-white border-gray-200 text-gray-700 hover:border-amber-400"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
            </div>

            {/* === ROW 4: Miễn tham gia (2 columns) === */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                <div className="bg-white p-4 rounded-lg border border-red-100 shadow-sm flex flex-col h-[400px]">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="text-red-600" size={20} />
                            <h3 className="font-bold text-gray-800">Giáo viên Miễn tham gia</h3>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">Những giáo viên này sẽ không được phân bất kỳ nhiệm vụ nào (Coi, Chấm, Thư ký, Phách).</p>
                    <div className="relative mb-2 shrink-0">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                            type="text" placeholder="Tìm giáo viên..." 
                            value={exemptSearch} onChange={e => setExemptSearch(e.target.value)}
                            className="w-full border border-gray-300 rounded pl-7 pr-3 py-1.5 text-sm"
                        />
                    </div>
                    <div className="flex-1 overflow-auto border border-gray-100 rounded">
                        {teachers.filter(t => t.toLowerCase().includes(exemptSearch.toLowerCase())).map(t => {
                            const isExempt = exemptTeachers.includes(t);
                            return (
                                <div key={t} onClick={() => toggleExemptMember(t)} className={cn("flex items-center justify-between px-3 py-1.5 border-b last:border-0 cursor-pointer", isExempt ? "bg-red-50" : "hover:bg-gray-50")}>
                                    <span className={cn("text-sm", isExempt ? "font-bold text-red-700" : "text-gray-700")}>{t}</span>
                                    {isExempt ? <CheckCircle2 className="text-red-500" size={16} /> : <div className="w-[16px] border-gray-300 border rounded-full h-[16px]" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-red-50 shadow-sm flex flex-col h-[400px]">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-400" /> Danh sách Miễn ({exemptTeachers.length})
                    </h3>
                    <div className="flex-1 overflow-auto border border-gray-100 rounded bg-gray-50/30 p-2">
                        {exemptTeachers.length === 0 ? <p className="text-center text-gray-400 text-sm mt-10">Chưa chọn giáo viên nào</p> : 
                            exemptTeachers.map(t => <span key={t} className="inline-block bg-white border border-red-200 text-red-700 text-xs px-2 py-1 rounded m-1 shadow-sm">{t}</span>)
                        }
                    </div>
                </div>

                {/* Card: Môn chấm tập trung */}
                <div className="bg-white p-4 rounded-lg border border-indigo-100 shadow-sm flex flex-col h-[480px]">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className="text-indigo-600" size={20} />
                        <h3 className="font-bold text-gray-800">Môn chấm tập trung</h3>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                        Tick chọn các môn sẽ được chấm tập trung tại trường. Chỉ các môn này mới được gán "CB" (miễn coi thi buổi sau).
                    </p>
                    <div className="flex-1 overflow-auto border border-gray-100 rounded">
                        <div className="bg-gray-50 text-[10px] uppercase text-gray-500 font-bold px-3 py-1.5 sticky top-0 border-b border-gray-200 flex justify-between">
                            <span>Tất cả môn</span>
                            <span className="text-indigo-600 font-bold">{markingSubjects.length} đã chọn</span>
                        </div>
                        {subjectColumns.map(s => {
                            const isMarking = markingSubjects.includes(s);
                            return (
                                <div 
                                    key={s} 
                                    onClick={() => {
                                        if (isMarking) setMarkingSubjects(markingSubjects.filter(sub => sub !== s));
                                        else setMarkingSubjects([...markingSubjects, s]);
                                    }}
                                    className={cn(
                                        "flex items-center justify-between px-3 py-1.5 border-b last:border-0 cursor-pointer transition-colors",
                                        isMarking ? "bg-indigo-50" : "hover:bg-gray-50"
                                    )}
                                >
                                    <span className={cn("text-sm", isMarking ? "font-bold text-indigo-700" : "text-gray-700")}>{s}</span>
                                    {isMarking ? <CheckCircle2 className="text-indigo-600" size={16} /> : <div className="w-[16px] border-gray-300 border rounded-sm h-[16px]" />}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

          </div>
        )}

        {activeSubTab === 'assignment' && (
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800">Ma trận phân công coi thi</h3>
              <div className="flex gap-2">
                <button 
                  onClick={handleExportMarkingSchedule}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors font-medium text-sm shadow-sm"
                >
                  <FileText size={18} /> Lịch chấm thi
                </button>
                <button 
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors font-medium text-sm shadow-sm"
                >
                  <Download size={18} /> Phân công Coi
                </button>
                <button 
                  onClick={() => setInvigilationAssignments([])}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 transition-colors font-medium text-sm shadow-sm"
                >
                  <Trash2 size={18} /> Xóa sạch
                </button>
              </div>
            </div>

            {/* Matrix Overview */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm flex flex-col flex-1 max-h-[500px]">
              <div className="overflow-auto flex-1">
                <table className="w-full text-[11px] border-collapse min-w-[max-content]">
                  <thead className="bg-gray-100 text-gray-500 font-bold sticky top-0 z-10">
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-3 text-left border-r sticky left-0 bg-gray-100 z-20 w-[40px]" rowSpan={2}>TT</th>
                      <th className="px-3 py-3 text-left border-r sticky left-[40px] bg-gray-100 z-20 w-[180px]" rowSpan={2}>Họ và tên GV</th>
                      {(Array.from(new Set(sortedSessionKeys.map(k => k.split('|')[0]))) as string[]).map((date) => {
                         const colsForDate = sortedSessionKeys.filter(k => k.split('|')[0] === date).length;
                         const sInfo = examSchedule.find(s => s.date === date);
                         return (
                            <th key={date} className="px-2 py-2 text-center border-r border-b" colSpan={colsForDate}>
                                {sInfo?.day || ''} ({date})
                            </th>
                         )
                      })}
                      <th className="px-3 py-3 text-center z-10" rowSpan={2}>SỐ BUỔI</th>
                    </tr>
                    <tr className="border-b border-gray-200">
                      {sortedSessionKeys.map((sk: string) => (
                        <th key={sk} className="px-2 py-1 text-center border-r min-w-[90px]">
                           {sk.split('|')[1]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invigilationAssignments.map((a: any, i: number) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-1.5 text-gray-400 border-r sticky left-0 bg-white z-0">{i + 1}</td>
                        <td className="px-3 py-1.5 font-medium text-gray-900 border-r sticky left-[40px] bg-white z-0 text-xs">{a.teacherName}</td>
                        {sortedSessionKeys.map((sk: string) => {
                           const val = (a.sessions as any)?.[sk];
                           const room = (a.roomAssignments as any)?.[sk];
                           return (
                             <td key={sk} className={cn(
                               "px-1 py-1.5 text-center border-r text-[10px]",
                               val === 'X' ? "text-blue-700 font-bold" : 
                               val === 'CB' ? "text-orange-500 italic bg-orange-50" : 
                               val === 'TK' ? "text-amber-600 font-bold bg-amber-50" : ""
                             )}>
                               {val === 'X' && room ? room : val === 'CB' ? 'CB' : val === 'TK' ? 'TK' : ''}
                             </td>
                           )
                        })}
                        <td className="px-3 py-1.5 font-bold text-center text-blue-800">{a.total}</td>
                      </tr>
                    ))}
                    {invigilationAssignments.length === 0 && (
                      <tr>
                        <td colSpan={sortedSessionKeys.length + 3} className="px-4 py-20 text-center text-gray-400 italic">
                          <div className="flex flex-col items-center gap-2">
                            <AlertCircle size={48} />
                            <p className="text-lg">Chưa có dữ liệu phân công.</p>
                            <p className="text-sm">Hãy cấu hình lịch thi và nhấn "TẠO BẢNG PHÂN CÔNG" ở tab Cấu hình.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed Per-Session Room Assignment */}
            {invigilationAssignments.length > 0 && (
              <div>
                <h3 className="font-bold text-lg text-gray-800 mb-3">Chi tiết phân công theo buổi</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {sortedSessionKeys.map((sk: string) => {
                    const [date, session] = sk.split('|');
                    const sInfo = examSchedule.find(s => s.date === date);
                    const sessionExams = examSchedule.filter(s => s.date === date && s.session === session);
                    const subjects = sessionExams.map(e => `${e.subject} (K${e.grade})`).join(', ');
                    
                    // Get teachers assigned to this session with rooms
                    const assigned = invigilationAssignments
                      .filter((a: any) => a.sessions[sk] === 'X' && a.roomAssignments?.[sk])
                      .map((a: any) => ({ name: a.teacherName, room: a.roomAssignments[sk] }))
                      .sort((a: any, b: any) => a.room.localeCompare(b.room));
                    
                    // Get CB teachers
                    const cbTeachers = invigilationAssignments
                      .filter((a: any) => a.sessions[sk] === 'CB')
                      .map((a: any) => a.teacherName);

                    return (
                      <div key={sk} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <div className={cn(
                          "px-4 py-2 font-bold text-sm flex justify-between items-center",
                          session === 'Sáng' ? "bg-amber-50 text-amber-800 border-b border-amber-200" : "bg-blue-50 text-blue-800 border-b border-blue-200"
                        )}>
                          <span>{session} - Thứ {sInfo?.day || ''} ({date})</span>
                          <span className="text-xs font-normal">{subjects}</span>
                        </div>
                        <div className="p-3">
                          <div className="text-[10px] uppercase text-gray-500 font-bold mb-2 flex justify-between">
                            <span>Giám thị: {assigned.length} GV</span>
                            {cbTeachers.length > 0 && <span className="text-orange-500">Chấm bài: {cbTeachers.length} GV</span>}
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[10px] uppercase text-gray-400 border-b">
                                <th className="text-left py-1 w-8">TT</th>
                                <th className="text-left py-1">Phòng</th>
                                <th className="text-left py-1">Giáo viên coi thi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {assigned.map((a: any, idx: number) => (
                                <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                  <td className="py-1 text-gray-400 text-xs">{idx + 1}</td>
                                  <td className="py-1 font-medium text-blue-700 text-xs">{a.room}</td>
                                  <td className="py-1 text-gray-800 text-xs">{a.name}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {cbTeachers.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <span className="text-[10px] uppercase text-orange-500 font-bold">Chấm bài: </span>
                              <span className="text-xs text-gray-600">{cbTeachers.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
