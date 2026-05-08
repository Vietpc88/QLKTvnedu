import React, { useState } from 'react';
import { Lock, User, AlertCircle, GraduationCap, ChevronRight, Phone, ShieldCheck, Mic } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  onLogin: (type: 'admin' | 'teacher' | 'speaking_teacher', credential: string, username?: string) => void;
  loginError: string;
  isLoading: boolean;
  schoolName: string;
}

export const SplashScreen: React.FC<Props> = ({ onLogin, loginError, isLoading, schoolName }) => {
  const [loginTab, setLoginTab] = useState<'admin' | 'teacher' | 'speaking_teacher'>('teacher');
  const [credential, setCredential] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential.trim()) return;
    if (loginTab === 'speaking_teacher' && !username.trim()) return;
    onLogin(loginTab, credential, username);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-bg-main font-manrope">
      {/* Premium Gradient Background Elements */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-accent/5 rounded-full blur-[100px]"></div>

      <div className="relative z-10 w-full max-w-lg p-6 flex flex-col">
        {/* Logo Section */}
        <div className="mb-10 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/20 mb-6">
            <GraduationCap size={32} />
          </div>
          <h1 className="text-3xl font-extrabold text-text-heading tracking-tight mb-2">
            QLKT Pro
          </h1>
          <p className="text-text-body font-bold text-xs uppercase tracking-widest opacity-60">
            {schoolName || 'Hệ thống quản lý kỳ thi thông minh'}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-gray-100 shadow-[var(--shadow-card)] rounded-2xl transition-all p-10">
          <h2 className="text-xl font-extrabold text-text-heading mb-8 text-center">Đăng nhập tài khoản</h2>
          
          {/* Snov.io Style Tabs */}
          <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-10 border border-border-soft">
            <button
              onClick={() => { setLoginTab('teacher'); setCredential(''); setUsername(''); }}
              className={cn(
                "flex-1 py-2.5 rounded-[14px] text-xs font-extrabold transition-all flex items-center justify-center gap-2 uppercase tracking-wider",
                loginTab === 'teacher' 
                  ? "bg-white text-primary shadow-sm border border-border-soft" 
                  : "text-text-body/60 hover:text-text-body"
              )}
            >
              <User size={14} /> Giáo viên
            </button>
            <button
              onClick={() => { setLoginTab('speaking_teacher'); setCredential(''); setUsername(''); }}
              className={cn(
                "flex-1 py-2.5 rounded-[14px] text-[10px] md:text-xs font-extrabold transition-all flex items-center justify-center gap-2 uppercase tracking-wider",
                loginTab === 'speaking_teacher' 
                  ? "bg-white text-primary shadow-sm border border-border-soft" 
                  : "text-text-body/60 hover:text-text-body"
              )}
            >
              <Mic size={14} /> Điểm Nói
            </button>
            <button
              onClick={() => { setLoginTab('admin'); setCredential(''); setUsername(''); }}
              className={cn(
                "flex-1 py-2.5 rounded-[14px] text-xs font-extrabold transition-all flex items-center justify-center gap-2 uppercase tracking-wider",
                loginTab === 'admin' 
                  ? "bg-white text-primary shadow-sm border border-border-soft" 
                  : "text-text-body/60 hover:text-text-body"
              )}
            >
              <ShieldCheck size={14} /> Admin
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {loginTab === 'speaking_teacher' ? (
              <>
                <div className="space-y-2">
                  <label className="text-[11px] font-extrabold text-text-body opacity-60 uppercase tracking-widest ml-1">
                    Số điện thoại / ID
                  </label>
                  <div className="relative group">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-text-body/40 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoFocus
                      className="w-full bg-slate-50 border border-border-soft rounded-2xl py-4 pl-12 pr-4 text-text-heading placeholder:text-text-body/30 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-bold"
                      placeholder="Nhập số điện thoại..."
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-extrabold text-text-body opacity-60 uppercase tracking-widest ml-1">
                    Mật khẩu
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-body/40 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                      type="password"
                      value={credential}
                      onChange={(e) => setCredential(e.target.value)}
                      className="w-full bg-slate-50 border border-border-soft rounded-2xl py-4 pl-12 pr-4 text-text-heading placeholder:text-text-body/30 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-bold"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-[11px] font-extrabold text-text-body opacity-60 uppercase tracking-widest ml-1">
                  {loginTab === 'admin' ? 'Xác thực quản trị' : 'Xác thực giáo viên'}
                </label>
                <div className="relative group">
                  {loginTab === 'admin' ? (
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-body/40 group-focus-within:text-primary transition-colors" size={18} />
                  ) : (
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-text-body/40 group-focus-within:text-primary transition-colors" size={18} />
                  )}
                  <input
                    type={loginTab === 'admin' ? 'password' : 'tel'}
                    value={credential}
                    onChange={(e) => setCredential(e.target.value)}
                    autoFocus={loginTab !== 'speaking_teacher'}
                    className="w-full bg-slate-50 border border-border-soft rounded-2xl py-4 pl-12 pr-4 text-text-heading placeholder:text-text-body/30 focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-bold"
                    placeholder={loginTab === 'admin' ? 'Nhập mật khẩu Admin...' : 'Nhập số điện thoại...'}
                  />
                </div>
              </div>
            )}

            {loginError && (
              <div className="flex items-start gap-3 text-rose-600 bg-rose-50 p-4 rounded-2xl border border-rose-100 animate-in shake duration-300">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <p className="text-[13px] font-bold leading-relaxed">{loginError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !credential.trim() || (loginTab === 'speaking_teacher' && !username.trim())}
              className="flex items-center justify-center gap-2 px-6 py-4 bg-[var(--color-primary)] text-white rounded-lg transition-all active:scale-95 font-bold hover:bg-[var(--color-primary-hover)] hover:shadow-lg hover:shadow-indigo-500/20 w-full text-sm mt-4 shadow-xl shadow-primary/20 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  Truy cập ứng dụng
                  <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] text-text-body italic opacity-50 px-4">
            {loginTab === 'teacher' && 'Dùng số điện thoại đã được phân công để truy cập dữ liệu cá nhân.'}
            {loginTab === 'speaking_teacher' && 'Dành riêng cho việc nhập điểm và báo cáo phần thi Nói.'}
            {loginTab === 'admin' && 'Quyền truy cập toàn diện vào hệ thống cấu hình và báo cáo.'}
          </p>
        </div>

        <div className="mt-10 text-center">
          <p className="text-[10px] text-text-body/40 font-bold tracking-widest uppercase">
            Product by Việt Đỗ &copy; 2026 • Zalo: 0367013579
          </p>
        </div>
      </div>
    </div>
  );
};
