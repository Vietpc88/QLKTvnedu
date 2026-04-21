import React, { useState, useEffect, useRef } from 'react';
import { AppProvider, useAppContext } from './store';
import { TabAssignment } from './components/TabAssignment';
import { TabMerger } from './components/TabMerger';
import { TabTeacher } from './components/TabTeacher';
import { TabInvigilation } from './components/TabInvigilation';
import { TabSpeakingGrade } from './components/TabSpeakingGrade';
import { TabSpeakingReport } from './components/TabSpeakingReport';
import { GasSetupModal } from './components/GasSetupModal';
import { ConfigEnglishModal } from './components/ConfigEnglishModal';
import { SplashScreen } from './components/SplashScreen';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { 
  Settings, Wrench, Trash2, LogOut, AlertCircle, Calendar, 
  Download, Upload, LayoutDashboard, RefreshCw, GraduationCap, 
  UserCog, Mic, KeyRound, Menu, X, Bell, ChevronRight, User
} from 'lucide-react';
import { cn } from './lib/utils';
import { loadFromGas, saveToGas } from './lib/gas';
import { downloadJSON, readJSONFile } from './lib/backupUtils';

const MainApp = () => {
  const [activeTab, setActiveTab] = useState<'assignment' | 'merger' | 'invigilation' | 'speaking_report'>('assignment');
  const [isGasModalOpen, setIsGasModalOpen] = useState(false);
  const [isConfigEnglishModalOpen, setIsConfigEnglishModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'error'>('idle');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024);
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
    englishSpeakingAccounts, setEnglishSpeakingAccounts,
    loggedInTeacher, setLoggedInTeacher,
    setLoggedInPhone,
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
      setEnglishSpeakingAccounts(data.englishSpeakingAccounts || []);
      
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
      
      const finalSubjects = (data.subjectColumns && data.subjectColumns.length > 0) 
        ? data.subjectColumns 
        : (data.markingSubjects || []);
      setSubjectColumns(finalSubjects);

      if (data.teacherList && data.teacherList.length > 0) {
        setTeachers(data.teacherList.map((t: any) => String(t.name).trim()).sort());
      } else {
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
      if (showLoading) alert(error.message);
    } finally {
      setIsLoadingInitial(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [gasUrl]);

  useEffect(() => {
    if (!gasUrl || isLoadingInitial || role !== 'admin') return;

    const timer = setTimeout(async () => {
      setSyncStatus('syncing');
      try {
        await saveToGas(gasUrl, {
          roomData, teacherList, assignmentData, mergedData, examSchedule, 
          invigilationAssignments, markingSubjects, secretariatPairs, 
          exemptTeachers, invigilationConfig, schoolInfo, teacherConfig, 
          anonymizationTeam, secretariatTeam, englishSpeakingAccounts
        }, 'sync');
        setSyncStatus('saved');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } catch (error) {
        console.error("Auto-sync failed:", error);
        setSyncStatus('error');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    roomData, teacherList, assignmentData, mergedData, examSchedule, 
    invigilationAssignments, markingSubjects, secretariatPairs, 
    exemptTeachers, invigilationConfig, schoolInfo, teacherConfig, 
    anonymizationTeam, secretariatTeam, gasUrl, englishSpeakingAccounts
  ]);

  useEffect(() => {
    if (refreshTrigger > 0) fetchInitialData(false);
  }, [refreshTrigger]);

  const handleBackup = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      originalData, assignmentData, mergedData, adminAccounts,
      subjectColumns, teachers, examSchedule, invigilationAssignments,
      anonymizationTeam, secretariatTeam, exemptTeachers, secretariatPairs,
      markingSubjects, teacherConfig, invigilationConfig, schoolInfo,
      englishSpeakingAccounts, teacherList, roomData
    };
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    downloadJSON(backupData, `QLKT_backup_${dateStr}.json`);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setShowRestoreModal(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    setIsRestoring(true);
    try {
      const data = await readJSONFile(restoreFile);
      if (typeof data !== 'object' || data === null) throw new Error('File backup không hợp lệ.');

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
      if (Array.isArray(data.englishSpeakingAccounts)) setEnglishSpeakingAccounts(data.englishSpeakingAccounts);
      if (Array.isArray(data.teacherList)) setTeacherList(data.teacherList);
      if (Array.isArray(data.roomData)) setRoomData(data.roomData);

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
            schoolInfo: data.schoolInfo || { authority: '', schoolName: '', principal: '', location: '', examName: '', schoolYear: '' },
            englishSpeakingAccounts: data.englishSpeakingAccounts || [],
            teacherList: data.teacherList || [],
            roomData: data.roomData || []
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

  const handleLogin = (type: 'admin' | 'teacher' | 'speaking_teacher', credential: string, username?: string) => {
    setLoginError('');
    if (type === 'admin') {
      let isValid = false;
      const pwd = credential.trim();
      const validAccounts = adminAccounts.filter(acc => Object.values(acc).some(val => val && String(val).trim() !== ''));
      if (validAccounts.length > 0) {
        isValid = validAccounts.some(acc => Object.values(acc).some(val => String(val).trim() === pwd));
      } else {
        isValid = pwd === 'Admin123';
      }
      if (isValid) {
        setRole('admin');
        setActiveTab('assignment');
      } else {
        setLoginError('Mật khẩu quản trị không chính xác!');
      }
    } else if (type === 'speaking_teacher') {
      const uname = (username || '').trim().replace(/^'/, '');
      const pwd = credential.trim();
      const account = englishSpeakingAccounts.find(acc => String(acc.username).replace(/^'/, '') === uname && acc.password === pwd);
      if (account) {
        setRole('speaking_teacher');
        setLoggedInTeacher(account.teacherName);
        setLoggedInPhone(uname);
        setActiveTab('assignment');
      } else {
        setLoginError('Tài khoản hoặc mật khẩu không chính xác!');
      }
    } else {
      const inputPhone = credential.trim();
      if (!inputPhone) {
        setLoginError('Vui lòng nhập số điện thoại!');
        return;
      }
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
      } else {
        setLoginError('Không tìm thấy giáo viên với số điện thoại này trong hệ thống!');
      }
    }
  };

  const handleLogout = () => {
    setRole(null);
    setLoggedInTeacher(null);
    setLoggedInPhone(null);
    setLoginError('');
  };

  const handleResetData = async () => {
    let isValid = false;
    if (adminAccounts && adminAccounts.length > 0) {
      isValid = adminAccounts.some(acc => Object.values(acc).some(val => String(val).trim() === resetPassword));
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
          originalData: [], assignmentData: [], mergedData: [], examSchedule: [],
          invigilationAssignments: [], anonymizationTeam: [], secretariatTeam: [],
          exemptTeachers: [], secretariatPairs: [], markingSubjects: [],
          teacherList: [], roomData: [], teacherConfig: [],
          invigilationConfig: { invigilatorsPerRoom: 1 },
          schoolInfo: { authority: '', schoolName: '', principal: '', location: '', examName: '', schoolYear: '' }
        });
      }
      setOriginalData([]); setAssignmentData([]); setMergedData([]); setSubjectColumns([]);
      setTeachers([]); setExamSchedule([]); setInvigilationAssignments([]); setAnonymizationTeam([]);
      setSecretariatTeam([]); setExemptTeachers([]); setSecretariatPairs([]); setMarkingSubjects([]);
      setTeacherList([]); setRoomData([]); setTeacherConfig([]);
      setSchoolInfo({ authority: '', schoolName: '', principal: '', location: '', examName: '', schoolYear: '' });
      setCurrentFile(''); setShowResetModal(false); setResetPassword('');
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

  const navItems = [
    { id: 'assignment', label: 'Phân công chấm', icon: Wrench, roles: ['admin', 'teacher'] },
    { id: 'merger', label: 'Ghép phách', icon: LayoutDashboard, roles: ['admin'] },
    { id: 'invigilation', label: 'Coi thi & Chấm thi', icon: Calendar, roles: ['admin'] },
    { id: 'speaking_report', label: 'Điểm Nói', icon: Mic, roles: ['admin'] },
  ];

  return (
    <div className="h-screen bg-bg-main flex overflow-hidden font-manrope">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45] lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Snov.io Inspired Sidebar */}
      <aside className={cn(
        "bg-white border-r border-border-soft flex flex-col transition-all duration-300 z-50 shrink-0",
        "fixed inset-y-0 left-0 lg:relative",
        isSidebarOpen ? "w-[280px] translate-x-0" : "w-[280px] -translate-x-full lg:w-[80px] lg:translate-x-0"
      )}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <GraduationCap size={24} />
          </div>
          {isSidebarOpen && (
            <div className="overflow-hidden">
              <h2 className="font-extrabold text-text-heading whitespace-nowrap leading-tight">QLKT Pro</h2>
              <p className="text-[10px] text-primary font-bold uppercase tracking-widest">{schoolInfo.schoolName || 'vNedu Tool'}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4">
          {navItems.filter(item => item.roles.includes(role || '')).map((item: any) => (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-sm text-[var(--color-text-body)] hover:bg-slate-50 hover:text-[var(--color-text-heading)]",
                activeTab === item.id && "bg-[var(--color-primary-light)] text-[var(--color-primary)]",
                !isSidebarOpen && "justify-center px-0"
              )}
              title={item.label}
            >
              <item.icon size={20} className="shrink-0" />
              {isSidebarOpen && <span>{item.label}</span>}
              {isSidebarOpen && activeTab === item.id && <ChevronRight size={16} className="ml-auto opacity-50" />}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border-soft space-y-2">
          {role === 'admin' && (
            <>
              <div 
                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-sm text-[var(--color-text-body)] hover:bg-slate-50 hover:text-[var(--color-text-heading)]", !isSidebarOpen && "justify-center px-0")}
                onClick={() => setIsConfigEnglishModalOpen(true)}
                title="Cấu hình Tiếng Anh"
              >
                <UserCog size={20} />
                {isSidebarOpen && <span>Cấu hình Tiếng Anh</span>}
              </div>
              <div 
                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-bold text-sm text-[var(--color-text-body)] hover:bg-slate-50 hover:text-[var(--color-text-heading)]", !isSidebarOpen && "justify-center px-0")}
                onClick={() => setIsGasModalOpen(true)}
                title="Cấu hình Cloud"
              >
                <Settings size={20} />
                {isSidebarOpen && <span>Cấu hình Cloud</span>}
              </div>
            </>
          )}
          <div 
            className={cn("snov-sidebar-item text-rose-500 hover:bg-rose-50 hover:text-rose-600", !isSidebarOpen && "justify-center px-0")}
            onClick={handleLogout}
            title="Đăng xuất"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Đăng xuất</span>}
          </div>
        </div>

        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-border-soft rounded-full flex items-center justify-center shadow-sm hover:bg-slate-50 transition-colors z-50 text-text-body"
        >
          {isSidebarOpen ? <X size={14} /> : <Menu size={14} />}
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Modern Header */}
        <header className="h-20 bg-white border-b border-border-soft px-4 lg:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 lg:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-text-body hover:bg-slate-50 rounded-xl transition-colors"
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-extrabold text-text-heading capitalize">
              {navItems.find(i => i.id === activeTab)?.label}
            </h1>
            {role === 'admin' && (
              <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-border-soft rounded-full">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  syncStatus === 'syncing' ? "bg-amber-500 animate-pulse" :
                  syncStatus === 'saved' ? "bg-accent" :
                  syncStatus === 'error' ? "bg-rose-500" : "bg-gray-300"
                )} />
                <span className="text-[10px] font-bold text-text-body uppercase tracking-wider">
                  {syncStatus === 'syncing' ? 'Đang lưu...' : 'Cloud Sync'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <button className="p-2 text-text-body hover:bg-slate-50 rounded-xl transition-colors relative">
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
              </button>
            </div>
            
            <div className="h-8 w-px bg-border-soft" />

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-text-heading leading-tight">{role === 'admin' ? 'Quản trị viên' : loggedInTeacher}</p>
                <p className="text-[10px] text-text-body font-medium uppercase tracking-widest">{role}</p>
              </div>
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-primary-light flex items-center justify-center text-primary font-black shadow-inner border border-primary/10">
                <User size={24} />
              </div>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <div className="flex-1 overflow-hidden p-8 flex flex-col min-h-0 bg-bg-main">
          {/* Action Toolbar for Admin */}
          {role === 'admin' && (
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleBackup}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-border-soft rounded-xl text-xs font-bold text-text-body hover:bg-slate-50 transition-all shadow-sm"
                >
                  <Download size={14} /> Sao lưu JSON
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-border-soft rounded-xl text-xs font-bold text-text-body hover:bg-slate-50 transition-all shadow-sm"
                >
                  <Upload size={14} /> Phục hồi
                  <input type="file" ref={fileInputRef} onChange={handleFileSelected} accept=".json" className="hidden" />
                </button>
              </div>

              <button 
                onClick={() => setShowResetModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100/50"
              >
                <Trash2 size={14} /> Reset Kỳ Thi
              </button>
            </div>
          )}

          {/* Dynamic Content Card */}
          <div className="flex-1 overflow-hidden flex flex-col bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl transition-all overflow-hidden">
            {isLoadingInitial ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
                  <RefreshCw size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-text-heading uppercase tracking-widest">Đang tải dữ liệu Cloud</p>
                  <p className="text-xs font-medium uppercase tracking-widest text-text-body mt-1">Vui lòng chờ...</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col p-6">
                {role === 'speaking_teacher' ? (
                  <TabSpeakingGrade />
                ) : role === 'teacher' ? (
                  <TabTeacher />
                ) : (
                  <div className="flex-1 min-h-0 relative">
                    {activeTab === 'assignment' && <TabAssignment />}
                    {activeTab === 'merger' && <TabMerger />}
                    {activeTab === 'invigilation' && <TabInvigilation />}
                    {activeTab === 'speaking_report' && <TabSpeakingReport />}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 w-[450px] shadow-2xl border border-rose-100 animate-in zoom-in duration-300">
            <div className="flex items-center gap-4 text-rose-600 mb-6 font-black text-xl uppercase tracking-tighter">
              <div className="bg-rose-100 p-3 rounded-2xl">
                <Trash2 size={32} />
              </div>
              Dữ liệu sẽ bị xóa
            </div>
            <p className="text-text-body mb-8 text-sm leading-relaxed">
              Dữ liệu kỳ thi sẽ bị xóa vĩnh viễn trên máy và Google Sheets.
            </p>
            <div className="space-y-4 mb-8">
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu xác nhận</label>
              <input 
                type="password" 
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                className="w-full bg-slate-50 border border-border-soft rounded-2xl px-5 py-4 text-lg focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 transition-all outline-none"
                placeholder="Nhập mật khẩu..."
                autoFocus
              />
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowResetModal(false)} className="flex-1 py-4 text-text-body font-bold hover:bg-slate-50 rounded-2xl transition-colors">Hủy</button>
              <button 
                onClick={handleResetData}
                disabled={isResetting || !resetPassword}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-rose-600/30 hover:bg-rose-700 transition-all text-sm disabled:opacity-50"
              >
                {isResetting ? '...' : 'Xóa Hết'}
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
              Khôi phục
            </div>
            <p className="text-text-body mb-8 text-sm leading-normal">
              Ghi đè bằng file: **{restoreFile?.name}**
            </p>
            <div className="flex gap-4">
              <button onClick={() => { setShowRestoreModal(false); setRestoreFile(null); }} className="flex-1 py-4 text-text-body font-bold hover:bg-slate-50 rounded-2xl transition-colors">Hủy</button>
              <button 
                onClick={handleRestore}
                disabled={isRestoring}
                className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-amber-600/30 hover:bg-amber-700 transition-all text-sm disabled:opacity-50"
              >
                {isRestoring ? '...' : 'Đồng ý'}
              </button>
            </div>
          </div>
        </div>
      )}

      <GasSetupModal isOpen={isGasModalOpen} onClose={() => setIsGasModalOpen(false)} gasUrl={gasUrl} setGasUrl={setGasUrl} />
      <ConfigEnglishModal isOpen={isConfigEnglishModalOpen} onClose={() => setIsConfigEnglishModalOpen(false)} />
      <ChangePasswordModal isOpen={isChangePasswordModalOpen} onClose={() => setIsChangePasswordModalOpen(false)} />
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
