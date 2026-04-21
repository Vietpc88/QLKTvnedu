import { formatPhoneNumber } from './utils';

export const saveToGas = async (gasUrl: string, payload: any, action: 'sync' | 'append' | 'updateStatus' | 'updateSpeakingScore' | 'delete' = 'sync') => {
  if (!gasUrl) throw new Error('Chưa cấu hình Google Apps Script URL');
  
  try {
    const formattedPayload = { ...payload, action };
    
    // Group mergedData by subject into Phach_ sheets
    if (formattedPayload.mergedData && Array.isArray(formattedPayload.mergedData)) {
      const grouped: Record<string, any[]> = {};
      formattedPayload.mergedData.forEach((row: any) => {
        const subject = row.subject || row['Môn'] || 'KhongXacDinh';
        const key = `Phach_${subject}`;
        if (!grouped[key]) grouped[key] = [];
        
        // Map to Vietnamese keys
        grouped[key].push({
          'STT': row.stt || row['STT'] || '',
          'Họ và tên': row.name || row['Họ và tên'] || '',
          'Giới tính': row.gender || row['Giới tính'] || '',
          'Ngày sinh': row.dob || row['Ngày sinh'] || '',
          'Nơi sinh': row.pob || row['Nơi sinh'] || '',
          'Lớp': row.className || row['Lớp'] || '',
          'SBD': row.sbd || row['SBD'] || '',
          'Phách': row.phach || row['Phách'] || '',
          'Túi': row.tui || row['Túi'] || '',
          'Môn': subject,
          'Điểm Nói': row.speakingScore || row['Điểm Nói'] || ''
        });
      });
      
      // Add grouped sheets to payload
      Object.keys(grouped).forEach(key => {
        formattedPayload[key] = grouped[key];
      });
      
      // Add flag to tell GAS script to sync Phach sheets
      formattedPayload.syncPhach = true;
      
      // Remove mergedData to save bandwidth as GAS script now uses Phach_ sheets
      delete formattedPayload.mergedData;
    }

    if (formattedPayload.assignmentData) {
      formattedPayload.assignmentData = formattedPayload.assignmentData.map((row: any) => {
        const newRow = { ...row };
        
        // Get phone value robustly
        let phoneVal = '';
        if (newRow.phone != null && String(newRow.phone).trim() !== '') {
          phoneVal = formatPhoneNumber(newRow.phone);
        } else if (newRow['Số điện thoại'] != null && String(newRow['Số điện thoại']).trim() !== '') {
          phoneVal = formatPhoneNumber(newRow['Số điện thoại']);
        }
        
        if (phoneVal && !phoneVal.startsWith("'")) {
          phoneVal = `'${phoneVal}`;
        }
        
        // Map all keys to Vietnamese for the sheet
        const mappedRow: any = {
          'Khối': newRow.grade || newRow['Khối'] || '',
          'Môn': newRow.subject || newRow['Môn'] || '',
          'Giáo viên': newRow.teacher || newRow['Giáo viên'] || '',
          'Số điện thoại': phoneVal,
          'Mã túi': newRow.package || newRow['Mã túi'] || '',
          'STT': newRow.stt || newRow['STT'] || '',
          'Phòng': newRow.room || newRow['Phòng'] || '',
          'Ngày giờ nhập': newRow.timestamp || newRow['Ngày giờ nhập'] || '',
          'Trạng thái': newRow.status || newRow['Trạng thái'] || 'Chưa',
          'color': newRow.color || '',
          'ID': newRow.id || `${newRow.grade}-${newRow.subject}-${newRow.package}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
        };
        
        return mappedRow;
      });
    }

    // Wrap Invigilation and other configs into a JSON store to avoid date formatting issues
    const invigilationKeys = [
      'invigilationAssignments', 
      'anonymizationTeam', 
      'secretariatTeam', 
      'teacherConfig', 
      'invigilationConfig',
      'englishSpeakingAccounts'
    ];

    const hasInvigilationData = invigilationKeys.some(key => formattedPayload[key] !== undefined);
    
    if (hasInvigilationData) {
      const invigilationData: any = {};
      invigilationKeys.forEach(key => {
        if (formattedPayload[key] !== undefined) {
          invigilationData[key] = formattedPayload[key];
          // Delete from top level to avoid redundant storage if GAS script writes everything
          delete formattedPayload[key];
        }
      });
      formattedPayload.invigilationStore = JSON.stringify(invigilationData);
    }

    const response = await fetch(gasUrl.trim(), {
      method: 'POST',
      body: JSON.stringify(formattedPayload),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Lỗi HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error('Máy chủ không trả về phản hồi JSON hợp lệ.');
    }

    if (result.status === 'error') {
      throw new Error(result.message);
    }
    return result;
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.message === 'Load failed') {
      throw new Error('Không thể kết nối tới Google Apps Script. Vui lòng kiểm tra kết nối mạng hoặc URL GAS. Đảm bảo bạn đã chọn "Anyone" khi triển khai.');
    }
    throw new Error(`Lỗi khi lưu dữ liệu: ${error.message}`);
  }
};

export const loadFromGas = async (gasUrl: string) => {
  const url = gasUrl?.trim();
  if (!url) throw new Error('Chưa cấu hình Google Apps Script URL');
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Lỗi HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        throw new Error('Máy chủ trả về trang HTML thay vì dữ liệu. Vui lòng kiểm tra xem bạn đã triển khai GAS đúng cách chưa (Deploy as Web App, Access: Anyone).');
      }
      throw new Error('Dữ liệu trả về không đúng định dạng JSON.');
    }
    
    if (result.status === 'error') {
      throw new Error(result.message);
    }
    
    // Extract data part (handle both {data: {...}} and {...} formats)
    const dataPart = result.data || result;
    const rawAssignments = Array.isArray(dataPart.assignmentData) ? dataPart.assignmentData : [];
    const rawOriginal = Array.isArray(dataPart.originalData) ? dataPart.originalData : [];

    // Check for JSON Store and merge it back into dataPart
    if (dataPart.invigilationStore && typeof dataPart.invigilationStore === 'string') {
      try {
        const storedData = JSON.parse(dataPart.invigilationStore);
        Object.assign(dataPart, storedData);
      } catch (e) {
        console.error('Failed to parse invigilationStore', e);
      }
    }

    // Helper to normalize keys of an object (lowercase and trim)
    const normalizeKeys = (obj: any) => {
      if (!obj || typeof obj !== 'object') return {};
      const normalized: any = {};
      Object.keys(obj).forEach(k => {
        normalized[k.trim().toLowerCase()] = obj[k];
      });
      return normalized;
    };

    // Map original data keys to lowercase for consistent access while preserving original keys
    const rawRoomData = Array.isArray(dataPart.roomData) ? dataPart.roomData : [];
    const originalHeaders = rawOriginal.length > 0 
      ? Object.keys(rawOriginal[0]) 
      : (rawRoomData.length > 0 ? Object.keys(rawRoomData[0]) : []);
    
    const subjectColumns = originalHeaders.filter(k => {
      const l = (k || '').toLowerCase().trim();
      if (!l || l === '' || l.includes('empty') || l.startsWith('_')) return false;
      const lowerKey = k.trim().toLowerCase();
      const isSystemKey = [
        'số điện thoại', 'sđt', 'điện thoại', 'giáo viên', 'stt', 
        'phòng - khối', 'phòng thi', 'phong thi', 'phòng', 'room', 
        'grade', 'khối', 'khoi', 'tên giáo viên', 'ten giao vien'
      ].some(sysKey => lowerKey.includes(sysKey) || lowerKey === sysKey);
      
      return !isSystemKey;
    });

    const mappedOriginal = rawOriginal.map((row: any) => {
      const normalized: any = { ...row };
      Object.keys(row).forEach(k => {
        const lower = k.trim().toLowerCase();
        // Only add lowercase for standard keys to avoid polluting with lowercase subjects
        if (['stt', 'giáo viên', 'số điện thoại', 'sđt', 'điện thoại', 'phòng - khối'].includes(lower)) {
          normalized[lower] = row[k];
        }
      });
      return normalized;
    });

    // Map Vietnamese keys back to English keys for assignmentData
    const mappedAssignments = rawAssignments
      .map((row: any) => {
        const normalizedRow = normalizeKeys(row);
        
        const getValue = (keys: string[]) => {
          for (const key of keys) {
            const lowerKey = key.toLowerCase();
            if (normalizedRow[lowerKey] !== undefined && normalizedRow[lowerKey] !== null) return normalizedRow[lowerKey];
          }
          return '';
        };

        let phoneVal = formatPhoneNumber(getValue(['số điện thoại', 'sđt', 'điện thoại', 'phone', 'phone number', 'dienthoai', 'sodienthoai']));
        if (phoneVal.startsWith("'")) {
          phoneVal = phoneVal.substring(1);
        }
        
        const subjectVal = String(getValue(['môn', 'subject', 'mon', 'môn thi', 'monthi'])).trim();
        // Match subject casing with original headers if possible
        const matchedSubject = subjectColumns.find(s => s.toLowerCase() === subjectVal.toLowerCase()) || subjectVal;

        return {
          grade: String(getValue(['khối', 'grade', 'khoi', 'khối lớp'])).trim(),
          subject: matchedSubject,
          teacher: String(getValue(['giáo viên', 'teacher', 'giao vien', 'gv', 'giaovien'])).trim(),
          phone: phoneVal,
          package: String(getValue(['mã túi', 'package', 'ma tui', 'túi', 'mã', 'matui'])).trim(),
          stt: String(getValue(['stt', 'số thứ tự', 'sothutu'])).trim(),
          room: String(getValue(['phòng', 'phòng - khối', 'room', 'phong', 'phòng thi', 'phongthi'])).trim(),
          timestamp: String(getValue(['ngày giờ nhập', 'thời gian nhập', 'thời gian', 'timestamp', 'time', 'thoigian'])).trim(),
          status: String(getValue(['trạng thái', 'status', 'trang thai', 'trangthai']) || 'Chưa').trim(),
          color: String(getValue(['color', 'màu', 'mau'])).trim(),
          id: String(getValue(['id', 'mã định danh'])).trim(),
        };
      })
      .filter((row: any) => row !== null && (row.package || row.teacher || row.grade));

    let rawMerged: any[] = [];
    if (Array.isArray(dataPart.mergedData)) {
      rawMerged = dataPart.mergedData;
    }
    
    // Also check for sheets starting with Phach_
    Object.keys(dataPart).forEach(key => {
      if (key.startsWith('Phach_') && Array.isArray(dataPart[key])) {
        const subject = key.substring(6); // Remove 'Phach_'
        const sheetData = dataPart[key].map((row: any) => ({
          ...row,
          subject: row.subject || row['Môn'] || subject
        }));
        rawMerged = rawMerged.concat(sheetData);
      }
    });

    const mappedMerged = rawMerged.map((row: any) => {
      const normalizedRow = normalizeKeys(row);
      const getValue = (keys: string[]) => {
        for (const key of keys) {
          const lowerKey = key.toLowerCase();
          if (normalizedRow[lowerKey] !== undefined && normalizedRow[lowerKey] !== null) return normalizedRow[lowerKey];
        }
        return '';
      };
      
      return {
        stt: String(getValue(['stt', 'số tt', 'so tt'])).trim(),
        name: String(getValue(['name', 'họ và tên', 'họ tên', 'ho va ten', 'ho ten'])).trim(),
        gender: String(getValue(['gender', 'giới tính', 'gioi tinh', 'nam/nữ', 'phái'])).trim(),
        dob: String(getValue(['dob', 'ngày sinh', 'ngay sinh'])).trim(),
        pob: String(getValue(['pob', 'nơi sinh', 'noi sinh'])).trim(),
        className: String(getValue(['classname', 'lớp', 'lop'])).trim(),
        sbd: String(getValue(['sbd', 'số báo danh', 'so bao danh'])).trim(),
        phach: String(getValue(['phach', 'số phách', 'mã phách', 'phách', 'so phach', 'ma phach'])).trim(),
        tui: String(getValue(['tui', 'túi', 'mã túi', 'ma tui'])).trim(),
        subject: String(getValue(['subject', 'môn', 'mon', 'môn thi', 'monthi'])).trim()
      };
    }).filter((row: any) => row.sbd || row.phach || row.name);

    return {
      originalData: mappedOriginal,
      assignmentData: mappedAssignments,
      subjectColumns,
      mergedData: mappedMerged,
      adminAccounts: Array.isArray(dataPart.adminAccounts) ? dataPart.adminAccounts : [],
      teacherConfig: Array.isArray(dataPart.teacherConfig) ? dataPart.teacherConfig : [],
      examSchedule: Array.isArray(dataPart.examSchedule) ? dataPart.examSchedule : [],
      anonymizationTeam: Array.isArray(dataPart.anonymizationTeam) ? dataPart.anonymizationTeam : [],
      secretariatTeam: Array.isArray(dataPart.secretariatTeam) ? dataPart.secretariatTeam : [],
      markingSubjects: Array.isArray(dataPart.markingSubjects) ? dataPart.markingSubjects : [],
      exemptTeachers: Array.isArray(dataPart.exemptTeachers) ? dataPart.exemptTeachers : [],
      secretariatPairs: Array.isArray(dataPart.secretariatPairs) ? dataPart.secretariatPairs : [],
      schoolInfo: dataPart.schoolInfo || null,
      teacherList: Array.isArray(dataPart.teacherList) ? dataPart.teacherList : [],
      roomData: Array.isArray(dataPart.roomData) ? dataPart.roomData : [],
      invigilationConfig: dataPart.invigilationConfig || { invigilatorsPerRoom: 2 },
      englishSpeakingAccounts: Array.isArray(dataPart.englishSpeakingAccounts) ? dataPart.englishSpeakingAccounts : []
    };
  } catch (error: any) {
    if (error.message === 'Failed to fetch' || error.message === 'Load failed') {
      throw new Error('Không thể kết nối tới Google Apps Script. Vui lòng kiểm tra kết nối mạng hoặc URL GAS. Đảm bảo bạn đã chọn "Anyone" khi triển khai.');
    }
    throw new Error(`Lỗi khi tải dữ liệu: ${error.message}`);
  }
};
