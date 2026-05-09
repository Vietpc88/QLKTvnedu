import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAppContext } from '../store';
import { FileUp, FileDown, User, Calendar, Info, Download, Upload, Trash2, Database, ShieldAlert } from 'lucide-react';
import { downloadTeacherTemplate, downloadRoomTemplate } from '../lib/templates';
import { cn } from '../lib/utils';

interface Props {
  onBackup?: () => void;
  onRestore?: () => void;
  onReset?: () => void;
}

export const TabConfig: React.FC<Props> = ({ onBackup, onRestore, onReset }) => {
  const {
    roomData, setRoomData,
    teacherList, setTeacherList,
    setTeachers,
    setSubjectColumns,
    setMarkingSubjects,
    role
  } = useAppContext();

  const [loading, setLoading] = useState(false);
  const teacherInputRef = useRef<HTMLInputElement>(null);
  const roomInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = role === 'admin';

  if (!isAdmin) {
    return (
      <div className="p-12 text-center">
        <div className="bg-rose-50 text-rose-600 p-6 rounded-2xl inline-block border border-rose-100">
          <p className="font-black uppercase tracking-widest text-sm">Cảnh báo: Bạn không có quyền truy cập trang cấu hình hệ thống.</p>
        </div>
      </div>
    );
  }

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
        Object.keys(row).forEach(k => {
          if (k !== roomKey && k !== sttKey) r[k] = String(row[k]).trim();
        });
        return r;
      });

      setRoomData(newRoomData);

      const subjects = Object.keys(firstRow).filter(k => {
        const l = k.toLowerCase().trim();
        if (!l || l === '' || l.includes('empty') || l.startsWith('_')) return false;
        return !['stt', 'phòng - khối'].includes(l);
      });
      setSubjectColumns(subjects);
      setMarkingSubjects(subjects); 

      alert(`Đã tải ${newRoomData.length} phòng.`);
    } catch (error: any) {
      alert(`Lỗi: ${error.message}`);
    } finally {
      setLoading(false);
      if (roomInputRef.current) roomInputRef.current.value = '';
    }
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

    XLSX.writeFile(wb, "MauNhapLieu_ToanBo.xlsx");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header Info */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-blue-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Cấu hình hệ thống</h1>
          <p className="text-blue-100 font-bold uppercase tracking-widest text-xs opacity-80">Quản lý dữ liệu gốc và bảo trì hệ thống</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Card: Giáo viên */}
        <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 transition-all flex flex-col group">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform">
              <User size={28} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Giáo viên</h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Họ tên & Số điện thoại</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 flex-1">
            <button
              onClick={() => teacherInputRef.current?.click()}
              disabled={loading}
              className="flex items-center justify-center gap-2.5 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 text-[11px]"
            >
              <FileUp size={18} /> Nhập File Excel
            </button>
            <button
              onClick={downloadTeacherTemplate}
              className="flex items-center justify-center gap-2.5 px-6 py-4 bg-white border-2 border-blue-50 text-blue-600 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-50 transition-all text-[11px]"
            >
              <FileDown size={18} /> Tải File Mẫu
            </button>
          </div>
          <input type="file" ref={teacherInputRef} onChange={handleTeacherUpload} accept=".xlsx,.xls" className="hidden" />
          
          <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang lưu trữ:</span>
              <span className="text-base font-black text-blue-600 uppercase tracking-tighter">{teacherList.length} GV</span>
            </div>
          </div>
        </div>

        {/* Card: Phòng & Môn */}
        <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 transition-all flex flex-col group">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
              <Calendar size={28} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Phòng & Môn</h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Sơ đồ túi thi</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 flex-1">
            <button
              onClick={() => roomInputRef.current?.click()}
              disabled={loading}
              className="flex items-center justify-center gap-2.5 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 text-[11px]"
            >
              <FileUp size={18} /> Nhập File Excel
            </button>
            <button
              onClick={downloadRoomTemplate}
              className="flex items-center justify-center gap-2.5 px-6 py-4 bg-white border-2 border-indigo-50 text-indigo-600 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 transition-all text-[11px]"
            >
              <FileDown size={18} /> Tải File Mẫu
            </button>
          </div>
          <input type="file" ref={roomInputRef} onChange={handleRoomUpload} accept=".xlsx,.xls" className="hidden" />

          <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đang lưu trữ:</span>
              <span className="text-base font-black text-indigo-600 uppercase tracking-tighter">{roomData.length} Phòng</span>
            </div>
          </div>
        </div>

        {/* Card: Bảo trì hệ thống */}
        <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-amber-500/10 transition-all flex flex-col group">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform">
              <Database size={28} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Dữ liệu & Bảo trì</h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Sao lưu & Khôi phục</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1">
            <button
              onClick={onBackup}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 border border-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all text-[9px]"
            >
              <Download size={20} /> Sao lưu
            </button>
            <button
              onClick={onRestore}
              className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 border border-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 transition-all text-[9px]"
            >
              <Upload size={20} /> Phục hồi
            </button>
            <button
              onClick={handleExportTemplate}
              className="col-span-2 flex items-center justify-center gap-3 py-3 bg-white border-2 border-slate-50 text-slate-500 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 transition-all text-[9px]"
            >
              <FileDown size={16} /> Mẫu nhập liệu toàn bộ
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={onReset}
              className="w-full flex items-center justify-center gap-3 py-4 bg-rose-50 text-rose-600 rounded-2xl font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all text-[11px] shadow-sm shadow-rose-100"
            >
              <Trash2 size={18} /> RESET TOÀN BỘ DỮ LIỆU
            </button>
          </div>
        </div>
      </div>
      
      {/* Thông tin hướng dẫn */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 flex flex-col md:flex-row gap-8 items-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
          <ShieldAlert size={32} />
        </div>
        <div className="flex-1 space-y-2 text-center md:text-left">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Lưu ý an toàn dữ liệu</h3>
          <p className="text-xs text-slate-500 font-bold leading-relaxed">
            Mọi thay đổi tại đây sẽ ảnh hưởng trực tiếp đến hệ thống Phân công. 
            Vui lòng thực hiện <b>Sao lưu</b> dữ liệu trước khi thực hiện các thay đổi lớn hoặc nhấn <b>Reset</b>.
          </p>
        </div>
        <div className="flex gap-2">
           <div className="px-4 py-2 bg-slate-50 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest">Version 1.2.6</div>
        </div>
      </div>
    </div>
  );
};
