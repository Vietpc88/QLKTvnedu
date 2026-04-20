import React, { useMemo, useState } from 'react';
import { useAppContext } from '../store';
import { Search, AlertCircle, CheckCircle, Clock, BookOpen, Users, Filter } from 'lucide-react';
import { cn } from '../lib/utils';

export const TabSpeakingReport: React.FC = () => {
  const { mergedData, englishSpeakingAccounts } = useAppContext();
  
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Lọc lấy danh sách học sinh Tiếng Anh
  const englishStudents = useMemo(() => {
    return mergedData.filter(row => String(row.subject || '').toLowerCase().includes('anh'));
  }, [mergedData]);

  // Phân tích báo cáo theo từng tài khoản giáo viên
  const reportByTeacher = useMemo(() => {
    return englishSpeakingAccounts.map(account => {
      // Tìm học sinh thuộc các lớp mà giáo viên này phụ trách
      const assignedClasses = account.assignedClasses;
      const assignedStudents = englishStudents.filter(s => 
        assignedClasses.includes(String(s.className || '').trim())
      );
      
      const totalStudents = assignedStudents.length;
      const gradedStudents = assignedStudents.filter(s => !!String(s.speakingScore || '').trim()).length;
      const missingStudents = assignedStudents.filter(s => !String(s.speakingScore || '').trim());
      const progress = totalStudents > 0 ? Math.round((gradedStudents / totalStudents) * 100) : 0;
      
      return {
        ...account,
        totalStudents,
        gradedStudents,
        missingData: missingStudents,
        progress,
        isComplete: totalStudents > 0 && gradedStudents === totalStudents
      };
    }).sort((a, b) => b.progress - a.progress);
  }, [englishSpeakingAccounts, englishStudents]);

  // Gom nhóm học sinh chưa có điểm cho bảng chi tiết
  const allMissingStudents = useMemo(() => {
    let missingList: any[] = [];
    
    reportByTeacher.forEach(teacher => {
      const missingWithTeacher = teacher.missingData.map(s => ({
        ...s,
        teacherName: teacher.teacherName,
        teacherPhone: teacher.username
      }));
      missingList = [...missingList, ...missingWithTeacher];
    });

    // Also find students who are 'Anh' but not assigned to any teacher
    const assignedClassSet = new Set(englishSpeakingAccounts.flatMap(a => a.assignedClasses));
    const unassignedMissing = englishStudents.filter(s => 
      !assignedClassSet.has(String(s.className || '').trim()) && !String(s.speakingScore || '').trim()
    );
    
    missingList = [
      ...missingList, 
      ...unassignedMissing.map(s => ({
        ...s,
        teacherName: 'Chưa phân công',
        teacherPhone: ''
      }))
    ];

    if (selectedFilter !== 'all') {
      missingList = missingList.filter(s => s.teacherName === selectedFilter);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      missingList = missingList.filter(s => 
        String(s.name || '').toLowerCase().includes(term) ||
        String(s.className || '').toLowerCase().includes(term)
      );
    }

    return missingList.sort((a, b) => String(a.className || '').localeCompare(String(b.className || '')));
  }, [reportByTeacher, englishStudents, englishSpeakingAccounts, selectedFilter, searchTerm]);

  // Cấu trúc danh sách filter filter
  const filterOptions = useMemo(() => {
    const options = reportByTeacher.map(t => t.teacherName);
    options.push('Chưa phân công');
    return Array.from(new Set(options));
  }, [reportByTeacher]);

  const globalTotal = englishStudents.length;
  const globalGraded = englishStudents.filter(s => !!String(s.speakingScore || '').trim()).length;
  const globalProgress = globalTotal > 0 ? Math.round((globalGraded / globalTotal) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-slate-50 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            Thống Kê Điểm Nói Tiếng Anh
          </h2>
          <p className="text-gray-500 font-medium">Theo dõi tiến độ chấm điểm của các Giám khảo Tiếng Anh</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 shadow-sm border border-gray-100 min-w-[150px]">
             <BookOpen size={20} className="text-indigo-500" />
             <div>
               <div className="text-[10px] uppercase font-bold text-gray-400">Tổng HS Tiếng Anh</div>
               <div className="text-xl font-black text-gray-800">{globalTotal}</div>
             </div>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 shadow-sm border border-gray-100 min-w-[150px]">
             <CheckCircle size={20} className="text-emerald-500" />
             <div>
               <div className="text-[10px] uppercase font-bold text-gray-400">Tiến độ chung</div>
               <div className="text-xl font-black text-emerald-600">{globalProgress}%</div>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 flex-1 min-h-0">
        
        {/* Bản Quản lý Giám Khao */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-slate-50 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Users size={18} className="text-indigo-500" /> 
              Tiến độ của Giám khảo
            </h3>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {reportByTeacher.length === 0 ? (
              <div className="text-center py-10 flex flex-col items-center justify-center text-gray-500">
                <AlertCircle size={40} className="mb-2 text-rose-300" />
                <p>Chưa có tài khoản Giám khảo Tiếng Anh nào được cấu hình.</p>
              </div>
            ) : (
              reportByTeacher.map((teacher, idx) => (
                <div key={idx} className="border border-gray-100 bg-white rounded-xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                  {/* Progress bar background overlay */}
                  <div 
                    className={cn("absolute bottom-0 left-0 h-1 transition-all", teacher.isComplete ? "bg-emerald-500" : "bg-indigo-500")}
                    style={{ width: `${teacher.progress}%` }}
                  />
                  
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        {teacher.teacherName}
                        {teacher.isComplete && <CheckCircle size={16} className="text-emerald-500" />}
                      </h4>
                      <p className="text-xs font-semibold text-gray-500 mt-0.5">SĐT: {teacher.username}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-indigo-600">{teacher.progress}%</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md">LỚP PHỤ TRÁCH</span>
                    <div className="flex gap-1 flex-wrap">
                      {teacher.assignedClasses.map(c => (
                        <span key={c} className="text-xs font-bold text-white bg-indigo-500 px-2 py-0.5 rounded-full">{c}</span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <div className="text-xs font-bold text-gray-400 mb-1">ĐÃ CHẤM</div>
                      <div className="font-black text-gray-800"><span className="text-indigo-600">{teacher.gradedStudents}</span> / {teacher.totalStudents} hs</div>
                    </div>
                    <div className="bg-rose-50/50 p-2.5 rounded-lg border border-rose-100">
                      <div className="text-xs font-bold text-rose-400 mb-1">CHƯA CHẤM</div>
                      <div className="font-black text-rose-600">{teacher.missingData.length} hs</div>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>

        {/* Danh sách học sinh chưa có điểm */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-rose-50/50 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-rose-700 flex items-center gap-2">
              <Clock size={18} className="text-rose-500" /> 
              Cảnh báo: Thí sinh chưa có điểm nói
              <span className="bg-rose-200 text-rose-800 text-xs px-2 py-0.5 rounded-full ml-1">
                {allMissingStudents.length}
              </span>
            </h3>
          </div>
          
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 bg-slate-50/50 shrink-0">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm tên HS, Lớp..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none min-w-[140px]"
              >
                <option value="all">Tất cả Giám khảo</option>
                {filterOptions.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {allMissingStudents.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center justify-center text-gray-500 h-full">
                <CheckCircle size={48} className="mb-3 text-emerald-400 opacity-50" />
                <p className="font-bold text-gray-600 text-lg">Tuyệt vời!</p>
                <p>Tất cả thí sinh Tiếng Anh đã được nhập điểm đầy đủ.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-100 shadow-sm border-b border-gray-200 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-xs font-black text-gray-500 uppercase">Họ Tên</th>
                    <th className="px-4 py-2.5 text-xs font-black text-gray-500 uppercase">Lớp</th>
                    <th className="px-4 py-2.5 text-xs font-black text-gray-500 uppercase">Giáo Viên</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allMissingStudents.map((s, idx) => (
                    <tr key={idx} className="hover:bg-rose-50/30">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">
                        {s.name || <span className="italic text-gray-400">Không rõ</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-indigo-600">
                        {s.className}
                      </td>
                      <td className="px-4 py-3 text-sm text-rose-600 font-medium">
                        {s.teacherName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
