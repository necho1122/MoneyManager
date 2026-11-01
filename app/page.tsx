"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BriefcaseBusiness,
  Check,
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  ShoppingBag,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { auth, db, googleProvider, isFirebaseConfigured } from "@/lib/firebase";

type MovementType = "income" | "expense" | "investment";
type Account = {
  id: string;
  name: string;
  type: "bank" | "cash" | "savings" | "investment";
  openingBalance: number;
};
type Movement = {
  id: string;
  amount: number;
  category: string;
  subcategory?: string;
  date: string;
  note: string;
  accountId: string;
  type: MovementType;
};
type UserCategory = {
  id: string;
  type: MovementType;
  name: string;
  parentName: string | null;
};

const categories: Record<MovementType, string[]> = {
  expense: ["Alimentación", "Vivienda", "Transporte", "Ocio", "Salud", "Compras", "Servicios", "Otros"],
  income: ["Sueldo", "Negocio", "Regalo", "Otros ingresos"],
  investment: ["Acciones", "Fondos", "Criptomonedas", "Otros"],
};
const categoryColors = ["#7587ed", "#ed9e72", "#57b99a", "#d9b955", "#ca78a4", "#70b8ce", "#a68bd6", "#9aa4aa"];
const movementNames: Record<MovementType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  investment: "Inversión",
};
const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function monthStart(month: string) {
  return `${month}-01`;
}

function todayDate() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function nextMonthStart(month: string) {
  const [year, value] = month.split("-").map(Number);
  return `${value === 12 ? year + 1 : year}-${String(value === 12 ? 1 : value + 1).padStart(2, "0")}-01`;
}

function formatMonth(month: string) {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(`${month}-15T12:00:00`));
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function getMonthOffset(month: string, offset: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function AppMark({ small = false }: { small?: boolean }) {
  return <span className={`brand-mark${small ? " brand-mark-small" : ""}`}><Wallet size={small ? 17 : 20} strokeWidth={2.2} /></span>;
}

function FirebaseSetup() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <AppMark />
        <span className="eyebrow">TU ESPACIO FINANCIERO</span>
        <h1>Un poco de orden,<br />mucha tranquilidad.</h1>
        <p>Para guardar tus datos de forma privada y entrar con Google, conecta tu proyecto de Firebase.</p>
        <ol>
          <li>Crea un proyecto y una aplicación web en Firebase.</li>
          <li>Activa Google en Authentication y crea la base de datos Firestore.</li>
          <li>Copia las variables de <code>.env.example</code> a <code>.env.local</code>.</li>
          <li>Publica las reglas del archivo <code>firestore.rules</code>.</li>
        </ol>
        <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">Abrir Firebase Console <ArrowUpRight size={16} /></a>
        <div className="setup-note"><CircleHelp size={17} /> Al terminar, reinicia el servidor con <code>npm run dev</code>.</div>
      </section>
    </main>
  );
}

function Login({ error, onLogin, busy }: { error: string; onLogin: () => void; busy: boolean }) {
  return (
    <main className="setup-page">
      <section className="setup-card login-card">
        <AppMark />
        <span className="eyebrow">TUS FINANZAS, A TU MANERA</span>
        <h1>Todo claro.<br />A tu ritmo.</h1>
        <p>Un lugar sencillo y privado para tener a mano tus cuentas, tus gastos y tus planes.</p>
        <button className="google-button" onClick={onLogin} disabled={busy}>
          <GoogleIcon /> {busy ? "Conectando..." : "Continuar con Google"}
        </button>
        {error && <p className="error-message">{error}</p>}
        <p className="privacy-note"><Check size={15} /> Tus datos solo son visibles para tu cuenta.</p>
      </section>
    </main>
  );
}

function GoogleIcon() {
  return <svg viewBox="0 0 48 48" width="19" height="19" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.24l7.73 5.99c4.51-4.17 7.11-10.31 7.11-17.7Z" /><path fill="#FBBC05" d="M10.53 28.59a14.39 14.39 0 0 1 0-9.18l-7.98-6.19a23.89 23.89 0 0 0 0 21.56l7.98-6.19Z" transform="translate(0 5)" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.75l-7.73-5.99c-2.15 1.45-4.92 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" /></svg>;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [activePage, setActivePage] = useState<"overview" | "movements" | "accounts">("overview");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);
  const [allMovements, setAllMovements] = useState<Movement[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [dataError, setDataError] = useState("");
  const [modal, setModal] = useState<"movement" | "account" | "category" | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [movementType, setMovementType] = useState<MovementType>("expense");
  const [selectedCategory, setSelectedCategory] = useState(categories.expense[0]);
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [categoryKind, setCategoryKind] = useState<"category" | "subcategory">("category");
  const [mobileNav, setMobileNav] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    }, (error) => {
      setAuthError(error.message);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setAccounts([]);
      setUserCategories([]);
      setAllMovements([]);
      setDataReady(false);
      return;
    }
    setDataReady(false);
    setDataError("");
    let accountsLoaded = false;
    let categoriesLoaded = false;
    let movementsLoaded = false;
    const markReady = () => {
      if (accountsLoaded && categoriesLoaded && movementsLoaded) setDataReady(true);
    };
    const accountUnsubscribe = onSnapshot(
      collection(db, "users", user.uid, "accounts"),
      (snapshot) => {
        setAccounts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Account)));
        accountsLoaded = true;
        markReady();
      },
      (error) => { setDataError(`No se pudieron cargar las cuentas: ${error.message}`); setDataReady(true); },
    );
    const categoryUnsubscribe = onSnapshot(
      collection(db, "users", user.uid, "categories"),
      (snapshot) => {
        setUserCategories(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as UserCategory)));
        categoriesLoaded = true;
        markReady();
      },
      (error) => { setDataError(`No se pudieron cargar las categorías: ${error.message}`); setDataReady(true); },
    );
    const movementQuery = query(collection(db, "users", user.uid, "movements"), orderBy("date", "desc"));
    const movementUnsubscribe = onSnapshot(
      movementQuery,
      (snapshot) => {
        setAllMovements(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Movement)));
        movementsLoaded = true;
        markReady();
      },
      (error) => { setDataError(`No se pudieron cargar los movimientos: ${error.message}`); setDataReady(true); },
    );
    return () => { accountUnsubscribe(); categoryUnsubscribe(); movementUnsubscribe(); };
  }, [user]);

  const rootCategories = useMemo(() => {
    const customNames = userCategories
      .filter((item) => item.type === movementType && item.parentName === null)
      .map((item) => item.name);
    return [...categories[movementType], ...customNames.filter(
      (name) => !categories[movementType].some((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase()),
    )];
  }, [movementType, userCategories]);

  const availableSubcategories = useMemo(
    () => userCategories
      .filter((item) => item.type === movementType && item.parentName === selectedCategory)
      .map((item) => item.name),
    [movementType, selectedCategory, userCategories],
  );

  const movements = useMemo(
    () => allMovements.filter((item) => item.date >= monthStart(month) && item.date < nextMonthStart(month)),
    [allMovements, month],
  );

  const totals = useMemo(() => {
    const income = movements.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expenses = movements.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    const investments = movements.filter((item) => item.type === "investment").reduce((sum, item) => sum + item.amount, 0);
    const accountBalances = accounts.map((account) => ({
      ...account,
      balance: account.openingBalance + allMovements
        .filter((item) => item.accountId === account.id)
        .reduce((sum, item) => sum + (item.type === "income" ? item.amount : -item.amount), 0),
    }));
    return { income, expenses, investments, balance: accountBalances.reduce((sum, item) => sum + item.balance, 0), accountBalances };
  }, [accounts, movements, allMovements]);

  const expensesByCategory = useMemo(() => {
    const grouped = movements.filter((item) => item.type === "expense").reduce<Record<string, number>>((acc, item) => {
      const label = item.subcategory ? `${item.category} · ${item.subcategory}` : item.category;
      acc[label] = (acc[label] || 0) + item.amount;
      return acc;
    }, {});
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [movements]);

  const handleLogin = async () => {
    if (!auth) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "No se pudo iniciar sesión.");
    } finally {
      setAuthBusy(false);
    }
  };

  const submitMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionError("Introduce un importe mayor que cero.");
      return;
    }
    setSaving(true);
    setActionError("");
    try {
      await addDoc(collection(db, "users", user.uid, "movements"), {
        type: formData.get("type"),
        amount,
        category: formData.get("category"),
        subcategory: formData.get("subcategory") || "",
        accountId: formData.get("accountId"),
        date: formData.get("date"),
        note: String(formData.get("note") || "").trim(),
        createdAt: new Date().toISOString(),
      });
      setModal(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  };

  const submitAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(event.currentTarget);
    const openingBalance = Number(formData.get("openingBalance"));
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      setActionError("Introduce un saldo inicial válido, igual o mayor que cero.");
      return;
    }
    setSaving(true);
    setActionError("");
    try {
      if (editingAccount) {
        await updateDoc(doc(db, "users", user.uid, "accounts", editingAccount.id), { openingBalance });
      } else {
        const name = String(formData.get("name") || "").trim();
        if (!name) {
          setActionError("Escribe un nombre para la cuenta.");
          return;
        }
        await addDoc(collection(db, "users", user.uid, "accounts"), {
          name,
          type: formData.get("type"),
          openingBalance,
          createdAt: new Date().toISOString(),
        });
      }
      setModal(null);
      setEditingAccount(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo guardar la cuenta.");
    } finally {
      setSaving(false);
    }
  };

  const submitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db || !user) return;
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") || "").trim();
    const parentName = categoryKind === "subcategory" ? String(formData.get("parentName") || "") : null;
    if (!name) {
      setActionError("Escribe un nombre para la categoría.");
      return;
    }
    const siblings = categoryKind === "subcategory"
      ? userCategories.filter((item) => item.type === movementType && item.parentName === parentName)
      : userCategories.filter((item) => item.type === movementType && item.parentName === null);
    const duplicate = siblings.some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())
      || (parentName === null && categories[movementType].some((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase()));
    if (duplicate) {
      setActionError("Ya existe una categoría con ese nombre en este grupo.");
      return;
    }
    setSaving(true);
    setActionError("");
    try {
      await addDoc(collection(db, "users", user.uid, "categories"), {
        type: movementType,
        name,
        parentName,
        createdAt: new Date().toISOString(),
      });
      if (parentName) {
        setSelectedCategory(parentName);
        setSelectedSubcategory(name);
      } else {
        setSelectedCategory(name);
        setSelectedSubcategory("");
      }
      setModal("movement");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo guardar la categoría.");
    } finally {
      setSaving(false);
    }
  };

  const openMovementModal = () => {
    setActionError("");
    setEditingAccount(null);
    setMovementType("expense");
    setSelectedCategory(categories.expense[0]);
    setSelectedSubcategory("");
    setModal("movement");
  };

  const openAccountModal = (account?: Account) => {
    setActionError("");
    setEditingAccount(account || null);
    setModal("account");
  };

  const openCategoryModal = () => {
    setActionError("");
    setCategoryKind("category");
    setModal("category");
  };

  const removeMovement = async (movement: Movement) => {
    if (!db || !user || !window.confirm("¿Eliminar este movimiento?")) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "movements", movement.id));
    } catch (error) {
      setDataError(error instanceof Error ? `No se pudo eliminar: ${error.message}` : "No se pudo eliminar el movimiento.");
    }
  };

  if (!isFirebaseConfigured) return <FirebaseSetup />;
  if (!authReady) return <main className="loading-screen"><span className="loader" /> Cargando tu espacio...</main>;
  if (!user) return <Login error={authError} onLogin={handleLogin} busy={authBusy} />;

  const navItems = [
    { key: "overview" as const, label: "Resumen", icon: LayoutDashboard },
    { key: "movements" as const, label: "Movimientos", icon: ArrowDownLeft },
    { key: "accounts" as const, label: "Cuentas", icon: Wallet },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileNav ? " sidebar-open" : ""}`}>
        <a className="brand" href="#"><AppMark /><span>mi<span className="brand-light">dinero</span></span></a>
        <div className="sidebar-label">MENÚ</div>
        <nav className="side-nav">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`nav-item${activePage === key ? " nav-active" : ""}`} onClick={() => { setActivePage(key); setMobileNav(false); }}>
              <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><span className="tip-icon"><TrendingUp size={17} /></span><strong>Poco a poco</strong><p>Pequeños hábitos hacen una gran diferencia.</p></div>
          <button className="user-profile" onClick={() => { if (auth) void signOut(auth); }} title="Cerrar sesión">
            {user.photoURL ? <img src={user.photoURL} alt="" /> : <span className="avatar-fallback">{user.displayName?.[0] || "U"}</span>}
            <span className="user-details"><strong>{user.displayName || "Mi cuenta"}</strong><small>Cerrar sesión</small></span><LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Abrir menú"><Menu /></button>
          <div><p className="topbar-kicker">TU ESPACIO FINANCIERO</p><h1>{activePage === "overview" ? "Tu resumen" : activePage === "movements" ? "Movimientos" : "Tus cuentas"}</h1></div>
          <div className="topbar-actions">
            <div className="month-picker">
              <button onClick={() => setMonth(getMonthOffset(month, -1))} aria-label="Mes anterior"><ArrowLeft size={16} /></button>
              <span>{formatMonth(month)}</span>
              <button onClick={() => setMonth(getMonthOffset(month, 1))} aria-label="Mes siguiente"><ArrowRight size={16} /></button>
            </div>
            <button className="primary-button add-button" onClick={openMovementModal}><Plus size={18} /><span>Nuevo movimiento</span></button>
          </div>
        </header>

        {dataError && <div className="alert error-alert">{dataError}</div>}
        {!dataReady ? <div className="content-loading"><span className="loader" /> Cargando tus datos...</div> : (
          <>
            {activePage === "overview" && (
              <>
                <section className="welcome-row">
                  <div><h2>Hola, {user.displayName?.split(" ")[0] || "qué bueno verte"} <span>✦</span></h2><p>Así se mueve tu dinero en {formatMonth(month)}.</p></div>
                  <button className="text-button" onClick={() => setActivePage("movements")}>Ver movimientos <ArrowRight size={16} /></button>
                </section>
                <section className="stats-grid">
                  <StatCard label="Saldo en tus cuentas" value={totals.balance} icon={<Wallet size={18} />} tone="lavender" note={`${accounts.length} ${accounts.length === 1 ? "cuenta" : "cuentas"}`} />
                  <StatCard label="Ingresos del mes" value={totals.income} icon={<ArrowDownLeft size={18} />} tone="mint" note={`${movements.filter((item) => item.type === "income").length} movimientos`} />
                  <StatCard label="Gastos del mes" value={totals.expenses} icon={<ArrowUpRight size={18} />} tone="peach" note={`${movements.filter((item) => item.type === "expense").length} movimientos`} />
                  <StatCard label="Invertido este mes" value={totals.investments} icon={<TrendingUp size={18} />} tone="yellow" note={`${movements.filter((item) => item.type === "investment").length} movimientos`} />
                </section>
                <section className="dashboard-grid">
                  <div className="panel spending-panel">
                    <div className="panel-heading"><div><h3>¿En qué se va?</h3><p>Tus gastos por categoría</p></div><span className="subtle-chip">{formatMonth(month).split(" ")[0]}</span></div>
                    {expensesByCategory.length ? <SpendingChart data={expensesByCategory} total={totals.expenses} /> : <EmptyState title="Aún no hay gastos" text="Cuando registres alguno, aquí verás cómo se reparte." />}
                  </div>
                  <div className="panel accounts-panel">
                    <div className="panel-heading"><div><h3>Tus cuentas</h3><p>Tu dinero, en cada lugar</p></div><button className="icon-button" onClick={() => openAccountModal()} aria-label="Añadir cuenta"><Plus size={18} /></button></div>
                    {totals.accountBalances.length ? <div className="account-list">{totals.accountBalances.slice(0, 4).map((account) => <AccountRow account={account} key={account.id} onEdit={() => openAccountModal(account)} />)}</div> : <EmptyState title="Empieza por tus cuentas" text="Añade dónde tienes tu dinero para empezar a organizarte." action={() => openAccountModal()} />}
                    {accounts.length > 4 && <button className="text-button account-more" onClick={() => setActivePage("accounts")}>Ver todas <ArrowRight size={15} /></button>}
                  </div>
                </section>
                <section className="panel recent-panel">
                  <div className="panel-heading"><div><h3>Lo último</h3><p>Movimientos recientes de este mes</p></div><button className="text-button" onClick={() => setActivePage("movements")}>Ver todo <ArrowRight size={15} /></button></div>
                  {movements.length ? <MovementTable movements={movements.slice(0, 5)} accounts={accounts} onDelete={removeMovement} /> : <EmptyState title="Todavía no hay movimientos" text="Anota tu primer ingreso, gasto o inversión." action={openMovementModal} />}
                </section>
              </>
            )}
            {activePage === "movements" && (
              <section className="panel page-panel">
                <div className="panel-heading"><div><h3>Todos tus movimientos</h3><p>Ingresos, gastos e inversiones de {formatMonth(month)}</p></div><span className="subtle-chip">{movements.length} registros</span></div>
                {movements.length ? <MovementTable movements={movements} accounts={accounts} onDelete={removeMovement} /> : <EmptyState title="Este mes está en blanco" text="Añade un movimiento para empezar a llevar el control." action={openMovementModal} />}
              </section>
            )}
            {activePage === "accounts" && (
              <section className="panel page-panel">
                <div className="panel-heading"><div><h3>Tus cuentas</h3><p>Organiza dónde guardas tu dinero</p></div><button className="primary-button" onClick={() => openAccountModal()}><Plus size={17} /> Añadir cuenta</button></div>
                {totals.accountBalances.length ? <div className="account-grid">{totals.accountBalances.map((account) => <AccountCard account={account} key={account.id} onEdit={() => openAccountModal(account)} />)}</div> : <EmptyState title="Aún no tienes cuentas" text="Añade tu cuenta bancaria, efectivo o ahorros." action={() => openAccountModal()} />}
              </section>
            )}
          </>
        )}
        <footer className="footer-note">Un paso a la vez. Tus finanzas son tuyas. <span>♡</span></footer>
      </main>

      {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Cerrar menú" />}
      {modal && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading"><div><span className="eyebrow">{modal === "movement" ? "ANOTA UN MOVIMIENTO" : modal === "category" ? "PERSONALIZA TUS CATEGORÍAS" : "ORGANIZA TU DINERO"}</span><h2 id="modal-title">{modal === "movement" ? "Nuevo movimiento" : modal === "category" ? categoryKind === "category" ? "Nueva categoría" : "Nueva subcategoría" : editingAccount ? "Editar saldo inicial" : "Nueva cuenta"}</h2></div><button className="icon-button" onClick={() => setModal(null)} aria-label="Cerrar"><X size={19} /></button></div>
            {(modal === "movement" || modal === "category") && <>
              <form onSubmit={submitMovement} className={`modal-form${modal === "category" ? " modal-form-hidden" : ""}`}>
                <label>Tipo de movimiento<select name="type" value={movementType} onChange={(event) => { const type = event.target.value as MovementType; setMovementType(type); setSelectedCategory(categories[type][0]); setSelectedSubcategory(""); }}><option value="expense">Gasto</option><option value="income">Ingreso</option><option value="investment">Inversión</option></select></label>
                <label>Importe (€)<input name="amount" type="number" min="0.01" step="0.01" placeholder="0,00" required autoFocus /></label>
                <label>Categoría</label>
                <div className="category-input-group"><select name="category" value={selectedCategory} onChange={(event) => { setSelectedCategory(event.target.value); setSelectedSubcategory(""); }}>{rootCategories.map((category) => <option key={category}>{category}</option>)}</select><button type="button" className="secondary-button category-add-button" onClick={openCategoryModal}><Plus size={14} /> Nueva</button></div>
                <label>Subcategoría <span className="optional">(opcional)</span></label>
                <div className="category-input-group"><select name="subcategory" value={selectedSubcategory} onChange={(event) => setSelectedSubcategory(event.target.value)}><option value="">Sin subcategoría</option>{availableSubcategories.map((subcategory) => <option key={subcategory}>{subcategory}</option>)}</select><button type="button" className="secondary-button category-add-button" onClick={() => { setActionError(""); setCategoryKind("subcategory"); setModal("category"); }}><Plus size={14} /> Nueva</button></div>
                <label>Cuenta<select name="accountId" required defaultValue=""><option value="" disabled>Elige una cuenta</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
                <label>Fecha<input name="date" type="date" defaultValue={todayDate()} required /></label>
                <label>Nota <span className="optional">(opcional)</span><input name="note" maxLength={100} placeholder="¿De qué se trata?" /></label>
                {accounts.length === 0 && <p className="inline-hint">Primero necesitas <button type="button" className="inline-link" onClick={() => openAccountModal()}>crear una cuenta</button>.</p>}
                {actionError && <p className="error-message">{actionError}</p>}
                <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancelar</button><button type="submit" className="primary-button" disabled={saving || accounts.length === 0}>{saving ? "Guardando..." : "Guardar movimiento"}</button></div>
              </form>
            </>}
            {modal === "account" ? (
              <form onSubmit={submitAccount} className="modal-form">
                {editingAccount ? <p className="account-edit-name">Ajustando el saldo inicial de <strong>{editingAccount.name}</strong>. Los movimientos registrados no cambiarán.</p> : <>
                  <label>Nombre de la cuenta<input name="name" maxLength={40} placeholder="Ej. Cuenta principal" required autoFocus /></label>
                  <label>Tipo<select name="type"><option value="bank">Cuenta bancaria</option><option value="savings">Ahorros</option><option value="cash">Efectivo</option><option value="investment">Inversión</option></select></label>
                </>}
                <label>Saldo inicial (€)<input name="openingBalance" type="number" min="0" step="0.01" placeholder="0,00" defaultValue={editingAccount?.openingBalance ?? 0} required autoFocus={Boolean(editingAccount)} /></label>
                {actionError && <p className="error-message">{actionError}</p>}
                <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setModal(null); setEditingAccount(null); }}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Guardando..." : editingAccount ? "Guardar saldo" : "Guardar cuenta"}</button></div>
              </form>
            ) : modal === "category" ? (
              <form onSubmit={submitCategory} className="modal-form">
                <label>Tipo de movimiento<select value={movementType} disabled><option value="expense">Gasto</option><option value="income">Ingreso</option><option value="investment">Inversión</option></select></label>
                <label>Qué quieres añadir<select value={categoryKind} onChange={(event) => { setCategoryKind(event.target.value as "category" | "subcategory"); setActionError(""); }}><option value="category">Categoría</option><option value="subcategory">Subcategoría</option></select></label>
                {categoryKind === "subcategory" && <label>Dentro de<select name="parentName" value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} required>{rootCategories.map((category) => <option key={category}>{category}</option>)}</select></label>}
                <label>Nombre<input name="name" maxLength={40} placeholder={categoryKind === "category" ? "Ej. Mascotas" : "Ej. Veterinario"} required autoFocus /></label>
                {actionError && <p className="error-message">{actionError}</p>}
                <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModal("movement")}>Volver</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Guardando..." : "Guardar categoría"}</button></div>
              </form>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, tone, note }: { label: string; value: number; icon: React.ReactNode; tone: string; note: string }) {
  return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><strong>{euro.format(value)}</strong><small>{note}</small></article>;
}

function SpendingChart({ data, total }: { data: [string, number][]; total: number }) {
  let cursor = 0;
  const gradient = data.map(([name, value], index) => {
    const start = cursor;
    cursor += total ? value / total * 100 : 0;
    return `${categoryColors[index % categoryColors.length]} ${start}% ${cursor}%`;
  }).join(", ");
  return <div className="chart-layout"><div className="donut-wrap"><div className="donut-chart" style={{ background: `conic-gradient(${gradient})` }}><div className="donut-hole"><small>Total gastos</small><strong>{euro.format(total)}</strong></div></div></div><div className="legend-list">{data.map(([name, value], index) => <div className="legend-row" key={name}><span className="legend-dot" style={{ backgroundColor: categoryColors[index % categoryColors.length] }} /><span className="legend-name">{name}</span><span className="legend-value">{euro.format(value)}</span><small>{total ? Math.round(value / total * 100) : 0}%</small></div>)}</div></div>;
}

function AccountRow({ account, onEdit }: { account: Account & { balance: number }; onEdit?: () => void }) {
  const Icon = account.type === "cash" ? Banknote : account.type === "investment" ? TrendingUp : account.type === "savings" ? BriefcaseBusiness : CreditCard;
  return <div className="account-row"><span className={`account-icon account-${account.type}`}><Icon size={18} /></span><span className="account-name"><strong>{account.name}</strong><small>{account.type === "bank" ? "Cuenta bancaria" : account.type === "cash" ? "Efectivo" : account.type === "savings" ? "Ahorros" : "Inversión"}</small></span><strong className="account-balance">{euro.format(account.balance)}</strong>{onEdit && <button className="icon-button account-edit-button" onClick={onEdit} aria-label={`Editar saldo inicial de ${account.name}`} title="Editar saldo inicial"><Pencil size={14} /></button>}</div>;
}

function AccountCard({ account, onEdit }: { account: Account & { balance: number }; onEdit: () => void }) {
  return <article className="account-card"><AccountRow account={account} onEdit={onEdit} /><div className="account-card-foot"><span>Saldo inicial</span><strong>{euro.format(account.openingBalance)}</strong></div></article>;
}

function MovementTable({ movements, accounts, onDelete }: { movements: Movement[]; accounts: Account[]; onDelete: (movement: Movement) => void }) {
  return <div className="table-scroll"><table className="movement-table"><thead><tr><th>Movimiento</th><th>Categoría</th><th>Cuenta</th><th>Fecha</th><th className="amount-column">Importe</th><th><span className="visually-hidden">Acciones</span></th></tr></thead><tbody>
    {movements.map((item) => {
      const Icon = item.type === "income" ? ArrowDownLeft : item.type === "investment" ? TrendingUp : ShoppingBag;
      return <tr key={item.id}><td><span className={`movement-icon movement-${item.type}`}><Icon size={17} /></span><span className="movement-description"><strong>{item.note || item.category}</strong><small>{movementNames[item.type]}</small></span></td><td><span className="category-pill">{item.subcategory ? `${item.category} · ${item.subcategory}` : item.category}</span></td><td>{accounts.find((account) => account.id === item.accountId)?.name || "Cuenta eliminada"}</td><td>{formatDate(item.date)}</td><td className={`amount-column amount-${item.type}`}>{item.type === "income" ? "+" : "−"}{euro.format(item.amount)}</td><td><button className="delete-button" onClick={() => onDelete(item)} aria-label={`Eliminar ${item.note || item.category}`}><X size={16} /></button></td></tr>;
    })}
  </tbody></table></div>;
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Wallet size={21} /></span><strong>{title}</strong><p>{text}</p>{action && <button className="text-button" onClick={action}>Empezar <ArrowRight size={15} /></button>}</div>;
}
