import React, { useState, useEffect } from 'react';
import { X, Save, Database, ShieldCheck, AlertCircle, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { migrateDataToFirebase } from '../lib/gas';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  gasUrl: string;
}

export const FirebaseSetupModal: React.FC<Props> = ({ isOpen, onClose, gasUrl }) => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [config, setConfig] = useState({
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  });

  const [useFirebase, setUseFirebase] = useState(() => localStorage.getItem('storageType') === 'firebase');

  useEffect(() => {
    const saved = localStorage.getItem('firebaseConfig');
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('firebaseConfig', JSON.stringify(config));
    localStorage.setItem('storageType', useFirebase ? 'firebase' : 'gas');
    alert('Đã lưu cấu hình Firebase. Ứng dụng sẽ tải lại để áp dụng thay đổi.');
    window.location.reload();
  };

  const handleMigrate = async () => {
    if (!gasUrl) {
      alert('Vui lòng cấu hình Google Apps Script URL trước khi di chuyển dữ liệu.');
      return;
    }
    
    if (!window.confirm('Hệ thống sẽ tải toàn bộ dữ liệu từ Google Sheets và ghi đè lên Firebase. Bạn có chắc chắn muốn tiếp tục?')) {
      return;
    }

    setIsMigrating(true);
    try {
      const result = await migrateDataToFirebase(gasUrl);
      alert(result.message);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsMigrating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in duration-300">
        <div className="flex items-center justify-between p-8 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Cấu hình Firebase</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Thay thế Google Sheets</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-all">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto flex-1 space-y-6">
          <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-amber-600" />
              <div>
                <p className="text-sm font-bold text-amber-900">Sử dụng Firebase làm kho lưu trữ chính</p>
                <p className="text-[11px] text-amber-700">Dữ liệu sẽ được đồng bộ thời gian thực và bảo mật hơn.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={useFirebase}
                onChange={e => setUseFirebase(e.target.checked)}
              />
              <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.keys(config).map((key) => (
              <div key={key} className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{key}</label>
                <input
                  type="text"
                  value={(config as any)[key]}
                  onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                  placeholder={`Nhập ${key}...`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none"
                />
              </div>
            ))}
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-3">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="text-amber-600" size={20} />
              <div>
                <p className="text-sm font-bold text-amber-900">Di chuyển dữ liệu (Migration)</p>
                <p className="text-[11px] text-amber-700">Tải tất cả các Sheet từ Google Sheets và lưu vào Firebase ngay bây giờ.</p>
              </div>
            </div>
            <button
              onClick={handleMigrate}
              disabled={isMigrating}
              className="w-full py-3 bg-white border border-amber-200 text-amber-700 rounded-xl font-bold text-sm hover:bg-amber-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isMigrating ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Database size={16} />
              )}
              {isMigrating ? 'Đang di chuyển dữ liệu...' : 'Bắt đầu di chuyển từ Google Sheets'}
            </button>
          </div>

          <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex gap-3">
            <AlertCircle className="text-blue-600 shrink-0" size={20} />
            <div className="text-xs text-blue-800 leading-relaxed">
              <p className="font-bold mb-1">Cách lấy thông tin:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Truy cập <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-bold">Firebase Console</a></li>
                <li>Tạo dự án mới hoặc chọn dự án hiện có.</li>
                <li>Vào <strong>Project Settings</strong> &gt; <strong>General</strong>.</li>
                <li>Cuộn xuống <strong>Your apps</strong> và chọn biểu tượng <strong>Web ({"</>"})</strong>.</li>
                <li>Sao chép các giá trị tương ứng vào ô bên trên.</li>
              </ol>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-2xl transition-all"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-amber-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-amber-600/20 hover:bg-amber-700 transition-all flex items-center gap-2"
          >
            <Save size={18} />
            Lưu cấu hình
          </button>
        </div>
      </div>
    </div>
  );
};
