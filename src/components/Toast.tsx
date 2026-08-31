import React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { TranslatedText } from "./TranslatedText";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 space-y-2 max-w-sm w-full no-print">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`p-3.5 rounded-2xl shadow-xl border flex items-center justify-between text-xs font-sans animate-slide-up transition-all ${
            toast.type === "success"
              ? "bg-[#2c2c24] text-white border-[#5A5A40]"
              : toast.type === "error"
              ? "bg-[#5c2828] text-white border-[#8c3e3e]"
              : "bg-[#444430] text-white border-[#5A5A40]"
          }`}
        >
          <div className="flex items-center space-x-2.5 mr-2">
            {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-[#d1d1ca] shrink-0" />}
            {toast.type === "error" && <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />}
            {toast.type === "info" && <Info className="w-4 h-4 text-[#d1d1ca] shrink-0" />}
            <span className="font-medium"><TranslatedText text={toast.message} /></span>
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1 text-[#8a8a7e] hover:text-white rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
