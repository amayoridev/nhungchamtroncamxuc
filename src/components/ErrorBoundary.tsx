import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('UI Crash Caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full max-w-lg mx-auto my-12 p-8 bg-white/90 backdrop-blur rounded-3xl border border-rose-200 shadow-xl text-center space-y-5 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto text-2xl shadow-sm">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-serif font-bold text-slate-800">
              {this.props.fallbackTitle || 'Không gian tạm gián đoạn'}
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-sm mx-auto">
              Hệ thống vừa phát hiện sự cố nhỏ khi kết nối dữ liệu. Bạn hãy bấm thử lại hoặc quay về Trang Chủ nhé.
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] font-mono text-rose-500 bg-rose-50 p-2 rounded-xl mt-3 border border-rose-100 max-h-20 overflow-y-auto">
                {this.state.error.message}
              </p>
            )}
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Thử Lại
            </button>
            <button
              onClick={() => {
                this.handleReload();
                window.location.hash = '';
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 shadow-sm transition-all cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" /> Về Trang Chủ
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
