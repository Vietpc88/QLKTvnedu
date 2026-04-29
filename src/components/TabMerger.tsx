import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import * as pdfMakeLib from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import { useAppContext } from '../store';
import { saveToGas } from '../lib/gas';
import { Upload, Save, Search, Trash2, Download, FileText, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

const pdfMake = (pdfMakeLib as any).default || pdfMakeLib;
const vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs || (window as any).pdfMake?.vfs;
if (vfs && pdfMake) {
  pdfMake.vfs = vfs;
}

export const TabMerger: React.FC = () => {
  const { 
    mergedData, setMergedData, 
    subjectColumns, assignmentData, roomData,
    gasUrl, refreshData
  } = useAppContext();

  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [currentFile, setCurrentFile] = useState('');
  const [searchSbd, setSearchSbd] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showMergedData, setShowMergedData] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncData = async (dataToSync: any[]) => {
    if (!gasUrl) return;
    setIsSyncing(true);
    try {
      await saveToGas(gasUrl, { mergedData: dataToSync });
    } catch (error) {
      console.error("Auto-sync failed", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!subject) {
      alert("Vui lòng chọn môn học trước khi tải file!");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setLoading(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      let newCombined: any[] = [];
      
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Find header row dynamically
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(20, sheetData.length); i++) {
          const row = sheetData[i];
          if (row && row.some(cell => {
            const val = String(cell).toLowerCase();
            return val.includes('số báo danh') || val === 'sbd' || val.includes('so bao danh');
          })) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex !== -1) {
          const headers = sheetData[headerRowIndex].map(h => String(h).trim());
          const rows = sheetData.slice(headerRowIndex + 1);
          
          rows.forEach((row) => {
            if (row.length > 0 && row.some(cell => cell !== undefined && cell !== '')) {
              const obj: any = {};
              headers.forEach((h, i) => {
                obj[h] = row[i];
              });
              
              // Helper to find value by possible keys
              const getVal = (keys: string[], fallbackIndex: number) => {
                for (const k of keys) {
                  const foundKey = Object.keys(obj).find(ok => ok.toLowerCase() === k.toLowerCase());
                  if (foundKey && obj[foundKey] !== undefined && obj[foundKey] !== '') {
                    return obj[foundKey];
                  }
                }
                return obj[headers[fallbackIndex]] || '';
              };

              // Map to standard format
              newCombined.push({
                stt: getVal(['STT', 'Số TT', 'So TT'], 0),
                name: getVal(['Họ và tên', 'Họ tên', 'Ho va ten', 'Ho ten'], 1),
                gender: getVal(['Giới tính', 'Gioi tinh', 'Nam/Nữ', 'Phái'], 2),
                dob: getVal(['Ngày sinh', 'Ngay sinh'], 3),
                pob: getVal(['Nơi sinh', 'Noi sinh'], 4),
                className: getVal(['Lớp', 'Lop'], 5),
                sbd: getVal(['Số báo danh', 'SBD', 'So bao danh'], 6),
                phach: getVal(['Số phách', 'Mã phách', 'Phách', 'So phach', 'Ma phach'], 7),
                tui: sheetName,
                subject: subject
              });
            }
          });
        }
      });
      
      if (newCombined.length === 0) {
        alert("Không tìm thấy dữ liệu hợp lệ trong file! Vui lòng đảm bảo file có dòng tiêu đề chứa cột 'Số báo danh' hoặc 'SBD'.");
        return;
      }

      const updatedData = [...mergedData, ...newCombined];
      setMergedData(updatedData);
      setCurrentFile(file.name);
      alert(`Đã ghép môn ${subject} thành công!`);
      syncData(updatedData);
    } catch (error: any) {
      alert(`Lỗi khi ghép: ${error.message}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteSubject = () => {
    if (!subject) return;
    
    if (!showConfirmDelete) {
      setShowConfirmDelete(true);
      setTimeout(() => setShowConfirmDelete(false), 3000);
      return;
    }

    const updatedData = mergedData.filter(r => r.subject !== subject);
    setMergedData(updatedData);
    setShowConfirmDelete(false);
    syncData(updatedData);
  };

  const handleSaveToGas = async () => {
    if (!gasUrl) {
      alert("Vui lòng cấu hình GAS URL trước!");
      return;
    }
    try {
      setLoading(true);
      await saveToGas(gasUrl, { mergedData });
      alert("Đã lưu dữ liệu lên Google Sheets thành công!");
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (mergedData.length === 0) {
      alert("Vui lòng tải file Excel Mã phách trước.");
      return;
    }
    if (!searchSbd.trim() && !searchName.trim()) {
      alert("Vui lòng nhập Số báo danh hoặc Họ và tên.");
      return;
    }

    let allMatches = mergedData;

    if (searchSbd.trim()) {
      const codeList = searchSbd.split(',').map(c => c.trim().toLowerCase());
      allMatches = allMatches.filter(r => 
        codeList.includes(String(r.sbd).trim().toLowerCase())
      );
    }

    if (searchName.trim()) {
      const nameQuery = searchName.trim().toLowerCase();
      allMatches = allMatches.filter(r => 
        String(r.name || '').toLowerCase().includes(nameQuery)
      );
    }

    if (allMatches.length === 0) {
      alert(`Không tìm thấy kết quả phù hợp.`);
      setSearchResults([]);
      return;
    }

    // If a subject is selected, check if matches belong to it
    let finalMatches = allMatches;
    if (subject && subject !== 'Tất cả') {
      finalMatches = allMatches.filter(r => r.subject === subject);
      
      if (finalMatches.length === 0) {
        const foundSubjects = Array.from(new Set(allMatches.map(m => m.subject))).join(', ');
        alert(`Kết quả tìm kiếm không thuộc môn ${subject}. Nó thuộc môn: ${foundSubjects}`);
        setSearchResults([]);
        return;
      }
    }

    // Merge with assignment data
    const finalResults = finalMatches.map(res => {
      const assignment = assignmentData.find(a => 
        a.subject.trim() === res.subject.trim() && 
        a.package.trim().toUpperCase() === res.tui.trim().toUpperCase()
      );
      return {
        ...res,
        teacher: assignment ? assignment.teacher : 'Chưa phân công',
        room: assignment ? assignment.room : 'Chưa xác định'
      };
    });

    setSearchResults(finalResults);
  };

  const handleExportResults = () => {
    if (searchResults.length === 0) return;
    
    const exportData = searchResults.map(row => ({
      "STT": row.stt,
      "Họ và tên": row.name,
      "Giới tính": row.gender,
      "Ngày sinh": row.dob,
      "Nơi sinh": row.pob,
      "Lớp": row.className,
      "Số báo danh": row.sbd,
      "Số phách": row.phach,
      "Túi thi": row.tui,
      "Điểm nói": row.speakingScore || '',
      "Giáo viên": row.teacher,
      "Phòng": row.room
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KetQua");
    XLSX.writeFile(wb, `KetQuaTimKiem_${new Date().getTime()}.xlsx`);
  };

  const handleExportPDF = () => {
    if (displayMergedData.length === 0) return;
    
    const bySubject: Record<string, any[]> = {};
    displayMergedData.forEach(row => {
      if (!bySubject[row.subject]) bySubject[row.subject] = [];
      bySubject[row.subject].push(row);
    });

    Object.keys(bySubject).forEach(subj => {
      const subjData = bySubject[subj];
      const byPackage: Record<string, any[]> = {};
      const packageOrder: Record<string, number> = {};
      let pkgCounter = 0;
      
      subjData.forEach(row => {
        if (!byPackage[row.tui]) {
          byPackage[row.tui] = [];
          packageOrder[row.tui] = pkgCounter++;
        }
        byPackage[row.tui].push(row);
      });

      const content: any[] = [];
      
      const packagesWithGrades = Object.keys(byPackage).map(pkg => {
        let grade = '.....';
        const assignment = assignmentData.find(a => 
          a.subject.trim().toLowerCase() === subj.trim().toLowerCase() && 
          a.package.trim().toUpperCase() === pkg.trim().toUpperCase()
        );
        
        if (assignment && assignment.grade) {
          grade = assignment.grade;
        } else if (roomData && roomData.length > 0) {
          const origRow = roomData.find(r => {
            const cellVal = r[subj];
            if (cellVal) {
              const pkgs = String(cellVal).split(',').map(p => p.trim().toUpperCase());
              return pkgs.includes(pkg.trim().toUpperCase());
            }
            return false;
          });
          if (origRow) {
            const roomRaw = String(origRow.room || '');
            if (roomRaw.includes('Khối')) {
              grade = roomRaw.split('Khối').pop()?.trim() || '.....';
            }
          }
        }
        return { pkg, grade, data: byPackage[pkg] };
      });

      // Sort by Grade then by Original Package Order
      packagesWithGrades.sort((a, b) => {
        const gradeA = parseInt(String(a.grade).replace(/\D/g, '')) || 0;
        const gradeB = parseInt(String(b.grade).replace(/\D/g, '')) || 0;
        
        if (gradeA !== gradeB) {
          return gradeA - gradeB;
        }
        return packageOrder[a.pkg] - packageOrder[b.pkg];
      });
      
      packagesWithGrades.forEach((pkgObj, pkgIndex) => {
        const { pkg, grade, data: pkgData } = pkgObj;
        
        pkgData.sort((a, b) => {
          const numA = parseFloat(String(a.stt).replace('.', ''));
          const numB = parseFloat(String(b.stt).replace('.', ''));
          return (isNaN(numA) ? 999 : numA) - (isNaN(numB) ? 999 : numB);
        });

        // Pad with empty rows to ensure a consistent table height (e.g., 25 rows)
        const MIN_ROWS = 25;
        const displayData = [...pkgData];
        while (displayData.length < MIN_ROWS) {
          displayData.push({ stt: '', phach: '', isPadding: true });
        }

        const isEnglish = String(subj).toLowerCase().includes('anh');
        
        const tableBody: any[] = [];
        
        const headerRow = [
          { text: 'STT', style: 'tableHeader', alignment: 'center' },
          { text: 'SP', style: 'tableHeader', alignment: 'center' }
        ];

        if (isEnglish) {
          headerRow.push({ text: 'ĐIỂM NÓI', style: 'tableHeader', alignment: 'center' });
          headerRow.push({ text: 'ĐIỂM VIẾT', style: 'tableHeader', alignment: 'center' });
          headerRow.push({ text: 'Ghi chú', style: 'tableHeader', alignment: 'center' });
        } else {
          headerRow.push({ text: subj.toUpperCase(), style: 'tableHeader', alignment: 'center' });
          headerRow.push({ text: 'Chú thích', style: 'tableHeader', alignment: 'center' });
        }
        
        tableBody.push(headerRow);

        displayData.forEach((row, rowIndex) => {
          const rowData: any[] = [
            { text: row.stt !== '' ? row.stt : '', alignment: 'center' },
            { text: row.phach || '', alignment: 'center' }
          ];

          if (isEnglish) {
            rowData.push({ text: row.speakingScore || '', alignment: 'center', bold: true });
            rowData.push({ text: '', alignment: 'center' });
            rowData.push({ text: '', alignment: 'center' });
          } else {
            rowData.push({ text: '', alignment: 'center' });
            rowData.push({ text: '', alignment: 'center' });
          }
          
          tableBody.push(rowData);
        });

        content.push({
          text: `DANH SÁCH ĐIỂM THI MÔN ${subj.toUpperCase()}`,
          style: 'header',
          alignment: 'center'
        });
        content.push({
          text: `Túi thi ${pkg}`,
          style: 'subheader',
          alignment: 'center'
        });
        content.push({
          text: `KHỐI: ${grade}`,
          style: 'subheader',
          alignment: 'center',
          margin: [0, 0, 0, 5]
        });

        content.push({
          table: {
            headerRows: 1,
            widths: isEnglish ? [30, 60, 60, 60, '*'] : [40, 80, 120, '*'],
            heights: 17, // Uniform height for all rows
            body: tableBody
          },
          layout: {
            hLineWidth: function () { return 1; },
            vLineWidth: function () { return 1; },
            hLineColor: function () { return '#000000'; },
            vLineColor: function () { return '#000000'; },
            paddingLeft: function() { return 4; },
            paddingRight: function() { return 4; },
            paddingTop: function() { return 2; },
            paddingBottom: function() { return 2; },
          }
        });

        // Notes section at the bottom
        content.push({
          margin: [0, 10, 0, 0],
          columns: [
            {
              width: '60%',
              text: [
                { text: 'Lưu ý:\n', bold: true, fontSize: 11 },
                { text: '- Ghi điểm rõ ràng, đúng hàng.\n- Làm tròn đến chữ số thập phân thứ nhất.\n- Kiểm tra kỹ trước khi nhập điểm.\n', italics: true, fontSize: 11 }
              ]
            },
            {
              width: '40%',
              text: 'Sửa: ..... chỗ',
              italics: true,
              fontSize: 11,
              alignment: 'right'
            }
          ]
        });

        // Signatures on the same row
        content.push({
          margin: [0, 20, 0, 0],
          columns: [
            {
              width: '50%',
              text: 'GK1 (Ký và ghi rõ họ và tên)',
              bold: true,
              italics: true,
              alignment: 'center'
            },
            {
              width: '50%',
              text: 'GK2 (Ký và ghi rõ họ và tên)',
              bold: true,
              italics: true,
              alignment: 'center'
            }
          ]
        });

        if (pkgIndex < packagesWithGrades.length - 1) {
          content.push({ text: '', pageBreak: 'after' });
        }
      });

      const docDefinition = {
        content: content,
        pageSize: 'A4',
        pageMargins: [40, 30, 40, 30],
        styles: {
          header: {
            fontSize: 14,
            bold: true,
            margin: [0, 0, 0, 2]
          },
          subheader: {
            fontSize: 13,
            bold: true,
            margin: [0, 0, 0, 2]
          },
          tableHeader: {
            bold: true,
            fontSize: 11,
            color: 'black',
            margin: [0, 2, 0, 2]
          }
        },
        defaultStyle: {
          fontSize: 11
        }
      };

      pdfMake.createPdf(docDefinition as any).download(`MauNhapDiem_${subj}.pdf`);
    });
  };

  const displayMergedData = useMemo(() => {
    if (subject && subject !== 'Tất cả') {
      return mergedData.filter(r => r.subject === subject);
    }
    return mergedData;
  }, [mergedData, subject]);

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Top Config */}
      <div className="border border-gray-200 rounded-lg bg-white p-4 shrink-0">
        <h3 className="font-semibold text-blue-700 mb-3">1. Nhập liệu & Cấu hình</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-48">
            <label className="block text-[11px] text-gray-500 mb-1 uppercase font-semibold">Chọn môn học</label>
            <select 
              value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            >
              <option value="">-- Chọn môn --</option>
              <option value="Tất cả">Tất cả</option>
              {subjectColumns.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 h-[34px]"
            >
              <Upload size={16} /> Chọn tệp Excel
            </button>
            <span className="text-xs text-gray-500 italic max-w-[150px] truncate" title={currentFile}>
              {currentFile ? currentFile : 'Chưa chọn tệp...'}
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className={cn(
                "flex items-center gap-1 px-4 py-1.5 bg-slate-100 text-slate-700 text-sm rounded hover:bg-slate-200 disabled:opacity-50 h-[34px]",
                isRefreshing && "animate-spin"
              )}
              title="Tải lại dữ liệu mới nhất từ Cloud"
            >
              <RefreshCw size={16} />
            </button>
            <button 
              onClick={handleSaveToGas} disabled={loading}
              className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 h-[34px]"
            >
              <Save size={16} /> Lưu dữ liệu
            </button>
            <button 
              onClick={handleDeleteSubject}
              disabled={!subject || subject === 'Tất cả'}
              className={cn(
                "flex items-center gap-1 px-4 py-1.5 text-white text-sm rounded transition-colors h-[34px] disabled:opacity-50 disabled:cursor-not-allowed",
                showConfirmDelete ? "bg-red-700 font-bold ring-2 ring-red-300" : "bg-red-600 hover:bg-red-700"
              )}
            >
              <Trash2 size={16} /> {showConfirmDelete ? "Xác nhận xóa?" : "Xóa môn này"}
            </button>
            {isSyncing && <span className="text-xs text-blue-500 animate-pulse font-medium ml-2">Đang đồng bộ...</span>}
          </div>
        </div>
      </div>

      {/* Lookup */}
      <div className="border border-gray-200 rounded-lg bg-white p-4 shrink-0">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-blue-700">2. Tra cứu Thí sinh</h3>
          <button 
            onClick={() => setShowMergedData(!showMergedData)}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded hover:bg-indigo-200 transition-colors"
          >
            {showMergedData ? 'Ẩn Dữ liệu đã ghép' : 'Hiện Dữ liệu đã ghép'}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="block text-[11px] text-gray-500 mb-1 uppercase font-semibold">Nhập SBD</label>
            <input 
              type="text" placeholder="Nhập SBD cần tra cứu (ví dụ: 001, 002...)" 
              value={searchSbd} onChange={e => setSearchSbd(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-[11px] text-gray-500 mb-1 uppercase font-semibold">Họ và tên</label>
            <input 
              type="text" placeholder="Nhập họ tên cần tra cứu..." 
              value={searchName} onChange={e => setSearchName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <button 
            onClick={handleSearch}
            className="flex items-center justify-center gap-2 px-6 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 h-[34px] w-full sm:w-40"
          >
            <Search size={16} /> Tìm kiếm
          </button>
        </div>
      </div>

      {/* Tables Splitter */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 lg:overflow-hidden">
        {/* Merged Data Table */}
        {showMergedData && (
          <div className="w-full lg:w-1/2 flex flex-col border border-gray-200 rounded-lg bg-white min-h-[400px] lg:min-h-0 lg:overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center shrink-0">
              <span className="font-semibold text-gray-700">Dữ liệu đã ghép (Tổng hợp)</span>
              <button 
                onClick={handleExportPDF}
                disabled={displayMergedData.length === 0}
                className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
              >
                <FileText size={14} /> Xuất PDF Nhập điểm
              </button>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">STT</th>
                    <th className="px-3 py-2">SBD</th>
                    <th className="px-3 py-2">Phách</th>
                    <th className="px-3 py-2">Túi</th>
                    <th className="px-3 py-2">Môn</th>
                    <th className="px-3 py-2">Họ tên</th>
                    <th className="px-3 py-2">Điểm Nói</th>
                  </tr>
                </thead>
                <tbody>
                  {displayMergedData.map((row, i) => (
                    <tr key={i} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-3 py-2">{row.stt}</td>
                      <td className="px-3 py-2 font-medium">{row.sbd}</td>
                      <td className="px-3 py-2">{row.phach}</td>
                      <td className="px-3 py-2">{row.tui}</td>
                      <td className="px-3 py-2">{row.subject}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 font-bold text-indigo-600">{row.speakingScore || '-'}</td>
                    </tr>
                  ))}
                  {displayMergedData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                        Chưa có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Search Results Table */}
        <div className={cn(
          "flex flex-col border border-gray-200 rounded-lg bg-white min-h-[400px] lg:min-h-0 lg:overflow-hidden",
          showMergedData ? "w-full lg:w-1/2" : "w-full"
        )}>
          <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center shrink-0">
            <span className="font-semibold text-gray-700">Kết quả tìm kiếm</span>
            <button 
              onClick={handleExportResults}
              disabled={searchResults.length === 0}
              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
            >
              <Download size={14} /> Xuất Excel
            </button>
          </div>
          <div className="flex-1 overflow-auto min-h-0">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2">SBD</th>
                  <th className="px-3 py-2">Phách</th>
                  <th className="px-3 py-2">Túi</th>
                  <th className="px-3 py-2">Giáo viên</th>
                  <th className="px-3 py-2">Phòng</th>
                  <th className="px-3 py-2">Họ tên</th>
                  <th className="px-3 py-2">Điểm Nói</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((row, i) => (
                  <tr key={i} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{row.sbd}</td>
                    <td className="px-3 py-2">{row.phach}</td>
                    <td className="px-3 py-2">{row.tui}</td>
                    <td className="px-3 py-2 font-bold text-blue-600">{row.teacher}</td>
                    <td className="px-3 py-2 text-red-600 font-medium">{row.room}</td>
                    <td className="px-3 py-2">{row.name}</td>
                    <td className="px-3 py-2 font-bold text-indigo-600">{row.speakingScore || '-'}</td>
                  </tr>
                ))}
                {searchResults.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Chưa có kết quả tìm kiếm
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
