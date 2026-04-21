import React, { useState } from 'react';
import { useAppContext } from '../store';
import { X, Plus, Trash2, Save, User as UserIcon } from 'lucide-react';
import { EnglishSpeakingAccount } from '../types';
import { saveToGas } from '../lib/gas';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigEnglishModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { englishSpeakingAccounts, setEnglishSpeakingAccounts, teacherList } = useAppContext();
  
  // Local state for editing before saving
  const [accounts, setAccounts] = useState<any[]>(
    (englishSpeakingAccounts || []).map(a => ({
      ...a,
      assignedClassesInput: a.assignedClasses.join(', ')
    }))
  );
  const [isSaving, setIsSaving] = useState(false);

  // Sync local state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setAccounts((englishSpeakingAccounts || []).map(a => ({
        ...a,
        assignedClassesInput: a.assignedClasses.join(', ')
      })));
    }
  }, [isOpen, englishSpeakingAccounts]);

  if (!isOpen) return null;

  const handleAddAccount = () => {
    setAccounts([...accounts, { username: '', password: '', teacherName: '', assignedClassesInput: '' }]);
  };

  const handleRemoveAccount = (index: number) => {
    const nextList = [...accounts];
    nextList.splice(index, 1);
    setAccounts(nextList);
  };

  const handleChange = (index: number, field: string, value: string) => {
    const nextList = [...accounts];
    nextList[index][field] = value;
    setAccounts(nextList);
  };

  const handleTeacherSelect = (index: number, teacherName: string) => {
    const nextList = [...accounts];
    nextList[index].teacherName = teacherName;
    const teacherRow = teacherList.find(t => t.name === teacherName);
    if (teacherRow) {
      nextList[index].username = String(teacherRow.phone || '').replace(/^'/, '');
    }
    setAccounts(nextList);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const finalAccounts: EnglishSpeakingAccount[] = accounts.map(a => ({
        username: a.username,
        password: a.password,
        teacherName: a.teacherName,
        assignedClasses: a.assignedClassesInput.split(',').map((c: string) => c.trim()).filter(Boolean)
      }));
      setEnglishSpeakingAccounts(finalAccounts);
      // Wait a moment for store to update, auto-sync in App.tsx might pick it up
      // Or we can explicitly save here
      alert("Đã cập nhật tài khoản thành công!");
      onClose();
    } catch (e: any) {
      alert("Lỗi: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportExcel = () => {
    if (accounts.length === 0) {
      alert("Không có tài khoản nào để xuất!");
      return;
    }

    const dataRows = accounts.map((acc, index) => ({
      "STT": index + 1,
      "Giáo viên": acc.teacherName,
      "Tài khoản (SĐT)": acc.username,
      "Mật khẩu": acc.password,
      "Lớp phân công": acc.assignedClassesInput
    }));

    const ws = XLSX.utils.json_to_sheet(dataRows);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 5 },
      { wch: 25 },
      { wch: 20 },
      { wch: 15 },
      { wch: 30 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Accounts");
    XLSX.writeFile(wb, `Danh_sach_tai_khoan_GV_Tieng_Anh_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <UserIcon size={20} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Cấu hình Tài khoản Tiếng Anh</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg font-bold text-sm hover:bg-indigo-100 transition-all shadow-sm"
              title="Xuất danh sách ra Excel"
            >
              <Download size={18} /> Xuất Excel
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-200 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-auto flex-1 bg-slate-50/50">
          <div className="mb-4 bg-blue-50 text-blue-800 text-sm p-4 rounded-xl flex gap-3">
            <div>
              <p className="font-semibold mb-1">Hướng dẫn:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Tạo các tài khoản dành riêng cho Giáo viên Tiếng Anh nhập điểm nói.</li>
                <li>Hệ thống sẽ lọc danh sách thí sinh có môn "Tiếng Anh" (hoặc "Anh") theo MÃ PHÁCH.</li>
                <li>Danh sách lớp phân công cách nhau bởi dấu phẩy (VD: 6A, 6B).</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            {accounts.map((acc, index) => (
              <div key={index} className="grid grid-cols-[1.5fr_1.5fr_1.5fr_2fr_auto] gap-4 items-center bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chọn Giáo viên</label>
                  <input
                    list={`teacher-list-${index}`}
                    value={acc.teacherName}
                    onChange={e => handleTeacherSelect(index, e.target.value)}
                    placeholder="Gõ để tìm hoặc chọn..."
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                  <datalist id={`teacher-list-${index}`}>
                    {teacherList.map((t, i) => (
                      <option key={i} value={t.name}>{t.phone}</option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">SĐT (Tài khoản)</label>
                  <input
                    type="text"
                    value={acc.username}
                    onChange={e => handleChange(index, 'username', e.target.value)}
                    placeholder="SĐT tự động hoặc nhập..."
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mật khẩu</label>
                  <input
                    type="text"
                    value={acc.password}
                    onChange={e => handleChange(index, 'password', e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lớp (Cách nhau dấu ,)</label>
                  <input
                    type="text"
                    value={acc.assignedClassesInput}
                    onChange={e => handleChange(index, 'assignedClassesInput', e.target.value)}
                    placeholder="VD: 6A, 6B"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="pt-5">
                  <button onClick={() => handleRemoveAccount(index)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
            
            {accounts.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                <p className="text-gray-500 font-medium">Chưa có tài khoản nào được tạo.</p>
              </div>
            )}
          </div>

          <button
            onClick={handleAddAccount}
            className="mt-6 flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed border-indigo-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors"
          >
            <Plus size={20} /> Thêm tài khoản mới
          </button>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3 shrink-0 bg-white">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-500 font-bold rounded-xl hover:bg-gray-100"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <Save size={18} /> {isSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
      </div>
    </div>
  );
};
