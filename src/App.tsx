import React, { useState, useEffect, useRef } from 'react';
import { AppProvider, useAppContext } from './store';
import { TabAssignment } from './components/TabAssignment';
import { TabMerger } from './components/TabMerger';
import { TabTeacher } from './components/TabTeacher';
import { TabInvigilation } from './components/TabInvigilation';
import { GasSetupModal } from './components/GasSetupModal';
import { SplashScreen } from './components/SplashScreen';
import { Settings, Wrench, Search, Trash2, User, Lock, LogOut, AlertCircle, Calendar, Download, Upload, LayoutDashboard, RefreshCw, Save, GraduationCap } from 'lucide-react';
import { cn } from './lib/utils';
import { loadFromGas, saveToGas } from './lib/gas';
import { downloadJSON, readJSONFile } from './lib/backupUtils';

const MainApp = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'assignment' | 'merger' | 'invigilation'>('assignment');
  const [isGasModalOpen, setIsGasModalOpen] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [loginTab, setLoginTab] = useState<'admin' | 'teacher'>('teacher');
  const [teacherPhone, setTeacherPhone] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { 
    gasUrl, setGasUrl,
    originalData, setOriginalData, 
    assignmentData, setAssignmentData, 
    mergedData, setMergedData, 
    setAdminAccounts, adminAccounts,
    subjectColumns, setSubjectColumns, 
    teachers, setTeachers, 
    setCurrentFile, refreshTrigger,
    teacherConfig, setTeacherConfig, 
    examSchedule, setExamSchedule, 
    anonymizationTeam, setAnonymizationTeam, 
    secretariatTeam, setSecretariatTeam,
    markingSubjects, setMarkingSubjects,
    invigilationAssignments, setInvigilationAssignments,
    invigilationConfig, setInvigilationConfig,
    exemptTeachers, setExemptTeachers,
    secretariatPairs, setSecretariatPairs,
    schoolInfo, setSchoolInfo,
    loggedInTeacher, setLoggedInTeacher,
    loggedInPhone, setLoggedInPhone,
    teacherList, setTeacherList,
    roomData, setRoomData,
    role, setRole
  } = useAppContext();

  const fetchInitialData = async (showLoading = true) => {
    if (!gasUrl) {
      setIsLoadingInitial(false);
      return;
    }
    if (showLoading) setIsLoadingInitial(true);
    else setIsRefreshing(true);

    try {
      const data: any = await loadFromGas(gasUrl);
      setOriginalData(data.originalData || []);
      setAssignmentData(data.assignmentData || []);
      setSubjectColumns(data.subjectColumns || []);
      setAdminAccounts(data.adminAccounts || []);
      setMergedData(data.mergedData || []);
      
      if (data.teacherConfig && data.teacherConfig.length > 0) setTeacherConfig(data.teacherConfig);
      if (data.examSchedule && data.examSchedule.length > 0) setExamSchedule(data.examSchedule);
      if (data.anonymizationTeam && data.anonymizationTeam.length > 0) setAnonymizationTeam(data.anonymizationTeam);
      if (data.invigilationConfig) setInvigilationConfig(data.invigilationConfig);
      if (data.exemptTeachers && data.exemptTeachers.length > 0) setExemptTeachers(data.exemptTeachers);
      if (data.secretariatPairs && data.secretariatPairs.length > 0) setSecretariatPairs(data.secretariatPairs);
      if (data.schoolInfo) setSchoolInfo(data.schoolInfo);
      if (data.markingSubjects && data.markingSubjects.length > 0) setMarkingSubjects(data.markingSubjects);
      if (data.teacherList && data.teacherList.length > 0) setTeacherList(data.teacherList);
      if (data.roomData && data.roomData.length > 0) setRoomData(data.roomData);
      
      // Sync subjectColumns with markingSubjects if empty
      const finalSubjects = (data.subjectColumns && data.subjectColumns.length > 0) 
        ? data.subjectColumns 
        : (data.markingSubjects || []);
      setSubjectColumns(finalSubjects);

      // Update teachers from teacherList
      if (data.teacherList && data.teacherList.length > 0) {
        setTeachers(data.teacherList.map((t: any) => String(t.name).trim()).sort());
      } else {
        // Fallback or legacy update logic if needed
        const tSet = new Set<string>();
        if (data.originalData) {
          data.originalData.forEach((r: any) => {
            if (r['giáo viên']) tSet.add(String(r['giáo viên']).trim());
          });
        }
        if (data.assignmentData) {
          data.assignmentData.forEach((a: any) => tSet.add(a.teacher));
        }
        setTeachers(Array.from(tSet).sort());
      }
    } catch (error: any) {
      console.error("Failed to load initial data from GAS:", error);
      // Don't alert on background refresh if it's just a trigger
      if (showLoading) alert(error.message);
    } finally {
      setIsLoadingInitial(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [gasUrl]);

  // AUTO-SYNC LOGIC
  useEffect(() => {
    if (!gasUrl || isLoadingInitial || role !== 'admin') return;

    const timer = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        await saveToGas(gasUrl, {
          roomData,
          teacherList,
          assignmentData,
          mergedData,
          examSchedule,
          invigilationAssignments,
          markingSubjects,
          secretariatPairs,
          exemptTeachers,
          invigilationConfig,
          schoolInfo,
          teacherConfig,
          anonymizationTeam,
          secretariatTeam
        }, 'sync');
        setSyncStatus('saved');
        // Reset to idle after 3 seconds
        setTimeout(() => setSyncStatus('idle'), 3000);
      } catch (error) {
        console.error("Auto-sync failed:", error);
        setSyncStatus('error');
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [
    roomData, teacherList, assignmentData, mergedData, examSchedule, 
    invigilationAssignments, markingSubjects, secretariatPairs, 
    exemptTeachers, invigilationConfig, schoolInfo, teacherConfig, 
    anonymizationTeam, secretariatTeam, gasUrl
  ]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchInitialData(false);
    }
  }, [refreshTrigger]);

  const handleRefresh = () => {
    fetchInitialData(false);
  };

  // === BACKUP: Download all data as JSON ===
  const handleBackup = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      originalData,
      assignmentData,
      mergedData,
      adminAccounts,
      subjectColumns,
      teachers,
      examSchedule,
      invigilationAssignments,
      anonymizationTeam,
      secretariatTeam,
      exemptTeachers,
      secretariatPairs,
      markingSubjects,
      teacherConfig,
      invigilationConfig,
      schoolInfo
    };
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    downloadJSON(backupData, `QLKT_backup_${dateStr}.json`);
  };

  // === RESTORE: Upload JSON file ===
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setShowRestoreModal(true);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setIsRestoring(true);
    try {
      const data = await readJSONFile(restoreFile);

      // Validate basic structure
      if (typeof data !== 'object' || data === null) {
        throw new Error('File backup không hợp lệ.');
      }

      // Restore all state
      if (Array.isArray(data.originalData)) setOriginalData(data.originalData);
      if (Array.isArray(data.assignmentData)) setAssignmentData(data.assignmentData);
      if (Array.isArray(data.mergedData)) setMergedData(data.mergedData);
      if (Array.isArray(data.adminAccounts)) setAdminAccounts(data.adminAccounts);
      if (Array.isArray(data.subjectColumns)) setSubjectColumns(data.subjectColumns);
      if (Array.isArray(data.teachers)) setTeachers(data.teachers);
      if (Array.isArray(data.examSchedule)) setExamSchedule(data.examSchedule);
      if (Array.isArray(data.invigilationAssignments)) setInvigilationAssignments(data.invigilationAssignments);
      if (Array.isArray(data.anonymizationTeam)) setAnonymizationTeam(data.anonymizationTeam);
      if (Array.isArray(data.secretariatTeam)) setSecretariatTeam(data.secretariatTeam);
      if (Array.isArray(data.markingSubjects)) setMarkingSubjects(data.markingSubjects);
      if (Array.isArray(data.exemptTeachers)) setExemptTeachers(data.exemptTeachers);
      if (Array.isArray(data.secretariatPairs)) setSecretariatPairs(data.secretariatPairs);
      if (Array.isArray(data.teacherConfig)) setTeacherConfig(data.teacherConfig);
      if (data.invigilationConfig) setInvigilationConfig(data.invigilationConfig);
      if (data.schoolInfo) setSchoolInfo(data.schoolInfo);

      // Sync to Google Sheets
      if (gasUrl) {
        try {
          await saveToGas(gasUrl, {
            originalData: data.originalData || [],
            assignmentData: data.assignmentData || [],
            mergedData: data.mergedData || [],
            examSchedule: data.examSchedule || [],
            invigilationAssignments: data.invigilationAssignments || [],
            anonymizationTeam: data.anonymizationTeam || [],
            secretariatTeam: data.secretariatTeam || [],
            exemptTeachers: data.exemptTeachers || [],
            secretariatPairs: data.secretariatPairs || [],
            markingSubjects: data.markingSubjects || [],
            teacherConfig: data.teacherConfig || [],
            invigilationConfig: data.invigilationConfig || { invigilatorsPerRoom: 1 },
            schoolInfo: data.schoolInfo || { authority: '', schoolName: '', principal: '', location: '', examName: '', schoolYear: '' }
          });
        } catch (syncErr: any) {
          console.error('Sync to GAS failed after restore:', syncErr);
          alert('Phục hồi dữ liệu cục bộ thành công, nhưng đồng bộ lên Google Sheets thất bại: ' + syncErr.message);
        }
      }

      setShowRestoreModal(false);
      setRestoreFile(null);
      alert('Phục hồi dữ liệu thành công!');
    } catch (error: any) {
      alert('Lỗi khi phục hồi: ' + error.message);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleLogin = (type: 'admin' | 'teacher', credential: string) => {
    setLoginError('');
    
    if (type === 'admin') {
      // Admin Login logic
      let isValid = false;
      const pwd = credential.trim();
      if (adminAccounts && adminAccounts.length > 0) {
        isValid = adminAccounts.some(acc => {
          return Object.values(acc).some(val => String(val).trim() === pwd);
        });
      } else {
        isValid = pwd === 'Admin123';
      }

      if (isValid) {
        setRole('admin');
        setActiveTab('assignment');
        setLoginError('');
      } else {
        setLoginError('Mật khẩu quản trị không chính xác!');
      }
    } else {
      // Teacher Login logic (Phone Number)
      const inputPhone = credential.trim();
      if (!inputPhone) {
        setLoginError('Vui lòng nhập số điện thoại!');
        return;
      }

      // Find teacher by phone in assignmentData or teacherList
      let foundTeacher = '';
      const cleanInput = inputPhone.replace(/\D/g, '');
      
      const assignment = assignmentData.find(a => {
        const cleanPhone = (a.phone || '').replace(/\D/g, '');
        return cleanPhone === cleanInput && cleanInput !== '';
      });

      if (assignment) {
        foundTeacher = assignment.teacher;
      } else {
        const t = teacherList.find(r => {
          const val = String(r.phone || '').replace(/\D/g, '');
          return val === cleanInput && cleanInput !== '';
        });
        if (t) foundTeacher = t.name;
      }

      if (foundTeacher) {
        setRole('teacher');
        setLoggedInTeacher(foundTeacher);
        setLoggedInPhone(inputPhone);
        setActiveTab('assignment'); 
        setLoginError('');
      } else {
        setLoginError('Không tìm thấy giáo viên với số điện thoại này trong hệ thống!');
      }
    }
  };

  const handleLogout = () => {
    setRole(null);
    setLoggedInTeacher(null);
    setLoggedInPhone(null);
    setAdminPassword('');
    setTeacherPhone('');
    setLoginError('');
    setShowLogin(true);
  };

  const handleResetData = async () => {
    let isValid = false;
    if (adminAccounts && adminAccounts.length > 0) {
      isValid = adminAccounts.some(acc => 
        Object.values(acc).some(val => String(val).trim() === resetPassword)
      );
    } else {
      isValid = resetPassword === 'Admin123';
    }

    if (!isValid) {
      alert('Mật khẩu không chính xác!');
      return;
    }
    
    setIsResetting(true);
    try {
      if (gasUrl) {
        await saveToGas(gasUrl, { 
          originalData: [], 
          assignmentData: [], 
          mergedData: [],
          examSchedule: [],
          invigilationAssignments: [],
          anonymizationTeam: [],
          secretariatTeam: [],
          exemptTeachers: [],
          secretariatPairs: [],
          markingSubjects: [],
          teacherList: [],
          roomData: [],
          teacherConfig: [],
          invigilationConfig: { invigilatorsPerRoom: 1 },
          schoolInfo: {
            authority: '',
            schoolName: '',
            principal: '',
            location: '',
            examName: '',
            schoolYear: ''
          }
        });
      }
      setOriginalData([]);
      setAssignmentData([]);
      setMergedData([]);
      setSubjectColumns([]);
      setTeachers([]);
      setExamSchedule([]);
      setInvigilationAssignments([]);
      setAnonymizationTeam([]);
      setSecretariatTeam([]);
      setExemptTeachers([]);
      setSecretariatPairs([]);
      setMarkingSubjects([]);
      setTeacherList([]);
      setRoomData([]);
      setTeacherConfig([]);
      setSchoolInfo({
        authority: '',
        schoolName: '',
        principal: '',
        location: '',
        examName: '',
        schoolYear: ''
      });
      setCurrentFile('');
      setShowResetModal(false);
      setResetPassword('');
      alert('Đã xóa toàn bộ dữ liệu thành công!');
    } catch (error: any) {
      alert('Lỗi khi xóa dữ liệu: ' + error.message);
    } finally {
      setIsResetting(false);
    }
  };

  if (!role) {
    return (
      <SplashScreen 
        onLogin={handleLogin}
        loginError={loginError}
        isLoading={isRefreshing}
        schoolName={schoolInfo.schoolName}
      />
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      {/* Premium Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm px-3 md:px-6 py-2 md:py-3 flex items-center justify-between shrink-0 z-50">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-600/20">
            <GraduationCap size={20} className="md:w-6 md:h-6" />
          </div>
          <div className="hidden md:block">
            <h1 className="text-xl font-black text-gray-900 leading-tight uppercase tracking-tight">
              Tiện ích quản lý kỳ thi
            </h1>
            <p className="text-[10px] text-blue-600 font-bold tracking-[0.2em] uppercase opacity-80">
              {schoolInfo.schoolName} {schoolInfo.examName ? ` - ${schoolInfo.examName}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Sync Status Indicator */}
          {role === 'admin' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-gray-200 shadow-inner">
              <div className={cn(
                "w-2 h-2 rounded-full",
                syncStatus === 'syncing' ? "bg-amber-500 animate-pulse" :
                syncStatus === 'saved' ? "bg-emerald-500" :
                syncStatus === 'error' ? "bg-rose-500" : "bg-gray-300"
              )} />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                {syncStatus === 'syncing' ? 'Đang đồng bộ...' :
                 syncStatus === 'saved' ? 'Đã lưu Cloud' :
                 syncStatus === 'error' ? 'Lỗi kết nối' : 'Cloud Sync'}
              </span>
            </div>
          )}

          <div className="hidden lg:flex flex-col items-end">
            <span className="text-sm font-black text-gray-800 leading-none">
              {role === 'admin' ? 'QUẢN TRỊ VIÊN' : loggedInTeacher}
            </span>
          </div>

          <div className="h-8 w-px bg-gray-200" />

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all font-black text-[10px] md:text-xs uppercase border border-rose-100 group"
          >
            <LogOut size={14} className="md:w-4 md:h-4 transition-transform group-hover:-translate-x-1" />
            <span className="hidden sm:inline">Đăng xuất</span>
            <span className="sm:hidden text-[9px]">Thoát</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 bg-slate-50">
        {/* Navigation Bar */}
        <div className="px-6 pt-4 shrink-0 bg-white border-b border-gray-200">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between">
            <div className="flex gap-1">
              {role === 'admin' ? (
                <>
                  <button 
                    onClick={() => setActiveTab('assignment')}
                    className={cn(
                      "flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-3 rounded-t-xl font-black text-[11px] md:text-[13px] uppercase transition-all tracking-wide border-x border-t",
                      activeTab === 'assignment' 
                        ? "bg-slate-50 text-blue-600 border-gray-200 shadow-inner" 
                        : "text-gray-400 hover:text-gray-600 border-transparent"
                    )}
                  >
                    <Wrench size={14} className="md:w-4 md:h-4" /> 
                    <span className="hidden md:inline">Phân công túi bài</span>
                    <span className="md:hidden">PC Chấm</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('merger')}
                    className={cn(
                      "flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-3 rounded-t-xl font-black text-[11px] md:text-[13px] uppercase transition-all tracking-wide border-x border-t",
                      activeTab === 'merger' 
                        ? "bg-slate-50 text-blue-600 border-gray-200 shadow-inner" 
                        : "text-gray-400 hover:text-gray-600 border-transparent"
                    )}
                  >
                    <LayoutDashboard size={14} className="md:w-4 md:h-4" /> 
                    <span className="hidden md:inline">Kết quả ghép phách</span>
                    <span className="md:hidden">Tra Phách</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('invigilation')}
                    className={cn(
                      "flex items-center gap-1.5 md:gap-2 px-3 md:px-6 py-3 rounded-t-xl font-black text-[11px] md:text-[13px] uppercase transition-all tracking-wide border-x border-t",
                      activeTab === 'invigilation' 
                        ? "bg-slate-50 text-blue-600 border-gray-200 shadow-inner" 
                        : "text-gray-400 hover:text-gray-600 border-transparent"
                    )}
                  >
                    <Calendar size={14} className="md:w-4 md:h-4" /> 
                    <span className="hidden md:inline">Coi thi & Chấm thi</span>
                    <span className="md:hidden">Coi & Chấm</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 py-3">
                  <span className="font-black text-sm uppercase tracking-widest text-slate-400">Trạng thái:</span>
                  <span className="font-black text-sm uppercase tracking-widest text-emerald-600">Sẵn sàng nhập liệu</span>
                </div>
              )}
            </div>

            {role === 'admin' && (
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setIsGasModalOpen(true)}
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  title="Cấu hình Google Apps Script"
                >
                  <Settings size={20} />
                </button>
                <button
                  onClick={handleBackup}
                  className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                  title="Sao lưu toàn bộ dữ liệu (JSON)"
                >
                  <Download size={20} />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                  title="Phục hồi từ file sao lưu"
                >
                  <Upload size={20} />
                  <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept=".json" className="hidden" />
                </button>
                <div className="h-6 w-px bg-gray-200 mx-1" />
                <button
                  onClick={() => setShowResetModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-600/20"
                >
                  <Trash2 size={14} /> Khởi tạo lại
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Viewport */}
        <div className="flex-1 overflow-hidden p-2 md:p-6 relative">
          <div className="h-full bg-white rounded-2xl md:rounded-[2rem] border border-gray-200 shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden relative z-10">
            {isLoadingInitial ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 text-gray-400 bg-slate-50/50">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                  <RefreshCw size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-gray-800 uppercase tracking-widest">Đang tải dữ liệu Cloud</p>
                  <p className="text-xs font-medium uppercase tracking-widest opacity-60 mt-1">Vui lòng chờ trong giây lát...</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                {role === 'teacher' ? (
                  <TabTeacher />
                ) : (
                  <>
                    {activeTab === 'assignment' && <TabAssignment />}
                    {activeTab === 'merger' && <TabMerger />}
                    {activeTab === 'invigilation' && <TabInvigilation />}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Legacy Modals Integration */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 w-[450px] shadow-2xl border border-rose-100 animate-in zoom-in duration-300">
            <div className="flex items-center gap-4 text-rose-600 mb-6 font-black text-xl uppercase tracking-tighter">
              <div className="bg-rose-100 p-3 rounded-2xl">
                <Trash2 size={32} />
              </div>
              Dữ liệu sẽ bị xóa vĩnh viễn
            </div>
            
            <p className="text-gray-600 mb-8 text-sm leading-relaxed">
              Bạn đang chuẩn bị xóa **toàn bộ dữ liệu** của kỳ thi hiện tại (Danh sách phòng, Phân công, Phách). Hành động này không thể hoàn tác và sẽ được đồng bộ lên Google Sheets.
            </p>

            <div className="space-y-4 mb-8">
              <label className="block text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">Xác nhận bằng mật khẩu</label>
              <input 
                type="password" 
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 rounded-2xl px-5 py-4 text-lg focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all"
                placeholder="Nhập mật khẩu quản trị..."
                autoFocus
              />
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => { setShowResetModal(false); setResetPassword(''); }}
                className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition-colors"
                disabled={isResetting}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleResetData}
                disabled={isResetting || !resetPassword}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-600/30 hover:bg-rose-700 active:scale-95 transition-all text-sm"
              >
                {isResetting ? 'Đang thực hiện...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestoreModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 w-[450px] shadow-2xl border border-amber-100 animate-in zoom-in duration-300">
            <div className="flex items-center gap-4 text-amber-600 mb-6 font-black text-xl uppercase tracking-tighter">
              <div className="bg-amber-100 p-3 rounded-2xl">
                <Upload size={32} />
              </div>
              Khôi phục dữ liệu
            </div>
            
            <div className="bg-amber-50 rounded-2xl p-4 mb-8 border border-amber-100 flex gap-3">
              <AlertCircle className="text-amber-600 shrink-0" size={20} />
              <p className="text-amber-800 text-sm leading-normal">
                Dữ liệu hiện tại sẽ bị GHI ĐÈ hoàn toàn bởi dữ liệu từ file sao lưu: **{restoreFile?.name}**
              </p>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => { setShowRestoreModal(false); setRestoreFile(null); }}
                className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl transition-colors"
                disabled={isRestoring}
              >
                Hủy bỏ
              </button>
              <button 
                onClick={handleRestore}
                disabled={isRestoring}
                className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-amber-600/30 hover:bg-amber-700 active:scale-95 transition-all text-sm"
              >
                {isRestoring ? 'Đang xử lý...' : 'Đồng ý khôi phục'}
              </button>
            </div>
          </div>
        </div>
      )}

      <GasSetupModal 
        isOpen={isGasModalOpen} 
        onClose={() => setIsGasModalOpen(false)} 
        gasUrl={gasUrl}
        setGasUrl={setGasUrl}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
