import { useState, useEffect } from 'react';
import { auth, db, messaging } from './firebase'; 
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, where, orderBy, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';

const ADMIN_EMAILS = ["daviduson11@gmail.com"]; 

const APP_VERSION = "v1.14.0";
const RELEASE_NOTES = [
  "Fixed the flashing bug where 'Complete Your Profile' briefly appears and disappears.",
  "Optimized Firebase data fetching to prevent local cache race conditions."
];

const GlobalStyle = () => (
  <style>{`
    html, body { margin: 0 !important; padding: 0 !important; background-color: #000 !important; overflow-x: hidden !important; }
    #root { margin: 0 !important; padding: 0 !important; width: 100% !important; min-height: 100vh !important; display: flex !important; justify-content: center !important; }
    * { box-sizing: border-box !important; font-family: "Inter", sans-serif; -webkit-tap-highlight-color: transparent; }
    
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .fade-in { animation: fadeIn 0.4s ease-out forwards; }
    
    button { transition: transform 0.15s ease, filter 0.15s ease !important; cursor: pointer; }
    button:active { transform: scale(0.92) !important; filter: brightness(0.8) !important; }
    
    .animated-card { transition: transform 0.15s ease, background-color 0.2s ease !important; }
    .animated-card:active { transform: scale(0.96) !important; background-color: #1a1a1a !important; }
    
    .fab-btn { position: fixed; bottom: 30px; width: 60px; height: 60px; border-radius: 50%; background-color: #1d4ed8; color: #fff; font-size: 30px; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 25px rgba(29,78,216,0.5); left: 50%; margin-left: 160px; }
    @media (max-width: 500px) { .fab-btn { left: auto; right: 20px; margin-left: 0; } }
    
    input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; }
    
    .tc-scroll::-webkit-scrollbar { width: 6px; }
    .tc-scroll::-webkit-scrollbar-track { background: #111; border-radius: 10px; }
    .tc-scroll::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 10px; }
  `}</style>
);

function App() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null); 
  const [isCheckingDB, setIsCheckingDB] = useState(true);

  const [view, setView] = useState('dashboard'); 
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [isNotifOpen, setIsNotifOpen] = useState(false); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const [customer, setCustomer] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [product, setProduct] = useState('');
  const [amount, setAmount] = useState('');
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0]);

  const [searchQuery, setSearchQuery] = useState('');

  const [loans, setLoans] = useState([]);
  const [history, setHistory] = useState([]); 
  const [registeredUsers, setRegisteredUsers] = useState([]);

  useEffect(() => {
    if (user && dbUser?.isProfileComplete) {
      const storedVersion = localStorage.getItem("app_version");
      if (storedVersion !== APP_VERSION) {
        setShowUpdateModal(true);
      }
    }
  }, [user, dbUser]);

  const closeUpdateModal = () => {
    localStorage.setItem("app_version", APP_VERSION);
    setShowUpdateModal(false);
  };

  // 1. AUTH LOGIC (Tinanggal ang nagko-cause ng race condition)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setIsCheckingDB(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. DATABASE FETCHER (Dito na natin nilagay ang initial user creation para malinis)
  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(doc(db, "users", user.email), async (d) => {
        if (d.exists()) {
          setDbUser(d.data());
          setIsCheckingDB(false);
        } else {
          // Unang beses mag-login, gagawa ng record sa DB
          try {
            await setDoc(doc(db, "users", user.email), { 
              email: user.email, 
              name: user.displayName || '', 
              isProfileComplete: false,
              tcAccepted: false
            });
          } catch(e) { console.error("Error creating user:", e); }
        }
      });
      return () => unsub();
    }
  }, [user]);

  // 3. PRE-FILL PROFILE SETUP (Gagana lang kapag empty pa yung text boxes)
  useEffect(() => {
    if (user && dbUser && !dbUser.isProfileComplete) {
      if (!firstName && !lastName) {
        const defaultName = dbUser.name || user.displayName || '';
        const parts = defaultName.trim().split(' ');
        if (parts.length > 1) {
          setFirstName(parts[0]);
          setLastName(parts.slice(1).join(' '));
        } else {
          setFirstName(parts[0]);
        }
      }
    }
  }, [user, dbUser, firstName, lastName]);

  // 4. FETCH LOANS AND HISTORY (Kapag tapos na ang lahat ng setup)
  useEffect(() => {
    if (user && dbUser && dbUser.isProfileComplete && (ADMIN_EMAILS.includes(user.email) || dbUser.tcAccepted)) {
      const isAdmin = ADMIN_EMAILS.includes(user.email);
      const loansRef = collection(db, "loans");
      const historyRef = collection(db, "credit_history");
      
      const qLoans = isAdmin 
        ? query(loansRef, orderBy("date", "desc")) 
        : query(loansRef, where("customerEmail", "==", user.email));
        
      const qHistory = isAdmin
        ? query(historyRef, orderBy("paidAt", "desc"))
        : query(historyRef, where("customerEmail", "==", user.email));

      const unsubLoans = onSnapshot(qLoans, (s) => setLoans(s.docs.map(d => ({ ...d.data(), id: d.id }))));
      
      const unsubHistory = onSnapshot(qHistory, (s) => {
        const now = new Date().getTime();
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
        const historyData = [];

        s.docs.forEach(d => {
          const data = d.data();
          const paidTime = data.paidAt?.seconds * 1000;
          if (paidTime && (now - paidTime > SEVEN_DAYS_MS)) {
            deleteDoc(doc(db, "credit_history", d.id)).catch(e => console.error(e));
          } else {
            historyData.push({ ...data, id: d.id });
          }
        });

        if (!isAdmin) {
          historyData.sort((a, b) => (b.paidAt?.seconds || 0) - (a.paidAt?.seconds || 0));
        }
        setHistory(historyData);
      });

      if (isAdmin) {
        const unsubUsers = onSnapshot(collection(db, "users"), (s) => setRegisteredUsers(s.docs.map(d => d.data())));
        return () => { unsubLoans(); unsubHistory(); unsubUsers(); };
      }
      return () => { unsubLoans(); unsubHistory(); };
    }
  }, [user, dbUser]);

  const requestPermission = async () => {
    try {
      if (!('Notification' in window)) return;
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const token = await getToken(messaging, { 
          vapidKey: 'BHqn4TWWqdAMifM_tTgehpWzQP98wr_flvlpRCuODm1SIHYjyCs5Z_gGlhaGHisyFwmJC9ABcXFbgI6J6cx1Ijk' 
        });
        if (token && user && !ADMIN_EMAILS.includes(user.email)) {
          await updateDoc(doc(db, "users", user.email), { fcmToken: token });
        }
      }
    } catch (err) { console.error("FCM Error:", err); }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (firstName.trim() && lastName.trim() && user) {
      await updateDoc(doc(db, "users", user.email), { 
        name: `${firstName.trim()} ${lastName.trim()}`,
        isProfileComplete: true 
      });
    }
  };

  const handleAcceptTC = async () => {
    if (user) {
      await updateDoc(doc(db, "users", user.email), { tcAccepted: true });
      requestPermission(); 
    }
  };

  const handleDeclineTC = () => {
    signOut(auth);
  };

  const sendPaymentReminder = async (email) => {
    const userLoans = loans.filter(l => l.customerEmail === email);
    if (userLoans.length > 0) {
      await updateDoc(doc(db, "loans", userLoans[0].id), { isNew: true });
      alert("Payment reminder triggered! A red dot will appear on their notification icon.");
    }
  };

  const getSummaries = () => {
    const s = {};
    loans.forEach(l => {
      if (!s[l.customerEmail]) s[l.customerEmail] = { name: l.customerName, email: l.customerEmail, total: 0, items: [], hasNew: false };
      s[l.customerEmail].total += l.amount;
      s[l.customerEmail].items.push(l);
      if (l.isNew) s[l.customerEmail].hasNew = true;
    });
    return Object.values(s);
  };

  const getHistorySummaries = () => {
    const s = {};
    history.forEach(h => {
      if (!s[h.customerEmail]) s[h.customerEmail] = { name: h.customerName, email: h.customerEmail, total: 0, items: [] };
      s[h.customerEmail].total += h.amount;
      s[h.customerEmail].items.push(h);
    });
    return Object.values(s);
  };

  const addLoan = async (e) => {
    e.preventDefault();
    const finalName = selectedCustomer ? selectedCustomer.name : customer;
    const finalEmail = selectedCustomer ? selectedCustomer.email : customerEmail;
    const finalDate = new Date(loanDate + "T12:00:00");

    if (finalName && amount && product && finalEmail) {
      await addDoc(collection(db, "loans"), {
        customerName: finalName,
        customerEmail: finalEmail.toLowerCase().trim(),
        productName: product,
        amount: parseFloat(amount),
        date: finalDate,
        status: "Unpaid",
        isNew: true 
      });
      setCustomer(''); setCustomerEmail(''); setProduct(''); setAmount(''); setLoanDate(new Date().toISOString().split('T')[0]);
      setIsModalOpen(false);
    }
  };

  const markAsPaid = async (loanObj) => {
    if(window.confirm("Confirm payment? This will be moved to Credit History.")) {
      try {
        await addDoc(collection(db, "credit_history"), {
          customerName: loanObj.customerName,
          customerEmail: loanObj.customerEmail,
          productName: loanObj.productName,
          amount: loanObj.amount,
          date: loanObj.date, 
          paidAt: new Date()  
        });
        await deleteDoc(doc(db, "loans", loanObj.id)); 
      } catch (e) {
        console.error("Error marking as paid:", e);
      }
    }
  };

  const isAdmin = user && ADMIN_EMAILS.includes(user.email);
  const newNotificationsCount = loans.filter(l => l.isNew && !isAdmin).length;

  const currentCustomerLoans = isAdmin && selectedCustomer 
    ? loans.filter(l => l.customerEmail === selectedCustomer.email) 
    : (!isAdmin ? loans : []);
  const currentTotal = currentCustomerLoans.reduce((acc, curr) => acc + curr.amount, 0);

  const groupLoansByMonth = (loansToGroup) => {
    const grouped = {};
    loansToGroup.forEach(l => {
      const dateObj = l.date?.seconds ? new Date(l.date.seconds * 1000) : new Date();
      const monthYear = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!grouped[monthYear]) grouped[monthYear] = { total: 0, items: [] };
      grouped[monthYear].items.push(l);
      grouped[monthYear].total += l.amount;
    });
    return Object.entries(grouped);
  };

  const closeNotifSidebar = () => {
    setIsNotifOpen(false);
    if (newNotificationsCount > 0) {
      const newUpdates = loans.filter(l => l.isNew && !isAdmin);
      newUpdates.forEach(async (loan) => {
        try {
          await updateDoc(doc(db, "loans", loan.id), { isNew: false });
        } catch(e) { console.error("Failed to update status", e); }
      });
    }
  };

  const filteredSummaries = getSummaries().filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredHistorySummaries = getHistorySummaries().filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredUsers = registeredUsers.filter(u => 
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const styles = {
    wrapper: { width: '100%', maxWidth: '480px', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' },
    nav: { position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', height: '65px', backgroundColor: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', zIndex: 1000, borderBottom: '1px solid #222' },
    main: { width: '100%', padding: '90px 20px 120px 20px', display: 'flex', flexDirection: 'column' },
    card: { backgroundColor: '#111', padding: '20px', borderRadius: '18px', marginBottom: '15px', border: '1px solid #222', cursor: 'pointer', position: 'relative' },
    balance: { textAlign: 'center', padding: '35px 20px', borderRadius: '25px', backgroundColor: '#161616', marginBottom: '30px', border: '1px solid #222', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    sidebar: { position: 'fixed', top: 0, left: isSidebarOpen ? '0' : '-280px', width: '280px', height: '100vh', backgroundColor: '#0a0a0a', zIndex: 3000, padding: '40px 20px', transition: '0.3s ease', borderRight: '1px solid #222' },
    notifSidebar: { position: 'fixed', top: 0, right: isNotifOpen ? '0' : '-300px', width: '280px', height: '100vh', backgroundColor: '#0a0a0a', zIndex: 3500, padding: '40px 20px', transition: '0.3s ease', borderLeft: '1px solid #222', boxSizing: 'border-box' },
    badge: { backgroundColor: '#ef4444', color: '#fff', borderRadius: '50%', width: '10px', height: '10px', position: 'absolute', top: '0px', right: '-2px', border: '2px solid rgba(10,10,10,0.95)' },
    btnNotify: { padding: '8px 15px', backgroundColor: '#1d4ed8', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: 'bold', marginTop: '10px' }
  };

  // --- RENDER GUARDS ---

  if (!user) return (
    <>
      <GlobalStyle />
      <div className="fade-in" style={{...styles.wrapper, justifyContent: 'center', alignItems: 'center'}}>
        <div style={{textAlign: 'center', padding: '20px'}}>
          <h1 style={{fontSize: 'clamp(32px, 10vw, 42px)', marginBottom: '10px', fontWeight: '800'}}>Uson CreditHub</h1>
          <p style={{color: '#666', marginBottom: '40px', fontSize: '18px'}}>Secure Sari-Sari Ledger System</p>
          <button onClick={() => signInWithPopup(auth, new GoogleAuthProvider())} style={{padding: '18px 45px', backgroundColor: '#1d4ed8', border: 'none', borderRadius: '15px', color: '#fff', fontWeight: 'bold'}}>Login with Google</button>
        </div>
      </div>
    </>
  );

  if (isCheckingDB || !dbUser) return (
    <>
      <GlobalStyle />
      <div className="fade-in" style={{...styles.wrapper, justifyContent: 'center', alignItems: 'center'}}>
        <p style={{color: '#666'}}>Securing your account...</p>
      </div>
    </>
  );

  if (!dbUser.isProfileComplete) return (
    <>
      <GlobalStyle />
      <div className="fade-in" style={{...styles.wrapper, justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
        <div style={{backgroundColor: '#111', padding: '30px 25px', borderRadius: '22px', width: '100%', maxWidth: '400px', border: '1px solid #3b82f6'}}>
          <h2 style={{color: '#3b82f6', margin: '0 0 10px 0', textAlign: 'center'}}>Complete Your Profile</h2>
          <p style={{color: '#aaa', fontSize: '13px', textAlign: 'center', marginBottom: '25px'}}>Please enter your real name so the Admin can easily identify your account.</p>
          
          <form onSubmit={handleSaveProfile} style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <input placeholder="First Name" value={firstName} onChange={e=>setFirstName(e.target.value)} required style={{padding: '14px', borderRadius: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #333', outline: 'none'}} />
            <input placeholder="Surname / Last Name" value={lastName} onChange={e=>setLastName(e.target.value)} required style={{padding: '14px', borderRadius: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #333', outline: 'none'}} />
            <button type="submit" style={{padding: '16px', backgroundColor: '#1d4ed8', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold', marginTop: '10px'}}>Save Profile</button>
          </form>
        </div>
      </div>
    </>
  );

  if (!isAdmin && !dbUser.tcAccepted) return (
    <>
      <GlobalStyle />
      <div className="fade-in" style={{...styles.wrapper, justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
        <div style={{backgroundColor: '#111', padding: '30px 25px', borderRadius: '22px', width: '100%', border: '1px solid #3b82f6', display: 'flex', flexDirection: 'column'}}>
          <h2 style={{color: '#3b82f6', margin: '0 0 15px 0', fontSize: '22px', textAlign: 'center'}}>Terms & Conditions</h2>
          <p style={{color: '#ccc', fontSize: '13px', textAlign: 'center', marginBottom: '20px'}}>Please read carefully before proceeding.</p>
          
          <div className="tc-scroll" style={{overflowY: 'auto', paddingRight: '10px', color: '#aaa', fontSize: '13px', lineHeight: '1.6', maxHeight: '45vh'}}>
            <p>Welcome to <strong>Uson CreditHub</strong>. By logging in with your Google account, you agree to the following conditions:</p>
            <h4 style={{color: '#fff', marginBottom: '5px'}}>1. Google Account Usage</h4>
            <p style={{marginTop: 0}}>Your Google Account (Gmail) is solely used for secure identification. This ensures that only you and the Administrator can view your personal credit records.</p>
            <h4 style={{color: '#fff', marginBottom: '5px'}}>2. Push Notifications & Reminders</h4>
            <p style={{marginTop: 0}}>To provide you with the best experience, Uson CreditHub requires <strong>Notification Permissions</strong>. This allows the system to send you real-time updates and friendly reminders regarding your current debts and past-due balances.</p>
            <h4 style={{color: '#fff', marginBottom: '5px'}}>3. Data Tracking & Privacy</h4>
            <p style={{marginTop: 0}}>The Administrator tracks your borrowed items, amounts, and dates. Once a debt is paid, it will be moved to your Credit History and automatically deleted from the server after 7 days to save storage.</p>
            <p style={{marginTop: '20px', fontStyle: 'italic', color: '#888'}}>By clicking "I Understand & Accept", your browser may prompt you to allow notifications. Please click "Allow" to stay updated.</p>
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px'}}>
            <button onClick={handleAcceptTC} style={{width: '100%', padding: '16px', backgroundColor: '#3b82f6', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold'}}>I Understand & Accept</button>
            <button onClick={handleDeclineTC} style={{width: '100%', padding: '16px', backgroundColor: 'transparent', border: '1px solid #ef4444', borderRadius: '12px', color: '#ef4444', fontWeight: 'bold'}}>Decline & Logout</button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <GlobalStyle />
      <div style={styles.wrapper}>
        <nav style={styles.nav}>
          <div onClick={() => setIsSidebarOpen(true)} style={{fontSize: '24px', cursor: 'pointer', transition: 'transform 0.2s ease'}} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.8)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
            ☰
          </div>
          <div style={{fontWeight: 'bold', fontSize: '18px', color: '#3b82f6'}}>Uson CreditHub</div>
          
          {!isAdmin ? (
            <div onClick={() => setIsNotifOpen(true)} style={{fontSize: '22px', cursor: 'pointer', position: 'relative', width: '24px', textAlign: 'center', transition: 'transform 0.2s ease'}} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.8)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
              🔔 {newNotificationsCount > 0 && <div style={styles.badge}></div>}
            </div>
          ) : (
            <div style={{width: '24px'}}></div>
          )}
        </nav>

        {isAdmin && <button className="fab-btn fade-in" onClick={() => setIsModalOpen(true)}>+</button>}

        <div style={styles.sidebar}>
          <div style={{marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid #222'}}>
            <p style={{color: '#888', fontSize: '11px', margin: '0 0 5px 0', textTransform: 'uppercase', letterSpacing: '1px'}}>Welcome back,</p>
            <h2 style={{color: '#fff', margin: 0, fontSize: '22px'}}>Hello, {dbUser.name ? dbUser.name.split(' ')[0] : 'User'}! ✨</h2>
          </div>

          <div style={{padding: '15px 0', color: view === 'dashboard' ? '#3b82f6' : '#888', cursor: 'pointer', fontWeight: view === 'dashboard' ? 'bold' : 'normal'}} onClick={() => {setView('dashboard'); setSelectedCustomer(null); setIsSidebarOpen(false); setSearchQuery('');}}>🏠 Dashboard</div>
          <div style={{padding: '15px 0', color: view === 'history' ? '#3b82f6' : '#888', cursor: 'pointer', fontWeight: view === 'history' ? 'bold' : 'normal'}} onClick={() => {setView('history'); setSelectedCustomer(null); setIsSidebarOpen(false); setSearchQuery('');}}>🕒 Credit History</div>
          {isAdmin && <div style={{padding: '15px 0', color: view === 'users' ? '#3b82f6' : '#888', cursor: 'pointer', fontWeight: view === 'users' ? 'bold' : 'normal'}} onClick={() => {setView('users'); setIsSidebarOpen(false); setSearchQuery('');}}>👥 Customers</div>}
          
          <button onClick={() => signOut(auth)} style={{marginTop: 'auto', padding: '12px', width: '100%', borderRadius: '10px', border: '1px solid #ef4444', color: '#ef4444', background: 'none'}}>Logout</button>
        </div>
        {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 2500, backgroundColor: 'rgba(0,0,0,0.5)'}}></div>}

        <div style={styles.notifSidebar}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px'}}>
            <h2 style={{margin: 0, fontSize: '20px'}}>Notifications</h2>
            <span onClick={closeNotifSidebar} style={{cursor: 'pointer', fontSize: '24px', color: '#666'}}>✕</span>
          </div>
          
          {newNotificationsCount > 0 ? (
            <div className="animated-card fade-in" style={{...styles.card, borderLeft: '4px solid #ef4444', padding: '15px'}}>
              <h4 style={{margin: '0 0 8px 0', color: '#ef4444'}}>Payment Reminder</h4>
              <p style={{margin: 0, fontSize: '13px', color: '#ccc', lineHeight: '1.5'}}>
                You have a credit that needs to be paid as it is past the due date.
              </p>
            </div>
          ) : (
            <div style={{textAlign: 'center', marginTop: '50px'}}>
              <p style={{color: '#666', fontSize: '14px', lineHeight: '1.5'}}>
                You have no notifications for due credits at the moment.
              </p>
            </div>
          )}
        </div>
        {isNotifOpen && <div onClick={closeNotifSidebar} style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 3400, backgroundColor: 'rgba(0,0,0,0.5)'}}></div>}

        <div className="fade-in" style={styles.main}>
          
          {isAdmin && !selectedCustomer && (
            <div style={{ marginBottom: '25px' }}>
              <input
                type="text"
                placeholder="🔍 Search name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '14px 20px', borderRadius: '12px', backgroundColor: '#111', color: '#fff', border: '1px solid #333', outline: 'none', fontSize: '14px' }}
              />
            </div>
          )}

          {isAdmin && !selectedCustomer && view === 'dashboard' && (
            <div style={{textAlign: 'center'}}>
              <h2 style={{marginBottom: '25px', display: 'none'}}>Summaries</h2> 
              
              {filteredSummaries.length === 0 ? (
                <div style={{marginTop: '40px', color: '#666'}}>
                  <p style={{fontSize: '16px'}}>{searchQuery ? "No matching records found." : "No active credit records at the moment."}</p>
                  {!searchQuery && <p style={{fontSize: '13px', opacity: 0.7}}>Click the + button below to add an entry.</p>}
                </div>
              ) : (
                filteredSummaries.map(s => (
                  <div key={s.email} className="animated-card" style={styles.card} onClick={() => setSelectedCustomer(s)}>
                    {s.hasNew && <div style={{...styles.badge, right: '15px', top: '15px', border: 'none'}}></div>}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div style={{textAlign: 'left'}}><div style={{fontWeight: 'bold', fontSize: '18px'}}>{s.name}</div><div style={{fontSize: '12px', color: '#666'}}>{s.items.length} records</div></div>
                      <div style={{color: '#ef4444', fontWeight: 'bold', fontSize: '20px'}}>₱{s.total.toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {(selectedCustomer || !isAdmin) && view === 'dashboard' && (
            <div className="fade-in">
              <div style={{display: 'flex', alignItems: 'center', marginBottom: '25px', justifyContent: 'center', position: 'relative'}}>
                {isAdmin && <button onClick={() => setSelectedCustomer(null)} style={{background: 'none', border: 'none', color: '#3b82f6', fontWeight: 'bold', position: 'absolute', left: 0}}>← Back</button>}
                <h2 style={{margin: 0, textAlign: 'center'}}>{isAdmin ? selectedCustomer.name : 'Your Credit'}</h2>
              </div>
              <div style={styles.balance}>
                <p style={{margin: 0, color: '#666', fontSize: '11px', textTransform: 'uppercase'}}>Current Balance</p>
                <h1 style={{margin: '10px 0', fontSize: '56px', color: '#ef4444'}}>₱{currentTotal.toLocaleString()}</h1>
                {isAdmin && <button onClick={() => sendPaymentReminder(selectedCustomer.email)} style={styles.btnNotify}>Notify to Pay 📢</button>}
              </div>

              {currentCustomerLoans.length === 0 ? (
                <div style={{textAlign: 'center', marginTop: '40px', color: '#666'}}>
                  <p style={{fontSize: '16px'}}>No one has borrowed yet as of now.</p>
                </div>
              ) : (
                groupLoansByMonth(currentCustomerLoans).map(([monthYear, data]) => (
                  <div key={monthYear} style={{marginBottom: '30px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', padding: '0 5px'}}>
                      <h3 style={{margin: 0, fontSize: '16px', color: '#3b82f6'}}>{monthYear}</h3>
                      <span style={{fontSize: '14px', fontWeight: 'bold', color: '#ef4444'}}>₱{data.total.toLocaleString()}</span>
                    </div>
                    
                    {data.items.map(l => (
                      <div key={l.id} className="animated-card" style={{...styles.card, cursor: 'default', marginBottom: '10px'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <div style={{textAlign: 'left'}}>
                            <div style={{fontWeight: 'bold'}}>{l.productName}</div>
                            <div style={{fontSize: '11px', color: '#666'}}>{new Date(l.date?.seconds * 1000).toLocaleDateString()}</div>
                          </div>
                          <div style={{textAlign: 'right'}}>
                            <div style={{color: '#ef4444', fontWeight: 'bold', fontSize: '18px'}}>₱{l.amount}</div>
                            {isAdmin && <button onClick={() => markAsPaid(l)} style={{color: '#3b82f6', background: 'none', border: 'none', fontSize: '11px'}}>Mark Paid</button>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}

          {view === 'history' && (
            <div className="fade-in" style={{width: '100%'}}>
              <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', padding: '15px', borderRadius: '12px', marginBottom: '25px', fontSize: '13px', color: '#93c5fd', lineHeight: '1.5' }}>
                ℹ️ <strong>Storage Reminder:</strong> To save database storage, paid credits are automatically deleted after <strong>7 days</strong>. Please take a screenshot if you need to keep a personal record.
              </div>

              {isAdmin && !selectedCustomer ? (
                <>
                  {filteredHistorySummaries.length === 0 ? (
                    <p style={{textAlign: 'center', color: '#666'}}>{searchQuery ? "No matching history found." : "No recent paid credits."}</p>
                  ) : (
                    filteredHistorySummaries.map(s => (
                      <div key={s.email} className="animated-card" style={styles.card} onClick={() => setSelectedCustomer(s)}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <div style={{textAlign: 'left'}}><div style={{fontWeight: 'bold', fontSize: '18px'}}>{s.name}</div><div style={{fontSize: '12px', color: '#666'}}>{s.items.length} records</div></div>
                          <div style={{color: '#10b981', fontWeight: 'bold', fontSize: '20px'}}>₱{s.total.toLocaleString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </>
              ) : (
                <div className="fade-in">
                  <div style={{display: 'flex', alignItems: 'center', marginBottom: '25px', justifyContent: 'center', position: 'relative'}}>
                    {isAdmin && <button onClick={() => setSelectedCustomer(null)} style={{background: 'none', border: 'none', color: '#3b82f6', fontWeight: 'bold', position: 'absolute', left: 0}}>← Back</button>}
                    <h2 style={{margin: 0, textAlign: 'center'}}>{isAdmin ? `${selectedCustomer.name}'s History` : 'Your Credit History'}</h2>
                  </div>
                  
                  { (isAdmin ? history.filter(h => h.customerEmail === selectedCustomer.email) : history).length === 0 ? (
                    <p style={{textAlign: 'center', color: '#666'}}>No recent paid credits.</p>
                  ) : (
                    (isAdmin ? history.filter(h => h.customerEmail === selectedCustomer.email) : history).map(h => (
                      <div key={h.id} className="animated-card" style={{...styles.card, cursor: 'default', opacity: 0.85}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                          <div style={{textAlign: 'left'}}>
                            <div style={{fontWeight: 'bold', color: '#ccc'}}>{h.productName}</div>
                            <div style={{fontSize: '11px', color: '#777', marginTop: '4px'}}>
                              Borrowed: {new Date(h.date?.seconds * 1000).toLocaleDateString()} <br/>
                              Paid: {new Date(h.paidAt?.seconds * 1000).toLocaleDateString()}
                            </div>
                          </div>
                          <div style={{color: '#10b981', fontWeight: 'bold', fontSize: '18px'}}>₱{h.amount}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'users' && isAdmin && (
            <div className="fade-in" style={{textAlign: 'center'}}>
              {filteredUsers.length === 0 ? (
                <p style={{color: '#666'}}>{searchQuery ? "No matching users found." : "No registered users yet."}</p>
              ) : (
                filteredUsers.map(u => (
                  <div key={u.email} className="animated-card" style={{...styles.card, textAlign: 'left', padding: '15px 20px'}} onClick={() => {setCustomerEmail(u.email); setCustomer(u.name); setView('dashboard');}}>
                    <div style={{display: 'flex', flexDirection: 'column'}}>
                      <span style={{fontWeight: 'bold', fontSize: '18px'}}>{u.name}</span>
                      <span style={{color: '#3b82f6', fontSize: '13px'}}>{u.email}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {isModalOpen && (
          <div className="fade-in" style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 4000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
            <div style={{backgroundColor: '#111', padding: '30px', borderRadius: '22px', width: '100%', maxWidth: '400px', border: '1px solid #333'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
                <h3 style={{margin: 0}}>Add Entry {selectedCustomer && <span style={{color: '#3b82f6', fontSize: '14px', display: 'block'}}>{selectedCustomer.name}</span>}</h3>
                <span onClick={() => setIsModalOpen(false)} style={{cursor: 'pointer', fontSize: '20px', color: '#666'}}>✕</span>
              </div>
              <form onSubmit={addLoan}>
                {!selectedCustomer && (
                  <>
                    <input placeholder="Name" value={customer} onChange={e => setCustomer(e.target.value)} style={{width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #333', boxSizing: 'border-box', outline: 'none'}} required />
                    <input placeholder="Gmail" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} style={{width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #333', boxSizing: 'border-box', outline: 'none'}} required />
                  </>
                )}
                
                <input placeholder="Product" value={product} onChange={e => setProduct(e.target.value)} style={{width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #333', boxSizing: 'border-box', outline: 'none'}} required />
                <input type="number" placeholder="₱ Amount" value={amount} onChange={e => setAmount(e.target.value)} style={{width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #333', boxSizing: 'border-box', outline: 'none'}} required />
                <input type="date" value={loanDate} onChange={e => setLoanDate(e.target.value)} style={{width: '100%', padding: '14px', marginBottom: '25px', borderRadius: '10px', backgroundColor: '#000', color: '#fff', border: '1px solid #333', boxSizing: 'border-box', colorScheme: 'dark', outline: 'none'}} required />
                <button type="submit" style={{width: '100%', padding: '16px', backgroundColor: '#1d4ed8', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold'}}>Save</button>
              </form>
            </div>
          </div>
        )}

        {showUpdateModal && (
          <div className="fade-in" style={{position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 5000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'}}>
            <div style={{backgroundColor: '#161616', padding: '30px', borderRadius: '22px', width: '100%', maxWidth: '400px', border: '1px solid #3b82f6', boxShadow: '0 10px 30px rgba(59, 130, 246, 0.2)'}}>
              <h2 style={{color: '#3b82f6', margin: '0 0 15px 0'}}>🚀 Update: {APP_VERSION}</h2>
              <p style={{color: '#aaa', fontSize: '14px', marginBottom: '20px'}}>Here's what's new in this version:</p>
              <ul style={{color: '#fff', fontSize: '14px', paddingLeft: '20px', lineHeight: '1.6', marginBottom: '30px'}}>
                {RELEASE_NOTES.map((note, idx) => (
                  <li key={idx} style={{marginBottom: '10px'}}>{note}</li>
                ))}
              </ul>
              <button onClick={closeUpdateModal} style={{width: '100%', padding: '16px', backgroundColor: '#3b82f6', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: 'bold'}}>Awesome, Got it!</button>
            </div>
          </div>
        )}

      </div>
    </>
  );
}

export default App;