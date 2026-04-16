import React, { useState } from 'react';
import { Lock, User, AlertCircle, GraduationCap, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  onLogin: (type: 'admin' | 'teacher', credential: string) => void;
  loginError: string;
  isLoading: boolean;
  schoolName: string;
}

export const SplashScreen: React.FC<Props> = ({ onLogin, loginError, isLoading, schoolName }) => {
  const [loginTab, setLoginTab] = useState<'admin' | 'teacher'>('teacher');
  const [credential, setCredential] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential.trim()) return;
    onLogin(loginTab, credential);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950 text-white font-sans">
      {/* Animated Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse delay-700"></div>

      <div className="relative z-10 w-full max-w-lg p-6 flex flex-col items-center">
        {/* Header / Logo Section */}
        <div className="mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center justify-center p-4 bg-blue-600 rounded-3xl shadow-xl shadow-blue-600/30 mb-6">
            <GraduationCap size={48} className="text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 uppercase whitespace-nowrap">
            TIỆN ÍCH QUẢN LÝ KỲ THI
          </h1>
          <p className="text-slate-400 font-medium text-xs md:text-sm uppercase tracking-widest">
            {schoolName}
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full bg-slate-900/50 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
          {/* Tab Selection */}
          <div className="flex bg-slate-950/50 p-1.5 rounded-2xl mb-8 border border-white/5">
            <button
              onClick={() => { setLoginTab('teacher'); setCredential(''); }}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                loginTab === 'teacher' 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <User size={18} /> GIÁO VIÊN
            </button>
            <button
              onClick={() => { setLoginTab('admin'); setCredential(''); }}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2",
                loginTab === 'admin' 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Lock size={18} /> QUẢN TRỊ VIÊN
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                {loginTab === 'admin' ? 'Nhập Mật khẩu' : 'Nhập Số điện thoại'}
              </label>
              <input
                type={loginTab === 'admin' ? 'password' : 'tel'}
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                autoFocus
                className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-white placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-lg"
                placeholder={loginTab === 'admin' ? '••••••••' : '09xx xxx xxx'}
              />
            </div>

            {loginError && (
              <div className="flex items-start gap-2 text-rose-500 bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 animate-in shake duration-300">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p className="text-sm font-medium leading-relaxed">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !credential.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  BẮT ĐẦU LÀM VIỆC
                  <ChevronRight size={20} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[11px] text-slate-500 italic leading-relaxed">
              {loginTab === 'teacher' && 'Sử dụng số điện thoại cá nhân được phân công để truy cập danh sách túi bài.'}
            </p>
          </div>
        </div>

        <div className="mt-12 text-slate-600 text-[10px] font-bold tracking-widest uppercase">
          &copy; 2026 Việt Đỗ - Zalo: 0367013579
        </div>
      </div>
    </div>
  );
};
