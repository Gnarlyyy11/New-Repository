import { useState, useEffect, useRef, useCallback } from 'react';
import { auth, db, messaging } from './firebase'; 
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, where, orderBy, setDoc, doc, deleteDoc, updateDoc, getDoc, enableIndexedDbPersistence, limit } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';

// --- IMPORTS MULA SA MGA HINIWALAY NA FILES ---
import Icon from './components/Icon';
import { dict } from './translations';
import { 
  safeStorageGet, safeStorageSet, playModernCheck, playPop, triggerHaptic, 
  getBalanceColor, getBalanceStatusText, safeFormatDate, safeFormatTime, 
  getInitials, getAvatarColor, calculateTrust 
} from './utils';
import GlobalStyle from './components/GlobalStyle';

// Enable Offline Persistence safely with fallback
try { 
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Persistence failed: Multiple tabs open.");
    } else if (err.code === 'unimplemented') {
      console.warn("Persistence not supported by browser.");
    }
  }); 
} catch (e) {}

const ADMIN_EMAILS = ["daviduson11@gmail.com", "jomariejoms89@gmail.com", "jocelynuson90@gmail.com"]; 

const APP_VERSION = "v1.22.1"; 
const APP_VERSION_CODE = 122; 
const RELEASE_NOTES = [
  "CRITICAL FIX: Resolved auto-logout and data wipe issues after browser cache clearing.",
  "🎉 OFFICIAL STABLE RELEASE (v1.22.1)",
  "Smart Background Updater: Seamless data-saving updates without loop issues.",
  "Mistake Proofing: Silent deletion of accidental entries without alerting customers."
];

// --- ANIMATED NUMBER ---
const AnimatedNumber = ({ value, privacy }) => {
  const safeValue = isNaN(value) ? 0 : Number(value);
  const [displayValue, setDisplayValue] = useState(safeValue);
  const prevValueRef = useRef(safeValue);
  
  useEffect(() => {
    const start = prevValueRef.current;
    const end = safeValue;
    if (start === end) return;
    const duration = 1000;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4); 
      setDisplayValue(Math.floor(start + (end - start) * ease));
      if (progress < 1) window.requestAnimationFrame(step);
      else { setDisplayValue(end); prevValueRef.current = end; }
    };
    window.requestAnimationFrame(step);
  }, [safeValue]);
  
  if (privacy) return <>***</>;
  return <>{displayValue.toLocaleString()}</>;
};

const TrustStars = ({ rating }) => {
  const safeRating = Math.max(0, Math.min(5, isNaN(rating) ? 3 : Math.floor(rating)));
  return (
    <span style={{fontSize: '10px', color: '#f59e0b', letterSpacing: '1px'}}>
      {'★'.repeat(safeRating)}{'☆'.repeat(5 - safeRating)}
    </span>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null); 
  const [isCheckingDB, setIsCheckingDB] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isAddingEntry, setIsAddingEntry] = useState(false);

  const [showSplash, setShowSplash] = useState(true);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [oneUiNotif, setOneUiNotif] = useState({ visible: false, title: '', desc: '', icon: '', id: 0 });
  
  const [showClearedEffect, setShowClearedEffect] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(safeStorageGet('app_haptics', 'true') !== 'false');
  const [isBellRinging, setIsBellRinging] = useState(false);
  const [clearingNotifs, setClearingNotifs] = useState(false);
  const [isNotifScrolledToBottom, setIsNotifScrolledToBottom] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // NOTIFICATION FEEDBACK STATES
  const [remindedUsers, setRemindedUsers] = useState({});
  const [adminAlerted, setAdminAlerted] = useState(false);

  const [theme, setTheme] = useState(safeStorageGet('app_theme', 'system'));
  const [accent, setAccent] = useState(safeStorageGet('app_accent', '#10b981'));
  const [lang, setLang] = useState(safeStorageGet('app_lang', 'en'));
  const [privacyMode, setPrivacyMode] = useState(false);

  const [dbVersionStr, setDbVersionStr] = useState(''); 
  const [showWhatsNewSidebar, setShowWhatsNewSidebar] = useState(false);
  const [showWhatsNewModal, setShowWhatsNewModal] = useState(false);
  const [showIosPrintModal, setShowIosPrintModal] = useState(false);
  const [showEReceiptModal, setShowEReceiptModal] = useState(false);
  
  const [fadeOutUpdateModal, setFadeOutUpdateModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateComplete, setUpdateComplete] = useState(false);
  
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const [view, setView] = useState('dashboard'); 
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [isNotifOpen, setIsNotifOpen] = useState(false); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [expandedStacks, setExpandedStacks] = useState({});
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

  const [customer, setCustomer] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState(''); 
  const [product, setProduct] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState(1); 
  const [proxyName, setProxyName] = useState('');
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0]);
  const [showCalc, setShowCalc] = useState(false);
  const [calcInput, setCalcInput] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const [loans, setLoans] = useState([]);
  const [history, setHistory] = useState([]); 
  const [archive, setArchive] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [registeredUsers, setRegisteredUsers] = useState([]);

  const [selectedLoanIds, setSelectedLoanIds] = useState([]); 
  const [invProduct, setInvProduct] = useState('');
  const [invStock, setInvStock] = useState('');

  const [updatePhoneInput, setUpdatePhoneInput] = useState('');
  const [proofImage, setProofImage] = useState(null);

  const [adminPhones, setAdminPhones] = useState([]);
  const [adminGcash, setAdminGcash] = useState({ phone: '', name: '' });
  const [adminGcashInputPhone, setAdminGcashInputPhone] = useState('');
  const [adminGcashInputName, setAdminGcashInputName] = useState('');

  const t = useCallback((key) => {
    const safeLang = dict[lang] ? lang : 'en';
    return dict[safeLang][key] || key;
  }, [lang]);

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return lang==='tl' ? "Magandang Umaga," : "Good Morning,";
    if (hr < 18) return lang==='tl' ? "Magandang Hapon," : "Good Afternoon,";
    return lang==='tl' ? "Magandang Gabi," : "Good Evening,";
  };

  const showToast = (message, type = 'success') => {
    triggerHaptic(50);
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: 'success' }), 3000);
  };

  const triggerOneUiNotif = (title, desc, icon) => {
    playPop();
    triggerHaptic(50);
    setOneUiNotif({ visible: false, title: '', desc: '', icon: '', id: 0 }); 
    setTimeout(() => {
      setOneUiNotif({ visible: true, title, desc, icon, id: Date.now() });
      setTimeout(() => setOneUiNotif(prev => ({ ...prev, visible: false })), 3500);
    }, 50);
  };

  const prevPending = useRef(0);
  const prevLowStock = useRef(0);
  const prevNewLoans = useRef(0);
  const prevReminded = useRef(0);
  const prevCleared = useRef(false);
  const prevUnlinkedCount = useRef(0);
  const prevTotalNotifs = useRef(0);
  const debounceTimer = useRef(null);
  
  const prevPaymentReqAt = useRef(0);
  const prevRemindedAt = useRef(0);
  const prevAddedAt = useRef(0);

  const isAdmin = user && ADMIN_EMAILS.includes(user?.email);

  useEffect(() => {
    if (!user || isLoadingData) return;
    const remindedLoans = loans.filter(l => l?.isReminded && !isAdmin);
    const newAddedLoans = loans.filter(l => l?.isNew && !isAdmin && l?.productName !== "Account Created");
    const pendingUsers = registeredUsers.filter(u => u?.paymentPending);
    const lowStockItems = inventory.filter(i => (i?.stock || 0) <= 5);
    const currentUnlinked = registeredUsers.filter(u => !ADMIN_EMAILS.includes(u?.email) && !loans.some(l => l?.customerEmail === u?.email));

    if (isAdmin) {
      const currentMaxReq = Math.max(0, ...pendingUsers.map(u => u.paymentRequestedAt || 0));
      if (currentMaxReq > prevPaymentReqAt.current && prevPaymentReqAt.current !== 0) {
          triggerOneUiNotif("GCash Payment", "A user sent a verification request.", "app");
      }
      prevPaymentReqAt.current = currentMaxReq || prevPaymentReqAt.current || Date.now();

      if (currentUnlinked.length > prevUnlinkedCount.current) triggerOneUiNotif("Action Required", "A new user needs a ledger account setup.", "users");
      if (lowStockItems.length > prevLowStock.current) triggerOneUiNotif("Low Stock", "An inventory item is running out.", "box");
      
      prevUnlinkedCount.current = currentUnlinked.length;
      prevLowStock.current = lowStockItems.length;
    } else {
      const currentMaxAdded = Math.max(0, ...newAddedLoans.map(l => l.addedAt || 0));
      if (currentMaxAdded > prevAddedAt.current && prevAddedAt.current !== 0) {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = setTimeout(() => {
              if (!newAddedLoans || newAddedLoans.length === 0) return;
              const latestLoan = newAddedLoans.reduce((prev, curr) => ((curr.addedAt||0) > (prev.addedAt||0)) ? curr : prev, newAddedLoans[0]);
              if (!latestLoan) return;
              const matchedLoans = newAddedLoans.filter(l => l.productName === latestLoan.productName && Math.abs((l.addedAt||0) - (latestLoan.addedAt||0)) < 5000);
              const qty = matchedLoans.length;
              const proxyStr = latestLoan.proxyName ? ` (via: ${latestLoan.proxyName})` : '';
              const langStr = safeStorageGet('app_lang', 'en');
              const itemDesc = langStr === 'tl' ? `Nilista: ${qty}x ${latestLoan.productName}${proxyStr}` : `Added: ${qty}x ${latestLoan.productName}${proxyStr}`;
              triggerOneUiNotif(t('newCredit'), itemDesc, "app");
          }, 800);
      }
      prevAddedAt.current = currentMaxAdded || prevAddedAt.current || Date.now();

      const currentMaxReminded = Math.max(0, ...remindedLoans.map(l => l.remindedAt || 0));
      if (currentMaxReminded > prevRemindedAt.current && prevRemindedAt.current !== 0) {
          triggerOneUiNotif(t('payReminder'), t('payDesc'), "bell");
      }
      prevRemindedAt.current = currentMaxReminded || prevRemindedAt.current || Date.now();

      if (dbUser?.clearedNotif && !prevCleared.current) {
         triggerOneUiNotif(t('accountCleared'), "Your balance has been fully paid.", "history");
         setShowClearedEffect(true); 
         triggerHaptic([50, 100, 50]);
         setTimeout(() => setShowClearedEffect(false), 2500);
      }
      prevCleared.current = dbUser?.clearedNotif;
    }
    
    const currentTotalNotifs = isAdmin ? (pendingUsers.length + currentUnlinked.length + lowStockItems.length) : (newAddedLoans.length + remindedLoans.length + (dbUser?.clearedNotif ? 1 : 0));
    if (currentTotalNotifs > prevTotalNotifs.current) {
       setIsBellRinging(true);
       setTimeout(() => setIsBellRinging(false), 1000);
    }
    prevTotalNotifs.current = currentTotalNotifs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loans, registeredUsers, inventory, dbUser, isAdmin, isLoadingData]);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', accent);
    const applyTheme = (tSetting) => {
      document.body.classList.remove('light-mode', 'dark-mode');
      if (tSetting === 'light') document.body.classList.add('light-mode');
      else if (tSetting === 'dark') document.body.classList.add('dark-mode');
      else {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.body.classList.add('dark-mode');
        else document.body.classList.add('light-mode');
      }
    };
    applyTheme(theme);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => { if (theme === 'system') applyTheme('system'); };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, accent]);

  const changeTheme = (newTheme) => {
    triggerHaptic(40);
    setTheme(newTheme); safeStorageSet('app_theme', newTheme);
  };
  const changeAccent = (color) => {
    triggerHaptic(40); setAccent(color); safeStorageSet('app_accent', color);
  };
  const toggleHaptics = () => {
    const newVal = !hapticsEnabled;
    setHapticsEnabled(newVal);
    safeStorageSet('app_haptics', newVal.toString());
  };

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault(); setDeferredPrompt(e);
      if (!window.matchMedia('(display-mode: standalone)').matches) setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = () => {
    triggerHaptic(50);
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') setShowInstallBanner(false);
        setDeferredPrompt(null);
      });
    }
  };

  // --- WELCOME TOUR LOGIC STRICTLY TIED TO DB ---
  useEffect(() => {
    if (user && dbUser && dbUser.isProfileComplete) {
      if (dbUser.tourCompleted !== true) {
         setTourStep(1); 
      }
    }
  }, [user, dbUser]);

  const handleNextTour = async () => {
    triggerHaptic(40);
    if (tourStep < 3) {
       setTourStep(tourStep + 1);
    } else {
       try { await updateDoc(doc(db, "users", user.email), { tourCompleted: true }); } catch(e) {}
       setTourStep(0);
    }
  };

  // --- UPDATE MODAL LOGIC FIX (INSTANT BACKGROUND CHECKER) ---
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500); 
    const storedVersion = safeStorageGet("app_version", null);
    const now = Date.now();

    if (storedVersion !== APP_VERSION) {
       safeStorageSet("app_version", APP_VERSION);
       safeStorageSet("app_update_time", now.toString());
       setShowWhatsNewModal(true); 
       setShowWhatsNewSidebar(true);
    } else {
       const storedTime = safeStorageGet("app_update_time", null);
       if (storedTime && (now - parseInt(storedTime)) < 24 * 60 * 60 * 1000) {
          setShowWhatsNewSidebar(true); 
       }
    }
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // 1. Real-time Firebase Listener (Cheap, automatic WebSocket)
    const unsub = onSnapshot(doc(db, "settings", "app_updates"), (d) => {
      if (d.exists() && d.data().versionCode > APP_VERSION_CODE) {
        setDbVersionStr(d.data().version || 'Newer Version');
        setShowUpdateModal(true);
      }
    });

    // 2. Smart Checker: Sisilip lang kapag binuksan ulit ang app galing background
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const snap = await getDoc(doc(db, "settings", "app_updates"));
          if (snap.exists() && snap.data().versionCode > APP_VERSION_CODE) {
            setDbVersionStr(snap.data().version || 'Newer Version');
            setShowUpdateModal(true);
          }
        } catch (e) {}
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => { 
      unsub(); 
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const startUpdateProcess = () => {
    triggerHaptic(50);
    setFadeOutUpdateModal(true);
    
    setTimeout(() => {
      setIsUpdatingApp(true);
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 20) + 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setUpdateProgress(100);
          setUpdateComplete(true);
          triggerHaptic([50, 100, 50]); 
          
          setTimeout(async () => {
            // --- AGGRESSIVE CACHE CLEARING PARA SA PWA/HOME SCREEN AWAITED PROPERLY ---
            if ('caches' in window) {
               try {
                  const names = await caches.keys();
                  await Promise.all(names.map(name => caches.delete(name)));
               } catch (e) {}
            }
            if ('serviceWorker' in navigator) {
               try {
                  const registrations = await navigator.serviceWorker.getRegistrations();
                  for(let registration of registrations) {
                     await registration.unregister();
                  }
               } catch (e) {}
            }
            // Force refresh immediately after cache delete
            window.location.reload(true);
          }, 1200); 
        } else {
          setUpdateProgress(progress);
        }
      }, 250);
    }, 400); 
  };

  const handlePrint = () => {
    triggerHaptic(40);
    const isIOS = typeof window !== 'undefined' && (
      /iPad|iPhone|iPod/.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || 
      /Mac/.test(navigator.userAgent) ||
      (navigator.vendor && navigator.vendor.includes('Apple'))
    );
    
    if (isIOS) setShowIosPrintModal(true);
    else window.print();
  };

  const exportCSV = () => {
    triggerHaptic(40);
    let csv = "Date,Customer Name,Customer Email,Product,Amount,Status\n";
    [...loans, ...history].forEach(r => {
       const d = safeFormatDate(r.date || r.paidAt);
       csv += `${d},"${r.customerName || ''}","${r.customerEmail || ''}","${r.productName || ''}",${r.amount || 0},${r.paidAt ? 'Paid' : 'Unpaid'}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'UsonCreditHub_Report.csv'; a.click();
  };

  const handleProofUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
       const img = new Image();
       img.src = event.target.result;
       img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setProofImage(canvas.toDataURL('image/jpeg', 0.6));
       }
    }
  };

  const safeNavigation = (callback) => {
    setIsNavigating(true);
    setTimeout(() => {
      callback();
      setIsNavigating(false);
    }, 200);
  };

  // --- CRITICAL FIX: Ensure auth persistence survives cache clear ---
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch (error) {
        console.error("Auth persistence error:", error);
      }
    };
    initializeAuth();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Force refresh user token to ensure session validity
        try {
          await u.getIdToken(true);
        } catch (e) {
          console.error("Token refresh failed", e);
        }
      } else {
        setUser(null);
        setDbUser(null);
        setIsCheckingDB(false);
      }
      setIsLoggingIn(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      // Create a robust listener that attempts to re-fetch if offline cache is wiped
      const fetchUserData = async () => {
        try {
          const docRef = doc(db, "users", user.email);
          const unsub = onSnapshot(docRef, async (d) => {
            if (d.exists()) {
              setDbUser(d.data());
              setIsCheckingDB(false);
            } else {
              // Only create if it truly doesn't exist on server
              const serverCheck = await getDoc(docRef);
              if (!serverCheck.exists()) {
                try { await setDoc(docRef, { email: user.email, name: '', phone: '', isProfileComplete: false, tcAccepted: false, paymentPending: false, proofImage: null, tourCompleted: false }); } catch(e) {}
              }
            }
          }, (error) => {
             console.error("Snapshot error, retrying...", error);
             setTimeout(fetchUserData, 2000); // Retry mechanism
          });
          return unsub;
        } catch (err) {
          setIsCheckingDB(false);
        }
      };
      
      let unsubscribeSnapshot;
      fetchUserData().then(unsub => { unsubscribeSnapshot = unsub; });
      
      return () => {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      };
    }
  }, [user]);

  useEffect(() => {
    if (user && dbUser && !dbUser.isProfileComplete) {
      if (dbUser.phone && !phone) setPhone(dbUser.phone);
    }
  }, [user, dbUser, phone]);

  useEffect(() => {
    if (user) {
      const unsubAdminGcash = onSnapshot(doc(db, "settings", "admin_gcash"), (d) => {
        if (d.exists()) {
          setAdminGcash(d.data());
          setAdminGcashInputPhone(d.data().phone || '');
          setAdminGcashInputName(d.data().name || '');
          setAdminPhones(d.data().phone ? [d.data().phone] : []);
        }
      });
      return () => unsubAdminGcash();
    }
  }, [user]);

  useEffect(() => {
    if (user && dbUser && dbUser.isProfileComplete && (ADMIN_EMAILS.includes(user?.email) || dbUser.tcAccepted)) {
      const adminFlag = ADMIN_EMAILS.includes(user?.email);
      const loansRef = collection(db, "loans");
      const historyRef = collection(db, "credit_history");
      
      const qLoans = adminFlag ? query(loansRef, orderBy("date", "desc")) : query(loansRef, where("customerEmail", "==", user.email));
      const qHistory = adminFlag ? query(historyRef, orderBy("paidAt", "desc")) : query(historyRef, where("customerEmail", "==", user.email));

      const unsubLoans = onSnapshot(qLoans, (s) => {
        setLoans(s.docs.map(d => ({ ...d.data(), id: d.id })));
        setTimeout(() => setIsLoadingData(false), 600); 
      });
      
      const unsubHistory = onSnapshot(qHistory, (s) => {
        const now = new Date().getTime();
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const historyData = [];
        s.docs.forEach(d => {
          const data = d.data();
          const paidTime = data.paidAt?.seconds * 1000;
          if (paidTime && (now - paidTime > SEVEN_DAYS_MS)) {
            addDoc(collection(db, "archive"), data).then(() => deleteDoc(doc(db, "credit_history", d.id))).catch(e => {});
          } else { historyData.push({ ...data, id: d.id }); }
        });
        if (!adminFlag) historyData.sort((a, b) => (b.paidAt?.seconds || 0) - (a.paidAt?.seconds || 0));
        setHistory(historyData);
      });

      if (adminFlag) {
        const unsubUsers = onSnapshot(collection(db, "users"), (s) => setRegisteredUsers(s.docs.map(d => d.data())));
        
        // AUTO-DELETE ACTIVITY LOGS OLDER THAN 30 DAYS
        const unsubLogs = onSnapshot(query(collection(db, "activity_logs"), orderBy("timestamp", "desc"), limit(50)), (s) => {
          const now = new Date().getTime();
          const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
          const validLogs = [];
          s.docs.forEach(d => {
            const data = d.data();
            const logTime = data.timestamp?.seconds * 1000;
            if (logTime && (now - logTime > THIRTY_DAYS_MS)) {
              deleteDoc(doc(db, "activity_logs", d.id)).catch(e => {});
            } else {
              validLogs.push({id: d.id, ...data});
            }
          });
          setActivityLogs(validLogs);
        });

        const unsubArchive = onSnapshot(query(collection(db, "archive"), orderBy("paidAt", "desc")), (s) => setArchive(s.docs.map(d => ({id: d.id, ...d.data()}))));
        const unsubInv = onSnapshot(collection(db, "inventory"), (s) => setInventory(s.docs.map(d => ({id: d.id, ...d.data()}))));
        return () => { unsubLoans(); unsubHistory(); unsubUsers(); unsubLogs(); unsubArchive(); unsubInv(); };
      }
      return () => { unsubLoans(); unsubHistory(); };
    }
  }, [user, dbUser]);

  const logActivity = async (actionText) => {
    if (!user || !ADMIN_EMAILS.includes(user?.email)) return;
    try { await addDoc(collection(db, "activity_logs"), { action: actionText, timestamp: new Date() }); } catch(e) {}
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault(); triggerHaptic();
    setIsLoggingIn(true);
    try {
      if (isSignUp) await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      else await signInWithEmailAndPassword(auth, authEmail, authPassword);
    } catch (err) { 
      showToast("Authentication Error", "error"); 
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogin = async () => { 
    triggerHaptic(); 
    setIsLoggingIn(true);
    try { 
      await signInWithPopup(auth, new GoogleAuthProvider()); 
    } catch (err) {
      setIsLoggingIn(false);
    } 
  };

  const handleLogout = async () => {
    triggerHaptic(); 
    setIsLoggingOut(true);
    try { await signOut(auth); window.location.reload(); } catch (err) { showToast("Logout Failed", "error"); setIsLoggingOut(false); }
  };

  const requestPermission = async () => {
    try {
      if (!('Notification' in window)) return;
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, { vapidKey: 'BHqn4TWWqdAMifM_tTgehpWzQP98wr_flvlpRCuODm1SIHYjyCs5Z_gGlhaGHisyFwmJC9ABcXFbgI6J6cx1Ijk' });
        if (token && user && !ADMIN_EMAILS.includes(user?.email)) {
          await updateDoc(doc(db, "users", user.email), { fcmToken: token });
        }
      }
    } catch (err) {}
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault(); triggerHaptic();
    
    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanPhone = phone.trim().replace(/\D/g, ''); // Strip non-digits

    if (!cleanFirstName || !cleanLastName || !cleanPhone) {
        return showToast("Please fill all required fields.", "error");
    }
    if (cleanPhone.length !== 11) {
        return showToast("Phone number must be exactly 11 digits.", "error");
    }

    try {
      if (user) {
        await updateDoc(doc(db, "users", user.email), { name: `${cleanFirstName} ${cleanLastName}`, phone: cleanPhone, isProfileComplete: true, needsAdminAck: true });
      }
    } catch (e) { showToast("Error saving profile", "error"); }
  };

  const handleAcceptTC = async () => {
    try {
      triggerHaptic();
      if (user) { await updateDoc(doc(db, "users", user.email), { tcAccepted: true }); requestPermission(); }
    } catch(e) {}
  };

  const handleDeclineTC = () => { triggerHaptic(); signOut(auth); };

  const handleUpdateMissingPhone = async (targetEmail) => {
    triggerHaptic();
    const cleanPhone = updatePhoneInput.trim().replace(/\D/g, '');
    if (cleanPhone.length !== 11) return showToast("Phone number must be exactly 11 digits.", "error");

    try {
      await updateDoc(doc(db, "users", targetEmail), { phone: cleanPhone });
      setUpdatePhoneInput(''); showToast("Phone number saved successfully!");
    } catch (e) { showToast("Failed to update phone number.", "error"); }
  };

  const handleCustomerEmailChange = (e) => {
    const val = e.target.value; setCustomerEmail(val);
    const foundUser = registeredUsers.find(u => (u?.email || '').toLowerCase() === val.toLowerCase());
    if (foundUser) {
       if(!customer) setCustomer(foundUser.name || '');
       if(!customerPhone) setCustomerPhone(foundUser.phone || '');
    }
  };

  const sendPaymentReminder = async (email) => {
    try {
      triggerHaptic();
      const userLoans = loans.filter(l => l?.customerEmail === email && l?.productName !== "Account Created");
      if (userLoans.length > 0) {
        await updateDoc(doc(db, "loans", userLoans[0].id), { isReminded: true, remindedAt: Date.now() });
        logActivity(`Sent in-app payment reminder to ${email}`);
        setRemindedUsers(prev => ({...prev, [email]: true}));
        setTimeout(() => setRemindedUsers(prev => ({...prev, [email]: false})), 3000);
      } else { showToast("This person has ₱0 balance.", "error"); }
    } catch(e) { showToast("Error sending reminder.", "error"); }
  };

  const handleRequestApproval = async () => {
    try {
      triggerHaptic();
      await updateDoc(doc(db, "users", user.email), { paymentPending: true, paymentRequestedAt: Date.now(), proofImage: proofImage || null });
      setProofImage(null);
      setAdminAlerted(true);
      setTimeout(() => setAdminAlerted(false), 3000);
    } catch(e) { showToast("Error sending request.", "error"); }
  };

  const deleteCustomerAccount = async (email, name) => {
    triggerHaptic(60);
    if(window.confirm(`🚨 WARNING: Are you sure you want to delete ${name}?`)) {
      try {
        await deleteDoc(doc(db, "users", email));
        const loansToDelete = loans.filter(l => l?.customerEmail === email);
        loansToDelete.forEach(async (l) => await deleteDoc(doc(db, "loans", l.id)));
        const historyToDelete = history.filter(h => h?.customerEmail === email);
        historyToDelete.forEach(async (h) => await deleteDoc(doc(db, "credit_history", h.id)));
        logActivity(`Deleted account and wiped data for ${name}`); showToast(`${name}'s data wiped.`);
      } catch (e) {}
    }
  };

  const handleClearAnalytics = async () => {
    triggerHaptic(60);
    if(window.confirm("🚨 RESET ANALYTICS: This will delete ALL history, archives, inventory, and logs. Active loans/balances will REMAIN. Proceed?")) {
      if(window.confirm("Are you absolutely sure? This cannot be undone.")) {
        try {
          history.forEach(async (h) => await deleteDoc(doc(db, "credit_history", h.id)));
          archive.forEach(async (a) => await deleteDoc(doc(db, "archive", a.id)));
          activityLogs.forEach(async (l) => await deleteDoc(doc(db, "activity_logs", l.id)));
          inventory.forEach(async (i) => await deleteDoc(doc(db, "inventory", i.id)));
          logActivity("Admin manually CLEARED Analytics & History."); showToast("Analytics and History successfully reset to zero.");
        } catch (e) { showToast("Error clearing data.", "error"); }
      }
    }
  };

  const handleClearAllLogs = async () => {
    triggerHaptic(60);
    if(window.confirm("🚨 Are you sure you want to completely clear ALL activity logs?")) {
      try {
        activityLogs.forEach(async (l) => await deleteDoc(doc(db, "activity_logs", l.id)));
        logActivity("Admin manually cleared all Activity Logs.");
        showToast("All activity logs cleared.");
      } catch (e) { showToast("Error clearing logs.", "error"); }
    }
  };

  const deleteSpecificLog = async (id) => {
    triggerHaptic(40);
    if(window.confirm("Delete this specific activity log?")) {
      try { await deleteDoc(doc(db, "activity_logs", id)); } catch(e) {}
    }
  };

  const handleClearActiveLoans = async () => {
    triggerHaptic(60);
    if(window.confirm("🚨 RESET ACTIVE LOANS: This will wipe out ALL current active balances in the dashboard. Proceed?")) {
      if(window.confirm("Are you absolutely sure? This cannot be undone.")) {
        try {
          loans.forEach(async (l) => { if(l?.productName !== "Account Created") await deleteDoc(doc(db, "loans", l.id)); });
          logActivity("Admin manually WIPED ALL active loans."); showToast("All active balances wiped.");
        } catch (e) { showToast("Error clearing data.", "error"); }
      }
    }
  };

  // --- NEW FUNCTION: DELETE SPECIFIC LOAN ---
  const deleteSelectedLoans = async () => {
    triggerHaptic(60);
    const loansToDelete = loans.filter(l => selectedLoanIds.includes(l.id));
    if(loansToDelete.length === 0) return showToast("Please select items to delete.", "error");
    if(window.confirm(`🚨 Are you sure you want to completely DELETE ${loansToDelete.length} selected item(s)?\n\nThis is for accidental entries. It will NOT be recorded in the History.`)) {
      try {
        for (const loanObj of loansToDelete) { await deleteDoc(doc(db, "loans", loanObj.id)); }
        const remainingLoans = loans.filter(l => l?.customerEmail === selectedCustomer.email && !selectedLoanIds.includes(l.id) && l?.productName !== "Account Created");
        if(remainingLoans.length === 0) await updateDoc(doc(db, "users", selectedCustomer.email), { paymentPending: false, proofImage: null });
        logActivity(`Deleted ${loansToDelete.length} mistaken entries for ${selectedCustomer.name}`); setSelectedLoanIds([]); showToast("Successfully deleted selected items!");
      } catch (e) {}
    }
  };

  const getSummaries = () => {
    const s = {};
    loans.forEach(l => {
      if (!l?.customerEmail) return;
      if (!s[l.customerEmail]) {
        const uProfile = registeredUsers.find(u => u?.email === l.customerEmail);
        s[l.customerEmail] = { name: l.customerName, email: l.customerEmail, total: 0, items: [], hasNew: false, paymentPending: uProfile?.paymentPending || false, phone: uProfile?.phone, proofImage: uProfile?.proofImage };
      }
      const amt = parseFloat(l.amount);
      s[l.customerEmail].total += (isNaN(amt) ? 0 : amt);
      if (l.productName !== "Account Created") {
        s[l.customerEmail].items.push(l);
        if (l.isNew || l.isReminded) s[l.customerEmail].hasNew = true;
      }
    });
    return Object.values(s);
  };

  const getHistorySummaries = () => {
    const s = {};
    history.forEach(h => {
      if (!h?.customerEmail) return;
      if (!s[h.customerEmail]) s[h.customerEmail] = { name: h.customerName, email: h.customerEmail, total: 0, items: [] };
      const amt = parseFloat(h.amount);
      s[h.customerEmail].total += (isNaN(amt) ? 0 : amt);
      s[h.customerEmail].items.push(h);
    });
    return Object.values(s);
  };

  const addStock = async (e) => {
    e.preventDefault(); triggerHaptic();
    const existing = inventory.find(i => (i?.productName || '').toLowerCase() === invProduct.toLowerCase());
    if (existing) {
      await updateDoc(doc(db, "inventory", existing.id), { stock: existing.stock + parseInt(invStock) });
      logActivity(`Restocked ${invProduct} by ${invStock} units.`);
    } else {
      await addDoc(collection(db, "inventory"), { productName: invProduct, stock: parseInt(invStock) });
      logActivity(`Added new inventory item: ${invProduct} (${invStock} units)`);
    }
    showToast(`Added ${invStock} units of ${invProduct}`); setInvProduct(''); setInvStock('');
  };

  const getQuickAddChips = () => {
    if (!selectedCustomer) return [];
    const counts = {};
    [...loans, ...history].filter(x => x?.customerEmail === selectedCustomer.email && x?.productName !== "Account Created").forEach(l => {
      if (l?.productName) counts[l.productName] = (counts[l.productName] || 0) + 1;
    });
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
  };

  const handleCalcInput = (char) => {
    triggerHaptic(20);
    if (char === 'C') setCalcInput('');
    else if (char === '=') {
      try { 
        // eslint-disable-next-line
        const res = eval(calcInput); 
        setAmount(res); setShowCalc(false); setCalcInput(''); 
      } catch(e) { showToast("Invalid Math", "error"); }
    } else setCalcInput(prev => prev + char);
  };

  const addLoan = async (e) => {
    e.preventDefault(); triggerHaptic();
    setIsAddingEntry(true);
    const finalDate = new Date(loanDate + "T12:00:00");
    const cleanProxy = proxyName.trim();

    try {
        if (!selectedCustomer) {
          if (customer && customerEmail && customerPhone) {
            const cleanPhone = customerPhone.trim().replace(/\D/g, '');
            if (cleanPhone.length !== 11) {
                setIsAddingEntry(false);
                return showToast("Phone must be exactly 11 digits.", "error");
            }
            const userRef = doc(db, "users", customerEmail.toLowerCase().trim());
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              await setDoc(userRef, { email: customerEmail.toLowerCase().trim(), name: customer, phone: cleanPhone, isProfileComplete: false, tcAccepted: false, paymentPending: false, proofImage: null, tourCompleted: false });
            }
            await addDoc(collection(db, "loans"), { customerName: customer, customerEmail: customerEmail.toLowerCase().trim(), productName: "Account Created", amount: 0, date: finalDate, status: "Unpaid", isNew: false, proxyName: cleanProxy, addedAt: Date.now() });
            logActivity(`Created profile wrapper for ${customer}`); showToast(`Account created for ${customer}!`); 
            setCustomer(''); setCustomerEmail(''); setCustomerPhone(''); setLoanDate(new Date().toISOString().split('T')[0]); setProxyName(''); setIsModalOpen(false);
          }
        } else {
          const qty = parseInt(quantity, 10) || 1;
          const finalAmt = parseFloat(amount || calcInput) || 0;
          if (finalAmt > 0 && product) {
            for (let i = 0; i < qty; i++) { await addDoc(collection(db, "loans"), { customerName: selectedCustomer.name, customerEmail: selectedCustomer.email.toLowerCase().trim(), productName: product, amount: finalAmt, date: finalDate, status: "Unpaid", isNew: true, proxyName: cleanProxy, addedAt: Date.now() }); }
            const invItem = inventory.find(i => (i?.productName || '').toLowerCase() === product.toLowerCase());
            if (invItem) await updateDoc(doc(db, "inventory", invItem.id), { stock: invItem.stock - qty });
            await updateDoc(doc(db, "users", selectedCustomer.email), { paymentPending: false });
            logActivity(`Added ${qty}x ${product} to ${selectedCustomer.name}`); showToast(`Added ${qty}x ${product} to ${selectedCustomer.name}!`); 
            setProduct(''); setAmount(''); setQuantity(1); setProxyName(''); setLoanDate(new Date().toISOString().split('T')[0]); setIsModalOpen(false);
          }
        }
    } catch(err) {
        showToast("Error adding entry.", "error");
    } finally {
        setIsAddingEntry(false);
    }
  };

  const markAsPaid = async (loanObj) => {
    triggerHaptic();
    if(window.confirm("Confirm payment? This will be moved to Credit History.")) {
      try {
        playModernCheck();
        await addDoc(collection(db, "credit_history"), { ...loanObj, paidAt: new Date() });
        await deleteDoc(doc(db, "loans", loanObj.id)); 
        
        const remainingLoans = loans.filter(l => l?.customerEmail === loanObj.customerEmail && l?.id !== loanObj.id && l?.productName !== "Account Created");
        if(remainingLoans.length === 0) {
          await updateDoc(doc(db, "users", loanObj.customerEmail), { clearedNotif: true, paymentPending: false, proofImage: null });
        }
        logActivity(`Processed single payment for ${loanObj.customerName} (${loanObj.productName})`);
        showToast("Payment successfully processed!");
      } catch (e) {}
    }
  };

  const markSelectedPaid = async () => {
    triggerHaptic();
    const loansToPay = loans.filter(l => selectedLoanIds.includes(l.id));
    if(loansToPay.length === 0) return showToast("Please select items to pay first.", "error");
    if(window.confirm(`Confirm payment for ${loansToPay.length} selected item(s)?`)) {
      try {
        playModernCheck();
        for (const loanObj of loansToPay) { await addDoc(collection(db, "credit_history"), { ...loanObj, paidAt: new Date() }); await deleteDoc(doc(db, "loans", loanObj.id)); }
        const remainingLoans = loans.filter(l => l?.customerEmail === selectedCustomer.email && !selectedLoanIds.includes(l.id) && l?.productName !== "Account Created");
        if(remainingLoans.length === 0) await updateDoc(doc(db, "users", selectedCustomer.email), { clearedNotif: true, paymentPending: false, proofImage: null });
        logActivity(`Processed ${loansToPay.length} selected payments for ${selectedCustomer.name}`); setSelectedLoanIds([]); showToast("Successfully paid selected items!");
      } catch (e) {}
    }
  };

  const markAllPaid = async (customerLoans) => {
    triggerHaptic();
    if(customerLoans.length === 0) return;
    if(window.confirm(`Confirm payment for ALL ${customerLoans.length} item(s)?`)) {
      try {
        playModernCheck();
        for (const loanObj of customerLoans) { await addDoc(collection(db, "credit_history"), { ...loanObj, paidAt: new Date() }); await deleteDoc(doc(db, "loans", loanObj.id)); }
        await updateDoc(doc(db, "users", selectedCustomer.email), { clearedNotif: true, paymentPending: false, proofImage: null });
        logActivity(`Processed full account clearance for ${selectedCustomer.name}`); setSelectedLoanIds([]); showToast("All items successfully marked as paid!");
      } catch (e) {}
    }
  };

  const getBestsellers = () => {
    const counts = {};
    [...loans, ...history, ...archive].forEach(l => { if (l?.productName && l?.productName !== "Account Created") counts[l.productName] = (counts[l.productName] || 0) + 1; });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  };
  
  const getHeatmapData = () => {
    const counts = {};
    [...loans, ...history, ...archive, ...activityLogs].forEach(i => {
      if(!i) return;
      try {
        let d;
        if (i.date?.seconds) d = new Date(i.date.seconds * 1000);
        else if (i.timestamp?.seconds) d = new Date(i.timestamp.seconds * 1000);
        else if (i.paidAt?.seconds) d = new Date(i.paidAt.seconds * 1000);
        
        if (d && !isNaN(d.getTime())) {
          const key = d.toISOString().split('T')[0];
          counts[key] = (counts[key] || 0) + 1;
        }
      } catch (e) {}
    });
    return counts;
  };

  const remindedLoans = loans.filter(l => l?.isReminded && !isAdmin);
  const newAddedLoans = loans.filter(l => l?.isNew && !isAdmin && l?.productName !== "Account Created");
  const pendingUsers = registeredUsers.filter(u => u?.paymentPending);
  const lowStockItems = inventory.filter(i => (i?.stock || 0) <= 5);
  
  const unlinkedUsers = registeredUsers.filter(u => !ADMIN_EMAILS.includes(u?.email) && !loans.some(l => l?.customerEmail === u?.email));
  const unlinkedUsersToDisplay = isAdmin ? unlinkedUsers : [];

  const adminNotificationsCount = pendingUsers.length + lowStockItems.length + unlinkedUsersToDisplay.length;
  const userNotificationsCount = remindedLoans.length + newAddedLoans.length + (dbUser?.clearedNotif && !isAdmin ? 1 : 0);
  const displayNotifCount = (isAdmin ? adminNotificationsCount : userNotificationsCount) + (showWhatsNewSidebar ? 1 : 0);

  const hasUrgentNotifAdmin = pendingUsers.length > 0 || unlinkedUsersToDisplay.length > 0 || lowStockItems.length > 0;
  const hasUrgentNotifUser = remindedLoans.length > 0;
  const hasUrgentNotifs = isAdmin ? hasUrgentNotifAdmin : hasUrgentNotifUser;

  const currentCustomerLoansRaw = isAdmin && selectedCustomer ? loans.filter(l => l?.customerEmail === selectedCustomer.email) : (!isAdmin ? loans : []);
  const displayCustomerLoans = currentCustomerLoansRaw.filter(l => l?.productName !== "Account Created");
  const currentTotal = displayCustomerLoans.reduce((acc, curr) => acc + (parseFloat(curr?.amount) || 0), 0);
  const globalTotalUnpaid = loans.filter(l => l?.productName !== "Account Created").reduce((acc, curr) => acc + (parseFloat(curr?.amount) || 0), 0);

  const activeEmail = isAdmin && selectedCustomer ? selectedCustomer.email : (user ? user.email : null);
  const activeProfile = registeredUsers.find(u => u?.email === activeEmail) || dbUser;
  const activePhone = activeProfile?.phone || '';

  const groupLoansByMonth = (loansToGroup) => {
    const grouped = {};
    const sortedLoans = [...loansToGroup].sort((a, b) => {
      const timeA = a?.date?.seconds || a?.paidAt?.seconds || 0;
      const timeB = b?.date?.seconds || b?.paidAt?.seconds || 0;
      return timeB - timeA; 
    });
    sortedLoans.forEach(l => {
      try {
        let d = new Date();
        if (l.date?.seconds) d = new Date(l.date.seconds * 1000);
        else if (l.paidAt?.seconds) d = new Date(l.paidAt.seconds * 1000);
        if (isNaN(d.getTime())) d = new Date();
        const monthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (!grouped[monthYear]) grouped[monthYear] = { total: 0, items: [], timestamp: new Date(d.getFullYear(), d.getMonth(), 1).getTime() };
        grouped[monthYear].items.push(l); 
        grouped[monthYear].total += (parseFloat(l?.amount) || 0);
      } catch(e) {}
    });
    return Object.entries(grouped).sort((a, b) => b[1].timestamp - a[1].timestamp);
  };

  const handleClearAllNotifs = async () => {
    triggerHaptic(40);
    setClearingNotifs(true);
    
    setTimeout(async () => {
       setShowWhatsNewSidebar(false);
       if (!isAdmin) {
         const updates = loans.filter(l => l?.isNew && l?.customerEmail === user?.email);
         updates.forEach(async (loan) => { try { await updateDoc(doc(db, "loans", loan.id), { isNew: false }); } catch(e) {} });
         if (dbUser?.clearedNotif) { try { await updateDoc(doc(db, "users", user.email), { clearedNotif: false }); } catch(e) {} }
       }
       setClearingNotifs(false);
    }, 400); 
  };

  const closeNotifSidebar = () => { setIsNotifOpen(false); };

  const handleNotifScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 5) {
      setIsNotifScrolledToBottom(true);
    } else {
      setIsNotifScrolledToBottom(false);
    }
  };

  const filteredUsers = registeredUsers.filter(u =>
    !ADMIN_EMAILS.includes(u?.email) && (
      (u?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u?.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleLanguageChange = (newLang) => {
    triggerHaptic(40);
    setLang(newLang);
    safeStorageSet('app_lang', newLang);
  };

  const handleSaveGcash = async () => {
    triggerHaptic(50);
    try {
      await setDoc(doc(db, "settings", "admin_gcash"), { name: adminGcashInputName, phone: adminGcashInputPhone });
      logActivity("Admin updated GCash Details.");
      showToast("GCash details saved successfully!");
    } catch (e) {
      showToast("Failed to save GCash details", "error");
    }
  };

  const toggleLoanSelection = (id) => {
    triggerHaptic(20);
    setSelectedLoanIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  
  const toggleStack = (key) => {
    triggerHaptic(20);
    setExpandedStacks(prev => ({...prev, [key]: !prev[key]}));
  };

  const safeSearch = searchQuery.toLowerCase();
  const rawSummaries = getSummaries();
  const filteredSummaries = rawSummaries.filter(s => {
    return (s?.name || '').toLowerCase().includes(safeSearch) || (s?.email || '').toLowerCase().includes(safeSearch);
  });

  const historyToDisplay = isAdmin && selectedCustomer ? history.filter(h => h?.customerEmail === selectedCustomer.email) : history;
  const filteredHistorySummaries = getHistorySummaries().filter(s => (s?.name || '').toLowerCase().includes(safeSearch) || (s?.email || '').toLowerCase().includes(safeSearch));

  const EmptyState = ({ icon, title, desc }) => (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 20px', color:'var(--text-muted)'}}>
      <div style={{color:'var(--border-color-light)', marginBottom:'20px'}}><Icon name={icon} size={64} /></div>
      <h3 style={{margin:'0 0 8px 0', color:'var(--text-main)'}}>{title}</h3>
      <p style={{margin:0, fontSize:'14px', textAlign:'center', maxWidth:'250px'}}>{desc}</p>
    </div>
  );

  const styles = {
    wrapper: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    main: { flex: '1 1 0%', minHeight: 0, width: '100%', padding: '90px 20px 130px 20px', display: 'flex', flexDirection: 'column', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' },
    card: { backgroundColor: 'var(--bg-card)', padding: '20px', borderRadius: '18px', marginBottom: '15px', border: '1px solid var(--border-color)', cursor: 'pointer', position: 'relative', color: 'var(--text-main)' },
    balance: { textAlign: 'center', padding: '35px 20px', borderRadius: '25px', backgroundColor: 'var(--bg-card-alt)', marginBottom: '30px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    sidebar: { display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: isSidebarOpen ? '0' : '-280px', width: '280px', height: '100%', backgroundColor: 'var(--bg-sidebar)', zIndex: 3000, padding: '40px 20px', transition: 'transform 0.3s ease', transform: `translate3d(${isSidebarOpen ? 0 : -280}px, 0, 0)`, willChange: 'transform', borderRight: '1px solid var(--border-color)' },
    notifSidebar: { position: 'fixed', top: 0, right: isNotifOpen ? '0' : '-300px', width: '280px', height: '100%', backgroundColor: 'var(--bg-sidebar)', zIndex: 3500, padding: '40px 20px', transition: 'transform 0.3s ease', transform: `translate3d(${isNotifOpen ? 0 : 300}px, 0, 0)`, willChange: 'transform', borderLeft: '1px solid var(--border-color)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' },
    badge: { background: '#ef4444', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', position: 'absolute', top: '-4px', right: 'calc(50% - 16px)', border: '2px solid var(--bg-sidebar)', lineHeight: 1 },
    modalInput: { width: '100%', height: '56px', padding: '0 16px', marginBottom: '15px', borderRadius: '12px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color-light)', boxSizing: 'border-box', outline: 'none', fontSize: '16px', lineHeight: '54px' },
    dateInput: { width: '100%', minHeight: '56px', padding: '0 16px', marginBottom: '15px', borderRadius: '12px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color-light)', boxSizing: 'border-box', outline: 'none', fontSize: '16px', appearance: 'none', WebkitAppearance: 'none' }
  };

  const heatmapData = getHeatmapData();
  const heatmapMax = Math.max(1, ...Object.values(heatmapData));
  
  let clearableNotifIndex = 0; 
  const balanceColor = getBalanceColor(currentTotal);
  const statusObj = getBalanceStatusText(currentTotal, t);
  const adminBalanceColor = getBalanceColor(globalTotalUnpaid);

  const renderSingleCard = (l, isSubCard = false) => (
    <div key={l.id} className="animated-card" style={{...styles.card, cursor: isAdmin ? 'pointer' : 'default', marginBottom: isSubCard ? '8px' : '10px', padding: isSubCard ? '15px' : '20px'}} onClick={() => isAdmin && toggleLoanSelection(l.id)}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          {isAdmin && (
            <div className="no-print" style={{ width: '20px', height: '20px', borderRadius: '5px', border: `2px solid ${selectedLoanIds.includes(l.id) ? '#10b981' : 'var(--border-color-light)'}`, backgroundColor: selectedLoanIds.includes(l.id) ? '#10b981' : 'transparent', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
              {selectedLoanIds.includes(l.id) && <Icon name="checkCircle" size={14} color="#fff" />}
            </div>
          )}
          <div style={{textAlign: 'left'}}>
            <div style={{fontWeight: 'bold', color: 'var(--text-main)', fontSize: isSubCard ? '14px' : '16px'}}>{l.productName}</div>
            <div style={{fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px'}}>
               {safeFormatDate(l.date)}
               {l.proxyName && <span style={{display:'block', color:'var(--primary)', marginTop:'2px'}}>(via: {l.proxyName})</span>}
            </div>
          </div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{color: '#ef4444', fontWeight: 'bold', fontSize: isSubCard ? '16px' : '18px'}}>₱{privacyMode ? '***' : l.amount}</div>
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // RENDER EARLY RETURNS
  // -------------------------------------------------------------
  
  if (isUpdatingApp) return (
    <>
      <GlobalStyle />
      <div className="fade-in no-print" style={{position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'var(--bg-overlay)', zIndex: 10000, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
          {!updateComplete ? (
             <>
                <div className="spinner" style={{width: '40px', height: '40px', borderTopColor: 'var(--primary)', marginBottom: '20px'}}></div>
                <h3 style={{color: 'var(--text-main)', marginBottom: '10px'}}>Updating App...</h3>
                <div style={{width: '100%', maxWidth: '250px', height: '8px', backgroundColor: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden'}}>
                   <div style={{width: `${updateProgress}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.2s ease-out'}}></div>
                </div>
                <p style={{color: 'var(--text-muted)', fontSize: '12px', marginTop: '10px'}}>{updateProgress}%</p>
             </>
          ) : (
             <div className="fade-in" style={{textAlign: 'center'}}>
                <div style={{backgroundColor: '#10b981', color: '#fff', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)'}}>
                   <Icon name="checkCircle" size={32} color="#fff" />
                </div>
                <h3 style={{color: '#10b981', margin: 0, fontSize: '22px'}}>Update Complete!</h3>
             </div>
          )}
      </div>
    </>
  );

  if (showUpdateModal) return (
    <>
      <GlobalStyle />
      <div className={`fade-in ${fadeOutUpdateModal ? 'fade-out' : ''} no-print`} style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-overlay)', zIndex: 99999 }}>
        <div className="animated-card" style={{backgroundColor: 'var(--bg-card)', padding: '30px', borderRadius: '22px', width: '90%', maxWidth: '350px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column'}}>
            <div style={{display: 'flex', justifyContent: 'center', marginBottom: '15px'}}>
               <div style={{width: '60px', height: '60px', background: 'var(--bg-card-alt)', border: '1px solid var(--border-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <Icon name="download" size={32} color="var(--primary)" />
               </div>
            </div>
            <h2 style={{margin: '0 0 10px 0', fontSize: '20px', color: 'var(--text-main)', textAlign: 'center'}}>Update Available</h2>
            <p style={{margin: '0 0 25px 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', textAlign: 'center'}}>A new stable version is ready. Please update to continue using the app smoothly.</p>
            <button className="clickable" onClick={startUpdateProcess} style={{width: '100%', padding: '16px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold', fontSize: '15px'}}>Install Update Now</button>
        </div>
      </div>
    </>
  );

  if (showSplash) return (
    <>
      <GlobalStyle />
      <div className="fade-in" style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'var(--bg-main)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
        <div className="splash-logo" style={{textAlign: 'center'}}>
          <h1 style={{fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(36px, 12vw, 48px)', margin: 0, fontWeight: '900', background: 'linear-gradient(90deg, var(--primary), #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'}}>Uson</h1>
          <h2 style={{fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 10vw, 36px)', margin: 0, fontWeight: '800', color: 'var(--text-main)'}}>CreditHub</h2>
        </div>
        <div style={{ marginTop: '40px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>
          <div className="spinner"></div> Establishing secure connection...
        </div>
      </div>
    </>
  );

  if (showWhatsNewModal) return (
    <>
      <GlobalStyle />
      <div className="fade-in no-print" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-overlay)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
        <div className="animated-card" style={{backgroundColor: 'var(--bg-card)', padding: '0', borderRadius: '24px', width: '100%', maxWidth: '360px', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
          <div style={{background: 'linear-gradient(135deg, var(--primary), #059669)', padding: '30px 20px', textAlign: 'center', color: '#fff'}}>
             <Icon name="rocket" size={48} color="#fff" />
          </div>
          <div style={{padding: '25px', textAlign: 'center'}}>
             <h2 style={{margin: '0 0 10px 0', fontSize: '22px', color: 'var(--text-main)'}}>What's New in {APP_VERSION}</h2>
             <ul style={{textAlign: 'left', color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', marginBottom: '25px', paddingLeft: '20px'}}>
               {RELEASE_NOTES.map((note, i) => <li key={i} style={{marginBottom: '6px'}}>{note}</li>)}
             </ul>
             <button className="clickable" onClick={() => setShowWhatsNewModal(false)} style={{width: '100%', padding: '16px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold', fontSize: '15px'}}>Got it!</button>
          </div>
        </div>
      </div>
    </>
  );

  if (isLoggingIn) return (
    <>
      <GlobalStyle />
      <div className="fade-in" style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-main)', zIndex: 99999 }}>
        <div style={{textAlign: 'center'}}>
           <div className="modern-spinner"></div>
           <h3 style={{color: 'var(--text-main)', margin: '0 0 5px 0'}}>Authenticating...</h3>
           <p style={{color: 'var(--text-muted)', fontSize: '12px', margin: 0}}>Please wait securely.</p>
        </div>
      </div>
    </>
  );

  if (isLoggingOut) return (
    <>
      <GlobalStyle />
      <div className="fade-in" style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-main)', zIndex: 99999 }}>
        <div style={{textAlign: 'center'}}>
           <div className="modern-spinner" style={{borderTopColor: '#ef4444'}}></div>
           <h3 style={{color: 'var(--text-main)', margin: '0 0 5px 0'}}>Logging Out...</h3>
           <p style={{color: 'var(--text-muted)', fontSize: '12px', margin: 0}}>Clearing secure session.</p>
        </div>
      </div>
    </>
  );

  if (!user) return (
    <>
      <GlobalStyle />
      <div className="fade-in" style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-main)', zIndex: 10 }}>
        <div style={{width: '100%', maxWidth: '380px', padding: '0 20px', textAlign: 'center'}}>
          <div style={{marginBottom: '40px'}}>
            <h1 className="app-title" style={{fontSize: '32px', marginBottom: '5px'}}>Uson CreditHub</h1>
            <p style={{color: 'var(--text-muted)', margin: 0, fontSize: '15px'}}>Secure Sari-Sari Ledger System</p>
          </div>

          <form onSubmit={handleEmailAuth} style={{display: 'flex', flexDirection: 'column'}}>
            <input type="email" placeholder="Email Address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="auth-input clickable" required />
            <input type="password" placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="auth-input clickable" required />
            <button className="clickable" type="submit" style={{padding: '16px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold', fontSize: '16px', marginTop: '5px'}}>
              {isSignUp ? "Create Account" : "Log In"}
            </button>
          </form>

          <p className="clickable" style={{textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', marginTop: '20px', display: 'inline-block'}} onClick={() => {triggerHaptic(); setIsSignUp(!isSignUp)}}>
            {isSignUp ? "Already have an account? Log in." : "Don't have an account? Sign up."}
          </p>

          <div className="divider">Or continue with</div>

          <button className="clickable" onClick={handleGoogleLogin} style={{width: '100%', padding: '14px', backgroundColor: '#fff', color: '#3c4043', border: '1px solid #dadce0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px', fontWeight: '600', fontSize: '15px'}}>
             <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
             Continue with Google
          </button>
        </div>
        {toast.visible && <div className="toast-anim no-print" style={{position:'fixed', bottom:'30px', left:'50%', transform:'translateX(-50%)', backgroundColor: toast.type==='error'?'#ef4444':'var(--primary)', color:'#fff', padding:'12px 24px', borderRadius:'30px', zIndex:9999, fontWeight:'bold', fontSize:'13px', boxShadow:'0 4px 15px rgba(0,0,0,0.3)', whiteSpace:'nowrap'}}>{toast.message}</div>}
      </div>
    </>
  );

  if (isCheckingDB || !dbUser) return (
    <>
      <GlobalStyle />
      <div className="fade-in" style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-main)', zIndex: 10 }}>
        <p style={{color: 'var(--text-muted)'}}>Securing your account...</p>
      </div>
    </>
  );

  if (!dbUser.isProfileComplete) return (
    <>
      <GlobalStyle />
      <div className="fade-in" style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-overlay)', zIndex: 10 }}>
        <div className="animated-card" style={{backgroundColor: 'var(--bg-card)', padding: '30px 25px', borderRadius: '22px', width: '90%', maxWidth: '400px', border: '1px solid var(--primary)', maxHeight: '80vh'}}>
          <h2 style={{color: 'var(--primary)', margin: '0 0 10px 0', textAlign: 'center'}}>Complete Your Profile</h2>
          <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginBottom: '25px'}}>Please enter your real name and phone number for SMS alerts.</p>
          
          <div style={{overflowY: 'auto', WebkitOverflowScrolling: 'touch', paddingRight: '10px'}}>
             <form onSubmit={handleSaveProfile} style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
               <input placeholder="First Name" value={firstName} onChange={e=>setFirstName(e.target.value)} required style={{...styles.modalInput, padding: '0 16px'}} />
               <input placeholder="Surname / Last Name" value={lastName} onChange={e=>setLastName(e.target.value)} required style={{...styles.modalInput, padding: '0 16px'}} />
               <input type="tel" placeholder="Phone Number (e.g. 0912...)" value={phone} onChange={e=>setPhone(e.target.value)} required style={{...styles.modalInput, padding: '0 16px'}} />
               <button className="clickable" type="submit" style={{padding: '16px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold', marginTop: '10px'}}>Save Profile</button>
             </form>
          </div>
        </div>
      </div>
    </>
  );

  if (!isAdmin && !dbUser.tcAccepted) return (
    <>
      <GlobalStyle />
      <div className="fade-in" style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-overlay)', zIndex: 10 }}>
        {/* INALIS ANG `animated-card` CLASS DITO PARA MA-FIX YUNG SCROLL ISSUE SA IOS */}
        <div style={{backgroundColor: 'var(--bg-card)', padding: '30px 25px', borderRadius: '22px', width: '90%', maxWidth: '400px', border: '1px solid var(--primary)', display: 'flex', flexDirection: 'column', height: '75vh', maxHeight: '600px', boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)'}}>
          <h2 style={{color: 'var(--primary)', margin: '0 0 15px 0', fontSize: '22px', textAlign: 'center', flexShrink: 0}}>Terms & Conditions</h2>
          <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginBottom: '20px', flexShrink: 0}}>Please read carefully before proceeding.</p>
          
          <div className="tc-scroll" style={{overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', paddingRight: '10px', color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6', flex: 1}}>
            <p>Welcome to <strong>Uson CreditHub</strong>. By logging in with your account, you agree to the following conditions:</p>
            <h4 style={{color: 'var(--text-main)', marginBottom: '5px'}}>1. Account Usage</h4>
            <p style={{marginTop: 0}}>Your account is solely used for secure identification. This ensures that only you and the Administrator can view your personal credit records.</p>
            <h4 style={{color: 'var(--text-main)', marginBottom: '5px'}}>2. Push Notifications & Reminders</h4>
            <p style={{marginTop: 0}}>To provide you with the best experience, Uson CreditHub requires <strong>Notification Permissions</strong>. This allows the system to send you real-time updates and friendly reminders regarding your current debts and past-due balances.</p>
            <h4 style={{color: 'var(--text-main)', marginBottom: '5px'}}>3. Data Tracking & Privacy</h4>
            <p style={{marginTop: 0}}>The Administrator tracks your borrowed items, amounts, and dates. Once a debt is paid, it will be moved to your Credit History and automatically deleted from the server after 7 days to save storage.</p>
            <p style={{marginTop: '20px', fontStyle: 'italic', color: 'var(--text-muted-dark)'}}>By clicking "I Understand & Accept", your browser may prompt you to allow notifications. Please click "Allow" to stay updated.</p>
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px', flexShrink: 0}}>
            <button className="clickable" onClick={handleAcceptTC} style={{width: '100%', padding: '16px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold'}}>I Understand & Accept</button>
            <button className="clickable" onClick={handleDeclineTC} style={{width: '100%', padding: '16px', backgroundColor: 'transparent', border: '1px solid #ef4444', borderRadius: '12px', color: '#ef4444', fontWeight: 'bold'}}>Decline & Logout</button>
          </div>
        </div>
      </div>
    </>
  );

  if (tourStep > 0) return (
    <>
      <GlobalStyle />
      <div className="fade-in no-print" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-overlay)', zIndex: 999999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
        <div className="animated-card" style={{backgroundColor: 'var(--bg-card)', padding: '35px 25px', borderRadius: '28px', width: '100%', maxWidth: '360px', border: '1px solid var(--primary)', textAlign: 'center', display: 'flex', flexDirection: 'column', height: '75vh', maxHeight: '600px'}}>
          
          <div className="tc-scroll" style={{overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', flex: 1, paddingRight: '5px'}}>
             {isAdmin && tourStep === 1 && <><div style={{width:'80px', height:'80px', background:'rgba(16, 185, 129, 0.1)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px auto'}}><Icon name="app" active size={40}/></div><h2 style={{color:'var(--text-main)', margin: '0 0 10px 0', fontSize:'24px', fontFamily: "'Outfit', sans-serif"}}>Add Entries</h2><p style={{color:'var(--text-muted)', fontSize:'14px', lineHeight:'1.6', margin:0}}>Located at the <strong>bottom center</strong>. Tap the main button to instantly log new customers or add items to their tab.</p></>}
             {isAdmin && tourStep === 2 && <><div style={{width:'80px', height:'80px', background:'rgba(16, 185, 129, 0.1)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px auto'}}><Icon name="bell" active size={40}/></div><h2 style={{color:'var(--text-main)', margin: '0 0 10px 0', fontSize:'24px', fontFamily: "'Outfit', sans-serif"}}>Notifications</h2><p style={{color:'var(--text-muted)', fontSize:'14px', lineHeight:'1.6', margin:0}}>Check the <strong>bottom right</strong>. Get alerted when users verify GCash payments, register an account, or when stocks are low.</p></>}
             {isAdmin && tourStep === 3 && <><div style={{width:'80px', height:'80px', background:'rgba(16, 185, 129, 0.1)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px auto'}}><Icon name="menu" size={40} active/></div><h2 style={{color:'var(--text-main)', margin: '0 0 10px 0', fontSize:'24px', fontFamily: "'Outfit', sans-serif"}}>System Tools</h2><p style={{color:'var(--text-muted)', fontSize:'14px', lineHeight:'1.6', margin:0}}>Open the Menu on the <strong>bottom left</strong> to access Analytics, Track Inventory, History, and your System Activity Logs.</p></>}

             {!isAdmin && tourStep === 1 && <><div style={{width:'80px', height:'80px', background:'rgba(16, 185, 129, 0.1)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px auto'}}><Icon name="home" active size={40}/></div><h2 style={{color:'var(--text-main)', margin: '0 0 10px 0', fontSize:'24px', fontFamily: "'Outfit', sans-serif"}}>Your Balance</h2><p style={{color:'var(--text-muted)', fontSize:'14px', lineHeight:'1.6', margin:0}}>Right in the middle of the screen. Always check your current unpaid balance on your main dashboard.</p></>}
             {!isAdmin && tourStep === 2 && <><div style={{width:'80px', height:'80px', background:'rgba(16, 185, 129, 0.1)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px auto'}}><Icon name="app" active size={40}/></div><h2 style={{color:'var(--text-main)', margin: '0 0 10px 0', fontSize:'24px', fontFamily: "'Outfit', sans-serif"}}>Payment Alerts</h2><p style={{color:'var(--text-muted)', fontSize:'14px', lineHeight:'1.6', margin:0}}>After sending your payment via GCash, click <strong>'Alert Admin'</strong> to notify them instantly to clear your account.</p></>}
             {!isAdmin && tourStep === 3 && <><div style={{width:'80px', height:'80px', background:'rgba(16, 185, 129, 0.1)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px auto'}}><Icon name="history" size={40} active/></div><h2 style={{color:'var(--text-main)', margin: '0 0 10px 0', fontSize:'24px', fontFamily: "'Outfit', sans-serif"}}>Digital Receipts</h2><p style={{color:'var(--text-muted)', fontSize:'14px', lineHeight:'1.6', margin:0}}>Open the Menu on the <strong>bottom left</strong> to view your past payments and download PDF receipts.</p></>}
          </div>

          <div style={{display: 'flex', gap: '8px', justifyContent: 'center', margin: '20px 0 25px', flexShrink: 0}}>
             {[1, 2, 3].map(step => (
                <div key={step} style={{width: tourStep === step ? '24px' : '8px', height: '8px', borderRadius: '4px', backgroundColor: tourStep === step ? 'var(--primary)' : 'var(--border-color-light)', transition: 'width 0.3s ease'}} />
             ))}
          </div>

          <button className="clickable" onClick={handleNextTour} style={{width: '100%', padding: '16px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '16px', color: '#fff', fontWeight: 'bold', fontSize: '15px', flexShrink: 0}}>{tourStep === 3 ? "Let's Start!" : "Next"}</button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <GlobalStyle />

      {/* GLOBAL TOP ONE UI NOTIF */}
      {oneUiNotif.visible && (
        <div className="one-ui-notif no-print">
          <div style={{backgroundColor: 'var(--primary)', padding: '10px', borderRadius: '50%', display: 'flex', flexShrink: 0}}>
            <Icon name={oneUiNotif.icon || "bell"} size={22} color="#fff" />
          </div>
          <div style={{flex: 1}}>
            <h4 style={{margin: '0 0 4px 0', fontSize: '15px', color: 'var(--text-main)'}}>{oneUiNotif.title}</h4>
            <p style={{margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.3', whiteSpace: 'pre-wrap'}}>{oneUiNotif.desc}</p>
          </div>
        </div>
      )}

      {/* ACCOUNT CLEARED EFFECT */}
      {showClearedEffect && (
         <div className="no-print" style={{position:'fixed', inset:0, zIndex:99999, background:'var(--bg-overlay)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
            <div style={{width:'110px', height:'110px', background:'#10b981', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', animation:'popInEffect 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', boxShadow:'0 10px 40px rgba(16, 185, 129, 0.5)'}}>
               <Icon name="checkCircle" size={64} color="#fff" />
            </div>
            <h2 className="fade-in" style={{color:'#10b981', marginTop:'25px', fontSize:'32px', fontFamily: "'Outfit', sans-serif", fontWeight:'900'}}>Account Cleared!</h2>
            <p className="fade-in" style={{color:'var(--text-muted)', fontSize:'14px', marginTop:'5px'}}>Thank you for your payment.</p>
         </div>
      )}
      
      {/* GLOBAL MODALS */}
      {showEReceiptModal && (
         <div className="fade-in no-print" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-overlay)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
            <div style={{width: '100%', maxWidth: '350px'}}>
               <div className="digital-receipt">
                  <div style={{color: 'var(--primary)', marginBottom:'10px', display:'flex', justifyContent:'center'}}><Icon name="checkCircle" size={48} /></div>
                  <h2 style={{margin:0, fontSize:'20px', color:'#000'}}>TRANSACTION COMPLETED</h2>
                  <p style={{fontSize:'12px', color:'#666', marginTop:'5px'}}>Uson CreditHub • Verified Payment</p>
                  <div className="digital-receipt-dash"></div>
                  <div style={{textAlign:'left', fontSize:'14px', lineHeight:'2'}}>
                     <div style={{display:'flex', justifyContent:'space-between'}}><span>Date:</span> <strong>{new Date().toLocaleDateString()}</strong></div>
                     <div style={{display:'flex', justifyContent:'space-between'}}><span>Account:</span> <strong style={{whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'150px', textAlign:'right'}}>{selectedCustomer?.name || dbUser?.name || 'User'}</strong></div>
                     <div style={{display:'flex', justifyContent:'space-between'}}><span>Admin:</span> <strong>David Uson</strong></div>
                  </div>
                  <div className="digital-receipt-dash"></div>
                  <h1 style={{fontSize:'36px', color:'#10b981', margin:'10px 0'}}>₱{privacyMode ? '***' : (historyToDisplay.reduce((acc, curr) => acc + (parseFloat(curr?.amount) || 0), 0)).toLocaleString()}</h1>
                  <p style={{fontSize:'11px', color:'#888', marginTop:'20px'}}>Save a screenshot of this digital receipt for your reference.</p>
               </div>
               <button className="clickable" onClick={() => { triggerHaptic(20); setShowEReceiptModal(false); }} style={{width: '100%', padding: '16px', backgroundColor: '#fff', border: 'none', borderRadius: '12px', color: '#000', fontWeight: 'bold', marginTop: '15px'}}>Close Receipt</button>
            </div>
         </div>
      )}

      {isThemeModalOpen && (
         <div className="fade-in no-print" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-overlay)', zIndex: 6000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
            <div className="animated-card" style={{backgroundColor: 'var(--bg-card)', padding: '30px', borderRadius: '22px', width: '100%', maxWidth: '350px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '70vh', maxHeight: '550px'}}>
               <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0}}>
                 <h3 style={{margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px'}}><Icon name="theme" size={20}/> Appearance</h3>
                 <span className="clickable" onClick={() => {triggerHaptic(); setIsThemeModalOpen(false)}} style={{fontSize: '20px', color: 'var(--text-muted)', padding: '5px'}}>✕</span>
               </div>
               
               <div className="tc-scroll" style={{overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', flex: 1}}>
                  <p style={{color: 'var(--text-muted)', fontSize: '13px', marginBottom: '10px'}}>Accent Color</p>
                  <div style={{display:'flex', gap:'10px', marginBottom:'25px'}}>
                    <div onClick={()=>changeAccent('#10b981')} style={{width:'30px', height:'30px', borderRadius:'50%', background:'#10b981', border: accent==='#10b981'?'2px solid #fff':'none', cursor:'pointer'}}></div>
                    <div onClick={()=>changeAccent('#3b82f6')} style={{width:'30px', height:'30px', borderRadius:'50%', background:'#3b82f6', border: accent==='#3b82f6'?'2px solid #fff':'none', cursor:'pointer'}}></div>
                    <div onClick={()=>changeAccent('#f59e0b')} style={{width:'30px', height:'30px', borderRadius:'50%', background:'#f59e0b', border: accent==='#f59e0b'?'2px solid #fff':'none', cursor:'pointer'}}></div>
                    <div onClick={()=>changeAccent('#8b5cf6')} style={{width:'30px', height:'30px', borderRadius:'50%', background:'#8b5cf6', border: accent==='#8b5cf6'?'2px solid #fff':'none', cursor:'pointer'}}></div>
                    <div onClick={()=>changeAccent('#ec4899')} style={{width:'30px', height:'30px', borderRadius:'50%', background:'#ec4899', border: accent==='#ec4899'?'2px solid #fff':'none', cursor:'pointer'}}></div>
                  </div>

                  <p style={{color: 'var(--text-muted)', fontSize: '13px', marginBottom: '10px'}}>Color Mode</p>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                     <button className="clickable" onClick={() => changeTheme('system')} style={{padding: '15px', backgroundColor: theme === 'system' ? 'var(--primary)' : 'var(--bg-card-alt)', border: '1px solid var(--border-color)', borderRadius: '12px', color: theme === 'system' ? '#fff' : 'var(--text-main)', fontWeight: 'bold'}}>🖥️ System Default</button>
                     <button className="clickable" onClick={() => changeTheme('light')} style={{padding: '15px', backgroundColor: theme === 'light' ? 'var(--primary)' : 'var(--bg-card-alt)', border: '1px solid var(--border-color)', borderRadius: '12px', color: theme === 'light' ? '#fff' : 'var(--text-main)', fontWeight: 'bold'}}>☀️ Light Mode</button>
                     <button className="clickable" onClick={() => changeTheme('dark')} style={{padding: '15px', backgroundColor: theme === 'dark' ? 'var(--primary)' : 'var(--bg-card-alt)', border: '1px solid var(--border-color)', borderRadius: '12px', color: theme === 'dark' ? '#fff' : 'var(--text-main)', fontWeight: 'bold'}}>🌙 Dark Mode</button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {isModalOpen && (
        <div className="fade-in no-print" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-overlay)', zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
          <div className="animated-card" style={{backgroundColor: 'var(--bg-card)', padding: '30px', borderRadius: '22px', width: '100%', maxWidth: '400px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '80vh', maxHeight: '650px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0}}>
              <h3 style={{margin: 0, color: 'var(--text-main)'}}>Add Entry {selectedCustomer && <span style={{color: 'var(--primary)', fontSize: '14px', display: 'block'}}>{selectedCustomer?.name}</span>}</h3>
              <span className="clickable" onClick={() => {triggerHaptic(); setIsModalOpen(false); setShowCalc(false);}} style={{fontSize: '20px', color: 'var(--text-muted)', padding: '5px'}}>✕</span>
            </div>
            
            <div className="tc-scroll" style={{overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', flex: 1, paddingRight: '5px'}}>
               <form onSubmit={addLoan}>
                 {!selectedCustomer ? (
                   <>
                     <input placeholder="Name" value={customer} onChange={e => setCustomer(e.target.value)} style={styles.modalInput} required />
                     <input list="unlinked-emails" placeholder="Gmail" value={customerEmail} onChange={handleCustomerEmailChange} style={styles.modalInput} required />
                     <datalist id="unlinked-emails">
                       {unlinkedUsers.map(u => <option key={u.email} value={u.email}>{u.name}</option>)}
                     </datalist>
                     <input type="tel" placeholder="Phone Number (e.g. 0912...)" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} style={styles.modalInput} required />
                   </>
                 ) : (
                   <>
                     {getQuickAddChips().length > 0 && (
                       <div style={{ whiteSpace:'nowrap', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', marginBottom:'15px'}}>
                          {getQuickAddChips().map(c => <div key={c} onClick={()=>{triggerHaptic(20); setProduct(c)}} className="clickable" style={{padding:'0 15px', fontSize:'11px', height: '30px', borderRadius: '15px', display:'inline-flex', alignItems:'center', justifyContent:'center', marginRight:'8px', border:'1px solid var(--border-color-light)', backgroundColor:'var(--bg-card)', color:'var(--text-muted)'}}>{c}</div>)}
                       </div>
                     )}
                     
                     <input list="product-suggestions" placeholder="Product Name" value={product} onChange={e => setProduct(e.target.value)} style={styles.modalInput} required />
                     
                     {/* OPTIONAL PROXY NAME */}
                     <input type="text" placeholder={t('proxyLabel')} value={proxyName} onChange={e => setProxyName(e.target.value)} style={styles.modalInput} />

                     <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                        <input type="text" placeholder="₱ Amount (Per Piece)" value={calcInput || amount} onChange={e => setAmount(e.target.value)} style={{...styles.modalInput, marginBottom:0, flex:1}} required />
                        <div className="clickable" onClick={()=>{triggerHaptic(); setShowCalc(!showCalc)}} style={{width:'56px', height:'56px', backgroundColor: showCalc ? 'var(--primary)' : 'var(--bg-input)', border:'1px solid var(--border-color-light)', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0}}>
                           <Icon name="calc" color={showCalc ? '#fff' : 'var(--text-main)'} size={20} />
                        </div>
                     </div>

                     {showCalc && (
                        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px', marginBottom:'20px'}}>
                           {['7','8','9','/','4','5','6','*','1','2','3','-','C','0','=','+'].map(btn => (
                              <div key={btn} className="clickable" onClick={()=>handleCalcInput(btn)} style={{backgroundColor:'var(--bg-card-alt)', padding:'12px 0', textAlign:'center', borderRadius:'8px', color: ['/','*','-','+','='].includes(btn) ? 'var(--primary)' : 'var(--text-main)', fontWeight:'bold', fontSize:'18px', border:'1px solid var(--border-color)'}}>{btn}</div>
                           ))}
                        </div>
                     )}
                     
                     <div style={{ marginBottom: '20px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', marginBottom: '10px', fontSize: '14px' }}>
                         <span>Quantity:</span>
                         <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '16px' }}>{quantity}</span>
                       </div>
                       <input type="range" min="1" max="30" value={quantity} onChange={e => {triggerHaptic(10); setQuantity(e.target.value)}} style={{ width: '100%' }} />
                     </div>
                   </>
                 )}
                 
                 <input type="date" value={loanDate} onChange={e => setLoanDate(e.target.value)} style={{...styles.dateInput, marginBottom: '25px' }} required />
                 
                 <button className="clickable" type="submit" disabled={isAddingEntry} style={{width: '100%', padding: '16px', backgroundColor: isAddingEntry ? 'var(--text-muted-dark)' : 'var(--primary)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold', flexShrink: 0}}>
                   {isAddingEntry ? <span style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'10px'}}><div className="mini-spinner"></div> Adding Entry...</span> : 'Save'}
                 </button>
               </form>
            </div>
          </div>
        </div>
      )}

      {showIosPrintModal && (
        <div className="fade-in no-print" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-overlay)', zIndex: 6000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
          <div className="animated-card" style={{backgroundColor: 'var(--bg-card)', padding: '30px', borderRadius: '22px', width: '100%', maxWidth: '400px', border: '1px solid #ef4444'}}>
            <h3 style={{color: '#ef4444', margin: '0 0 15px 0'}}>⚠️ iOS Restriction</h3>
            <p style={{color: 'var(--text-main)', fontSize: '14px', lineHeight: '1.5', marginBottom: '20px'}}>
              Apple blocks PDF downloads inside Add-to-Homescreen apps. <br/><br/>
              To print or save your receipt, please copy the link below and open it directly in the <strong>Safari</strong> browser.
            </p>
            <div style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
              <input readOnly value={window.location.href} style={{...styles.modalInput, marginBottom: 0, flex: 1, color: 'var(--text-muted-dark)'}} />
              <button className="clickable" onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                showToast('Link copied! Open Safari and paste it.');
              }} style={{padding: '0 15px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold'}}>Copy</button>
            </div>
            <button className="clickable" onClick={() => setShowIosPrintModal(false)} style={{width: '100%', padding: '12px', background: 'none', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-muted)', fontWeight: 'bold'}}>Close</button>
          </div>
        </div>
      )}

      <div className="wrapper" style={styles.wrapper}>
        <header className="top-header no-print">
          <div className="app-title">Uson CreditHub</div>
          <div className="clickable" onClick={() => {triggerHaptic(); setPrivacyMode(!privacyMode)}} style={{position:'absolute', right:'20px', color:'var(--text-muted)'}}>
             {privacyMode ? <Icon name="eyeOff" size={20}/> : <Icon name="eye" size={20}/>}
          </div>
        </header>

        <div className="bottom-nav no-print">
          <div className={`nav-item clickable ${isSidebarOpen ? 'active' : ''}`} onClick={() => {triggerHaptic(); setIsSidebarOpen(true)}}>
            <Icon name="menu" active={isSidebarOpen} />
            <span>{t('menu')}</span>
          </div>
          
          {isAdmin && view === 'dashboard' && (
            <div className="nav-item clickable" onClick={() => {triggerHaptic(); setIsModalOpen(true)}}>
              <div className="bottom-fab"><Icon name="home" color="#fff" size={28} /></div>
            </div>
          )}
          {isAdmin && view !== 'dashboard' && (
             <div className="nav-item" style={{opacity: 0, pointerEvents: 'none'}}>
                <div className="bottom-fab"></div>
             </div>
          )}

          <div className={`nav-item clickable ${isNotifOpen ? 'active' : ''}`} onClick={() => {triggerHaptic(); setIsNotifOpen(true)}} style={{position: 'relative'}}>
            <div className={hasUrgentNotifs ? 'ringing-infinite' : (isBellRinging ? 'ringing' : '')} style={{display: 'inline-flex'}}>
               <Icon name="bell" active={isNotifOpen} color={hasUrgentNotifs ? '#ef4444' : undefined} />
            </div>
            <span>{t('navNotifs')}</span>
            {displayNotifCount > 0 && (
               <div style={{...styles.badge, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:'bold'}}>
                  {displayNotifCount > 9 ? '9+' : displayNotifCount}
               </div>
            )}
          </div>
        </div>

        {/* LEFT SIDEBAR MENU */}
        <div className="sidebar no-print tc-scroll" style={{...styles.sidebar, overflowY: 'auto', transform: `translate3d(${isSidebarOpen ? 0 : -280}px, 0, 0)`}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)'}}>
            <div>
              <p style={{color: 'var(--text-muted-dark)', fontSize: '11px', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '1px'}}>{getGreeting()}</p>
              <h2 style={{color: 'var(--text-main)', margin: 0, fontSize: '20px'}}>{dbUser?.name ? dbUser.name.split(' ')[0] : 'User'}! ✨</h2>
            </div>
            <span className="clickable" onClick={()=>setIsSidebarOpen(false)} style={{fontSize:'24px', color:'var(--text-muted)'}}>✕</span>
          </div>

          <div className="clickable" style={{display:'flex', alignItems:'center', gap:'12px', padding: '15px 0', color: view === 'dashboard' ? 'var(--primary)' : 'var(--text-muted-dark)', fontWeight: view === 'dashboard' ? 'bold' : 'normal'}} onClick={() => safeNavigation(() => { setView('dashboard'); setSelectedCustomer(null); setIsSidebarOpen(false); setSearchQuery(''); })}><Icon name="home" size={20} active={view==='dashboard'}/> {t('dashboard')}</div>
          <div className="clickable" style={{display:'flex', alignItems:'center', gap:'12px', padding: '15px 0', color: view === 'history' ? 'var(--primary)' : 'var(--text-muted-dark)', fontWeight: view === 'history' ? 'bold' : 'normal'}} onClick={() => safeNavigation(() => { setView('history'); setSelectedCustomer(null); setIsSidebarOpen(false); setSearchQuery(''); })}><Icon name="history" size={20} active={view==='history'}/> {t('history')}</div>
          
          {isAdmin && <div className="clickable" style={{display:'flex', alignItems:'center', gap:'12px', padding: '15px 0', color: view === 'users' ? 'var(--primary)' : 'var(--text-muted-dark)', fontWeight: view === 'users' ? 'bold' : 'normal'}} onClick={() => safeNavigation(() => { setView('users'); setIsSidebarOpen(false); setSearchQuery(''); })}><Icon name="users" size={20} active={view==='users'}/> Customers</div>}
          {isAdmin && <div className="clickable" style={{display:'flex', alignItems:'center', gap:'12px', padding: '15px 0', color: view === 'analytics' ? 'var(--primary)' : 'var(--text-muted-dark)', fontWeight: view === 'analytics' ? 'bold' : 'normal'}} onClick={() => safeNavigation(() => { setView('analytics'); setIsSidebarOpen(false); setSearchQuery(''); })}><Icon name="analytics" size={20} active={view==='analytics'}/> Analytics & Inventory</div>}
          {isAdmin && <div className="clickable" style={{display:'flex', alignItems:'center', gap:'12px', padding: '15px 0', color: view === 'archive' ? 'var(--primary)' : 'var(--text-muted-dark)', fontWeight: view === 'archive' ? 'bold' : 'normal'}} onClick={() => safeNavigation(() => { setView('archive'); setIsSidebarOpen(false); setSearchQuery(''); })}><Icon name="archive" size={20} active={view==='archive'}/> System Archive</div>}
          {isAdmin && <div className="clickable" style={{display:'flex', alignItems:'center', gap:'12px', padding: '15px 0', color: view === 'logs' ? 'var(--primary)' : 'var(--text-muted-dark)', fontWeight: view === 'logs' ? 'bold' : 'normal'}} onClick={() => safeNavigation(() => { setView('logs'); setIsSidebarOpen(false); setSearchQuery(''); })}><Icon name="logs" size={20} active={view==='logs'}/> Activity Logs</div>}

          <div className="clickable" style={{display:'flex', alignItems:'center', gap:'12px', padding: '15px 0', color: view === 'howToUse' ? 'var(--primary)' : 'var(--text-muted-dark)', fontWeight: view === 'howToUse' ? 'bold' : 'normal'}} onClick={() => safeNavigation(() => { setView('howToUse'); setIsSidebarOpen(false); setSearchQuery(''); })}><Icon name="guide" size={20} active={view==='howToUse'}/> {t('howToUse')}</div>

          <div className="clickable" style={{display:'flex', alignItems:'center', gap:'12px', padding: '15px 0', color: 'var(--text-muted-dark)', fontWeight: 'normal', borderTop: '1px solid var(--border-color)', marginTop: '15px'}} onClick={() => {triggerHaptic(); setIsThemeModalOpen(true); setIsSidebarOpen(false);}}><Icon name="theme" size={20} /> {t('theme')}</div>

          <div className="clickable" style={{display:'flex', alignItems:'center', gap:'12px', padding: '15px 0', color: view === 'settings' ? 'var(--primary)' : 'var(--text-muted-dark)', fontWeight: view === 'settings' ? 'bold' : 'normal'}} onClick={() => safeNavigation(() => { setView('settings'); setIsSidebarOpen(false); setSearchQuery(''); })}><Icon name="settings" size={20} active={view==='settings'}/> {t('settings')}</div>

          <button className="clickable" onClick={handleLogout} style={{marginTop: 'auto', padding: '12px', width: '100%', borderRadius: '10px', border: '1px solid #ef4444', color: '#ef4444', background: 'none', display:'flex', justifyContent:'center', alignItems:'center', gap:'8px'}}><Icon name="logout" size={16} /> {t('logout')}</button>
        </div>
        {/* OPACITY FIX FOR SMOOTH CLOSE ANIMATION */}
        <div onClick={() => setIsSidebarOpen(false)} style={{position: 'fixed', inset: 0, zIndex: 2500, backgroundColor: 'var(--bg-overlay)', opacity: isSidebarOpen ? 1 : 0, pointerEvents: isSidebarOpen ? 'auto' : 'none', transition: 'opacity 0.3s ease'}}></div>

        {/* RIGHT NOTIFICATION SIDEBAR */}
        <div className="notifSidebar no-print" style={{...styles.notifSidebar, transform: `translate3d(${isNotifOpen ? 0 : 300}px, 0, 0)`}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0}}>
            <h2 style={{margin: 0, fontSize: '20px', color: 'var(--text-main)'}}>{t('notifs')}</h2>
            <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
               {(userNotificationsCount > 0 || showWhatsNewSidebar || adminNotificationsCount > 0) && (
                  <span className="clickable" onClick={handleClearAllNotifs} style={{fontSize: '12px', color: 'var(--primary)', fontWeight: 'bold'}}>Clear All</span>
               )}
               <span className="clickable" onClick={closeNotifSidebar} style={{fontSize: '24px', color: 'var(--text-muted)', padding: '5px'}}>✕</span>
            </div>
          </div>
          
          <div style={{position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
            <div className="tc-scroll" onScroll={handleNotifScroll} style={{ display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', flex: 1, paddingBottom: '30px', paddingRight: '12px', overflowX: 'hidden' }}>
              
              {isAdmin ? (
                <>
                  {pendingUsers.length > 0 && pendingUsers.map(pu => (
                    <div key={pu.email} className="animated-card fade-in clickable notif-item urgent-pulse" style={{...styles.card, borderLeft: '4px solid #f59e0b', padding: '15px', margin: 0}} onClick={() => safeNavigation(() => { const summary = getSummaries().find(s => s?.email === pu.email); if(summary) { setSelectedCustomer(summary); setIsNotifOpen(false); setView('dashboard'); } })}>
                      <h4 style={{margin: '0 0 8px 0', color: '#f59e0b'}}>GCash Payment</h4>
                      <p style={{margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5'}}>
                        <strong style={{color: 'var(--text-main)'}}>{pu.name}</strong> sent a verification request for GCash payment.
                      </p>
                      {pu.proofImage && <div style={{marginTop:'10px', border:'1px solid var(--border-color)', borderRadius:'8px', padding:'5px'}}><img src={pu.proofImage} alt="Proof" style={{width:'100%', borderRadius:'4px'}}/></div>}
                    </div>
                  ))}

                  {unlinkedUsersToDisplay.length > 0 && unlinkedUsersToDisplay.map(uu => (
                     <div key={uu.email} className="animated-card fade-in clickable notif-item urgent-pulse" style={{...styles.card, borderLeft: '4px solid #f59e0b', padding: '15px', margin: 0}} onClick={() => {
                         setCustomerEmail(uu.email); setCustomer(uu.name); setCustomerPhone(uu.phone || ''); setIsNotifOpen(false); setIsModalOpen(true);
                     }}>
                        <h4 style={{margin: '0 0 8px 0', color: '#f59e0b'}}>Needs Ledger Setup</h4>
                        <p style={{margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5'}}>
                          <strong style={{color: 'var(--text-main)'}}>{uu.name}</strong> registered but has no ledger yet. Click to setup.
                        </p>
                     </div>
                  ))}
                  
                  {lowStockItems.length > 0 && lowStockItems.map(item => (
                    <div key={item.id} className="animated-card fade-in clickable notif-item urgent-pulse" style={{...styles.card, borderLeft: '4px solid #ef4444', padding: '15px', margin: 0}} onClick={() => safeNavigation(() => { setIsNotifOpen(false); setView('analytics'); })}>
                      <h4 style={{margin: '0 0 8px 0', color: '#ef4444'}}>Low Stock Warning</h4>
                      <p style={{margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5'}}>
                        <strong style={{color: 'var(--text-main)'}}>{item.productName}</strong> only has {item.stock} unit(s) left!
                      </p>
                    </div>
                  ))}

                  {showWhatsNewSidebar && (
                    <div className={`animated-card fade-in notif-item ${clearingNotifs ? 'slide-out-domino' : ''}`} style={{...styles.card, padding: 0, overflow: 'hidden', border: '1px solid var(--primary)', backgroundColor: 'var(--bg-card)', animationDelay: clearingNotifs ? `${(clearableNotifIndex++) * 0.08}s` : '0s'}}>
                      <div style={{background: 'linear-gradient(135deg, var(--primary), #059669)', padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <Icon name="rocket" size={20} color="#fff" />
                        <h4 style={{margin: 0, color: '#fff', fontSize: '14px'}}>What's New in {APP_VERSION}</h4>
                      </div>
                      <div style={{padding: '15px'}}>
                        <ul style={{margin: 0, paddingLeft: '15px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6'}}>
                          {RELEASE_NOTES.map((note, i) => <li key={i} style={{marginBottom: '4px'}}>{note}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}

                  {adminNotificationsCount === 0 && !showWhatsNewSidebar && (
                    <EmptyState icon="bell" title="All caught up!" desc="No pending verifications at the moment." />
                  )}
                </>
              ) : (
                <>
                  {remindedLoans.length > 0 && (
                    <div className="animated-card fade-in notif-item urgent-pulse" style={{...styles.card, borderLeft: '4px solid #ef4444', padding: '15px', margin: 0}}>
                      <h4 style={{margin: '0 0 8px 0', color: '#ef4444'}}>{t('payReminder')}</h4>
                      <p style={{margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5'}}>
                        {t('payDesc')}
                      </p>
                    </div>
                  )}

                  {newAddedLoans.length > 0 && (
                    <div className={`animated-card fade-in notif-item ${clearingNotifs ? 'slide-out-domino' : ''}`} style={{...styles.card, borderLeft: '4px solid var(--primary)', padding: '15px', margin: 0, animationDelay: clearingNotifs ? `${(clearableNotifIndex++) * 0.08}s` : '0s'}}>
                      <h4 style={{margin: '0 0 8px 0', color: 'var(--primary)'}}>{t('newCredit')}</h4>
                      <p style={{margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5'}}>
                        {t('newCreditDesc')}
                      </p>
                    </div>
                  )}

                  {dbUser?.clearedNotif && !isAdmin && (
                    <div className={`animated-card fade-in notif-item ${clearingNotifs ? 'slide-out-domino' : ''}`} style={{...styles.card, borderLeft: '4px solid #10b981', padding: '15px', margin: 0, animationDelay: clearingNotifs ? `${(clearableNotifIndex++) * 0.08}s` : '0s'}}>
                      <h4 style={{margin: '0 0 8px 0', color: '#10b981'}}>{t('accountCleared')}</h4>
                      <p style={{margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5'}}>
                        {t('clearedDesc')}
                      </p>
                    </div>
                  )}

                  {showWhatsNewSidebar && (
                    <div className={`animated-card fade-in notif-item ${clearingNotifs ? 'slide-out-domino' : ''}`} style={{...styles.card, padding: 0, overflow: 'hidden', border: '1px solid var(--primary)', backgroundColor: 'var(--bg-card)', animationDelay: clearingNotifs ? `${(clearableNotifIndex++) * 0.08}s` : '0s'}}>
                      <div style={{background: 'linear-gradient(135deg, var(--primary), #059669)', padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <Icon name="rocket" size={20} color="#fff" />
                        <h4 style={{margin: 0, color: '#fff', fontSize: '14px'}}>What's New in {APP_VERSION}</h4>
                      </div>
                      <div style={{padding: '15px'}}>
                        <ul style={{margin: 0, paddingLeft: '15px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6'}}>
                          {RELEASE_NOTES.map((note, i) => <li key={i} style={{marginBottom: '4px'}}>{note}</li>)}
                        </ul>
                      </div>
                    </div>
                  )}

                  {userNotificationsCount === 0 && !showWhatsNewSidebar && (
                    <EmptyState icon="bell" title="All caught up!" desc={t('noNotifs')} />
                  )}
                </>
              )}
            </div>
            
            {/* IOS BLUR EFFECT / GRADIENT AT THE BOTTOM FOR LONG NOTIFICATIONS */}
            {!isNotifScrolledToBottom && (
               <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px', background: 'linear-gradient(to bottom, transparent, var(--bg-sidebar))', pointerEvents: 'none', zIndex: 10}} />
            )}
          </div>
        </div>
        {/* OPACITY FIX FOR SMOOTH CLOSE ANIMATION */}
        <div onClick={closeNotifSidebar} style={{position: 'fixed', inset: 0, zIndex: 3400, backgroundColor: 'var(--bg-overlay)', opacity: isNotifOpen ? 1 : 0, pointerEvents: isNotifOpen ? 'auto' : 'none', transition: 'opacity 0.3s ease'}}></div>

        {/* MAIN DASHBOARD CONTAINER */}
        <div className={`main tc-scroll ${isNavigating ? 'fade-out-nav' : 'fade-in'}`} style={styles.main}>
          {!activePhone && view === 'dashboard' && (
             <div className="no-print animated-card" style={{...styles.card, backgroundColor: 'var(--bg-card-alt)', border: '1px solid #f59e0b', marginBottom: '20px'}}>
                <h4 style={{color: '#f59e0b', margin: '0 0 10px 0'}}>{t('phoneReq')}</h4>
                <p style={{fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 15px 0'}}>{t('phoneDesc')}</p>
                <div style={{display: 'flex', gap: '10px'}}>
                   <input type="tel" placeholder="0912..." value={updatePhoneInput} onChange={e=>setUpdatePhoneInput(e.target.value)} style={{...styles.modalInput, marginBottom: 0, flex: 1}} />
                   <button className="clickable" onClick={() => handleUpdateMissingPhone(activeEmail)} style={{padding: '0 15px', backgroundColor: '#f59e0b', border: 'none', borderRadius: '12px', color: '#000', fontWeight: 'bold'}}>{t('save')}</button>
                </div>
             </div>
          )}

          {isAdmin && !selectedCustomer && (view === 'dashboard' || view === 'history' || view === 'users' || view === 'archive') && (
            <div className="no-print" style={{ marginBottom: '15px' }}>
              <input
                type="text"
                placeholder="Search name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '14px 20px', borderRadius: '12px', backgroundColor: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-color-light)', outline: 'none', fontSize: '14px' }}
              />
            </div>
          )}

          {view === 'settings' && (
             <div className="fade-in no-print">
               <h2 style={{color: 'var(--primary)', marginBottom: '25px', textAlign: 'center'}}>{t('settings')}</h2>

               <div className="animated-card" style={{...styles.card, border: '1px solid var(--border-color)', marginBottom: '20px'}}>
                  <h3 style={{margin: '0 0 10px 0', color: 'var(--text-main)'}}>Language / Wika</h3>
                  <p style={{color: 'var(--text-muted)', fontSize: '13px', marginBottom: '15px'}}>Choose your preferred language for the dashboard.</p>
                  <select value={lang} onChange={(e) => handleLanguageChange(e.target.value)} className="custom-select" style={{...styles.modalInput, marginBottom: 0}}>
                     <option value="en">English</option>
                     <option value="tl">Tagalog</option>
                  </select>
               </div>

               <div className="animated-card" style={{...styles.card, border: '1px solid var(--border-color)', marginBottom: '20px'}}>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <h3 style={{margin: '0 0 5px 0', color: 'var(--text-main)'}}>System Haptics</h3>
                      <p style={{color: 'var(--text-muted)', fontSize: '12px', margin: 0}}>Enable vibration feedback (Android only).</p>
                    </div>
                    <div onClick={toggleHaptics} style={{width:'50px', height:'26px', borderRadius:'13px', background: hapticsEnabled ? 'var(--primary)' : 'var(--bg-input)', border: hapticsEnabled ? 'none' : '1px solid var(--border-color)', display:'flex', alignItems:'center', padding:'2px', cursor:'pointer', transition:'0.3s'}}>
                       <div style={{width:'22px', height:'22px', borderRadius:'50%', background:'#fff', transform: hapticsEnabled ? 'translateX(24px)' : 'translateX(0)', transition:'0.3s', boxShadow:'0 2px 4px rgba(0,0,0,0.2)'}}></div>
                    </div>
                  </div>
               </div>

               {isAdmin && (
                 <div className="animated-card" style={{...styles.card, backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-color)', marginBottom: '20px'}}>
                    <h3 style={{margin: '0 0 10px 0', color: 'var(--text-main)'}}>Admin GCash Details</h3>
                    <p style={{color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px'}}>Set your GCash registered name and number. This will be shown to users as their payment method.</p>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                       <input type="text" placeholder="GCash Registered Name" value={adminGcashInputName} onChange={e=>setAdminGcashInputName(e.target.value)} style={{...styles.modalInput, marginBottom: 0}} />
                       <input type="tel" placeholder="GCash Number (e.g. 0912...)" value={adminGcashInputPhone} onChange={e=>setAdminGcashInputPhone(e.target.value)} style={{...styles.modalInput, marginBottom: 0}} />
                       <button className="clickable" onClick={handleSaveGcash} style={{padding: '16px', backgroundColor: '#10b981', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold', marginTop: '10px'}}>Save GCash Details</button>
                    </div>
                 </div>
               )}

               {isAdmin && (
                 <div className="animated-card" style={{...styles.card, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444'}}>
                    <h3 style={{margin: '0 0 10px 0', color: '#ef4444'}}>Danger Zone (Testing)</h3>
                    <p style={{color: '#ffb3b3', fontSize: '13px', marginBottom: '20px', lineHeight: '1.5'}}>
                      Safely reset testing data. Choose which data to wipe.
                    </p>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
                       <button className="clickable" onClick={handleClearAnalytics} style={{padding: '16px', backgroundColor: 'transparent', border: '1px solid #ef4444', borderRadius: '12px', color: '#ef4444', fontWeight: 'bold'}}>
                          Clear Analytics & History <br/><span style={{fontSize: '11px', fontWeight: 'normal'}}>(Keeps active dashboard users/loans)</span>
                       </button>
                       <button className="clickable" onClick={handleClearActiveLoans} style={{padding: '16px', backgroundColor: '#ef4444', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold'}}>
                          Wipe Active Dashboard Loans <br/><span style={{fontSize: '11px', fontWeight: 'normal'}}>(Deletes all current unpaid balances)</span>
                       </button>
                    </div>
                 </div>
               )}
             </div>
          )}

          {view === 'howToUse' && (
             <div className="fade-in no-print">
               <h2 style={{color: 'var(--primary)', marginBottom: '25px', textAlign: 'center'}}>{t('howToUse')}</h2>
               <div className="animated-card" style={{...styles.card, border: '1px solid var(--border-color)', lineHeight: '1.6'}}>
                  <h3 style={{color: 'var(--text-main)', marginTop: 0}}>{lang === 'tl' ? 'Ano ang Uson CreditHub?' : 'What is Uson CreditHub?'}</h3>
                  <p style={{color: 'var(--text-muted)', fontSize: '14px', whiteSpace: 'pre-wrap'}}>
                    {t('htuAppDesc')}
                  </p>
                  
                  <h3 style={{color: 'var(--text-main)', marginTop: '20px'}}>{isAdmin ? t('htuAdminTitle') : t('htuUserTitle')}</h3>
                  <ul style={{color: 'var(--text-muted)', fontSize: '14px', paddingLeft: '20px'}}>
                    <li style={{marginBottom: '10px'}}>{isAdmin ? t('htuAdmin1') : t('htuUser1')}</li>
                    <li style={{marginBottom: '10px'}}>{isAdmin ? t('htuAdmin2') : t('htuUser2')}</li>
                    <li style={{marginBottom: '10px'}}>{isAdmin ? t('htuAdmin3') : t('htuUser3')}</li>
                  </ul>
               </div>
             </div>
          )}

          {isAdmin && !selectedCustomer && view === 'dashboard' && (
            <div style={{textAlign: 'center'}}>
              <div className="animated-card" style={{...styles.balance, padding: '25px 20px', marginBottom: '20px', border: `1px solid ${adminBalanceColor}`}}>
                <p style={{margin: 0, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase'}}>Total Pending Collectibles</p>
                <h1 style={{margin: '5px 0 0 0', fontSize: '42px', color: adminBalanceColor, transition: 'color 0.5s ease'}}>
                  ₱<AnimatedNumber value={globalTotalUnpaid} privacy={privacyMode} />
                </h1>
              </div>
              
              {isLoadingData ? (
                <>
                  <div className="skeleton" style={{height: '80px', marginBottom: '15px'}}></div>
                  <div className="skeleton" style={{height: '80px', marginBottom: '15px'}}></div>
                </>
              ) : filteredSummaries.length === 0 ? (
                <EmptyState icon="users" title="No Active Borrowers" desc="Add entries to see your customers here." />
              ) : (
                filteredSummaries.map(s => (
                  <div key={s.email} className={`animated-card clickable ${s.paymentPending ? 'glow-warning' : ''}`} style={{...styles.card, border: s.paymentPending ? '1px solid #f59e0b' : '1px solid var(--border-color)'}} onClick={() => safeNavigation(() => { setSelectedCustomer(s); })}>
                    {s.hasNew && <div style={{...styles.badge, right: '15px', top: '15px', border: 'none', width: '10px', height: '10px'}}></div>}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                        <div style={{width:'40px', height:'40px', borderRadius:'50%', background: getAvatarColor(s.email), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:'bold', fontSize:'14px', flexShrink:0}}>
                          {getInitials(s.name)}
                        </div>
                        <div style={{textAlign: 'left'}}>
                          <div style={{fontWeight: 'bold', fontSize: '16px', color: 'var(--text-main)', marginBottom:'2px'}}>
                            {s.name} {s.paymentPending && <span className="no-print" style={{fontSize: '10px', backgroundColor: '#f59e0b', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold'}}>Verifying</span>}
                          </div>
                          <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                            <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>{s.items.length} records</span>
                            <TrustStars rating={calculateTrust(s.email, history, loans)} />
                          </div>
                        </div>
                      </div>
                      <div style={{color: getBalanceColor(s.total), fontWeight: 'bold', fontSize: '18px', transition: 'color 0.5s ease'}}>
                        ₱{privacyMode ? '***' : s.total.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {view === 'dashboard' && !isAdmin && loans.length === 0 && !isLoadingData && (
             <div className="animated-card fade-in no-print" style={{...styles.card, backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px'}}>
               <Icon name="bell" size={28} color="#f59e0b" />
               <div>
                 <h4 style={{margin: '0 0 5px 0', color: '#f59e0b', fontSize: '15px'}}>{t('awaitingAdmin')}</h4>
                 <p style={{margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4'}}>{t('awaitingAdminDesc')}</p>
               </div>
             </div>
          )}

          {view === 'dashboard' && (selectedCustomer || (!isAdmin && loans.length > 0)) && (
            <div className="fade-in">
              <div style={{display: 'grid', gridTemplateColumns: '60px 1fr 60px', alignItems: 'center', marginBottom: '25px'}}>
                {isAdmin ? (
                   <div className="clickable" onClick={() => safeNavigation(() => { setSelectedCustomer(null); setSelectedLoanIds([]); })} style={{width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)'}}>
                      <Icon name="chevronLeft" size={20} />
                   </div>
                ) : <div></div>}
                <h2 style={{margin: 0, textAlign: 'center', color: 'var(--text-main)', fontSize: '20px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{isAdmin && selectedCustomer ? selectedCustomer.name : t('yourCredit')}</h2>
                <div></div>
              </div>
              
              <div style={{...styles.balance, border: `1px solid ${balanceColor}`}} className="animated-card">
                <p style={{margin: 0, color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase'}}>{t('curBalance')}</p>
                
                <h1 style={{margin: '10px 0 5px 0', fontSize: '56px', color: balanceColor, transition: 'color 0.5s ease', lineHeight: '1.1'}}>
                  ₱<AnimatedNumber value={currentTotal} privacy={privacyMode} />
                </h1>

                {!isAdmin && (
                  <div style={{fontSize: '12px', color: statusObj.color, fontWeight: '600', marginTop: '5px', textAlign: 'center', transition: 'color 0.5s ease', padding: '4px 12px', backgroundColor: 'var(--bg-input)', borderRadius: '12px', display: 'inline-block'}}>
                    {statusObj.text}
                  </div>
                )}
                
                {/* ADMIN DUAL NOTIFY BUTTONS */}
                {isAdmin && currentTotal > 0 && selectedCustomer && (
                  <div className="no-print" style={{display: 'flex', gap: '10px', width: '100%', marginTop: '20px'}}>
                    {activePhone ? (
                      <a href={`sms:${activePhone}?body=${encodeURIComponent(`Hi ${selectedCustomer.name}, this is ${adminGcash.name || 'Admin'} from Uson CreditHub. You have a pending balance of ₱${currentTotal}. Please settle it via GCash (${adminGcash.phone || 'Not set'}) or in person. Thank you!`)}`} 
                         className="clickable" 
                         style={{flex: 1, padding: '12px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', fontSize: '13px', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}>
                         <Icon name="sms" size={16} color="#fff"/> Text User
                      </a>
                    ) : (
                      <button className="clickable" onClick={() => showToast("No phone number registered for this user.", "error")} style={{flex: 1, padding: '12px', backgroundColor: 'var(--scrollbar-thumb)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}>
                         <Icon name="sms" size={16} color="#fff"/> No SMS
                      </button>
                    )}
                    <button className="clickable" onClick={() => sendPaymentReminder(selectedCustomer.email)} style={{flex: 1, padding: '12px', backgroundColor: remindedUsers[selectedCustomer.email] ? '#10b981' : '#3b82f6', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: '0.3s'}}>
                       {remindedUsers[selectedCustomer.email] ? <><Icon name="checkCircle" size={16} color="#fff"/> Sent! ✅</> : <><Icon name="bell" size={16} color="#fff"/> Remind User</>}
                    </button>
                  </div>
                )}

                {/* USER DUAL NOTIFY BUTTONS */}
                {!isAdmin && currentTotal > 0 && (
                  <div className="no-print" style={{width: '100%', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)'}}>
                    <p style={{fontSize: '13px', color: 'var(--text-muted)', marginBottom: '15px', lineHeight: '1.5'}}>
                      {t('payGcash')} <strong style={{color: 'var(--text-main)'}}>{adminGcash.phone || 'Not Set'}</strong><br/>
                      {t('name')} <strong style={{color: 'var(--text-main)'}}>{adminGcash.name || 'Not Set'}</strong><br/>
                      <span style={{fontSize: '11px', color: 'var(--text-muted-dark)'}}>{t('payPerson')}</span>
                    </p>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                      <div style={{display: 'flex', gap: '10px'}}>
                        <button className="clickable" onClick={handleRequestApproval} style={{flex: 1, padding: '12px', backgroundColor: adminAlerted ? '#059669' : '#10b981', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: '0.3s'}}>
                           {adminAlerted ? <><Icon name="checkCircle" size={16} color="#fff"/> Alert Sent! ✅</> : <><Icon name="app" size={16} color="#fff"/> {t('notifyApp')}</>}
                        </button>
                        
                        {adminGcash.phone ? (
                          <a href={`sms:${adminGcash.phone}?body=${encodeURIComponent(`Hello ${adminGcash.name || 'Admin'}, I am ${dbUser?.name}. I have just sent my payment of ₱${currentTotal} to your GCash account. Please verify and clear my account. Thank you!`)}`} 
                             className="clickable" 
                             style={{flex: 1, padding: '12px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', fontSize: '12px', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}>
                             <Icon name="sms" size={16} color="#fff"/> {t('textAdmin')}
                          </a>
                        ) : (
                          <button className="clickable" onClick={() => showToast("Admin hasn't setup a GCash number yet.", "error")} style={{flex: 1, padding: '12px', backgroundColor: 'var(--scrollbar-thumb)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'}}>
                             <Icon name="sms" size={16} color="#fff"/> {t('noAdminNum')}
                          </button>
                        )}
                      </div>
                      <label className="clickable" style={{width:'100%', padding:'12px', backgroundColor:'var(--bg-input)', border:'1px dashed var(--border-color-light)', borderRadius:'10px', color:'var(--text-muted)', fontSize:'12px', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'}}>
                        <Icon name="image" size={16} /> {proofImage ? "Proof Attached ✅ (Click to change)" : "Attach GCash Screenshot (Optional)"}
                        <input type="file" accept="image/*" onChange={handleProofUpload} style={{display:'none'}}/>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* MODERN ADMIN ACTION BAR */}
              {isAdmin && displayCustomerLoans.length > 0 && (
                <div className="no-print animated-card" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '12px 15px', borderRadius: '16px', marginBottom: '25px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <div style={{width: '28px', height: '28px', borderRadius: '8px', backgroundColor: selectedLoanIds.length > 0 ? 'var(--primary)' : 'var(--bg-card-alt)', color: selectedLoanIds.length > 0 ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', transition: '0.3s'}}>
                            {selectedLoanIds.length}
                        </div>
                        <span style={{fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600'}}>Selected</span>
                    </div>
                    <div style={{display: 'flex', gap: '8px'}}>
                        <button className="clickable" onClick={deleteSelectedLoans} style={{padding: '10px', backgroundColor: selectedLoanIds.length > 0 ? '#ef4444' : 'var(--bg-input)', border: 'none', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.3s'}} disabled={selectedLoanIds.length === 0} title="Delete Incorrect Entry">
                            <Icon name="trash" size={16} color={selectedLoanIds.length > 0 ? "#fff" : "var(--text-muted-dark)"}/>
                        </button>
                        <button className="clickable" onClick={markSelectedPaid} style={{padding: '10px 14px', backgroundColor: selectedLoanIds.length > 0 ? '#10b981' : 'var(--bg-input)', border: 'none', borderRadius: '10px', color: selectedLoanIds.length > 0 ? '#fff' : 'var(--text-muted-dark)', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', transition: '0.3s'}} disabled={selectedLoanIds.length === 0}>
                            <Icon name="checkCircle" size={14} color={selectedLoanIds.length > 0 ? "#fff" : "var(--text-muted-dark)"}/> Pay
                        </button>
                        <button className="clickable" onClick={() => markAllPaid(displayCustomerLoans)} style={{padding: '10px 14px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px'}}>
                            <Icon name="history" size={14} color="#fff"/> Pay All
                        </button>
                    </div>
                </div>
              )}

              {isLoadingData ? (
                <>
                  <div className="skeleton" style={{height: '60px', marginBottom: '10px'}}></div>
                  <div className="skeleton" style={{height: '60px', marginBottom: '10px'}}></div>
                </>
              ) : displayCustomerLoans.length === 0 ? (
                <EmptyState icon="home" title="All Clear!" desc={t('noBorrowings')} />
              ) : (
                groupLoansByMonth(displayCustomerLoans).map(([monthYear, data]) => {
                  
                  // IOS STYLE STACKING LOGIC
                  const groups = {};
                  data.items.forEach(l => {
                      const nameKey = (l.productName || '').trim().toLowerCase();
                      if (!groups[nameKey]) groups[nameKey] = [];
                      groups[nameKey].push(l);
                  });

                  return (
                    <div key={monthYear} style={{marginBottom: '30px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '0 5px'}}>
                        <h3 style={{margin: 0, fontSize: '16px', color: 'var(--primary)'}}>{monthYear}</h3>
                        <span style={{fontSize: '14px', fontWeight: 'bold', color: '#ef4444'}}>₱{privacyMode ? '***' : data.total.toLocaleString()}</span>
                      </div>
                      
                      {Object.entries(groups).map(([nameKey, groupItems]) => {
                          if (groupItems.length === 1) {
                              return renderSingleCard(groupItems[0]);
                          } else {
                              const stackKey = `${monthYear}_${nameKey}`;
                              const isExpanded = expandedStacks[stackKey];
                              const totalStackAmt = groupItems.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
                              
                              return (
                                  <div key={stackKey} style={{marginBottom: '10px'}}>
                                      <div className="animated-card clickable" style={{...styles.card, marginBottom: isExpanded ? '5px' : '10px', zIndex: 2, position: 'relative'}} onClick={() => toggleStack(stackKey)}>
                                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                                  <div style={{width: '24px', height: '24px', borderRadius: '5px', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold'}}>{groupItems.length}x</div>
                                                  <div style={{textAlign: 'left'}}>
                                                      <div style={{fontWeight: 'bold', color: 'var(--text-main)'}}>{groupItems[0].productName}</div>
                                                      <div style={{fontSize: '11px', color: 'var(--text-muted)'}}>Tap to {isExpanded ? 'collapse' : 'expand'}</div>
                                                  </div>
                                              </div>
                                              <div style={{textAlign: 'right'}}>
                                                  <div style={{color: '#ef4444', fontWeight: 'bold', fontSize: '18px'}}>₱{privacyMode ? '***' : totalStackAmt}</div>
                                              </div>
                                          </div>
                                      </div>
                                      
                                      {!isExpanded && (
                                          <div style={{height: '8px', margin: '-18px 10px 10px 10px', backgroundColor: 'var(--bg-card-alt)', borderRadius: '0 0 10px 10px', border: '1px solid var(--border-color)', borderTop: 'none', zIndex: 1, position: 'relative', opacity: 0.7}}></div>
                                      )}

                                      {isExpanded && (
                                          <div className="fade-in" style={{paddingLeft: '15px', borderLeft: '2px solid var(--border-color-light)', marginLeft: '10px'}}>
                                              {groupItems.map(l => renderSingleCard(l, true))}
                                          </div>
                                      )}
                                  </div>
                              )
                          }
                      })}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {view === 'history' && (
            <div className="fade-in" style={{width: '100%'}}>
              <div className="no-print animated-card" style={{ border: '1px solid var(--primary)', padding: '15px', borderRadius: '12px', marginBottom: '25px', fontSize: '13px', color: 'var(--primary)', lineHeight: '1.5', display: 'flex', gap: '10px', alignItems: 'center' }}>
                <Icon name="archive" size={16} /> {t('storageReminder')}
              </div>

              {isAdmin && !selectedCustomer ? (
                <>
                  {isLoadingData ? (
                    <div className="skeleton" style={{height: '70px', marginBottom: '15px'}}></div>
                  ) : filteredHistorySummaries.length === 0 ? (
                    <EmptyState icon="history" title="No History Yet" desc="Paid balances will appear here." />
                  ) : (
                    filteredHistorySummaries.map(s => (
                      <div key={s.email} className="animated-card clickable" style={styles.card} onClick={() => safeNavigation(() => { setSelectedCustomer(s); })}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                             <div style={{width:'36px', height:'36px', borderRadius:'50%', background: getAvatarColor(s.email), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:'bold', fontSize:'12px', flexShrink:0}}>
                               {getInitials(s.name)}
                             </div>
                             <div style={{textAlign: 'left'}}><div style={{fontWeight: 'bold', fontSize: '18px', color: 'var(--text-main)'}}>{s.name}</div><div style={{fontSize: '12px', color: 'var(--text-muted)'}}>{s.items.length} records</div></div>
                          </div>
                          <div style={{color: '#10b981', fontWeight: 'bold', fontSize: '20px'}}>₱{privacyMode ? '***' : s.total.toLocaleString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              ) : (
                <div className="fade-in">
                  <div className="no-print" style={{display: 'grid', gridTemplateColumns: '60px 1fr 60px', alignItems: 'center', marginBottom: '25px'}}>
                    {isAdmin ? (
                       <div className="clickable" onClick={() => safeNavigation(() => { setSelectedCustomer(null); })} style={{width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-card-alt)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-main)'}}>
                          <Icon name="chevronLeft" size={20} />
                       </div>
                    ) : <div></div>}
                    <h2 style={{margin: 0, textAlign: 'center', color: 'var(--text-main)', fontSize: '20px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{isAdmin ? `${selectedCustomer?.name || 'User'}'s History` : t('history')}</h2>
                    <div></div>
                  </div>
                  
                  <h2 className="print-title" style={{display: 'none'}}>{isAdmin && selectedCustomer ? `${selectedCustomer?.name || 'User'}'s Receipt` : t('yourReceipt')}</h2>
                  
                  {(!isAdmin || selectedCustomer) && historyToDisplay.length > 0 && (
                    <div className="no-print" style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                      <button className="clickable" onClick={() => { triggerHaptic(20); setShowEReceiptModal(true); }} style={{flex: 1, padding: '12px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}><Icon name="image" size={16} color="#fff" /> View E-Receipt</button>
                      <button className="clickable" onClick={handlePrint} style={{flex: 1, padding: '12px', backgroundColor: 'var(--border-color-light)', border: 'none', borderRadius: '10px', color: 'var(--text-main)', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}><Icon name="download" size={16} /> PDF</button>
                    </div>
                  )}

                  { historyToDisplay.length === 0 ? (
                    <EmptyState icon="history" title="No History" desc={t('noCredits')} />
                  ) : (
                    groupLoansByMonth(historyToDisplay).map(([monthYear, data]) => (
                      <div key={monthYear} style={{marginBottom: '30px'}}>
                        <div className="print-title-month no-print" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px', marginBottom: '15px'}}>
                           <h3 style={{margin: 0, fontSize: '18px', color: 'var(--text-main)'}}>{monthYear}</h3>
                           <div style={{textAlign: 'right'}}>
                              <div style={{fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>{t('paid')}</div>
                              <div style={{fontSize: '16px', fontWeight: 'bold', color: '#10b981'}}>₱{privacyMode ? '***' : data.total.toLocaleString()}</div>
                           </div>
                        </div>

                        <div className="history-list">
                          {data.items.map(h => (
                            <div key={h.id} className="animated-card" style={{...styles.card, cursor: 'default', opacity: 0.85}}>
                              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                <div style={{textAlign: 'left'}}>
                                  <div style={{fontWeight: 'bold', color: 'var(--text-main)'}}>{h.productName}</div>
                                  <div style={{fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px'}}>
                                    {t('borrowed')} {safeFormatDate(h.date)} <br/>
                                    {t('paid')} {safeFormatDate(h.paidAt)}
                                    {h.proxyName && <span style={{display:'block', color:'var(--primary)', marginTop:'2px'}}>(via: {h.proxyName})</span>}
                                  </div>
                                </div>
                                <div style={{color: '#10b981', fontWeight: 'bold', fontSize: '18px'}}>₱{privacyMode ? '***' : h.amount}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'analytics' && isAdmin && (
            <div className="fade-in">
              <h2 className="print-title" style={{color: 'var(--primary)', marginBottom: '20px', textAlign: 'center'}}>Analytics & Inventory</h2>
              <div className="no-print" style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                <button className="clickable" onClick={handlePrint} style={{flex:1, padding: '12px', backgroundColor: 'var(--border-color-light)', border: 'none', borderRadius: '10px', color: 'var(--text-main)', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}><Icon name="download" size={16}/> Save PDF</button>
                <button className="clickable" onClick={exportCSV} style={{flex:1, padding: '12px', backgroundColor: '#10b981', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}><Icon name="download" size={16} color="#fff"/> Export CSV</button>
              </div>

              <h3 style={{color: 'var(--text-main)', fontSize: '16px', marginTop: '10px'}}>Activity Heatmap (14 Days)</h3>
              <div className="animated-card no-print" style={{...styles.card, padding:'15px'}}>
                 <div style={{display:'flex', gap:'4px', overflowX:'auto', scrollbarWidth:'none'}}>
                   {[...Array(14)].map((_, i) => {
                      const d = new Date(); d.setDate(d.getDate() - (13 - i));
                      const key = d.toISOString().split('T')[0];
                      const count = heatmapData[key] || 0;
                      const opacity = count === 0 ? 0.1 : 0.3 + (count/heatmapMax)*0.7;
                      return <div key={i} title={`${key}: ${count} activities`} style={{width:'24px', height:'24px', borderRadius:'4px', backgroundColor:'var(--primary)', opacity, flexShrink:0}}></div>
                   })}
                 </div>
              </div>
              
              <h3 style={{color: 'var(--text-main)', fontSize: '16px', marginTop: '20px'}}>Top Active Borrowers</h3>
              <div className="history-list">
                {getSummaries().length === 0 ? <p style={{color: 'var(--text-muted)', fontSize: '13px'}}>No data.</p> : getSummaries().sort((a,b)=>b.total - a.total).slice(0,3).map((s, idx, arr) => (
                    <div key={s.email} className="animated-card" style={{...styles.card, padding: '15px'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <div style={{fontWeight: 'bold', color: 'var(--text-main)'}}>#{idx+1} {s.name}</div>
                            <div style={{color: '#ef4444', fontWeight: 'bold'}}>₱{privacyMode ? '***' : s.total.toLocaleString()}</div>
                        </div>
                        <div className="chart-bar-bg no-print"><div className="chart-bar-fill" style={{width: `${(s.total / (arr[0].total || 1)) * 100}%`, backgroundColor: '#ef4444'}}></div></div>
                    </div>
                ))}
              </div>

              <h3 style={{color: 'var(--text-main)', fontSize: '16px', marginTop: '20px'}}>Fastest Selling Products (All Time)</h3>
              <div className="history-list">
                {getBestsellers().length === 0 ? <p style={{color: 'var(--text-muted)', fontSize: '13px'}}>No data.</p> : getBestsellers().map(([prodName, count], idx, arr) => (
                    <div key={prodName} className="animated-card" style={{...styles.card, padding: '15px'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <div style={{fontWeight: 'bold', color: 'var(--text-main)'}}>#{idx+1} {prodName}</div>
                            <div style={{color: '#10b981', fontWeight: 'bold'}}>{count} sold</div>
                        </div>
                        <div className="chart-bar-bg no-print"><div className="chart-bar-fill" style={{width: `${(count / (arr[0][1] || 1)) * 100}%`, backgroundColor: '#10b981'}}></div></div>
                    </div>
                ))}
              </div>

              <h3 className="no-print" style={{color: 'var(--text-main)', fontSize: '16px', marginTop: '20px'}}>Inventory Tracker</h3>
              <div className="no-print animated-card" style={{...styles.card, backgroundColor: 'var(--bg-card-alt)'}}>
                  <form onSubmit={addStock} style={{display: 'flex', gap: '10px', marginBottom: '20px'}}>
                      <input list="product-suggestions" placeholder="Product" value={invProduct} onChange={e=>setInvProduct(e.target.value)} style={{...styles.modalInput, marginBottom: 0, height: '45px'}} required />
                      <input type="number" placeholder="Qty" value={invStock} onChange={e=>setInvStock(e.target.value)} style={{...styles.modalInput, marginBottom: 0, width: '80px', height: '45px'}} required />
                      <button type="submit" className="clickable" style={{padding: '0 15px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold'}}>+</button>
                  </form>
                  {inventory.length === 0 ? <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center'}}>No inventory tracked yet.</p> : inventory.map(i => (
                      <div key={i.id} style={{display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)'}}>
                          <div style={{color: (i?.stock || 0) <= 5 ? '#ef4444' : 'var(--text-main)', fontWeight: 'bold'}}>{i.productName}</div>
                          <div style={{color: (i?.stock || 0) <= 5 ? '#ef4444' : 'var(--text-muted)', fontWeight: 'bold'}}>{i.stock} left</div>
                      </div>
                  ))}
              </div>
            </div>
          )}

          {view === 'archive' && isAdmin && (
            <div className="fade-in">
              <h2 className="print-title" style={{color: 'var(--primary)', marginBottom: '20px', textAlign: 'center'}}>System Archive (> 7 Days)</h2>
              <button className="clickable no-print" onClick={handlePrint} style={{width: '100%', padding: '12px', backgroundColor: 'var(--border-color-light)', border: 'none', borderRadius: '10px', color: 'var(--text-main)', fontWeight: 'bold', marginBottom: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}><Icon name="download" size={16}/> Save Report</button>

              {archive.length === 0 ? <EmptyState icon="box" title="Empty Archive" desc="Old records will be saved here." /> : (
                <div className="history-list">
                  {archive.filter(a => (a?.customerName || '').toLowerCase().includes(searchQuery.toLowerCase())).map(a => (
                    <div key={a.id} className="animated-card" style={{...styles.card, cursor: 'default', opacity: 0.85}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <div style={{textAlign: 'left'}}>
                                <div style={{fontWeight: 'bold', color: 'var(--text-main)'}}>{a.productName}</div>
                                <div style={{fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px'}}>
                                    User: {a.customerName} <br/>
                                    Paid: {safeFormatDate(a.paidAt)}
                                </div>
                            </div>
                            <div style={{color: '#10b981', fontWeight: 'bold', fontSize: '18px'}}>₱{privacyMode ? '***' : a.amount}</div>
                        </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'logs' && isAdmin && (
            <div className="fade-in no-print">
              <h2 style={{color: 'var(--primary)', marginBottom: '20px', textAlign: 'center'}}>Activity Logs (Audit)</h2>
              
              {activityLogs.length > 0 && (
                <button className="clickable" onClick={handleClearAllLogs} style={{width: '100%', padding: '12px', backgroundColor: 'transparent', border: '1px solid #ef4444', borderRadius: '10px', color: '#ef4444', fontWeight: 'bold', marginBottom: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'}}><Icon name="trash" size={16}/> Clear All Logs</button>
              )}

              <div className="animated-card" style={{...styles.card, backgroundColor: 'var(--bg-card)'}}>
                  {activityLogs.length === 0 ? <EmptyState icon="logs" title="No Activity" desc="Logs will appear when you perform actions." /> : activityLogs.map(log => (
                      <div key={log.id} style={{padding: '12px 0', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <div>
                            <div style={{color: 'var(--text-main)', fontSize: '14px', marginBottom: '4px'}}>{log.action}</div>
                            <div style={{color: 'var(--text-muted-dark)', fontSize: '11px'}}>{safeFormatTime(log.timestamp)}</div>
                          </div>
                          <div className="clickable" onClick={() => deleteSpecificLog(log.id)} style={{padding: '10px', color: '#ef4444'}} title="Delete Log">
                            <Icon name="trash" size={18} color="#ef4444" />
                          </div>
                      </div>
                  ))}
              </div>
            </div>
          )}

          {view === 'users' && isAdmin && (
            <div className="fade-in" style={{textAlign: 'center'}}>
              {filteredUsers.length === 0 ? (
                <EmptyState icon="users" title="No Users" desc="Registered customers will appear here." />
              ) : (
                filteredUsers.map(u => (
                  <div key={u.email} className="animated-card" style={{...styles.card, marginBottom: '15px', textAlign: 'left', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap:'15px'}}>
                        <div style={{width:'36px', height:'36px', borderRadius:'50%', background: getAvatarColor(u.email), display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:'bold', fontSize:'12px', flexShrink:0}}>
                          {getInitials(u.name)}
                        </div>
                        <div style={{display:'flex', flexDirection:'column'}}>
                          <span style={{fontWeight: 'bold', fontSize: '18px', color: 'var(--text-main)'}}>{u.name}</span>
                          <span style={{color: 'var(--primary)', fontSize: '13px'}}>{u.email}</span>
                          <span style={{color: 'var(--text-muted)', fontSize: '12px'}}>{u.phone || 'No phone'}</span>
                        </div>
                    </div>
                    <div className="clickable" onClick={(e) => { e.stopPropagation(); deleteCustomerAccount(u.email, u.name); }} style={{ padding: '10px', color: '#ef4444', display: 'flex' }} title="Delete User">
                      <Icon name="trash" size={22} color="#ef4444" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
}

export default App;