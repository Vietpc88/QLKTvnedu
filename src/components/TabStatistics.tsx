import React, { useMemo, useState } from 'react';
import { useAppContext } from '../store';
import { cn } from '../lib/utils';
import { LayoutDashboard, BookOpen, GraduationCap, CheckCircle2, AlertCircle, Clock, BarChart3, TrendingUp } from 'lucide-react';

export const TabStatistics: React.FC = () => {
  const { roomData, assignmentData, subjectColumns } = useAppContext();
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  const grades = useMemo(() => {
    const s = new Set<string>();
    roomData.forEach(row => {
      const roomRaw = String(row.room || '');
      if (roomRaw.toLowerCase().includes('khối')) {
        s.add(roomRaw.toLowerCase().split('khối').pop()?.trim() || 'Khác');
      } else {
        s.add(roomRaw || 'Khác');
      }
    });
    return Array.from(s).sort();
  }, [roomData]);

  const stats = useMemo(() => {
    const requiredPkgs: { grade: string, subject: string, pkg: string }[] = [];
    
    // 1. Extract all required packages from roomData
    roomData.forEach(row => {
      const roomRaw = String(row.room || '');
      let grade = '';
      if (roomRaw.toLowerCase().includes('khối')) {
        grade = roomRaw.toLowerCase().split('khối').pop()?.trim() || 'Khác';
      } else {
        grade = roomRaw || 'Khác';
      }

      subjectColumns.forEach(sub => {
        const cellValue = row[sub];
        if (cellValue && String(cellValue).trim()) {
          const pkgs = String(cellValue).split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
          pkgs.forEach(pkg => {
            requiredPkgs.push({ grade, subject: sub, pkg });
          });
        }
      });
    });

    const normalize = (s: any) => String(s || '').toLowerCase().trim();

    // 2. Count assigned and done from assignmentData
    const assignedMap = new Map<string, string>(); // key -> status
    assignmentData.forEach(a => {
      const key = `${normalize(a.grade)}|${normalize(a.subject)}|${normalize(a.package)}`;
      assignedMap.set(key, a.status || 'Chưa');
    });

    const allResults = requiredPkgs.map(item => {
      const key = `${normalize(item.grade)}|${normalize(item.subject)}|${normalize(item.pkg)}`;
      const status = assignedMap.get(key);
      return {
        ...item,
        isAssigned: assignedMap.has(key),
        isDone: status === 'Xong'
      };
    });

    const results = allResults.filter(r => {
      const matchGrade = !filterGrade || normalize(r.grade) === normalize(filterGrade);
      const matchSubject = !filterSubject || normalize(r.subject) === normalize(filterSubject);
      return matchGrade && matchSubject;
    });

    const total = results.length;
    const assignedCount = results.filter(r => r.isAssigned).length;
    const doneCount = results.filter(r => r.isDone).length;

    // Group by Grade
    const gradeSummary: Record<string, any> = {};
    results.forEach(r => {
      if (!gradeSummary[r.grade]) gradeSummary[r.grade] = { label: r.grade, total: 0, assigned: 0, done: 0 };
      gradeSummary[r.grade].total++;
      if (r.isAssigned) gradeSummary[r.grade].assigned++;
      if (r.isDone) gradeSummary[r.grade].done++;
    });

    // Group by Subject
    const subjectSummary: Record<string, any> = {};
    results.forEach(r => {
      if (!subjectSummary[r.subject]) subjectSummary[r.subject] = { label: r.subject, total: 0, assigned: 0, done: 0 };
      subjectSummary[r.subject].total++;
      if (r.isAssigned) subjectSummary[r.subject].assigned++;
      if (r.isDone) subjectSummary[r.subject].done++;
    });

    // Group by Grade + Subject
    const comboSummary: Record<string, any> = {};
    results.forEach(r => {
      const key = `${r.grade} - ${r.subject}`;
      if (!comboSummary[key]) comboSummary[key] = { label: key, grade: r.grade, subject: r.subject, total: 0, assigned: 0, done: 0 };
      comboSummary[key].total++;
      if (r.isAssigned) comboSummary[key].assigned++;
      if (r.isDone) comboSummary[key].done++;
    });

    return {
      total,
      assignedCount,
      doneCount,
      grades: Object.values(gradeSummary).sort((a, b) => a.label.localeCompare(b.label)),
      subjects: Object.values(subjectSummary).sort((a, b) => a.label.localeCompare(b.label)),
      combos: Object.values(comboSummary).sort((a, b) => {
        if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
        return a.subject.localeCompare(b.subject);
      })
    };
  }, [roomData, assignmentData, subjectColumns, filterGrade, filterSubject]);

  const StatCard = ({ title, value, total, icon: Icon, color, subLabel }: any) => (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col gap-4 relative overflow-hidden group hover:shadow-md transition-all">
      <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-8 -mt-8 opacity-10 transition-transform group-hover:scale-110", color)}></div>
      <div className="flex items-center justify-between">
        <div className={cn("p-3 rounded-xl", color.replace('bg-', 'bg-opacity-10 text-').replace('-600', ''))}>
          <Icon size={24} />
        </div>
        {total > 0 && (
          <span className="text-xs font-black text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
            {Math.round((value / total) * 100)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">{title}</p>
        <div className="flex items-end gap-2">
          <h3 className="text-3xl font-black text-gray-800">{value}</h3>
          <span className="text-gray-400 font-bold mb-1.5 text-sm">/ {total}</span>
        </div>
        {subLabel && <p className="text-[10px] font-bold text-emerald-600 mt-1 uppercase tracking-tight">{subLabel}</p>}
      </div>
      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-1000 ease-out", color)} 
          style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}
        ></div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 h-full overflow-y-auto pr-2 custom-scrollbar pb-10">
      {/* Header Info */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-black text-text-heading flex items-center gap-3">
            <BarChart3 className="text-primary" size={28} />
            THỐNG KÊ TIẾN ĐỘ CHẤM THI
          </h2>
          <p className="text-[10px] text-text-body font-bold opacity-40 uppercase tracking-[0.2em]">
            Dữ liệu được tổng hợp từ Danh sách Phòng và Phân công thực tế
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
            <GraduationCap size={14} className="text-gray-400" />
            <select
              value={filterGrade}
              onChange={e => setFilterGrade(e.target.value)}
              className="bg-transparent border-0 text-xs font-black focus:ring-0 outline-none cursor-pointer pr-8"
            >
              <option value="">Tất cả Khối</option>
              {grades.map(g => <option key={g} value={g}>Khối {g}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
            <BookOpen size={14} className="text-gray-400" />
            <select
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              className="bg-transparent border-0 text-xs font-black focus:ring-0 outline-none cursor-pointer pr-8"
            >
              <option value="">Tất cả Môn</option>
              {subjectColumns.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {(filterGrade || filterSubject) && (
            <button
              onClick={() => { setFilterGrade(''); setFilterSubject(''); }}
              className="px-3 py-1.5 text-[10px] font-black text-rose-600 hover:bg-rose-50 rounded-xl transition-colors uppercase tracking-widest"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
          title="Tiến độ phân công" 
          value={stats.assignedCount} 
          total={stats.total} 
          icon={CheckCircle2} 
          color="bg-indigo-600" 
          subLabel={`Hoàn thành: ${stats.doneCount} túi`}
        />
        <StatCard 
          title="Tiến độ chấm bài" 
          value={stats.doneCount} 
          total={stats.total} 
          icon={TrendingUp} 
          color="bg-emerald-600" 
        />
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-8 -mt-8 opacity-50"></div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">Tổng cộng kỳ thi</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-black text-slate-800">{stats.total}</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Túi bài thi</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Stats by Grade */}
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <GraduationCap className="text-blue-600" size={20} />
            <h3 className="font-black text-gray-800 uppercase tracking-tight">Thống kê theo Khối</h3>
          </div>
          <div className="space-y-6">
            {stats.grades.map(g => (
              <div key={g.label} className="group">
                <div className="flex justify-between items-end mb-2">
                  <span className="font-bold text-gray-700">Khối {g.label}</span>
                  <div className="text-right">
                    <span className="text-xs font-black text-indigo-600">{g.assigned}</span>
                    <span className="text-[10px] font-bold text-gray-400 mx-1">/</span>
                    <span className="text-xs font-bold text-gray-500">{g.total} phân công</span>
                  </div>
                </div>
                <div className="relative h-3 bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-blue-100 transition-all duration-1000" style={{ width: `${(g.assigned/g.total)*100}%` }}></div>
                  <div className="absolute inset-y-0 left-0 bg-blue-600 transition-all duration-1000 shadow-[0_0_10px_rgba(37,99,235,0.3)]" style={{ width: `${(g.done/g.total)*100}%` }}></div>
                </div>
                <div className="mt-1 flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-400">
                  <span>Phân công: {Math.round((g.assigned/g.total)*100)}%</span>
                  <span className="text-blue-600">Hoàn thành: {Math.round((g.done/g.total)*100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats by Subject */}
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm flex flex-col gap-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <BookOpen className="text-indigo-600" size={20} />
            <h3 className="font-black text-gray-800 uppercase tracking-tight">Thống kê theo Môn học</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stats.subjects.map(s => (
              <div key={s.label} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-3 group hover:border-indigo-200 transition-colors">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-black text-slate-600 uppercase truncate max-w-[100px]">{s.label}</span>
                  <span className="text-[10px] font-black px-2 py-1 bg-white rounded-lg text-indigo-600 border border-indigo-50">
                    Phân công: {Math.round((s.assigned/s.total)*100)}%
                  </span>
                </div>
                <div className="flex items-end gap-1.5">
                  <span className="text-xl font-black text-slate-800">{s.assigned}</span>
                  <span className="text-xs font-bold text-slate-400 mb-1">/ {s.total} phân công</span>
                </div>
                <div className="w-full bg-white h-1.5 rounded-full overflow-hidden border border-slate-200">
                  <div className="bg-indigo-500 h-full" style={{ width: `${(s.done/s.total)*100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Combo Matrix */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Clock className="text-amber-500" size={20} />
            <h3 className="font-black text-gray-800 uppercase tracking-tight">Chi tiết Phân công (Môn + Khối)</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <tr>
                <th className="px-8 py-4">Kết hợp</th>
                <th className="px-8 py-4">Khối</th>
                <th className="px-8 py-4">Môn</th>
                <th className="px-8 py-4 text-center">Tổng số túi</th>
                <th className="px-8 py-4 text-center">Đã phân công</th>
                <th className="px-8 py-4 text-center">Hoàn thành</th>
                <th className="px-8 py-4 text-right">Tiến độ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.combos.map((c, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-4 font-bold text-gray-800">{c.label}</td>
                  <td className="px-8 py-4 text-gray-500">{c.grade}</td>
                  <td className="px-8 py-4 text-gray-500">{c.subject}</td>
                  <td className="px-8 py-4 text-center font-bold text-gray-400">{c.total}</td>
                  <td className="px-8 py-4 text-center">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black",
                      c.assigned === c.total ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {c.assigned} / {c.total}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-center font-black text-blue-600">{c.done}</td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden shrink-0">
                        <div className="bg-emerald-500 h-full" style={{ width: `${(c.done/c.total)*100}%` }}></div>
                      </div>
                      <span className="text-[10px] font-black w-8">{Math.round((c.done/c.total)*100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
