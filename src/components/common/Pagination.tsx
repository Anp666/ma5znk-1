import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalRecords: number;
  pageSize: number;
  lang: 'ar' | 'en';
}

export default function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  totalRecords, 
  pageSize,
  lang 
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  const isAr = lang === 'ar';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-10 py-6 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800">
      <div className="text-sm text-zinc-500 font-medium">
        {isAr ? (
          <>عرض {startRecord}-{endRecord} من {totalRecords} سجل</>
        ) : (
          <>Showing {startRecord}-{endRecord} of {totalRecords} records</>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 transition-all"
        >
          {isAr ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                currentPage === page
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50'
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 transition-all"
        >
          {isAr ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
