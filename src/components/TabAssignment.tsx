import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import * as pdfMakeLib from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { useAppContext } from '../store';
import { saveToGas, loadFromGas } from '../lib/gas';
import { Upload, Save, Download, Search, Trash2, AlertTriangle, Palette, RefreshCw, AlertCircle, CheckCircle2, XCircle, FileText, User, Calendar, FileUp, FileDown } from 'lucide-react';
import { cn, formatPhoneNumber } from '../lib/utils';
import { downloadTeacherTemplate, downloadRoomTemplate } from '../lib/templates';

const pdfMake = (pdfMakeLib as any).default || pdfMakeLib;
const vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs || (window as any).pdfMake?.vfs;
if (vfs && pdfMake) {
  pdfMake.vfs = vfs;
}

const COLORS = [
  '#FFC0CB', '#ADD8E6', '#90EE90', '#FFD700',
  '#FFA07A', '#DDA0DD', '#87CEEB', '#FFB6C1',
  '#E6E6FA', '#FFE4B5'
];

interface Props {
  onBackup?: () => void;
  onRestore?: () => void;
  onReset?: () => void;
}

export const TabAssignment: React.FC<Props> = ({ onBackup, onRestore, onReset }) => {
  const {
    roomData, setRoomData,
    assignmentData, setAssignmentData,
    subjectColumns, setSubjectColumns,
    markingSubjects, setMarkingSubjects,
    teachers, setTeachers,
    teacherList, setTeacherList,
    gasUrl, currentFile, setCurrentFile,
    role, setMergedData
  } = useAppContext();

  const [loading, setLoading] = useState(false);
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [teacher, setTeacher] = useState('');
  const [packages, setPackages] = useState('');
  const [packageSearch, setPackageSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [sidePanelType, setSidePanelType] = useState<'room' | 'teacher' | null>(null);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [missingTasks, setMissingTasks] = useState<any[]>([]);
  const [dialog, setDialog] = useState<{ title: string; message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const teacherInputRef = useRef<HTMLInputElement>(null);
  const roomInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = role === 'admin';

  const getRowKey = (row: any, index?: number) => {
    if (!row) return `empty-${index ?? 'unknown'}`;
    if (row.id) return row.id;
    const base = `${row.grade || ''}|${row.subject || ''}|${row.teacher || ''}|${row.package || ''}|${row.stt || ''}|${row.room || ''}`;
    if (base === '|||||') return `row-${index ?? 'unknown'}`;
    return base;
  };

  const grades = useMemo(() => {
    const gSet = new Set<string>();
    roomData.forEach(r => {
      const room = String(r.room || '').toLowerCase();
      if (room.includes('khối')) {
        gSet.add(room.split('khối').pop()?.trim() || '');
      }
    });
    return Array.from(gSet).sort();
  }, [roomData]);

  const syncData = async (orig: any[], assign: any[], action: 'sync' | 'append' | 'updateStatus' | 'delete' = 'sync', specificData?: any[]) => {
    if (!gasUrl) return;
    setIsSyncing(true);
    try {
      // If specificData is provided, use it for the action, otherwise use the full assign list
      const dataToSync = specificData || assign;
      const payload: any = { assignmentData: dataToSync };

      // Only send roomData/teacherList for full sync to avoid unnecessary overwrites
      if (action === 'sync') {
        payload.roomData = roomData;
        payload.teacherList = teacherList;
      }

      return await saveToGas(gasUrl, payload, action);
    } catch (error) {
      console.error(`Auto-sync failed for action ${action}`, error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTeacherUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

      const newTeacherList = json.map((row: any) => {
        const nameKey = Object.keys(row).find(k => ['họ và tên', 'giáo viên', 'tên', 'name'].includes(k.toLowerCase().trim()));
        const phoneKey = Object.keys(row).find(k => ['số điện thoại', 'sđt', 'điện thoại', 'phone'].includes(k.toLowerCase().trim()));

        let phone = String(row[phoneKey || ''] || '').trim().replace(/^'/, '');

        return {
          name: String(row[nameKey || ''] || '').trim(),
          phone: phone
        };
      }).filter(t => t.name);

      if (newTeacherList.length === 0) throw new Error("File Excel GV không có dữ liệu hợp lệ!");

      setTeacherList(newTeacherList);
      setTeachers(newTeacherList.map(t => t.name).sort());

      alert(`Đã tải ${newTeacherList.length} giáo viên.`);
    } catch (error: any) {
      alert(`Lỗi: ${error.message}`);
    } finally {
      setLoading(false);
      if (teacherInputRef.current) teacherInputRef.current.value = '';
    }
  };

  const handleRoomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

      if (json.length === 0) throw new Error("File Excel Phòng không có dữ liệu!");

      const firstRow = json[0] as any;
      const roomKey = Object.keys(firstRow).find(k => k.trim().toLowerCase() === 'phòng - khối');
      const sttKey = Object.keys(firstRow).find(k => k.trim().toLowerCase() === 'stt');

      if (!roomKey) throw new Error("Thiếu cột 'Phòng - Khối'!");

      const newRoomData = json.map((row: any) => {
        const r: any = {
          stt: String(row[sttKey || 'stt'] || '').trim(),
          room: String(row[roomKey]).trim(),
        };
        // Add all other keys as subject columns
        Object.keys(row).forEach(k => {
          if (k !== roomKey && k !== sttKey) r[k] = String(row[k]).trim();
        });
        return r;
      });

      setRoomData(newRoomData);

      // Extract subjects
      const subjects = Object.keys(firstRow).filter(k => {
        const l = k.toLowerCase().trim();
        if (!l || l === '' || l.includes('empty') || l.startsWith('_')) return false;
        return !['stt', 'phòng - khối'].includes(l);
      });
      setSubjectColumns(subjects);
      setMarkingSubjects(subjects); // Lưu danh sách môn học vào cấu hình hệ thống

      alert(`Đã tải ${newRoomData.length} phòng.`);
    } catch (error: any) {
      alert(`Lỗi: ${error.message}`);
    } finally {
      setLoading(false);
      if (roomInputRef.current) roomInputRef.current.value = '';
    }
  };

  const handleLoadFromGas = async () => {
    if (!gasUrl) {
      alert("Vui lòng cấu hình GAS URL trước!");
      return;
    }
    try {
      setLoading(true);
      const data = await loadFromGas(gasUrl);
      if (data.teacherList) {
        setTeacherList(data.teacherList);
        setTeachers(data.teacherList.map((t: any) => t.name).sort());
      }
      if (data.roomData && data.roomData.length > 0) {
        setRoomData(data.roomData);
        const allKeys = Object.keys(data.roomData[0]);
        const cols = allKeys.filter(k => {
          const l = k.toLowerCase().trim();
          if (!l || l === '' || l.includes('empty') || l.startsWith('_')) return false;
          return !['stt', 'room'].includes(l);
        });
        setSubjectColumns(cols);
      }
      if (data.assignmentData) {
        setAssignmentData(data.assignmentData);
      }
      if (data.mergedData) {
        setMergedData(data.mergedData);
      }

      alert("Đã tải dữ liệu từ Google Sheets thành công!");
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToGas = async () => {
    if (!gasUrl) {
      alert("Vui lòng cấu hình GAS URL trước!");
      return;
    }
    try {
      setLoading(true);
      await saveToGas(gasUrl, {
        roomData,
        teacherList,
        assignmentData
      });
      alert("Đã lưu dữ liệu lên Google Sheets thành công!");
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (row: any, newStatus: string) => {
    const newData = assignmentData.map(a => {
      if (getRowKey(a) === getRowKey(row)) {
        return { ...a, status: newStatus };
      }
      return a;
    });
    setAssignmentData(newData);
    // Use updateStatus action with just the changed row
    syncData(roomData, newData, 'updateStatus', [{ ...row, status: newStatus }]);
  };

  const handleBulkStatusChange = (newStatus: string) => {
    if (selectedRows.size === 0) {
      alert("Vui lòng chọn ít nhất một dòng!");
      return;
    }
    const newData = assignmentData.map(a => {
      if (selectedRows.has(getRowKey(a))) {
        return { ...a, status: newStatus };
      }
      return a;
    });
    setAssignmentData(newData);
    // Use updateStatus action with only the affected rows
    const affectedRows = assignmentData.filter(a => selectedRows.has(getRowKey(a))).map(a => ({ ...a, status: newStatus }));
    syncData(roomData, newData, 'updateStatus', affectedRows);
    setSelectedRows(new Set());
  };

  const handleSyncAllStatus = async () => {
    if (!gasUrl) {
      alert("Vui lòng cấu hình GAS URL trước!");
      return;
    }
    try {
      setLoading(true);
      await syncData(roomData, assignmentData, 'updateStatus', assignmentData);
      alert("Đã cập nhật tất cả trạng thái lên Google Sheets thành công!");
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!grade || !subject || !teacher || !packages) {
      setDialog({
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn và nhập đầy đủ thông tin:\n- Khối\n- Môn\n- Giáo viên\n- Mã túi',
        type: 'warning'
      });
      return;
    }

    if (!teachers.includes(teacher)) {
      setDialog({
        title: 'Lỗi',
        message: 'Không tồn tại giáo viên trong danh sách. Vui lòng chọn đúng tên giáo viên.',
        type: 'error'
      });
      return;
    }

    setLoading(true);
    try {
      const pkgsList = packages.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);

      // Match grade exactly
      const rows = roomData.filter(r => {
        const room = String(r.room || '').toLowerCase();
        if (!room.includes('khối')) return false;
        const g = room.split('khối').pop()?.trim() || '';
        return g === grade.toLowerCase();
      });

      const matches: any[] = [];
      const notFoundPkgs: string[] = [];

      pkgsList.forEach(p => {
        let found = false;
        rows.forEach(r => {
          const cellValue = r[subject];
          if (cellValue !== undefined && cellValue !== null && cellValue !== "") {
            const rPkgs = String(cellValue).split(',').map(pkg => pkg.trim().toUpperCase());
            if (rPkgs.includes(p)) {
              matches.push({
                pkg: p,
                stt: r.stt || '999',
                room: r.room || ''
              });
              found = true;
            }
          }
        });
        if (!found) notFoundPkgs.push(p);
      });

      if (matches.length === 0) {
        setDialog({
          title: 'Không thể phân công',
          message: `Các túi không tồn tại trong dữ liệu gốc: ${notFoundPkgs.join(', ')}`,
          type: 'error'
        });
        setLoading(false);
        return;
      }

      matches.sort((a, b) => {
        const numA = parseFloat(String(a.stt).replace('.', ''));
        const numB = parseFloat(String(b.stt).replace('.', ''));
        return (isNaN(numA) ? 999 : numA) - (isNaN(numB) ? 999 : numB);
      });

      // Get color for teacher
      const existingTeacher = assignmentData.find(a => a.teacher === teacher);
      const color = existingTeacher?.color || COLORS[assignmentData.length % COLORS.length];

      // Get phone for teacher from teacherList
      let phone = '';
      const tInfo = teacherList.find(t => String(t.name).trim() === teacher);
      if (tInfo) {
        phone = tInfo.phone;
      }

      if (!phone) {
        const existingTeacher = assignmentData.find(a => a.teacher === teacher);
        phone = existingTeacher?.phone || '';
      }

      const newAssignments = matches.map(m => ({
        grade,
        subject,
        teacher,
        phone,
        package: m.pkg,
        stt: String(m.stt).endsWith('.0') ? String(m.stt).slice(0, -2) : String(m.stt),
        room: m.room,
        color,
        timestamp: new Date().toLocaleString('vi-VN'),
        status: 'Chưa',
        id: `${grade}-${subject}-${m.pkg}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      }));

      // Send directly to GAS
      const response = await syncData(roomData, [...assignmentData, ...newAssignments], 'append', newAssignments);

      // Reload data from server to get the absolute truth
      const latestData = await loadFromGas(gasUrl);
      setAssignmentData(latestData.assignmentData || []);

      setPackages('');

      let msg = response?.message || `Đã gửi yêu cầu phân công ${matches.length} túi.`;
      if (notFoundPkgs.length > 0) {
        msg += `\n\nLưu ý: Các túi không tồn tại trong dữ liệu gốc: ${notFoundPkgs.join(', ')}`;
      }

      setDialog({
        title: response?.status === 'partial' ? 'Phân công một phần' : 'Kết quả',
        message: msg,
        type: response?.status === 'partial' ? 'warning' : 'success'
      });

    } catch (error: any) {
      setDialog({
        title: 'Lỗi hệ thống',
        message: 'Không thể lưu phân công. Vui lòng thử lại.\n' + error.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedRows.size === 0) return;

    if (!showConfirmDelete) {
      setShowConfirmDelete(true);
      setTimeout(() => setShowConfirmDelete(false), 3000);
      return;
    }

    const newData = assignmentData.filter(row => !selectedRows.has(getRowKey(row)));
    setAssignmentData(newData);
    setSelectedRows(new Set());
    setShowConfirmDelete(false);
    // Use delete action with only the deleted rows
    const deletedRows = assignmentData.filter(row => selectedRows.has(getRowKey(row)));
    syncData(roomData, newData, 'delete', deletedRows);
  };

  const handleColorize = () => {
    const teacherColorMap: Record<string, string> = {};
    let colorIdx = 0;

    const newData = assignmentData.map(row => {
      if (!teacherColorMap[row.teacher]) {
        teacherColorMap[row.teacher] = COLORS[colorIdx % COLORS.length];
        colorIdx++;
      }
      return { ...row, color: teacherColorMap[row.teacher] };
    });

    setAssignmentData(newData);
    syncData(roomData, newData);
  };

  const handleCheckMissing = () => {
    if (roomData.length === 0) {
      setDialog({ title: "Thông báo", message: "Chưa có dữ liệu gốc (DS Phòng). Vui lòng tải file trước!", type: "warning" });
      return;
    }

    const normalizeStr = (s: any) => String(s || '').trim().toLowerCase();
    const requiredTasksMap = new Map<string, any>();

    roomData.forEach(r => {
      const roomRaw = String(r.room || '');
      let g = '';
      if (roomRaw.toLowerCase().includes('khối')) {
        g = roomRaw.toLowerCase().split('khối').pop()?.trim() || '';
      }

      subjectColumns.forEach(sub => {
        const cellValue = r[sub];
        if (cellValue && String(cellValue).trim()) {
          const pkgs = String(cellValue).split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
          pkgs.forEach(pkg => {
            const key = `${normalizeStr(g)}|${normalizeStr(sub)}|${normalizeStr(roomRaw)}|${pkg}`;
            requiredTasksMap.set(key, { grade: g, subject: sub, room: roomRaw, pkg });
          });
        }
      });
    });

    const completedTasksSet = new Set<string>();
    assignmentData.forEach(item => {
      const key = `${normalizeStr(item.grade)}|${normalizeStr(item.subject)}|${normalizeStr(item.room)}|${String(item.package).toUpperCase().trim()}`;
      completedTasksSet.add(key);
    });

    let missing = Array.from(requiredTasksMap.entries())
      .filter(([key]) => !completedTasksSet.has(key))
      .map(([_, val]) => val);

    // Filter by selected grade and subject if they are selected
    if (filterGrade) {
      missing = missing.filter(t => normalizeStr(t.grade) === normalizeStr(filterGrade));
    }
    if (filterSubject) {
      missing = missing.filter(t => normalizeStr(t.subject) === normalizeStr(filterSubject));
    }

    // Sort: Grade, Subject, Room, Package
    missing.sort((a, b) => {
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
      if (a.room !== b.room) return a.room.localeCompare(b.room);
      return a.pkg.localeCompare(b.pkg);
    });

    setMissingTasks(missing);
    setShowMissingModal(true);

    if (missing.length === 0) {
      setDialog({
        title: "Hoàn tất",
        message: "Tuyệt vời! Tất cả các túi thi đã được phân công đầy đủ dựa theo bộ lọc hiện tại.",
        type: "success"
      });
    }
  };

  const handleExportMissing = () => {
    if (roomData.length === 0) {
      alert("Chưa có dữ liệu gốc (DS Phòng). Vui lòng tải file trước!");
      return;
    }

    const normalizeStr = (s: any) => String(s || '').trim().toLowerCase();
    const requiredTasksMap = new Map<string, any>();

    roomData.forEach(r => {
      const roomRaw = String(r.room || '');
      let g = '';
      if (roomRaw.toLowerCase().includes('khối')) {
        g = roomRaw.toLowerCase().split('khối').pop()?.trim() || '';
      }

      subjectColumns.forEach(sub => {
        const cellValue = r[sub];
        if (cellValue && String(cellValue).trim()) {
          const pkgs = String(cellValue).split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
          pkgs.forEach(pkg => {
            const key = `${normalizeStr(g)}|${normalizeStr(sub)}|${normalizeStr(roomRaw)}|${pkg}`;
            requiredTasksMap.set(key, { grade: g, subject: sub, room: roomRaw, pkg });
          });
        }
      });
    });

    const completedTasksSet = new Set<string>();
    assignmentData.forEach(item => {
      const key = `${normalizeStr(item.grade)}|${normalizeStr(item.subject)}|${normalizeStr(item.room)}|${String(item.package).toUpperCase().trim()}`;
      completedTasksSet.add(key);
    });

    let missingTasks = Array.from(requiredTasksMap.entries())
      .filter(([key]) => !completedTasksSet.has(key))
      .map(([_, val]) => val);

    // Filter by selected grade and subject if they are selected
    if (filterGrade) {
      missingTasks = missingTasks.filter(t => normalizeStr(t.grade) === normalizeStr(filterGrade));
    }
    if (filterSubject) {
      missingTasks = missingTasks.filter(t => normalizeStr(t.subject) === normalizeStr(filterSubject));
    }

    if (missingTasks.length === 0) {
      alert("Tuyệt vời! Không có túi thi nào bị sót theo bộ lọc hiện tại.");
      return;
    }

    // Sort by grade, subject, room, package
    missingTasks.sort((a, b) => {
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
      if (a.room !== b.room) return a.room.localeCompare(b.room);
      return a.pkg.localeCompare(b.pkg);
    });

    const exportData = missingTasks.map(row => ({
      "Khối": row.grade,
      "Môn": row.subject,
      "Phòng": row.room,
      "Mã túi": row.pkg
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TuiChuaPhanCong");
    XLSX.writeFile(wb, `TuiChuaPhanCong_${new Date().getTime()}.xlsx`);
  };

  const handleExportMissingPDF = () => {
    if (roomData.length === 0) {
      alert("Chưa có dữ liệu gốc (DS Phòng). Vui lòng tải file trước!");
      return;
    }

    const normalizeStr = (s: any) => String(s || '').trim().toLowerCase();
    const requiredTasksMap = new Map<string, any>();

    roomData.forEach(r => {
      const roomRaw = String(r.room || '');
      let g = '';
      if (roomRaw.toLowerCase().includes('khối')) {
        g = roomRaw.toLowerCase().split('khối').pop()?.trim() || '';
      }

      subjectColumns.forEach(sub => {
        const cellValue = r[sub];
        if (cellValue && String(cellValue).trim()) {
          const pkgs = String(cellValue).split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
          pkgs.forEach(pkg => {
            const key = `${normalizeStr(g)}|${normalizeStr(sub)}|${normalizeStr(roomRaw)}|${pkg}`;
            requiredTasksMap.set(key, { grade: g, subject: sub, room: roomRaw, pkg });
          });
        }
      });
    });

    const completedTasksSet = new Set<string>();
    assignmentData.forEach(item => {
      const key = `${normalizeStr(item.grade)}|${normalizeStr(item.subject)}|${normalizeStr(item.room)}|${String(item.package).toUpperCase().trim()}`;
      completedTasksSet.add(key);
    });

    let missingTasks = Array.from(requiredTasksMap.entries())
      .filter(([key]) => !completedTasksSet.has(key))
      .map(([_, val]) => val);

    if (filterGrade) {
      missingTasks = missingTasks.filter(t => normalizeStr(t.grade) === normalizeStr(filterGrade));
    }
    if (filterSubject) {
      missingTasks = missingTasks.filter(t => normalizeStr(t.subject) === normalizeStr(filterSubject));
    }

    if (missingTasks.length === 0) {
      alert("Tuyệt vời! Không có túi thi nào bị sót theo bộ lọc hiện tại.");
      return;
    }

    missingTasks.sort((a, b) => {
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
      if (a.room !== b.room) return a.room.localeCompare(b.room);
      return a.pkg.localeCompare(b.pkg);
    });

    // Group by subject
    const groupedBySubject: Record<string, any[]> = {};
    missingTasks.forEach(task => {
      if (!groupedBySubject[task.subject]) {
        groupedBySubject[task.subject] = [];
      }
      groupedBySubject[task.subject].push(task);
    });

    const content: any[] = [];

    content.push({
      text: 'DANH SÁCH TÚI CHƯA PHÂN CÔNG',
      style: 'header',
      alignment: 'center',
      margin: [0, 0, 0, 20]
    });

    Object.keys(groupedBySubject).forEach((subject, index) => {
      const tasks = groupedBySubject[subject];

      content.push({
        text: `Môn: ${subject}`,
        style: 'subheader',
        margin: [0, 10, 0, 5]
      });

      const tableBody = [
        [
          { text: 'STT', style: 'tableHeader', alignment: 'center' },
          { text: 'Khối', style: 'tableHeader', alignment: 'center' },
          { text: 'Phòng', style: 'tableHeader', alignment: 'center' },
          { text: 'Mã túi', style: 'tableHeader', alignment: 'center' }
        ]
      ];

      tasks.forEach((task, i) => {
        tableBody.push([
          { text: (i + 1).toString(), style: 'tableCell', alignment: 'center' },
          { text: task.grade, style: 'tableCell', alignment: 'center' },
          { text: task.room, style: 'tableCell', alignment: 'center' },
          { text: task.pkg, style: 'tableCell', alignment: 'center' }
        ]);
      });

      content.push({
        table: {
          headerRows: 1,
          widths: ['auto', '*', '*', '*'],
          body: tableBody
        },
        layout: {
          hLineWidth: function () { return 0.5; },
          vLineWidth: function () { return 0.5; },
          hLineColor: function () { return '#000000'; },
          vLineColor: function () { return '#000000'; },
          paddingLeft: function () { return 4; },
          paddingRight: function () { return 4; },
          paddingTop: function () { return 2; },
          paddingBottom: function () { return 2; },
        },
        margin: [0, 0, 0, 15]
      });
    });

    const docDefinition = {
      content: content,
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      styles: {
        header: {
          fontSize: 16,
          bold: true
        },
        subheader: {
          fontSize: 14,
          bold: true
        },
        tableHeader: {
          bold: true,
          fontSize: 12,
          color: 'black',
          fillColor: '#eeeeee'
        },
        tableCell: {
          fontSize: 11
        }
      },
      defaultStyle: {
        fontSize: 11
      }
    };

    pdfMake.createPdf(docDefinition as any).download(`Phieu_TuiChuaPhanCong_${new Date().getTime()}.pdf`);
  };

  const filteredAssignmentData = useMemo(() => {
    let data = assignmentData;
    if (filterGrade) {
      data = data.filter(r => String(r.grade).trim() === String(filterGrade).trim());
    }
    if (filterSubject) {
      data = data.filter(r => String(r.subject).trim() === String(filterSubject).trim());
    }
    if (filterTeacher) {
      data = data.filter(r => String(r.teacher).trim() === String(filterTeacher).trim());
    }
    if (filterStatus) {
      data = data.filter(r => (r.status || 'Chưa') === filterStatus);
    }
    if (packageSearch) {
      const pkgs = packageSearch.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
      data = data.filter(r => pkgs.includes(String(r.package).trim().toUpperCase()));
    }
    return data;
  }, [assignmentData, filterGrade, filterSubject, filterTeacher, filterStatus, packageSearch]);

  const handleExportExcel = () => {
    if (filteredAssignmentData.length === 0) {
      alert("Không có dữ liệu để xuất!");
      return;
    }

    const exportData = filteredAssignmentData.map(row => {
      let phone = row.phone || '';
      if (!phone) {
        const tInfo = teacherList.find(t => String(t.name).trim() === row.teacher);
        phone = tInfo?.phone || '';
      }

      let phoneStr = phone ? formatPhoneNumber(phone).replace(/^'/, '') : "";

      return {
        "Môn": row.subject,
        "Mã túi": row.package,
        "Giáo viên": row.teacher,
        "Số điện thoại": phoneStr,
        "Thời gian nhập": row.timestamp || '',
        "Trạng thái": row.status || 'Chưa',
        "ID": row.id || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);

    // Force "Số điện thoại" column to be text
    const range = XLSX.utils.decode_range(ws['!ref'] || "A1:D1");
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: 3 }); // Column D (index 3) is "Số điện thoại"
      if (ws[cellAddress]) {
        ws[cellAddress].t = 's'; // Set type to string
        ws[cellAddress].z = '@'; // Set format to text
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PhanCong");
    XLSX.writeFile(wb, `PhanCong_${new Date().getTime()}.xlsx`);
  };

  const handleExportTemplate = () => {
    const wsTeachers = XLSX.utils.json_to_sheet([{
      'Giáo viên': 'Nguyễn Văn A',
      'Số điện thoại': '0987654321'
    }]);

    const wsRooms = XLSX.utils.json_to_sheet([{
      'STT': '1',
      'Phòng - Khối': 'Phòng 1 Khối 6',
      'Toán': 'AAB, BBC',
      'Văn': 'CCD'
    }]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsTeachers, "GiaoVien");
    XLSX.utils.book_append_sheet(wb, wsRooms, "PhongThi");

    XLSX.writeFile(wb, "MauNhapLieu_2File.xlsx");
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full lg:min-h-0 overflow-y-auto lg:overflow-hidden">
      {/* Left Panel: Original Data / Teacher List */}
      {sidePanelType !== null && (
        <div className="w-full lg:w-1/3 flex flex-col border border-gray-200 rounded-lg bg-white lg:overflow-hidden min-h-[400px] lg:min-h-0 shrink-0 lg:shrink shadow-sm">
          <div className="p-3 bg-gray-50 border-b border-gray-200 font-semibold text-gray-700 shrink-0 flex justify-between items-center">
            <span className="flex items-center gap-2">
              {sidePanelType === 'room' && '📂 DỮ LIỆU GỐC (DS PHÒNG THI)'}
              {sidePanelType === 'teacher' && '👥 DANH SÁCH GIÁO VIÊN'}
            </span>
            <button
              onClick={() => setSidePanelType(null)}
              className="p-1 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            <div className="min-w-full inline-block align-middle overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-20">
                  <tr>
                    {sidePanelType === 'room' && (
                      roomData.length > 0 ? (
                        Object.keys(roomData[0]).map((key, i) => (
                          <th key={i} className="px-4 py-2 border-b whitespace-nowrap">{key}</th>
                        ))
                      ) : (
                        <th className="px-4 py-2 border-b">Chưa có dữ liệu</th>
                      )
                    )}
                    {sidePanelType === 'teacher' && (
                      <>
                        <th className="px-4 py-2 border-b whitespace-nowrap">Họ và tên</th>
                        <th className="px-4 py-2 border-b whitespace-nowrap">Số điện thoại</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sidePanelType === 'room' && (
                    roomData.map((row, i) => (
                      <tr key={i} className="bg-white border-b hover:bg-gray-50">
                        {Object.values(row).map((val: any, j) => (
                          <td key={j} className="px-4 py-2 whitespace-nowrap border-r last:border-r-0">{val}</td>
                        ))}
                      </tr>
                    ))
                  )}
                  {sidePanelType === 'teacher' && (
                    teacherList.map((t, i) => (
                      <tr key={i} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium whitespace-nowrap">{t.name}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{String(t.phone || '').replace(/^'/, '')}</td>
                      </tr>
                    ))
                  )}
                  {((sidePanelType === 'room' && roomData.length === 0) ||
                    (sidePanelType === 'teacher' && teacherList.length === 0)) && (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-gray-400 italic">
                          Không có dữ liệu hiển thị.
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Right Panel: Controls & Results */}
      <div className={cn(
        "flex flex-col gap-4 shrink-0 lg:shrink lg:min-h-0",
        sidePanelType !== null ? "w-full lg:w-2/3" : "w-full"
      )}>

        {/* Configuration Header - 2 Balanced Horizontal Cards */}
        {isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 shrink-0">
            {/* Card 1: Teachers */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex items-center justify-between gap-4 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-600"></div>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                  <User size={16} />
                </div>
                <div className="min-w-0 pr-2">
                  <h3 className="text-xs font-black text-gray-800 uppercase tracking-tight truncate">DS GIÁO VIÊN</h3>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest truncate">Họ tên, SĐT</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSidePanelType(sidePanelType === 'teacher' ? null : 'teacher')}
                  className={cn(
                    "text-[9px] font-black px-2 py-1.5 rounded-lg border uppercase transition-all whitespace-nowrap",
                    sidePanelType === 'teacher' ? "bg-blue-600 text-white border-blue-600" : "text-blue-600 bg-blue-50 border-blue-100"
                  )}
                >
                  {sidePanelType === 'teacher' ? 'Ẩn' : 'Hiện'}
                </button>
                <button
                  onClick={() => teacherInputRef.current?.click()}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black transition-all shadow-md shadow-blue-600/10 active:scale-95 text-[10px] uppercase"
                >
                  <FileUp size={14} />
                  {loading ? '...' : 'NHẬP FILE'}
                </button>
                <button
                  onClick={downloadTeacherTemplate}
                  className="text-[9px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1.5 rounded-lg border border-blue-100 uppercase transition-all whitespace-nowrap"
                  title="Tải mẫu Excel"
                >
                  Mẫu
                </button>
              </div>
              <input type="file" ref={teacherInputRef} onChange={handleTeacherUpload} accept=".xlsx,.xls" className="hidden" />
            </div>

            {/* Card 2: Rooms & Subjects */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex items-center justify-between gap-4 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600"></div>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                  <Calendar size={16} />
                </div>
                <div className="min-w-0 pr-2">
                  <h3 className="text-xs font-black text-gray-800 uppercase tracking-tight truncate">DS PHÒNG & MÔN</h3>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest truncate">STT, Phòng, Môn</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSidePanelType(sidePanelType === 'room' ? null : 'room')}
                  className={cn(
                    "text-[9px] font-black px-2 py-1.5 rounded-lg border uppercase transition-all whitespace-nowrap",
                    sidePanelType === 'room' ? "bg-indigo-600 text-white border-indigo-600" : "text-indigo-600 bg-indigo-50 border-indigo-100"
                  )}
                >
                  {sidePanelType === 'room' ? 'Ẩn' : 'Hiện'}
                </button>
                <button
                  onClick={() => roomInputRef.current?.click()}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black transition-all shadow-md shadow-indigo-600/10 active:scale-95 text-[10px] uppercase"
                >
                  <FileUp size={14} />
                  {loading ? '...' : 'NHẬP FILE'}
                </button>
                <button
                  onClick={downloadRoomTemplate}
                  className="text-[9px] font-black text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-1.5 rounded-lg border border-indigo-100 uppercase transition-all whitespace-nowrap"
                  title="Tải mẫu Excel"
                >
                  Mẫu
                </button>
              </div>
              <input type="file" ref={roomInputRef} onChange={handleRoomUpload} accept=".xlsx,.xls" className="hidden" />
            </div>
          </div>
        )}

        {/* Assignment Form */}
        {/* Unified Toolbar & Form */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-4 shrink-0 shadow-sm">
          {/* Main Toolbar - Compact Single Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-inner transition-all",
                currentFile ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
              )}>
                {currentFile ? `📁 ${currentFile}` : '🌐 TRỰC TUYẾN'}
              </span>
              {isSyncing && (
                <div className="flex items-center gap-1.5 text-blue-500 animate-pulse ml-2">
                  <RefreshCw size={12} className="animate-spin" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Đang lưu...</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <>
                  <button
                    onClick={onBackup}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-[11px] font-black text-gray-700 hover:bg-slate-50 transition-all shadow-sm uppercase tracking-widest"
                  >
                    <Download size={14} className="text-blue-500" /> Sao lưu
                  </button>
                  <button
                    onClick={onRestore}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-[11px] font-black text-gray-700 hover:bg-slate-50 transition-all shadow-sm uppercase tracking-widest"
                  >
                    <Upload size={14} className="text-emerald-500" /> Phục hồi
                  </button>
                  <div className="h-6 w-px bg-gray-200 mx-1" />
                </>
              )}
              <button
                onClick={handleExportTemplate}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 text-gray-700 text-[10px] font-black uppercase tracking-tight rounded-lg hover:bg-slate-100 transition-all border border-gray-200"
              >
                <FileDown size={14} className="text-amber-500" /> Mẫu toàn bộ
              </button>
              {isAdmin && (
                <button
                  onClick={onReset}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 text-rose-600 text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-100 transition-all border border-rose-100"
                >
                  <Trash2 size={14} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Assignment Form */}
          <div className="flex flex-wrap items-end gap-4 pt-4">
            <div className="w-28">
              <label className="block text-[10px] text-gray-500 font-extrabold mb-1.5 uppercase tracking-widest">Khối</label>
              <select
                value={grade} onChange={e => setGrade(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
              >
                <option value="" key="default">-- Khối --</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="w-40">
              <label className="block text-[10px] text-text-body font-extrabold mb-1.5 uppercase tracking-widest opacity-60">Môn</label>
              <select
                value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full bg-slate-50 border border-border-soft rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all outline-none"
              >
                <option value="" key="default">-- Chọn môn --</option>
                {subjectColumns.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] text-text-body font-extrabold mb-1.5 uppercase tracking-widest opacity-60">Giáo viên</label>
              <input
                type="text"
                list="teacher-list"
                placeholder="🔍 Nhập tên giáo viên..."
                value={teacher}
                onChange={e => setTeacher(e.target.value)}
                onBlur={e => {
                  if (e.target.value && !teachers.includes(e.target.value)) {
                    setTeacher('');
                  }
                }}
                className="w-full bg-slate-50 border border-border-soft rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all outline-none"
              />
              <datalist id="teacher-list">
                {teachers.filter(Boolean).map(t => <option key={`dl-${t}`} value={t} />)}
              </datalist>
            </div>
            <div className="flex-2 min-w-[280px]">
              <label className="block text-[10px] text-text-body font-extrabold mb-1.5 uppercase tracking-widest opacity-60">Mã túi (DKZ, YBK...)</label>
              <input
                type="text" placeholder="Nhập mã túi thi..."
                value={packages} onChange={e => setPackages(e.target.value)}
                className="w-full bg-slate-50 border border-border-soft rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all outline-none"
              />
            </div>
            <button
              onClick={handleAssign}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl transition-all active:scale-95 font-black uppercase tracking-widest text-[11px] hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20 h-[46px] shadow-md shadow-blue-500/10"
            >
              {loading ? 'ĐANG XỬ LÝ' : 'PHÂN CÔNG'}
            </button>
          </div>
        </div>

        {/* Results Card */}
        <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl transition-all p-5 flex flex-col flex-1 lg:overflow-hidden min-h-[400px] lg:min-h-0">
          <div className="flex flex-wrap justify-between gap-4 mb-6 items-center shrink-0">
            <h3 className="text-lg font-extrabold text-text-heading">Danh sách Phân công</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleColorize} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 text-[11px] font-extrabold uppercase tracking-widest rounded-xl hover:bg-indigo-100 transition-all border border-indigo-100">
                <Palette size={14} /> Tô màu
              </button>
              <button onClick={handleCheckMissing} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 text-[11px] font-extrabold uppercase tracking-widest rounded-xl hover:bg-amber-100 transition-all border border-amber-100">
                <AlertTriangle size={14} /> Kiểm tra sót
              </button>
              <div className="h-8 w-px bg-border-soft mx-1" />
              <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-accent/10 text-accent-hover text-[11px] font-extrabold uppercase tracking-widest rounded-xl hover:bg-accent/20 transition-all border border-accent/20">
                <Download size={14} /> Xuất Excel
              </button>
              <button
                onClick={handleDeleteSelected}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-[11px] font-extrabold uppercase tracking-widest rounded-xl transition-all border",
                  showConfirmDelete 
                    ? "bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-200" 
                    : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                )}
              >
                <Trash2 size={14} /> {showConfirmDelete ? "Chắc chắn?" : "Xóa chọn"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6 shrink-0 bg-slate-50 p-4 rounded-xl border border-border-soft">
            <span className="text-xs font-extrabold text-text-body uppercase tracking-[0.2em] opacity-40 ml-1">Lọc nhanh:</span>
            <select
              value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
              className="bg-white border border-border-soft rounded-xl px-4 py-2 text-xs font-bold w-full sm:w-32 focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all outline-none"
            >
              <option value="" key="all-grades">Tất cả khối</option>
              {grades.filter(Boolean).map(g => <option key={`filter-g-${g}`} value={g}>{g}</option>)}
            </select>
            <select
              value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
              className="bg-white border border-border-soft rounded-xl px-4 py-2 text-xs font-bold w-full sm:w-40 focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all outline-none"
            >
              <option value="" key="all-subjects">Tất cả môn</option>
              {subjectColumns.filter(Boolean).map(s => <option key={`filter-s-${s}`} value={s}>{s}</option>)}
            </select>
            <select
              value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}
              className="bg-white border border-border-soft rounded-xl px-4 py-2 text-xs font-bold w-full sm:w-56 focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all outline-none"
            >
              <option value="" key="all-teachers">Tất cả giáo viên</option>
              {teachers.filter(Boolean).map(t => <option key={`filter-t-${t}`} value={t}>{t}</option>)}
            </select>
            <div className="relative flex-1 min-w-[240px] w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-body/30" size={16} />
              <input
                type="text" placeholder="Tìm mã túi..."
                value={packageSearch} onChange={e => setPackageSearch(e.target.value)}
                className="w-full bg-white border border-border-soft rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto border border-border-soft rounded-2xl min-h-0 bg-white">
            <table className="w-full text-sm text-left border-separate border-spacing-0">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th className="px-4 py-4 w-12 text-center border-b border-border-soft">
                    <input
                      type="checkbox"
                      className="rounded-md border-border-soft text-primary focus:ring-primary/20 transition-all font-sans"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRows(new Set(filteredAssignmentData.map(getRowKey)));
                        } else {
                          setSelectedRows(new Set());
                        }
                      }}
                      checked={selectedRows.size === filteredAssignmentData.length && filteredAssignmentData.length > 0}
                    />
                  </th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-text-body opacity-40 uppercase tracking-widest border-b border-border-soft">Khối</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-text-body opacity-40 uppercase tracking-widest border-b border-border-soft">Môn</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-text-body opacity-40 uppercase tracking-widest border-b border-border-soft">Giáo viên</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-text-body opacity-40 uppercase tracking-widest border-b border-border-soft">Mã túi</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-text-body opacity-40 uppercase tracking-widest border-b border-border-soft">Phòng</th>
                  <th className="px-6 py-4 text-[11px] font-extrabold text-text-body opacity-40 uppercase tracking-widest border-b border-border-soft text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignmentData.map((row, i) => (
                  <tr
                    key={getRowKey(row, i)}
                    className="border-b hover:opacity-90"
                    style={{ backgroundColor: row.color || 'white' }}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(getRowKey(row))}
                        onChange={(e) => {
                          const key = getRowKey(row);
                          const newSet = new Set(selectedRows);
                          if (e.target.checked) newSet.add(key);
                          else newSet.delete(key);
                          setSelectedRows(newSet);
                        }}
                      />
                    </td>
                    <td className="px-4 py-2 text-center font-medium text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2">{row.grade}</td>
                    <td className="px-4 py-2">{row.subject}</td>
                    <td className="px-4 py-2 font-medium">{row.teacher}</td>
                    <td className="px-4 py-2 font-bold">{row.package}</td>
                    <td className="px-4 py-2">{row.room}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{row.timestamp || ''}</td>
                    <td className="px-4 py-2 text-center">
                      <select
                        value={row.status || 'Chưa'}
                        onChange={(e) => handleStatusChange(row, e.target.value)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer outline-none",
                          (!row.status || row.status === 'Chưa')
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        )}
                      >
                        <option value="Chưa">Chưa</option>
                        <option value="Xong">Xong</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {filteredAssignmentData.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      Chưa có dữ liệu phân công
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Custom Dialog */}
        {dialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl transform transition-all">
              <div className="flex items-center gap-3 mb-4">
                {dialog.type === 'error' && <XCircle className="text-red-500" size={28} />}
                {dialog.type === 'warning' && <AlertCircle className="text-yellow-500" size={28} />}
                {dialog.type === 'success' && <CheckCircle2 className="text-green-500" size={28} />}
                <h2 className={cn(
                  "text-xl font-bold",
                  dialog.type === 'error' ? "text-red-600" :
                    dialog.type === 'warning' ? "text-yellow-600" : "text-green-600"
                )}>
                  {dialog.title}
                </h2>
              </div>
              <div className="text-gray-700 mb-6 whitespace-pre-wrap leading-relaxed">
                {dialog.message}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setDialog(null)}
                  className={cn(
                    "px-6 py-2 text-white rounded-lg font-medium transition-colors shadow-sm",
                    dialog.type === 'error' ? "bg-red-600 hover:bg-red-700" :
                      dialog.type === 'warning' ? "bg-yellow-500 hover:bg-yellow-600" : "bg-green-600 hover:bg-green-700"
                  )}
                >
                  Đã hiểu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: TÚI BÀI CHƯA PHÂN CÔNG */}
        {showMissingModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[101] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-amber-100 animate-in zoom-in duration-300 overflow-hidden">
              <div className="p-6 bg-amber-50 border-b border-amber-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <div className="bg-amber-100 p-3 rounded-2xl text-amber-700 shadow-inner">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-amber-900 uppercase tracking-tight">TÚI BÀI CHƯA PHÂN CÔNG</h2>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-0.5">
                      {filterGrade || filterSubject
                        ? `Đang lọc: ${filterGrade ? `Khối ${filterGrade}` : ''} ${filterSubject ? `- ${filterSubject}` : ''}`
                        : 'Phạm vi: Toàn bộ kỳ thi'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMissingModal(false)}
                  className="p-2 hover:bg-amber-100 rounded-full text-amber-400 transition-colors"
                >
                  <XCircle size={28} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-6 bg-white min-h-0">
                {missingTasks.length > 0 ? (
                  <div className="inline-block min-w-full align-middle overflow-x-auto border border-gray-100 rounded-2xl shadow-sm">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest">STT</th>
                          <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Khối</th>
                          <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Môn</th>
                          <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Phòng</th>
                          <th className="px-6 py-4 text-left text-xs font-black text-gray-500 uppercase tracking-widest">Mã túi</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-50">
                        {missingTasks.map((t, i) => (
                          <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-400">{i + 1}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{t.grade}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{t.subject}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{t.room}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-amber-700">{t.pkg}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 border-2 border-dashed border-gray-200 rounded-[2rem]">
                    <div className="bg-white p-4 rounded-3xl shadow-lg shadow-emerald-600/10 mb-6">
                      <CheckCircle2 size={48} className="text-emerald-500" />
                    </div>
                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">HOÀN TẤT PHÂN CÔNG</h3>
                    <p className="text-sm text-gray-500 mt-2">Tuyệt vời! Tất cả túi thi đều đã có người phụ trách.</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                <button
                  onClick={() => setShowMissingModal(false)}
                  className="px-8 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 transition-all font-sans"
                >
                  Đóng cửa sổ
                </button>
                {missingTasks.length > 0 && (
                  <button
                    onClick={() => { handleExportMissingPDF(); setShowMissingModal(false); }}
                    className="px-8 py-3 bg-amber-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 active:scale-95"
                  >
                    Xuất Phiếu PDF
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
