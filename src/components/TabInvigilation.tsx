import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAppContext } from '../store';
import { saveToGas } from '../lib/gas';
import { Upload, Save, Download, Search, Trash2, Calendar, Users, User, Briefcase, Play, FileText, CheckCircle2, AlertCircle, Plus, Settings, LayoutGrid, UserMinus, BookOpen, X } from 'lucide-react';
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
  const [activeSubTab, setActiveSubTab] = useState<'schedule' | 'anonymization' | 'secretariat' | 'experts' | 'exempt' | 'matrix' | 'settings'>('schedule');
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
  const uniqueDates = useMemo(() => {
    return (Array.from(new Set(examSchedule.map(s => s.date))) as string[]).sort((a, b) => {
      const parseDate = (d: string) => {
        const parts = d.split('/');
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
      };
      return parseDate(a) - parseDate(b);
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
    <div className="flex h-full overflow-hidden bg-[var(--color-bg-main)] font-manrope">
      {/* Sub-Sidebar */}
      <div className="w-[280px] border-r border-gray-100 flex flex-col bg-white shrink-0 shadow-[4px_0_20px_-10px_rgba(0,0,0,0.05)] z-10">
        <div className="p-6 border-b border-gray-50 bg-slate-50/30">
          <h3 className="text-xs font-extrabold text-[var(--color-text-heading)] uppercase tracking-[0.2em] opacity-60 flex items-center gap-2">
            <LayoutGrid size={14} className="text-[var(--color-primary)]" /> Coi & Chấm thi
          </h3>
        </div>
        
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Section: Planning */}
          <div>
            <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Lập kế hoạch</p>
            <div className="space-y-1">
              <button
                onClick={() => setActiveSubTab('schedule')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-sm",
                  activeSubTab === 'schedule' 
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]" 
                    : "text-[var(--color-text-body)] hover:bg-slate-50 hover:text-[var(--color-text-heading)]"
                )}
              >
                <Calendar size={18} />
                <span>Lịch thi</span>
              </button>
              <button
                onClick={() => setActiveSubTab('settings')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-sm",
                  activeSubTab === 'settings' 
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]" 
                    : "text-[var(--color-text-body)] hover:bg-slate-50 hover:text-[var(--color-text-heading)]"
                )}
              >
                <Settings size={18} />
                <span>Thiết lập chung</span>
              </button>
            </div>
          </div>

          {/* Section: Resources */}
          <div>
            <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Nguồn lực</p>
            <div className="space-y-1">
              <button
                onClick={() => setActiveSubTab('anonymization')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-sm",
                  activeSubTab === 'anonymization' 
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)] shadow-sm" 
                    : "text-[var(--color-text-body)] hover:bg-slate-50 hover:text-[var(--color-text-heading)]"
                )}
              >
                <div className={cn("p-1.5 rounded-lg transition-colors", activeSubTab === 'anonymization' ? "bg-white" : "bg-gray-50")}>
                  <LayoutGrid size={16} />
                </div>
                <span>Tổ Làm phách</span>
              </button>
              <button
                onClick={() => setActiveSubTab('secretariat')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-sm",
                  activeSubTab === 'secretariat' 
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)] shadow-sm" 
                    : "text-[var(--color-text-body)] hover:bg-slate-50 hover:text-[var(--color-text-heading)]"
                )}
              >
                <div className={cn("p-1.5 rounded-lg transition-colors", activeSubTab === 'secretariat' ? "bg-white" : "bg-gray-50")}>
                  <Users size={16} />
                </div>
                <span>Tổ Thư ký</span>
              </button>
              <button
                onClick={() => setActiveSubTab('experts')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-sm",
                  activeSubTab === 'experts' 
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]" 
                    : "text-[var(--color-text-body)] hover:bg-slate-50 hover:text-[var(--color-text-heading)]"
                )}
              >
                <BookOpen size={18} />
                <span>GV & Chuyên môn</span>
              </button>
              <button
                onClick={() => setActiveSubTab('exempt')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-sm",
                  activeSubTab === 'exempt' 
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]" 
                    : "text-[var(--color-text-body)] hover:bg-slate-50 hover:text-[var(--color-text-heading)]"
                )}
              >
                <UserMinus size={18} />
                <span>Danh sách Miễn</span>
              </button>
            </div>
          </div>

          {/* Section: Execution */}
          <div>
            <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Thực hiện</p>
            <div className="space-y-1">
              <button
                onClick={() => setActiveSubTab('matrix')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-sm",
                  activeSubTab === 'matrix' 
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]" 
                    : "text-[var(--color-text-body)] hover:bg-slate-50 hover:text-[var(--color-text-heading)]"
                )}
              >
                <FileText size={18} />
                <span>Kết quả Phân công</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: Info & Sync */}
        <div className="p-4 border-t border-gray-50 bg-slate-50/20 space-y-3">
          <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
             <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
               <span>Lịch thi</span>
               <span className={cn(examSchedule.length > 0 ? "text-green-500" : "text-amber-500")}>
                 {examSchedule.length > 0 ? 'Đã tải' : 'Trống'}
               </span>
             </div>
             <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
               <div 
                 className={cn("h-full transition-all duration-500", examSchedule.length > 0 ? "bg-green-500 w-full" : "bg-amber-500 w-1/4")}
               />
             </div>
          </div>
          <button 
            onClick={handleSaveConfigToServer}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-primary)] text-white rounded-xl transition-all active:scale-95 font-bold text-sm hover:bg-[var(--color-primary-hover)] shadow-lg shadow-indigo-200"
          >
            <Save size={16} /> 
            {loading ? 'Đang đồng bộ...' : 'Đồng bộ Dữ liệu'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-[var(--color-bg-main)] p-6 lg:p-10">
        
        {/* TAB: SCHEDULE */}
        {activeSubTab === 'schedule' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="space-y-8">
                {/* Upload Card */}
                <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl p-8 flex flex-col items-center justify-center gap-6 text-center border-dashed border-gray-300">
                  <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-inner">
                    <Upload size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-text-heading mb-2">Tải lên lịch thi</h3>
                    <p className="text-sm text-text-body opacity-60">Chọn file Excel (.xlsx) chứa các cột: Thứ, Ngày, Buổi, Khối, Môn.</p>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleScheduleUpload} accept=".xlsx,.xls" className="hidden" />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-xl transition-all active:scale-95 font-bold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200"
                    disabled={loading}
                  >
                    {loading ? 'Đang xử lý...' : 'Chọn file từ máy tính'}
                  </button>
                </div>

                {/* Manual Form Card */}
                <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl p-8">
                  <h3 className="text-lg font-extrabold text-text-heading mb-6 flex items-center gap-3">
                    <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Plus size={20} /></div>
                    Thêm lịch thi thủ công
                  </h3>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-extrabold text-text-body uppercase tracking-widest opacity-60">Thứ</label>
                      <select value={manualDay} onChange={e => setManualDay(e.target.value)} className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-all">
                        {['2','3','4','5','6','7','CN'].map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-extrabold text-text-body uppercase tracking-widest opacity-60">Ngày thi</label>
                       <input type="text" value={manualDate} onChange={e => setManualDate(e.target.value)} className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-all" placeholder="VD: 08/05/2026"/>
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-extrabold text-text-body uppercase tracking-widest opacity-60">Buổi</label>
                       <select value={manualSession} onChange={e => setManualSession(e.target.value as any)} className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-all">
                          <option>Sáng</option><option>Chiều</option>
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-extrabold text-text-body uppercase tracking-widest opacity-60">Khối</label>
                       <select value={manualGrade} onChange={e => setManualGrade(e.target.value)} className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-all">
                          <option value="">Chọn khối</option>
                          {['6','7','8','9'].map(g => <option key={g}>{g}</option>)}
                       </select>
                    </div>
                    <div className="col-span-2 space-y-2">
                       <label className="text-xs font-extrabold text-text-body uppercase tracking-widest opacity-60">Môn thi</label>
                       <input list="subject-options" value={manualSubject} onChange={e => setManualSubject(e.target.value)} className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-green-500 transition-all" placeholder="Nhập hoặc chọn môn..."/>
                    </div>
                  </div>
                  <button onClick={handleManualAddSchedule} className="w-full mt-8 py-4 bg-green-50 text-green-700 rounded-xl font-extrabold text-sm border border-green-200 hover:bg-green-100 transition-all active:scale-95 uppercase tracking-widest">
                    Thêm vào danh sách
                  </button>
                </div>
              </div>

              {/* Matrix Card */}
              <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl overflow-hidden flex flex-col min-h-[600px]">
                <div className="px-8 py-6 bg-slate-50 border-b border-gray-100 flex justify-between items-center">
                  <h4 className="text-lg font-extrabold text-text-heading">Ma trận lịch thi</h4>
                  <button onClick={() => setExamSchedule([])} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Xóa tất cả">
                    <Trash2 size={20} />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-8">
                  <div className="min-w-[500px]">
                    <div className="text-center mb-10">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Lịch thi chính thức</h5>
                      <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{schoolInfo.examName || '---'}</h3>
                      <div className="h-1.5 w-16 bg-[var(--color-primary)] mx-auto mt-4 rounded-full"></div>
                    </div>
                    
                    <table className="w-full border-separate border-spacing-0 border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-r border-slate-100">Thời gian</th>
                          <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-r border-slate-100">Buổi</th>
                          {['6', '7', '8', '9'].map(g => (
                            <th key={g} className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">Khối {g}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleMatrix.map((dateRow, dateIdx) => (
                          <React.Fragment key={dateRow.date}>
                            {dateRow.sessions.map((session, sessIdx) => (
                              <tr key={session.name} className="group hover:bg-slate-50 transition-colors">
                                {sessIdx === 0 && (
                                  <td rowSpan={dateRow.sessions.length} className="px-4 py-6 text-center align-middle border-b border-r border-slate-50 bg-slate-50/20">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Thứ {dateRow.day}</span>
                                      <span className="text-sm font-black text-[var(--color-primary)]">{dateRow.date}</span>
                                    </div>
                                  </td>
                                )}
                                <td className={cn(
                                  "px-4 py-4 text-center font-black text-[10px] uppercase tracking-widest border-b border-r border-slate-50",
                                  session.name === 'Sáng' ? "text-amber-500" : "text-blue-500"
                                )}>
                                  {session.name}
                                </td>
                                {['6', '7', '8', '9'].map(g => {
                                  const subjects = session.grades[g] || [];
                                  return (
                                    <td key={g} className="px-3 py-4 border-b border-slate-50 align-middle">
                                      <div className="flex flex-col gap-1.5">
                                        {subjects.map((s, si) => (
                                          <div key={si} className="text-[11px] font-bold text-slate-700 bg-[var(--color-primary-light)]/30 rounded-lg py-1.5 px-2.5 border border-[var(--color-primary-light)]/50 text-center">
                                            {s}
                                          </div>
                                        ))}
                                        {subjects.length === 0 && <span className="text-slate-200 text-center">-</span>}
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                        {examSchedule.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-24 text-slate-300 font-bold italic">Vui lòng tải hoặc thêm lịch thi...</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ANONYMIZATION (LÀM PHÁCH) */}
        {activeSubTab === 'anonymization' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-6 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-text-heading mb-1 uppercase tracking-tight">Tổ Làm phách</h2>
                <p className="text-sm text-text-body opacity-60">Thành viên tổ làm phách sẽ được miễn toàn bộ lịch coi thi.</p>
              </div>
              <span className="px-4 py-2 bg-purple-50 text-purple-700 rounded-2xl text-xs font-black uppercase shadow-sm border border-purple-100">
                {anonymizationTeam.length} Giáo viên
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
              {/* Left Column: Selection */}
              <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl flex flex-col min-h-0 overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-slate-50/30">
                  <h3 className="text-sm font-black text-text-heading mb-4 uppercase tracking-wider flex items-center gap-2">
                    <Search size={16} className="text-primary" /> Chọn thành viên
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" placeholder="Tìm tên giáo viên..." 
                      value={anonymizationSearch} onChange={e => setAnonymizationSearch(e.target.value)}
                      className="w-full bg-white border border-gray-100 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-1 custom-scrollbar">
                  {teachers
                    .filter(t => t.toLowerCase().includes(anonymizationSearch.toLowerCase()) && !anonymizationTeam.includes(t))
                    .map(t => (
                      <div 
                        key={t} onClick={() => toggleTeamMember(t)}
                        className="group flex items-center justify-between px-5 py-4 rounded-xl cursor-pointer transition-all hover:bg-slate-50 border border-transparent hover:border-gray-100"
                      >
                        <span className="font-bold text-sm text-text-body group-hover:text-primary transition-colors">{t}</span>
                        <div className="w-8 h-8 bg-gray-50 text-gray-400 rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                          <Plus size={16} />
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Right Column: Currently Selected */}
              <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl flex flex-col min-h-0 overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-slate-50/30 flex items-center justify-between">
                  <h3 className="text-sm font-black text-text-heading uppercase tracking-wider flex items-center gap-2">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><LayoutGrid size={16} /></div>
                    Danh sách đã chọn
                  </h3>
                  {anonymizationTeam.length > 0 && (
                    <button onClick={() => setAnonymizationTeam([])} className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline">Xóa hết</button>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-1 custom-scrollbar">
                  {anonymizationTeam.map((t, idx) => (
                    <div 
                      key={t}
                      className="flex items-center justify-between px-5 py-4 rounded-xl bg-purple-50/50 border border-purple-100/50 group animate-in slide-in-from-right-4 duration-300"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <span className="font-bold text-sm text-purple-900">{t}</span>
                      <button 
                        onClick={() => toggleTeamMember(t)}
                        className="w-8 h-8 flex items-center justify-center text-purple-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {anonymizationTeam.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-4 py-20">
                      <LayoutGrid size={48} />
                      <p className="text-sm font-bold uppercase tracking-widest">Chưa có thành viên nào</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: SECRETARIAT (TỔ THƯ KÝ) */}
        {activeSubTab === 'secretariat' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-6 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-text-heading mb-1 uppercase tracking-tight">Tổ Thư ký</h2>
                <p className="text-sm text-text-body opacity-60">Thành viên tổ thư ký sẽ được miễn coi thi và gán ký hiệu TK vào lịch trực.</p>
              </div>
              <span className="px-4 py-2 bg-amber-50 text-amber-700 rounded-2xl text-xs font-black uppercase shadow-sm border border-amber-100">
                {secretariatTeam.length} Giáo viên
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
              {/* Left Column: Selection */}
              <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl flex flex-col min-h-0 overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-slate-50/30">
                  <h3 className="text-sm font-black text-text-heading mb-4 uppercase tracking-wider flex items-center gap-2">
                    <Search size={16} className="text-primary" /> Chọn thư ký
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" placeholder="Tìm tên giáo viên..." 
                      value={secretariatSearch} onChange={e => setSecretariatSearch(e.target.value)}
                      className="w-full bg-white border border-gray-100 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-1 custom-scrollbar">
                  {teachers
                    .filter(t => t.toLowerCase().includes(secretariatSearch.toLowerCase()) && !secretariatTeam.includes(t))
                    .map(t => (
                      <div 
                        key={t} onClick={() => toggleSecretariatMember(t)}
                        className="group flex items-center justify-between px-5 py-4 rounded-xl cursor-pointer transition-all hover:bg-slate-50 border border-transparent hover:border-gray-100"
                      >
                        <span className="font-bold text-sm text-text-body group-hover:text-primary transition-colors">{t}</span>
                        <div className="w-8 h-8 bg-gray-50 text-gray-400 rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                          <Plus size={16} />
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Right Column: Currently Selected & Pairs */}
              <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl flex flex-col min-h-0 overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-slate-50/30 flex items-center justify-between">
                  <h3 className="text-sm font-black text-text-heading uppercase tracking-wider flex items-center gap-2">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Users size={16} /></div>
                    Danh sách đã chọn
                  </h3>
                  {secretariatTeam.length > 0 && (
                    <button onClick={() => setSecretariatTeam([])} className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline">Xóa hết</button>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-1 custom-scrollbar">
                  {secretariatTeam.map((t, idx) => (
                    <div 
                      key={t}
                      className="flex items-center justify-between px-5 py-4 rounded-xl bg-amber-50/50 border border-amber-100/50 group animate-in slide-in-from-right-4 duration-300"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <span className="font-bold text-sm text-amber-900">{t}</span>
                      <button 
                        onClick={() => toggleSecretariatMember(t)}
                        className="w-8 h-8 flex items-center justify-center text-amber-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {secretariatTeam.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-4 py-20">
                      <Users size={48} />
                      <p className="text-sm font-bold uppercase tracking-widest">Chưa có thành viên nào</p>
                    </div>
                  )}

                  {/* Pairs Section Integration */}
                  {secretariatTeam.length > 0 && (
                    <div className="mt-8 mx-2 p-6 bg-slate-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h4 className="text-sm font-black text-text-heading uppercase tracking-widest">Ghép cặp trực ({secretariatPairs.length})</h4>
                          <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Chọn 2 người để tạo 1 cặp trực</p>
                        </div>
                        {secretariatPairs.length > 0 && (
                          <button onClick={() => setSecretariatPairs([])} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-6">
                        {secretariatTeam.filter(t => !secretariatPairs.some(p => p[0] === t || p[1] === t)).map(t => (
                          <button 
                            key={t} onClick={() => togglePairSelection(t)}
                            className={cn(
                              "px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all border shadow-sm",
                              pairingSelection.includes(t) 
                                ? "bg-amber-600 border-amber-600 text-white shadow-amber-200 animate-pulse" 
                                : "bg-white border-gray-200 text-text-body hover:border-amber-400 hover:shadow-md"
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {secretariatPairs.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-amber-100 shadow-sm animate-in zoom-in duration-300">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span className="text-xs font-black text-amber-900 tracking-tight">{p[0]} + {p[1]}</span>
                            </div>
                            <button onClick={() => setSecretariatPairs(secretariatPairs.filter((_, i) => i !== idx))} className="p-1.5 text-amber-200 hover:text-rose-500 transition-colors"><X size={12} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* TAB: EXPERTS */}
        {/* TAB: EXPERTS (CHUYÊN MÔN) */}
        {activeSubTab === 'experts' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-6 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-text-heading mb-1 uppercase tracking-tight">Chuyên môn & Chấm thi</h2>
                <p className="text-sm text-text-body opacity-60">Gán giáo viên vào bộ môn để hệ thống tự động miễn coi thi buổi kế tiếp khi môn đó thi.</p>
              </div>
            </div>

            {/* Selection Controls */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Môn học</label>
                <select 
                  value={selectedConfigSubject} onChange={e => setSelectedConfigSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-sm"
                >
                  <option value="">-- Chọn Môn học --</option>
                  {subjectColumns.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Khối lớp (Tùy chọn)</label>
                <select 
                  value={selectedConfigGrade} onChange={e => setSelectedConfigGrade(e.target.value)}
                  className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-sm"
                >
                  <option value="">-- Tất cả khối --</option>
                  {['6','7','8','9'].map(g => <option key={g} value={g}>Khối {g}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-0">
              {/* Left Column: Selection */}
              <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl flex flex-col min-h-0 overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-slate-50/30">
                  <h3 className="text-sm font-black text-text-heading mb-4 uppercase tracking-wider flex items-center gap-2">
                    <Search size={16} className="text-primary" /> Danh sách chờ
                  </h3>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                      type="text" placeholder="Tìm giáo viên..." 
                      value={teacherConfigSearch} onChange={e => setTeacherConfigSearch(e.target.value)}
                      className="w-full bg-white border border-gray-100 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-1 custom-scrollbar">
                  {!selectedConfigSubject ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-4 py-20 px-10">
                      <Briefcase size={48} />
                      <p className="text-sm font-bold uppercase tracking-widest">Vui lòng chọn môn học trước</p>
                    </div>
                  ) : (
                    teachers
                      .filter(t => t.toLowerCase().includes(teacherConfigSearch.toLowerCase()) && !activeSubjectTeachers.includes(t))
                      .map(t => (
                        <div 
                          key={t} onClick={() => handleTeacherSubjectToggle(t)}
                          className="group flex items-center justify-between px-5 py-4 rounded-xl cursor-pointer transition-all hover:bg-slate-50 border border-transparent hover:border-gray-100"
                        >
                          <span className="font-bold text-sm text-text-body group-hover:text-primary transition-colors">{t}</span>
                          <div className="w-8 h-8 bg-gray-50 text-gray-400 rounded-lg flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                            <Plus size={16} />
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Right Column: Currently Assigned */}
              <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl flex flex-col min-h-0 overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-slate-50/30 flex items-center justify-between">
                  <h3 className="text-sm font-black text-text-heading uppercase tracking-wider flex items-center gap-2">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Briefcase size={16} /></div>
                    Đã phân công chuyên môn
                  </h3>
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-tighter">
                    {activeSubjectTeachers.length} GV
                  </span>
                </div>
                <div className="flex-1 overflow-auto p-4 space-y-1 custom-scrollbar">
                  {activeSubjectTeachers.map((t, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between px-5 py-4 rounded-xl bg-blue-50/50 border border-blue-100/50 group animate-in slide-in-from-right-4 duration-300"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <span className="font-bold text-sm text-blue-900">{t}</span>
                      <button 
                        onClick={() => handleTeacherSubjectToggle(t)}
                        className="w-8 h-8 flex items-center justify-center text-blue-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {activeSubjectTeachers.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-4 py-20 px-10">
                      <BookOpen size={48} />
                      <p className="text-sm font-bold uppercase tracking-widest">Chưa có giáo viên chuyên môn</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* TAB: EXEMPT */}
        {activeSubTab === 'exempt' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl p-12 flex flex-col items-center max-w-4xl mx-auto">
                <div className="w-20 h-20 bg-red-100 text-red-500 rounded-3xl flex items-center justify-center mb-8 shadow-inner">
                   <UserMinus size={40} />
                </div>
                <h2 className="text-2xl font-black text-text-heading mb-3 text-center">Danh sách Giáo viên Miễn nhiệm vụ</h2>
                <p className="text-sm text-text-body opacity-60 text-center max-w-md mb-12">Những người được tick trong danh sách này sẽ không được gán bất kỳ nhiệm vụ nào trong kỳ thi này.</p>
                
                <div className="w-full flex gap-10">
                   <div className="flex-1 flex flex-col h-[500px]">
                      <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                          type="text" placeholder="Tìm kiếm giáo viên..." 
                          value={exemptSearch} onChange={e => setExemptSearch(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-100 rounded-xl pl-12 pr-4 py-4 text-sm font-bold focus:bg-white focus:border-red-500 transition-all outline-none shadow-sm"
                        />
                      </div>
                      <div className="flex-1 overflow-auto pr-4 custom-scrollbar space-y-1">
                        {teachers.filter(t => t.toLowerCase().includes(exemptSearch.toLowerCase())).map(t => {
                          const isExempt = exemptTeachers.includes(t);
                          return (
                            <div 
                              key={t} onClick={() => toggleExemptMember(t)}
                              className={cn(
                                "group flex items-center justify-between px-6 py-4 rounded-2xl cursor-pointer transition-all",
                                isExempt ? "bg-red-50 text-red-700" : "hover:bg-slate-50 text-text-body"
                              )}
                            >
                              <span className="font-bold text-sm">{t}</span>
                              {isExempt ? <CheckCircle2 className="text-red-600" size={24} /> : <div className="w-6 h-6 border-2 border-gray-200 rounded-full group-hover:border-red-300 transition-colors" />}
                            </div>
                          )
                        })}
                      </div>
                   </div>
                   
                   <div className="w-[320px] bg-slate-50 border border-gray-100 rounded-3xl p-8 flex flex-col border-dashed">
                      <div className="flex items-center justify-between mb-8">
                         <h4 className="text-xs font-black text-text-heading uppercase tracking-widest">Đã miễn ({exemptTeachers.length})</h4>
                         <button onClick={() => setExemptTeachers([])} className="text-xs font-bold text-red-500 hover:underline">Hủy tất cả</button>
                      </div>
                      <div className="flex-1 overflow-auto flex flex-wrap gap-2 content-start">
                         {exemptTeachers.map(t => (
                           <span key={t} className="bg-white border border-red-100 text-red-700 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm">{t}</span>
                         ))}
                         {exemptTeachers.length === 0 && <div className="w-full h-full flex items-center justify-center text-gray-300 italic text-sm">Trống</div>}
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* TAB: SETTINGS */}
        {activeSubTab === 'settings' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
            <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl p-10">
               <div className="flex items-center gap-4 mb-10">
                  <div className="p-4 bg-slate-100 text-slate-700 rounded-2xl shadow-inner"><Settings size={28} /></div>
                  <div>
                    <h2 className="text-2xl font-black text-text-heading">Thiết lập chung Hội đồng</h2>
                    <p className="text-sm text-text-body opacity-60">Các thông số cốt lõi để vận hành hệ thống Coi & Chấm thi.</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                 {/* Basic Info Group */}
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-[var(--color-primary)] uppercase tracking-[0.3em] mb-4">Thông tin hành chính</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-text-body opacity-60">Cơ quan chủ quản</label>
                        <input value={schoolInfo.authority} onChange={e => setSchoolInfo({...schoolInfo, authority: e.target.value})} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-3.5 text-sm font-bold focus:bg-white focus:border-[var(--color-primary)] transition-all outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-text-body opacity-60">Tên đơn vị (Trường)</label>
                        <input value={schoolInfo.schoolName} onChange={e => setSchoolInfo({...schoolInfo, schoolName: e.target.value})} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-3.5 text-sm font-bold focus:bg-white focus:border-[var(--color-primary)] transition-all outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-text-body opacity-60">Tên Kỳ kiểm tra</label>
                        <input value={schoolInfo.examName} onChange={e => setSchoolInfo({...schoolInfo, examName: e.target.value})} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-3.5 text-sm font-bold focus:bg-white focus:border-[var(--color-primary)] transition-all outline-none" />
                      </div>
                    </div>
                 </div>

                 {/* Advanced Rules Group */}
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-[var(--color-primary)] uppercase tracking-[0.3em] mb-4">Quy tắc & Nhân sự</h4>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-text-body opacity-60">Định mức Giám thị</label>
                        <select 
                          value={invigilationConfig.invigilatorsPerRoom}
                          onChange={e => setInvigilationConfig({ ...invigilationConfig, invigilatorsPerRoom: parseInt(e.target.value) })}
                          className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-3.5 text-sm font-black text-blue-600 focus:bg-white focus:border-[var(--color-primary)] transition-all outline-none appearance-none"
                        >
                          <option value="1">01 Giám thị / phòng</option>
                          <option value="2">02 Giám thị / phòng (Khuyên dùng)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-text-body opacity-60">Năm học</label>
                        <input value={schoolInfo.schoolYear} onChange={e => setSchoolInfo({...schoolInfo, schoolYear: e.target.value})} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-3.5 text-sm font-bold focus:bg-white focus:border-[var(--color-primary)] transition-all outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-text-body opacity-60">Hiệu trưởng</label>
                        <input value={schoolInfo.principal} onChange={e => setSchoolInfo({...schoolInfo, principal: e.target.value})} className="w-full bg-slate-50 border border-gray-100 rounded-xl px-4 py-3.5 text-sm font-bold focus:bg-white focus:border-[var(--color-primary)] transition-all outline-none" />
                      </div>
                    </div>
                 </div>
               </div>

               <div className="mt-16 pt-10 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex gap-4">
                    <button 
                      onClick={() => {
                        const data = { teacherConfig, anonymizationTeam, secretariatTeam, schoolInfo, invigilationConfig, markingSubjects, exemptTeachers };
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `Full_Backup_${new Date().toISOString().slice(0, 10)}.json`;
                        link.click();
                      }}
                      className="flex items-center gap-2 px-6 py-4 bg-slate-50 text-text-heading border border-gray-200 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all shadow-sm"
                    >
                      <Download size={20} /> Sao lưu toàn bộ
                    </button>
                  </div>
                  
                  <button 
                    onClick={generateAssignments}
                    disabled={loading || examSchedule.length === 0}
                    className="flex items-center gap-3 px-10 py-5 bg-[var(--color-primary)] text-white rounded-2xl font-black text-sm hover:bg-[var(--color-primary-hover)] shadow-2xl shadow-indigo-200 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest"
                  >
                    <Play size={20} /> Bắt đầu Phân công Tự động
                  </button>
               </div>
            </div>
          </div>
        )}

        {/* TAB: MATRIX (RESULTS) */}
        {activeSubTab === 'matrix' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between border-b border-gray-100 pb-8">
              <div>
                <h2 className="text-3xl font-black text-text-heading mb-2">Bảng tổng hợp Phân công</h2>
                <p className="text-sm text-text-body opacity-60">Tổng cộng {invigilationAssignments.length} giáo viên tham gia hội đồng.</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={handleExportMarkingSchedule}
                  className="flex items-center gap-2.5 px-6 py-4 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-2xl font-bold text-sm hover:bg-indigo-100 transition-all shadow-sm"
                >
                  <FileText size={20} /> Xuất Lịch Chấm
                </button>
                <button 
                  onClick={handleExportExcel}
                  className="flex items-center gap-2.5 px-6 py-4 bg-blue-50 text-blue-700 border border-blue-100 rounded-2xl font-bold text-sm hover:bg-blue-100 transition-all shadow-sm"
                >
                  <Download size={20} /> Xuất Bảng Coi
                </button>
                <button 
                  onClick={() => { if(window.confirm('Xóa sạch kết quả?')) setInvigilationAssignments([]) }}
                  className="p-4 bg-red-50 text-red-500 rounded-2xl hover:bg-red-100 transition-all"
                >
                  <Trash2 size={24} />
                </button>
              </div>
            </div>

            {/* The Big Matrix Table */}
            <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-[32px] overflow-hidden flex flex-col">
              <div className="overflow-auto custom-scrollbar max-h-[700px]">
                <table className="w-full text-xs border-separate border-spacing-0">
                  <thead className="bg-slate-50 sticky top-0 z-20">
                    <tr>
                      <th className="px-6 py-5 text-left border-b border-r border-slate-100 font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-30" rowSpan={2}>TT</th>
                      <th className="px-6 py-5 text-left border-b border-r border-slate-100 font-black text-slate-400 uppercase tracking-widest sticky left-14 bg-slate-50 z-30 min-w-[200px]" rowSpan={2}>Họ và tên</th>
                      {uniqueDates.map(date => {
                         const cols = sortedSessionKeys.filter(k => k.split('|')[0] === date).length;
                         const sInfo = examSchedule.find(s => s.date === date);
                         return (
                            <th key={date} className="px-4 py-3 text-center border-b border-r border-slate-100 font-black text-slate-700 text-[10px] uppercase tracking-widest bg-slate-100/50" colSpan={cols}>
                                {sInfo?.day ? 'T' + sInfo.day : ''} ({date})
                            </th>
                         )
                      })}
                      <th className="px-6 py-5 text-center border-b border-slate-100 font-black text-[var(--color-primary)] uppercase tracking-widest bg-[var(--color-primary-light)]/20" rowSpan={2}>Tổng</th>
                    </tr>
                    <tr>
                       {sortedSessionKeys.map(sk => (
                          <th key={sk} className="px-3 py-4 text-center border-b border-r border-slate-100 font-black text-[10px] text-slate-500 uppercase tracking-tighter bg-slate-50/80">
                             {sk.split('|')[1]}
                          </th>
                       ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {invigilationAssignments.map((a: any, i: number) => (
                      <tr key={i} className="group hover:bg-indigo-50/30 transition-colors">
                        <td className="px-6 py-4 text-slate-400 font-bold border-b border-r border-slate-50 sticky left-0 bg-white group-hover:bg-indigo-50/30 font-mono text-[10px]">{(i+1).toString().padStart(2,'0')}</td>
                        <td className="px-6 py-4 font-black text-slate-800 border-b border-r border-slate-50 sticky left-14 bg-white group-hover:bg-indigo-50/30 text-sm whitespace-nowrap">{a.teacherName}</td>
                        {sortedSessionKeys.map(sk => {
                          const val = a.sessions[sk];
                          const room = a.roomAssignments?.[sk];
                          return (
                            <td key={sk} className={cn(
                              "px-2 py-4 text-center border-b border-r border-slate-50 text-[10px] font-black leading-tight",
                              val === 'X' ? "bg-blue-50/30 text-blue-700" : 
                              val === 'CB' ? "bg-orange-50/50 text-orange-600 italic" : 
                              val === 'TK' ? "bg-amber-50 text-amber-600" : ""
                            )}>
                              {val === 'X' ? (
                                <div className="flex flex-col gap-0.5">
                                   <span className="text-blue-400 text-[8px] uppercase">{val}</span>
                                   <span className="truncate max-w-[80px]">{room}</span>
                                </div>
                              ) : val}
                            </td>
                          )
                        })}
                        <td className="px-6 py-4 font-black text-center text-blue-800 bg-slate-50/30 border-b border-slate-50 text-sm">{a.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Secondary: Session details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12 pb-12">
               {sortedSessionKeys.slice(0, 4).map(sk => {
                  const [date, sess] = sk.split('|');
                  const assigned = invigilationAssignments.filter((a:any) => a.sessions[sk] === 'X');
                  return (
                    <div key={sk} className="bg-white border border-gray-100 shadow-sm rounded-3xl p-8">
                       <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center gap-3">
                           <div className={cn("w-1.5 h-10 rounded-full", sess === 'Sáng' ? "bg-amber-500" : "bg-blue-500")} />
                           <div>
                             <h4 className="font-extrabold text-slate-800">{sess} - {date}</h4>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{assigned.length} Giám thị</p>
                           </div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                          {assigned.map((a:any) => (
                             <div key={a.teacherName} className="flex items-center justify-between bg-slate-50/50 px-4 py-3 rounded-xl border border-slate-100">
                                <span className="text-xs font-bold text-slate-700 truncate">{a.teacherName}</span>
                                <span className="text-[10px] font-black text-slate-400">{a.roomAssignments[sk]}</span>
                             </div>
                          ))}
                       </div>
                    </div>
                  )
               })}
               {sortedSessionKeys.length > 4 && (
                 <div className="lg:col-span-2 text-center p-10 bg-slate-50 border border-dashed border-slate-200 rounded-3xl text-sm font-bold text-slate-500">
                    Và còn {sortedSessionKeys.length - 4} buổi thi khác... Hãy xuất Excel để xem đầy đủ chi tiết.
                 </div>
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
