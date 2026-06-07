import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-warm-950 gap-4 px-4 text-center">
      <Radio className="w-8 h-8 text-crimson-600" />
      <p className="text-6xl font-bold text-warm-800 select-none">404</p>
      <h1 className="text-warm-200 font-semibold text-lg">Page not found</h1>
      <p className="text-warm-500 text-sm max-w-xs">
        This page doesn't exist. Head back to the dashboard or the home page.
      </p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 bg-crimson-800/60 hover:bg-crimson-700/60 border border-crimson-700/50
            text-warm-100 text-sm rounded-lg transition-colors">
          Dashboard
        </button>
        <button
          onClick={() => navigate('/landing')}
          className="px-4 py-2 bg-warm-800 hover:bg-warm-700 border border-warm-700
            text-warm-200 text-sm rounded-lg transition-colors">
          Home
        </button>
      </div>
    </div>
  );
}
