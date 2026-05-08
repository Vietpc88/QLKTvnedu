import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store';
import { saveToGas } from '../lib/gas';
import { Save, Search, AlertCircle, Edit3 } from 'lucide-react';
import { cn } from '../lib/utils';

export const TabSpeakingGrade = () => {
  const { englishSpeakingAccounts, loggedInPhone, mergedData, setMergedData, gasUrl } = useAppContext();

  // Retrieve current speaking teacher account
  const currentAccount = useMemo(() => {
    const phone = String(loggedInPhone || '').replace(/^'/, '');
    return englishSpeakingAccounts.find(acc => String(acc.username).replace(/^'/, '') === phone);
  }, [englishSpeakingAccounts, loggedInPhone]);

  const assignedClasses = currentAccount?.assignedClasses || [];
  const [selectedClass, setSelectedClass] = useState<string>(assignedClasses[0] || '');
  const [searchTerm, setSearchTerm] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localChanges, setLocalChanges] = useState<Record<string, string>>({});

  // Lọc dữ liệu: Môn có chữ 'Anh' và thuộc lớp được chọn
  const filteredData = useMemo(() => {
    if (!selectedClass) return [];
    
    return mergedData.filter(row => {
      const isEnglish = String(row.subject || '').toLowerCase().includes('anh');
      const isCorrectClass = String(row.className || '').trim() === selectedClass.trim();
      const matchesSearch = String(row.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      return isEnglish && isCorrectClass && matchesSearch;
    }).sort((a, b) => {
      // Sắp xếp ABC theo tên (từ cuối cùng)
      const nameA = String(a.name || '').trim();
      const nameB = String(b.name || '').trim();
      
      const lastA = nameA.split(' ').pop() || '';
      const lastB = nameB.split(' ').pop() || '';
      
      if (lastA !== lastB) {
        return lastA.localeCompare(lastB, 'vi');
      }
      return nameA.localeCompare(nameB, 'vi');
    });
  }, [mergedData, selectedClass, searchTerm]);

  const handleScoreChange = (sbd: string, subject: string, newScore: string) => {
    const numericScore = parseFloat(newScore);
    if (newScore !== '' && (isNaN(numericScore) || numericScore < 0 || numericScore > 10)) {
      return; // Basic validation
    }

    setLocalChanges(prev => ({ ...prev, [`${sbd}_${subject}`]: newScore }));

    setMergedData(mergedData.map(row => {
      if (row.sbd === sbd && row.subject === subject) {
        return { ...row, speakingScore: newScore };
      }
      return row;
    }));
  };

  const handleSave = async () => {
    if (!gasUrl) {
      alert('Chưa cấu hình máy chủ Google Apps Script. Vui lòng liên hệ Admin.');
      return;
    }

    const updates = Object.keys(localChanges).map(key => {
      const [sbd, subject] = key.split('_');
      return { sbd, subject, speakingScore: localChanges[key] };
    });

    if (updates.length === 0) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return;
    }

    setIsSaving(true);
    try {
      await saveToGas(gasUrl, { updates }, 'updateSpeakingScore');
      setLocalChanges({}); // Xóa danh sách đợi sau khi đồng bộ thành công
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e: any) {
      alert("Lỗi khi lưu điểm: " + e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentAccount) {
    return (
      <div className="p-6 text-rose-500">
        Lỗi: Không tìm thấy thông tin tài khoản giáo viên.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header bar */}
      <div className="px-2 sm:px-6 py-2 sm:py-3 border-b border-gray-200 bg-slate-50 flex flex-nowrap items-center gap-2 sm:gap-4 shrink-0">
        <select 
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="flex-1 min-w-0 px-2 sm:px-4 py-2 bg-white border border-gray-200 rounded-xl font-bold text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
        >
          {assignedClasses.length === 0 && <option value="">Chưa có lớp</option>}
          {assignedClasses.map(cls => (
            <option key={cls} value={cls}>Lớp {cls}</option>
          ))}
        </select>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={cn(
            "flex items-center gap-1.5 px-4 sm:px-6 py-2 text-white rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95 shrink-0",
            isSaving ? "bg-indigo-400 cursor-wait shadow-none" : "bg-indigo-600 shadow-indigo-600/20 hover:bg-indigo-700"
          )}
        >
          <Save size={16} className={cn(isSaving && "animate-pulse")} /> 
          {isSaving ? 'Đang lưu...' : saveSuccess ? 'Đã Lưu!' : 'Lưu Điểm'}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-2 sm:p-6 overflow-hidden flex flex-col">
        {assignedClasses.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 flex-col gap-2">
            <AlertCircle size={40} className="text-amber-500" />
            <p className="font-medium text-lg">Bạn chưa được phân công lớp nào để nhập điểm.</p>
          </div>
        ) : (
          <>
            {/* Search and summary */}
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm theo Họ tên..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 sm:py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="text-sm font-medium text-gray-500">
                Hiển thị <span className="font-bold text-gray-800">{filteredData.length}</span> học sinh
              </div>
            </div>

            {/* Table wrapper */}
            <div className="flex-1 overflow-auto border border-gray-200 rounded-2xl relative shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm border-b border-gray-200">
                  <tr>
                    <th className="px-1 sm:px-4 py-2 text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-wider w-8 sm:w-16 text-center">STT</th>
                    <th className="px-1 sm:px-4 py-2 text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-wider border-l border-gray-200">Họ tên</th>
                    <th className="px-1 sm:px-4 py-2 text-[10px] sm:text-xs font-black text-gray-500 uppercase tracking-wider w-20 sm:w-32 border-l border-gray-200 text-center">Điểm Nói</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredData.length > 0 ? (
                    filteredData.map((row, index) => (
                      <tr key={`${row.sbd}-${row.subject}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-1 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-500 font-medium text-center">
                          {index + 1}
                        </td>
                        <td className="px-1 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-800 border-l border-gray-200 leading-tight">
                          {row.name || <span className="text-gray-400 italic">Không rõ</span>}
                        </td>
                        <td className="px-1 sm:px-4 py-1.5 sm:py-2 text-sm text-gray-800 font-medium border-l border-gray-200 text-center">
                          <input 
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={row.speakingScore || ''}
                            onChange={(e) => handleScoreChange(row.sbd, row.subject, e.target.value)}
                            placeholder="Nhập..."
                            className={cn(
                              "w-12 sm:w-24 px-1 sm:px-2 py-0.5 sm:py-1 border rounded-md sm:rounded-lg text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all",
                              row.speakingScore ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-gray-200 bg-white"
                            )}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                        {searchTerm ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có dữ liệu ghép phách môn Tiếng Anh cho lớp này.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
