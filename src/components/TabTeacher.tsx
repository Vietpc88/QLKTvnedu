import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store';
import { saveToGas, loadFromGas } from '../lib/gas';
import { Search, AlertCircle, XCircle, CheckCircle2, Trash2 } from 'lucide-react';
import { cn, formatPhoneNumber } from '../lib/utils';

const COLORS = [
  '#FFC0CB', '#ADD8E6', '#90EE90', '#FFD700',
  '#FFA07A', '#DDA0DD', '#87CEEB', '#FFB6C1',
  '#E6E6FA', '#FFE4B5'
];

export const TabTeacher: React.FC = () => {
  const { 
    roomData, 
    assignmentData, setAssignmentData,
    subjectColumns,
    teachers, setTeachers,
    teacherList,
    gasUrl,
    refreshData,
    loggedInTeacher
  } = useAppContext();

  const [loading, setLoading] = useState(false);
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [teacher, setTeacher] = useState('');
  const [packages, setPackages] = useState('');
  
  const [packageSearch, setPackageSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  
  const [dialog, setDialog] = useState<{title: string, message: string, type: 'warning'|'error'|'success'} | null>(null);
  
  // Auto-initialize teacher if logged in
  React.useEffect(() => {
    if (loggedInTeacher) {
      setTeacher(loggedInTeacher);
    }
  }, [loggedInTeacher]);

  const getRowKey = (row: any, index?: number) => {
    if (!row) return `empty-${index ?? 'unknown'}`;
    if (row.id) return row.id;
    const base = `${row.grade || ''}|${row.subject || ''}|${row.teacher || ''}|${row.package || ''}|${row.stt || ''}|${row.room || ''}`;
    if (base === '|||||') return `row-${index ?? 'unknown'}`;
    return base;
  };

  const handleStatusChange = async (row: any, newStatus: string) => {
    const updatedData = assignmentData.map(a => {
      if (getRowKey(a) === getRowKey(row)) {
        return { ...a, status: newStatus };
      }
      return a;
    });
    setAssignmentData(updatedData);
    
    // Sync to GAS
    const rowToUpdate = { ...row, status: newStatus };
    await syncData(roomData, updatedData, 'updateStatus', [rowToUpdate]);
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedRows.size === 0) {
      setDialog({ title: 'Thông báo', message: 'Vui lòng chọn ít nhất một túi bài.', type: 'warning' });
      return;
    }

    const updatedRows: any[] = [];
    const updatedData = assignmentData.map(a => {
      const key = getRowKey(a);
      if (selectedRows.has(key)) {
        const updated = { ...a, status: newStatus };
        updatedRows.push(updated);
        return updated;
      }
      return a;
    });

    setAssignmentData(updatedData);
    setSelectedRows(new Set());
    
    await syncData(roomData, updatedData, 'updateStatus', updatedRows);
    setDialog({ title: 'Thành công', message: `Đã cập nhật trạng thái cho ${updatedRows.length} túi bài.`, type: 'success' });
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phân công túi [${row.package}] này không?`)) return;
    
    setLoading(true);
    try {
      const updatedData = assignmentData.filter(a => getRowKey(a) !== getRowKey(row));
      setAssignmentData(updatedData);
      
      // Sync delete action to GAS
      await syncData(roomData, updatedData, 'delete', [row]);
      
      setDialog({
        title: 'Thành công',
        message: `Đã xóa phân công túi ${row.package} thành công.`,
        type: 'success'
      });
    } catch (error: any) {
      setDialog({
        title: 'Lỗi',
        message: 'Không thể xóa phân công. Vui lòng thử lại.\n' + error.message,
        type: 'error'
      });
      refreshData(false);
    } finally {
      setLoading(false);
    }
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
      console.error(`Sync failed for action ${action}`, error);
      throw error;
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

  const filteredData = useMemo(() => {
    let data = assignmentData;
    if (loggedInTeacher) {
      data = data.filter(r => String(r.teacher).trim() === String(loggedInTeacher).trim());
    } else if (filterTeacher) {
      data = data.filter(r => String(r.teacher).trim() === String(filterTeacher).trim());
    }
    
    if (filterGrade) {
      data = data.filter(r => String(r.grade).trim() === String(filterGrade).trim());
    }
    if (filterSubject) {
      data = data.filter(r => String(r.subject).trim() === String(filterSubject).trim());
    }
    if (filterStatus) {
      data = data.filter(r => (r.status || 'Chưa') === filterStatus);
    }
    if (packageSearch) {
      const pkgs = packageSearch.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
      data = data.filter(r => pkgs.includes(String(r.package).trim().toUpperCase()));
    }
    return data;
  }, [assignmentData, filterTeacher, filterGrade, filterSubject, filterStatus, packageSearch]);

  return (
    <div className="flex flex-col gap-4 h-full lg:min-h-0 overflow-y-auto lg:overflow-hidden">
      {/* Right Panel: Controls & Results */}
      {/* Right Panel: Controls & Results */}
      <div className="flex flex-col gap-3 md:gap-4 shrink-0 lg:shrink lg:min-h-0 w-full">
        {/* Assignment Form (Now available for Teachers to self-assign) */}
        <div className="border border-gray-200 rounded-lg bg-white p-3 md:p-4 flex flex-col gap-3 shrink-0 shadow-sm border-l-4 border-l-blue-600">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-black text-gray-800 uppercase tracking-tight text-sm flex items-center gap-2">
              <span className="p-1 px-2 bg-blue-600 text-white rounded text-[10px]">NEW</span>
              Phân công tự nhập phách
            </h3>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-24">
              <label className="block text-[11px] text-gray-500 mb-1 uppercase font-black tracking-widest">Khối</label>
              <select 
                value={grade} onChange={e => setGrade(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="" key="default">-- Khối --</option>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="w-full sm:w-32">
              <label className="block text-[11px] text-gray-500 mb-1 uppercase font-black tracking-widest">Môn</label>
              <select 
                value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
                <option value="" key="default">-- Môn --</option>
                {subjectColumns.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[150px] w-full sm:w-auto">
              <label className="block text-[11px] text-gray-500 mb-1 uppercase font-black tracking-widest">Giáo viên</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={teacher} 
                  disabled={!!loggedInTeacher}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-slate-100 font-bold text-blue-700 disabled:opacity-80"
                  placeholder="Họ tên giáo viên..."
                />
              </div>
            </div>
            <div className="flex-2 min-w-[200px] w-full sm:w-auto">
              <label className="block text-[11px] text-gray-500 mb-1 uppercase font-black tracking-widest">Mã túi (cách nhau dấu phẩy)</label>
              <input 
                type="text" placeholder="VD: DKZ, YBK,..." 
                value={packages} onChange={e => setPackages(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white border-blue-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold placeholder:font-normal"
              />
            </div>
            <button 
              onClick={handleAssign}
              disabled={loading}
              className="w-full sm:w-auto px-8 py-2.5 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95 disabled:opacity-50"
            >
              {loading ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN NHẬP'}
            </button>
          </div>
        </div>

      {/* Results */}
      <div className="border border-gray-200 rounded-lg bg-white p-3 md:p-4 flex-1 flex flex-col shadow-sm min-h-[400px] lg:min-h-0 lg:overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between gap-3 mb-3 items-start sm:items-center">
          <div>
            <h3 className="font-semibold text-blue-700">Dữ liệu đã phân công</h3>
            <p className="text-xs text-gray-500 mt-1">Hiển thị tất cả các túi bài đã được phân công trong hệ thống.</p>
          </div>
          <div className="flex items-center gap-2">
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap hidden sm:inline">Lọc:</span>
          {!loggedInTeacher && (
            <select 
              value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full sm:w-48"
            >
              <option value="" key="all-teachers">Tất cả Giáo viên</option>
              {teachers.filter(Boolean).map(t => <option key={`filter-t-${t}`} value={t}>{t}</option>)}
            </select>
          )}
          <select 
            value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full sm:w-28"
          >
            <option value="" key="all-grades">Tất cả khối</option>
            {grades.filter(Boolean).map(g => <option key={`filter-g-${g}`} value={g}>{g}</option>)}
          </select>
          <select 
            value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full sm:w-36"
          >
            <option value="" key="all-subjects">Tất cả môn</option>
            {subjectColumns.filter(Boolean).map(s => <option key={`filter-s-${s}`} value={s}>{s}</option>)}
          </select>
          <select 
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm w-full sm:w-36"
          >
            <option value="" key="all">Tất cả trạng thái</option>
            <option value="Chưa" key="not-done">Chưa</option>
            <option value="Xong" key="done">Xong</option>
          </select>
          <div className="relative flex-1 min-w-[200px] w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" placeholder="Nhập mã túi cần tìm..." 
              value={packageSearch} onChange={e => setPackageSearch(e.target.value)}
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto border border-gray-200 rounded min-h-0">
          {/* Desktop Table View */}
          <table className="w-full text-sm text-left hidden md:table">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 w-12 text-center">STT</th>
                <th className="px-4 py-2">Khối</th>
                <th className="px-4 py-2">Môn</th>
                <th className="px-4 py-2">Giáo viên</th>
                <th className="px-4 py-2">Mã túi</th>
                <th className="px-4 py-2">Thời gian nhập</th>
                <th className="px-4 py-2 text-center">Trạng thái</th>
                <th className="px-4 py-2 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, i) => (
                <tr 
                  key={getRowKey(row, i)} 
                  className="border-b hover:opacity-90"
                  style={{ backgroundColor: row.color || 'white' }}
                >
                  <td className="px-4 py-2 text-center font-medium text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2">{row.grade}</td>
                  <td className="px-4 py-2">{row.subject}</td>
                  <td className="px-4 py-2 font-medium">{row.teacher}</td>
                  <td className="px-4 py-2 font-bold">{row.package}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">{row.timestamp || ''}</td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium",
                        (!row.status || row.status === 'Chưa') 
                          ? "bg-red-100 text-red-700" 
                          : "bg-green-100 text-green-700"
                      )}
                    >
                      {row.status || 'Chưa'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button 
                      onClick={() => handleDelete(row)}
                      className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                      title="Xóa phân công này"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Card View */}
          <div className="md:hidden flex flex-col gap-3 p-3">
            {filteredData.map((row, i) => (
              <div 
                key={`card-${getRowKey(row, i)}`} 
                className="p-4 rounded-lg border border-gray-200 shadow-sm"
                style={{ backgroundColor: row.color || 'white' }}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-gray-500">#{i + 1}</span>
                  <div
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-bold",
                      (!row.status || row.status === 'Chưa') 
                        ? "bg-red-100 text-red-700 border border-red-200" 
                        : "bg-green-100 text-green-700 border border-green-200"
                    )}
                  >
                    {row.status || 'Chưa'}
                  </div>
                  <button 
                    onClick={() => handleDelete(row)}
                    className="p-2 text-rose-600 bg-rose-50 rounded-lg active:bg-rose-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase block">Khối</span>
                    <span className="font-medium">{row.grade}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase block">Môn</span>
                    <span className="font-medium">{row.subject}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 text-[10px] uppercase block">Giáo viên</span>
                    <span className="font-bold text-blue-700">{row.teacher}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase block">Mã túi</span>
                    <span className="font-black text-lg">{row.package}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[10px] uppercase block">Thời gian</span>
                    <span className="text-xs">{row.timestamp || '---'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredData.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500 italic">
              Không tìm thấy dữ liệu phân công phù hợp.
            </div>
          )}
        </div>
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
    </div>
  );
};

