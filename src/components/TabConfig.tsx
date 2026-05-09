import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAppContext } from '../store';
import { FileUp, FileDown, User, Calendar, Info } from 'lucide-react';
import { downloadTeacherTemplate, downloadRoomTemplate } from '../lib/templates';
import { cn } from '../lib/utils';

export const TabConfig: React.FC = () => {
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

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card: Giáo viên */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl">
              <User size={32} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Danh sách Giáo viên</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Quản lý họ tên & Số điện thoại</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            <button
              onClick={() => teacherInputRef.current?.click()}
              disabled={loading}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 text-sm"
            >
              <FileUp size={20} /> Nhập File Excel Giáo viên
            </button>
            <button
              onClick={downloadTeacherTemplate}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-blue-50 text-blue-600 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-50 transition-all text-sm"
            >
              <FileDown size={20} /> Tải File Mẫu Excel
            </button>
          </div>
          <input type="file" ref={teacherInputRef} onChange={handleTeacherUpload} accept=".xlsx,.xls" className="hidden" />
          
          <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Đang lưu trữ:</span>
              <span className="text-lg font-black text-blue-600">{teacherList.length} GV</span>
            </div>
          </div>
        </div>

        {/* Card: Phòng & Môn */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Calendar size={32} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">DS Phòng & Môn thi</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Cấu hình STT & Môn học</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={() => roomInputRef.current?.click()}
              disabled={loading}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 text-sm"
            >
              <FileUp size={20} /> Nhập File Excel Phòng thi
            </button>
            <button
              onClick={downloadRoomTemplate}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-indigo-50 text-indigo-600 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-50 transition-all text-sm"
            >
              <FileDown size={20} /> Tải File Mẫu Excel
            </button>
          </div>
          <input type="file" ref={roomInputRef} onChange={handleRoomUpload} accept=".xlsx,.xls" className="hidden" />

          <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Đang lưu trữ:</span>
              <span className="text-lg font-black text-indigo-600">{roomData.length} Phòng</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Thông tin hướng dẫn */}
      <div className="bg-amber-50 border border-amber-100 rounded-3xl p-8">
        <h3 className="text-sm font-black text-amber-800 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Info size={18} /> Hướng dẫn cấu hình hệ thống
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs text-amber-700 font-bold leading-relaxed">
          <ul className="space-y-3">
            <li className="flex gap-2"><span>•</span> <span>File danh sách giáo viên: Cần có ít nhất 2 cột <b>"Họ và tên"</b> và <b>"Số điện thoại"</b>.</span></li>
            <li className="flex gap-2"><span>•</span> <span>File phòng thi: Cần có cột <b>"STT"</b>, <b>"Phòng - Khối"</b> và các cột môn thi tương ứng.</span></li>
          </ul>
          <ul className="space-y-3">
            <li className="flex gap-2"><span>•</span> <span>Dữ liệu này là dữ liệu gốc dùng để tạo các phân công trong tab <b>Phân công chấm</b>.</span></li>
            <li className="flex gap-2"><span>•</span> <span>Mọi thay đổi tại đây sẽ được tự động đồng bộ khi bạn thực hiện Phân công mới.</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
};
