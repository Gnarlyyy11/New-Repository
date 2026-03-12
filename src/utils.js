// src/utils.js

export const safeStorageGet = (key, defaultVal) => {
  try { return localStorage.getItem(key) || defaultVal; } catch(e) { return defaultVal; }
};

export const safeStorageSet = (key, val) => {
  try { localStorage.setItem(key, val); } catch(e) {}
};

export const playModernCheck = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1); gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1400, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.1);
    gain1.gain.setValueAtTime(0, ctx.currentTime);
    gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(2800, ctx.currentTime);
    gain2.gain.setValueAtTime(0, ctx.currentTime);
    gain2.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    osc1.start(ctx.currentTime); osc2.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.5); osc2.stop(ctx.currentTime + 0.5);
  } catch(e) {}
};

export const playPop = () => { 
  const a = new Audio('https://actions.google.com/sounds/v1/water/bubble_pop.ogg'); 
  a.volume=0.3; 
  a.play().catch(()=>{}); 
};

export const triggerHaptic = (ms = 40) => { 
  if (safeStorageGet('app_haptics', 'true') === 'false') return;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return; 
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) window.navigator.vibrate(ms); 
};

export const getBalanceColor = (val) => {
  if (val === 0) return '#10b981'; 
  if (val <= 500) {
    const ratio = val / 500;
    const r = Math.round(16 + (245 - 16) * ratio);
    const g = Math.round(185 + (158 - 185) * ratio);
    const b = Math.round(129 + (11 - 129) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const ratio = Math.min((val - 500) / 1000, 1);
    const r = Math.round(245 + (239 - 245) * ratio);
    const g = Math.round(158 + (68 - 158) * ratio);
    const b = Math.round(11 + (68 - 11) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }
};

export const getBalanceStatusText = (val, t) => {
  if (val === 0) return { text: t('statusGood'), color: '#10b981' };
  if (val <= 500) return { text: t('statusWarning'), color: '#f59e0b' };
  return { text: t('statusDanger'), color: '#ef4444' };
};

export const safeFormatDate = (ts) => {
  try {
    if (!ts) return 'N/A';
    if (ts.toDate) return ts.toDate().toLocaleDateString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
    if (ts instanceof Date) return ts.toLocaleDateString();
    return 'N/A';
  } catch(e) { return 'N/A'; }
};

export const safeFormatTime = (ts) => {
  try {
    if (!ts) return 'N/A';
    if (ts.toDate) return ts.toDate().toLocaleString();
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
    if (ts instanceof Date) return ts.toLocaleString();
    return 'N/A';
  } catch(e) { return 'N/A'; }
};

export const getInitials = (name) => {
  if (!name || typeof name !== 'string') return "?";
  const cleanName = name.trim();
  if (!cleanName) return "?";
  const parts = cleanName.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts[0]) return parts[0].substring(0, 2).toUpperCase();
  return "?";
};

export const getAvatarColor = (email) => {
  const colors = ['linear-gradient(135deg, #10b981, #059669)', 'linear-gradient(135deg, #3b82f6, #2563eb)', 'linear-gradient(135deg, #f59e0b, #d97706)', 'linear-gradient(135deg, #8b5cf6, #6d28d9)', 'linear-gradient(135deg, #ec4899, #be185d)'];
  if (!email || typeof email !== 'string') return colors[0];
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export const calculateTrust = (email, history, loans) => {
  const histCount = history.filter(h => h?.customerEmail === email).length;
  const loanCount = loans.filter(l => l?.customerEmail === email && l?.productName !== "Account Created").length;
  if (histCount === 0 && loanCount === 0) return 3; 
  const total = histCount + loanCount;
  if (total === 0) return 3;
  const ratio = histCount / total;
  if (ratio > 0.8) return 5;
  if (ratio > 0.5) return 4;
  if (ratio > 0.2) return 3;
  return 2;
};