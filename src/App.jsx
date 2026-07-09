import React, { useState } from 'react';
import Admin from './Admin';
import User from './User';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('user');

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="flex justify-between items-center px-8 py-6 bg-slate-900/80 backdrop-blur-md border-b border-white/10">
        <div className="font-bold text-2xl bg-gradient-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent">
          GeoTracker
        </div>
        <div className="flex gap-4">
          <button 
            className={`px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 ${
              activeTab === 'user' 
                ? 'text-slate-50 bg-blue-500/20 border border-blue-500/30' 
                : 'text-slate-400 hover:text-slate-50 hover:bg-white/5'
            }`}
            onClick={() => setActiveTab('user')}
          >
            User Portal
          </button>
          <button 
            className={`px-4 py-2 rounded-lg text-base font-medium transition-all duration-300 ${
              activeTab === 'admin' 
                ? 'text-slate-50 bg-blue-500/20 border border-blue-500/30' 
                : 'text-slate-400 hover:text-slate-50 hover:bg-white/5'
            }`}
            onClick={() => setActiveTab('admin')}
          >
            Admin Portal
          </button>
        </div>
      </nav>

      <main className="flex-1 flex justify-center items-center p-8">
        {activeTab === 'user' ? <User /> : <Admin />}
      </main>
    </div>
  );
}

export default App;
