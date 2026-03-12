// src/components/GlobalStyle.jsx
import React from 'react';

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;700;900&display=swap');
    :root {
      --bg-main: #000000; --bg-card: #111111; --bg-card-alt: #161616; --bg-sidebar: #0a0a0a; --bg-input: #000000; --bg-overlay: rgba(0, 0, 0, 0.85);
      --text-main: #ffffff; --text-muted: #aaaaaa; --text-muted-dark: #666666; --border-color: #222222; --border-color-light: #333333;
      --primary: #10b981; --scrollbar-thumb: #555555; --scrollbar-track: #111111;
    }
    body.light-mode {
      --bg-main: #f3f4f6; --bg-card: #ffffff; --bg-card-alt: #f9fafb; --bg-sidebar: #ffffff; --bg-input: #ffffff; --bg-overlay: rgba(0, 0, 0, 0.6);
      --text-main: #111827; --text-muted: #4b5563; --text-muted-dark: #9ca3af; --border-color: #e5e7eb; --border-color-light: #d1d5db;
      --scrollbar-thumb: #cbd5e1; --scrollbar-track: #f1f5f9;
    }
    body.dark-mode {
      --bg-main: #000000; --bg-card: #111111; --bg-card-alt: #161616; --bg-sidebar: #0a0a0a; --bg-input: #000000; --bg-overlay: rgba(0, 0, 0, 0.85);
      --text-main: #ffffff; --text-muted: #aaaaaa; --text-muted-dark: #666666; --border-color: #222222; --border-color-light: #333333;
      --scrollbar-thumb: #555555; --scrollbar-track: #111111;
    }

    /* ABSOLUTE VIEWPORT LOCK */
    html, body, #root { 
      margin: 0 !important; padding: 0 !important; 
      background: var(--bg-main) !important; color: var(--text-main) !important; 
      overflow: hidden !important; 
      height: 100%; width: 100%; 
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      overscroll-behavior-y: none; transition: color 0.3s ease; 
      display: flex; justify-content: center;
    }
    * { box-sizing: border-box !important; font-family: "Inter", sans-serif; -webkit-tap-highlight-color: transparent; }
    
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .fade-in { animation: fadeIn 0.4s ease-out forwards; }
    .fade-out { opacity: 0 !important; transition: opacity 0.5s ease-out; }
    @keyframes slideUp { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
    .toast-anim { animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
    @keyframes slideDownFade { to { opacity: 0; transform: translateY(20px); } }
    .fade-out-nav { animation: slideDownFade 0.25s forwards; }
    
    @keyframes ytSplashLogo { 0% { transform: scale(0.6); opacity: 0; } 50% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
    .splash-logo { animation: ytSplashLogo 0.7s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
    
    @keyframes oneUiPop { 0% { opacity: 0; transform: translate(-50%, -40px) scale(0.85); } 10% { opacity: 1; transform: translate(-50%, 0) scale(1); } 90% { opacity: 1; transform: translate(-50%, 0) scale(1); } 100% { opacity: 0; transform: translate(-50%, -40px) scale(0.85); } }
    .one-ui-notif { position: fixed; top: 15px; left: 50%; width: 92%; max-width: 420px; padding: 14px 18px; border-radius: 20px; z-index: 100000; background-color: var(--bg-sidebar); border: 1px solid var(--border-color-light); box-shadow: 0 10px 40px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 14px; animation: oneUiPop 3.5s cubic-bezier(0.1, 0.9, 0.2, 1) forwards; }
    
    @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
    .skeleton { position: relative; overflow: hidden; background-color: var(--bg-card-alt); border-color: transparent !important; }
    .skeleton::after { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent); animation: shimmer 1.5s infinite; }
    body.light-mode .skeleton::after { background: linear-gradient(90deg, transparent, rgba(0,0,0,0.05), transparent); }

    /* MODERN SPINNER */
    .modern-spinner { width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.1); border-radius: 50%; border-top-color: var(--primary); animation: spin 1s ease-in-out infinite; margin: 0 auto 15px; }
    body.light-mode .modern-spinner { border-color: rgba(0,0,0,0.1); border-top-color: var(--primary); }
    .mini-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s ease-in-out infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    @keyframes popInEffect { 0% { transform: scale(0.5); opacity: 0; } 70% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }

    @keyframes ringBell {
      0% { transform: rotate(0); }
      10% { transform: rotate(25deg); }
      20% { transform: rotate(-25deg); }
      30% { transform: rotate(15deg); }
      40% { transform: rotate(-15deg); }
      50% { transform: rotate(5deg); }
      60% { transform: rotate(-5deg); }
      70% { transform: rotate(0); }
    }
    .ringing svg { animation: ringBell 0.8s ease-in-out; transform-origin: top center; }
    .ringing-infinite svg { animation: ringBell 1.2s ease-in-out infinite; transform-origin: top center; }
    
    @keyframes slideOutRight { to { transform: translateX(120%); opacity: 0; } }
    .slide-out-domino { animation: slideOutRight 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards; }

    @keyframes urgentPulse {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); border-color: rgba(239, 68, 68, 1); }
      70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); border-color: rgba(239, 68, 68, 0.5); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); border-color: rgba(239, 68, 68, 1); }
    }
    .urgent-pulse { animation: urgentPulse 2s infinite !important; border: 2px solid #ef4444 !important; }

    @keyframes glowWarning {
      0% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.3); border-color: rgba(245, 158, 11, 0.5); }
      50% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.8); border-color: #f59e0b; }
      100% { box-shadow: 0 0 5px rgba(245, 158, 11, 0.3); border-color: rgba(245, 158, 11, 0.5); }
    }
    .glow-warning { animation: glowWarning 2s infinite !important; }

    button, .clickable { transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), filter 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s !important; cursor: pointer; touch-action: manipulation; }
    button:active, .clickable:active { transform: scale(0.92) !important; filter: brightness(0.8) !important; }
    .animated-card { transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), filter 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.1); }
    .animated-card:active { transform: scale(0.98) !important; filter: brightness(1.2) !important; }
    
    .top-header { position: absolute; top: 0; left: 0; right: 0; height: 70px; background-color: var(--bg-sidebar); display: flex; justify-content: space-between; align-items: center; padding: 0 20px; z-index: 1000; border-bottom: 1px solid var(--border-color); box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .app-title { font-family: 'Outfit', sans-serif; font-size: 26px; font-weight: 900; background: linear-gradient(90deg, var(--primary), #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px; }
    .bottom-nav { position: absolute; bottom: 0; left: 0; right: 0; height: 75px; background-color: var(--bg-sidebar); display: flex; justify-content: space-around; align-items: center; z-index: 1000; border-top: 1px solid var(--border-color); padding-bottom: env(safe-area-inset-bottom); box-shadow: 0 -4px 20px rgba(0,0,0,0.1); }
    .nav-item { display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); font-size: 11px; font-weight: 600; gap: 4px; flex: 1; }
    .nav-item.active { color: var(--primary); }
    .bottom-fab { width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #3b82f6); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4); transform: translateY(-15px); }
    .chart-bar-bg { width: 100%; height: 8px; background-color: var(--border-color-light); border-radius: 4px; overflow: hidden; margin-top: 8px; }
    .chart-bar-fill { height: 100%; background-color: var(--primary); border-radius: 4px; transition: width 1s ease-out; }
    
    input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; }
    input[type="date"] { min-height: 56px; }
    input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; height: 24px; width: 24px; border-radius: 50%; background: var(--primary); cursor: pointer; margin-top: -8px; transition: transform 0.2s; }
    input[type=range]::-webkit-slider-thumb:active { transform: scale(1.2); }
    input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 8px; cursor: pointer; background: var(--border-color-light); border-radius: 4px; border: 1px solid var(--border-color); }
    
    .tc-scroll { -webkit-overflow-scrolling: touch; overscroll-behavior-y: contain; }
    .tc-scroll::-webkit-scrollbar { width: 6px; }
    .tc-scroll::-webkit-scrollbar-track { background: var(--scrollbar-track); border-radius: 10px; }
    .tc-scroll::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 10px; }
    
    .auth-input { width: 100%; padding: 16px; margin-bottom: 12px; border-radius: 12px; background-color: var(--bg-input); color: var(--text-main); border: 1px solid var(--border-color-light); box-sizing: border-box; outline: none; font-size: 15px; transition: border-color 0.2s ease, background-color 0.3s ease; }
    .auth-input:focus { border-color: var(--primary); }

    select.custom-select {
      appearance: none;
      -webkit-appearance: none;
      background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M1 1.5L6 6.5L11 1.5" stroke="%23888888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/%3E%3C/svg%3E');
      background-repeat: no-repeat;
      background-position: right 16px center;
      padding-right: 40px;
    }
    
    .divider { display: flex; align-items: center; text-align: center; margin: 25px 0; color: var(--text-muted-dark); font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;}
    .divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid var(--border-color); }
    .divider:not(:empty)::before { margin-right: .5em; }
    .divider:not(:empty)::after { margin-left: .5em; }

    .digital-receipt { background: #fff; color: #000; padding: 30px; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); text-align: center; font-family: 'Courier New', monospace; position: relative; }
    .digital-receipt::before, .digital-receipt::after { content: ''; position: absolute; width: 20px; height: 20px; background: var(--bg-overlay); border-radius: 50%; top: 50%; transform: translateY(-50%); }
    .digital-receipt::before { left: -10px; } .digital-receipt::after { right: -10px; }
    .digital-receipt-dash { border-top: 2px dashed #ccc; margin: 20px 0; }
    
    .notif-item { flex-shrink: 0; }

    @page { size: A5 portrait; margin: 10mm; }
    @media print {
      html, body, #root, .wrapper, .tc-scroll, .main { display: block !important; position: static !important; overflow: visible !important; height: auto !important; min-height: auto !important; background: white !important; color: black !important; transform: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
      .top-header, .bottom-nav, .sidebar, .notifSidebar, button, input, select, .no-print { display: none !important; }
      .fade-in { animation: none !important; opacity: 1 !important; transform: none !important; }
      * { color: #000 !important; border-color: #000 !important; box-shadow: none !important; text-shadow: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; opacity: 1 !important; background-color: transparent !important; backdrop-filter: none !important; }
      .print-title { display: block !important; width: 100% !important; text-align: center !important; margin: 0 auto 20px !important; font-size: 24px !important; font-weight: bold !important; }
      .print-title-month { display: flex !important; justify-content: space-between !important; width: 100% !important; border-bottom: 2px solid #000 !important; margin-bottom: 15px !important; padding-bottom: 5px !important; }
      .history-list { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 15px !important; width: 100% !important; align-items: start !important; }
      .animated-card { border: 1px solid #aaa !important; break-inside: avoid; page-break-inside: avoid; margin: 0 !important; padding: 10px !important; width: 100% !important; box-sizing: border-box !important; }
      h1, h2, h3, h4, p, div, span { break-after: avoid; color: #000 !important; }
    }
  `}</style>
);

export default GlobalStyle;