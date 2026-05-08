import React, { useState } from 'react';
import { X, KeyRound, Save, AlertCircle } from 'lucide-react';
import { useAppContext } from '../store';
import { saveToGas } from '../lib/gas';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { 
    loggedInPhone, role, adminAccounts, setAdminAccounts, 
    englishSpeakingAccounts, setEnglishSpeakingAccounts, gasUrl,
    roomData, teacherList, assignmentData, mergedData, examSchedule, 
    invigilationAssignments, markingSubjects, secretariatPairs, 
    exemptTeachers, invigilationConfig, schoolInfo, teacherConfig, 
    anonymizationTeam, secretariatTeam
  } = useAppContext();
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (newPassword.length < 4) {
      setError('Mật khẩu mới phải có ít nhất 4 ký tự.');
      return;
    }

    setIsSaving(true);
    try {
      if (role === 'admin') {
        // Handle admin password change
        let found = false;
        const updatedAdminAccounts = adminAccounts.map(acc => {
          const keys = Object.keys(acc);
          let matchKey = '';
          for (const key of keys) {
            if (String(acc[key]).trim() === currentPassword.trim()) {
              matchKey = key;
              break;
            }
          }
          if (matchKey) {
            found = true;
            return { ...acc, [matchKey]: newPassword.trim() };
          }
          return acc;
        });

        // Fallback for default password if no admin accounts exist yet
        if (!found && adminAccounts.length === 0 && currentPassword.trim() === 'Admin123') {
          updatedAdminAccounts.push({ password: newPassword.trim() });
          found = true;
        }

        if (!found) {
          setError('Mật khẩu hiện tại không chính xác.');
          setIsSaving(false);
          return;
        }

        setAdminAccounts(updatedAdminAccounts);
        
        // Sync immediately
        if (gasUrl) {
          await saveToGas(gasUrl, {
            roomData, teacherList, assignmentData, mergedData, examSchedule, 
            invigilationAssignments, markingSubjects, secretariatPairs, 
            exemptTeachers, invigilationConfig, schoolInfo, teacherConfig, 
            anonymizationTeam, secretariatTeam, englishSpeakingAccounts,
            adminAccounts: updatedAdminAccounts
          }, 'sync');
        }
      } else {
        // Handle english speaking teacher password change
        const uname = String(loggedInPhone).trim().replace(/^'/, '');
        const accountIndex = englishSpeakingAccounts.findIndex(
          acc => String(acc.username).replace(/^'/, '') === uname && acc.password === currentPassword.trim()
        );

        if (accountIndex === -1) {
          setError('Mật khẩu hiện tại không chính xác.');
          setIsSaving(false);
          return;
        }

        const updatedAccounts = [...englishSpeakingAccounts];
        updatedAccounts[accountIndex].password = newPassword.trim();
        
        setEnglishSpeakingAccounts(updatedAccounts);

        // Sync immediately
        if (gasUrl) {
          await saveToGas(gasUrl, {
            roomData, teacherList, assignmentData, mergedData, examSchedule, 
            invigilationAssignments, markingSubjects, secretariatPairs, 
            exemptTeachers, invigilationConfig, schoolInfo, teacherConfig, 
            anonymizationTeam, secretariatTeam, 
            englishSpeakingAccounts: updatedAccounts,
            adminAccounts
          }, 'sync');
        }
      }

      setSuccess('Đổi mật khẩu thành công!');
      
      setTimeout(() => {
        onClose();
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccess('');
      }, 1500);
    } catch (err: any) {
      setError('Lỗi khi lưu mật khẩu: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 min-h-screen animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <KeyRound size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Đổi Mật Khẩu</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100 animate-in shake duration-300">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs font-semibold leading-relaxed">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100 animate-in zoom-in duration-300">
              <KeyRound size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs font-semibold leading-relaxed">{success}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mật khẩu hiện tại</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mật khẩu mới</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Xác nhận mật khẩu mới</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full mt-4 bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Save size={18} />
            )}
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </form>
      </div>
    </div>
  );
};
