import React from "react";

export const Badge = ({ children, variant = "default", className = "" }) => {
  const variants = {
    default: "bg-slate-100 text-slate-800 hover:bg-slate-200",
    success: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
    secondary: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200",
    outline: "border border-slate-200 text-slate-600 hover:bg-slate-50",
    warning: "bg-amber-100 text-amber-800 hover:bg-amber-200",
    error: "bg-rose-100 text-rose-800 hover:bg-rose-200",
  };

  return (
    <div
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${variants[variant] || variants.default} ${className}`}
    >
      {children}
    </div>
  );
};
