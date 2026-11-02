"use client";

import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Settings,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import {
  calculateJarReport,
  getJarForTransaction,
  JARS,
} from "@/lib/jars";
import { SettingsPanel } from "./components/SettingsPanel";
import { JarCard } from "./components/JarCard";
import { useJarData } from "./useJarData";

const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function currentMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, offset: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(year, value - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" })
    .format(new Date(`${month}-15T12:00:00`));
}

function jarMonthStart(month: string) {
  return `${month}-01`;
}

function nextJarMonthStart(month: string) {
  return `${shiftMonth(month, 1)}-01`;
}

function SetupMessage() {
  return <main className="setup-page"><section className="setup-card"><span className="eyebrow">MÉTODO DE LOS SEIS FRASCOS</span><h1>Conecta tu espacio financiero.</h1><p>Configura Firebase para consultar tus movimientos y guardar tus preferencias personales.</p><Link href="/">Volver a Mi Dinero <ArrowRight size={16} /></Link></section></main>;
}

function LoginMessage({ error, busy, onLogin }: { error: string; busy: boolean; onLogin: () => void }) {
  return <main className="setup-page"><section className="setup-card login-card"><span className="jar-login-icon"><PiggyBank size={24} /></span><span className="eyebrow">MÉTODO DE LOS SEIS FRASCOS</span><h1>Tu dinero,<br />con intención.</h1><p>Inicia sesión con la misma cuenta para ver tus ingresos y configurar tus frascos.</p><button className="google-button" onClick={onLogin} disabled={busy}>{busy ? "Conectando..." : "Continuar con Google"}</button>{error && <p className="error-message">{error}</p>}<Link className="jar-back-link" href="/">Volver al resumen <ArrowRight size={15} /></Link></section></main>;
}

export default function JarsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [activeTab, setActiveTab] = useState<"overview" | "settings">("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const data = useJarData(user);

  useEffect(() => {
    if (!auth) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    }, (error) => {
      setAuthError(error.message);
      setAuthReady(true);
    });
  }, []);

  const monthTransactions = useMemo(
    () => data.transactions.filter((transaction) => transaction.date >= jarMonthStart(month) && transaction.date < nextJarMonthStart(month)),
    [data.transactions, month],
  );
  const monthlyIncome = useMemo(
    () => monthTransactions.filter((transaction) => transaction.type === "income").reduce((total, transaction) => total + transaction.amount, 0),
    [monthTransactions],
  );
  const jars = useMemo(
    () => calculateJarReport(monthlyIncome, monthTransactions, data.settings, data.accounts),
    [data.accounts, data.settings, monthlyIncome, monthTransactions],
  );
  const monthlyOutflow = useMemo(
    () => monthTransactions.filter((transaction) => transaction.type === "expense").reduce((total, transaction) => total + transaction.amount, 0),
    [monthTransactions],
  );
  const allocatedBudget = useMemo(() => jars.reduce((total, jar) => total + jar.budget, 0), [jars]);
  const executed = useMemo(() => jars.reduce((total, jar) => total + jar.executed, 0), [jars]);
  const unassignedTransactions = useMemo(
    () => monthTransactions.filter((transaction) =>
      (transaction.type === "expense" || transaction.type === "investment")
      && !getJarForTransaction(transaction, data.settings),
    ),
    [data.settings, monthTransactions],
  );
  const unassignedTotal = useMemo(
    () => unassignedTransactions.reduce((total, transaction) => total + transaction.amount, 0),
    [unassignedTransactions],
  );
  const hasOverspending = jars.some((jar) => jar.status === "Excedido");
  const allComplete = unassignedTransactions.length === 0
    && jars.every((jar) => jar.budget === 0 || jar.executed >= jar.budget - 0.005);
  const globalStatus = monthlyIncome <= 0
    ? "Esperando tus ingresos"
    : hasOverspending
      ? "Hay frascos excedidos"
      : unassignedTransactions.length > 0
        ? "Hay movimientos sin frasco"
      : allComplete
        ? "Distribución completada"
        : "Distribución en curso";
  const globalStatusClass = hasOverspending ? "jar-status-over" : allComplete && monthlyIncome > 0 ? "jar-status-complete" : "jar-status-within";

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

  const saveSettings = async (settings: typeof data.settings) => {
    setSaving(true);
    setSaved(false);
    try {
      await data.saveSettings(settings);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (!isFirebaseConfigured) return <SetupMessage />;
  if (!authReady) return <main className="loading-screen"><span className="loader" /> Cargando tu espacio...</main>;
  if (!user) return <LoginMessage error={authError} busy={authBusy} onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar${mobileNav ? " sidebar-open" : ""}`}>
        <Link className="brand" href="/"><span className="brand-mark"><Wallet size={20} strokeWidth={2.2} /></span><span>mi<span className="brand-light">dinero</span></span></Link>
        <div className="sidebar-label">TU ESPACIO</div>
        <nav className="side-nav">
          <Link className="nav-item" href="/"><LayoutDashboard size={19} strokeWidth={1.9} /><span>Resumen</span></Link>
          <button className={`nav-item${activeTab === "overview" ? " nav-active" : ""}`} onClick={() => { setActiveTab("overview"); setMobileNav(false); }}><ChartNoAxesCombined size={19} strokeWidth={1.9} /><span>Método de los 6 frascos</span></button>
          <button className={`nav-item${activeTab === "settings" ? " nav-active" : ""}`} onClick={() => { setActiveTab("settings"); setMobileNav(false); }}><Settings size={19} strokeWidth={1.9} /><span>Configurar frascos</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><span className="tip-icon"><PiggyBank size={17} /></span><strong>Un plan con propósito</strong><p>Asigna una intención a cada parte de tus ingresos.</p></div>
          <button className="user-profile" onClick={() => { if (auth) void signOut(auth); }} title="Cerrar sesión">
            {user.photoURL ? <img src={user.photoURL} alt="" /> : <span className="avatar-fallback">{user.displayName?.[0] || "U"}</span>}
            <span className="user-details"><strong>{user.displayName || "Mi cuenta"}</strong><small>Cerrar sesión</small></span><LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Abrir menú"><Menu /></button>
          <div><p className="topbar-kicker">PLANIFICACIÓN PERSONAL</p><h1>{activeTab === "overview" ? "Método de los 6 frascos" : "Configurar frascos"}</h1></div>
          <div className="topbar-actions">
            {activeTab === "overview" && <div className="month-picker"><button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior"><ArrowLeft size={16} /></button><span>{monthLabel(month)}</span><button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente"><ArrowRight size={16} /></button></div>}
            {activeTab === "overview" && <button className="primary-button add-button" onClick={() => setActiveTab("settings")}><Settings size={16} /><span>Ajustar método</span></button>}
          </div>
        </header>
        {data.error && <div className="alert error-alert">{data.error}</div>}
        {data.loading ? <div className="content-loading"><span className="loader" /> Cargando tus movimientos...</div> : activeTab === "overview" ? (
          <>
            <section className="jars-welcome">
              <div><span className="eyebrow">CADA EURO TIENE UN PROPÓSITO</span><h2>Una forma sencilla de cuidar tu dinero.</h2><p>Revisa cómo se distribuyeron tus ingresos durante <strong>{monthLabel(month)}</strong>.</p></div>
              <div className="jars-income-summary"><span><ArrowDownLeft size={15} /> Ingresos del mes</span><strong>{euro.format(monthlyIncome)}</strong></div>
            </section>
            <section className="jar-summary-grid">
              <article className="jar-summary-card"><span>Presupuesto total</span><strong>{euro.format(allocatedBudget)}</strong><small>Distribuido entre los seis frascos</small></article>
              <article className="jar-summary-card"><span>Gastos registrados</span><strong>{euro.format(monthlyOutflow)}</strong><small>Movimientos de gasto del mes</small></article>
              <article className="jar-summary-card"><span>Aportado a frascos</span><strong>{euro.format(executed)}</strong><small>Gastos e inversiones asignados</small></article>
              <article className="jar-summary-card"><span>Estado del mes</span><strong className={`jar-global-status ${globalStatusClass}`}>{globalStatus}</strong><small>{monthlyIncome > 0 ? `${jars.filter((jar) => jar.status === "Excedido").length} frascos excedidos` : "Registra un ingreso para calcular tu plan"}</small></article>
            </section>
            {monthlyIncome <= 0 && <div className="jar-info-banner"><CircleHelp size={17} /><span>Cuando registres ingresos en Mi Dinero, calcularemos automáticamente el presupuesto de cada frasco.</span><Link href="/">Ir a movimientos <ArrowRight size={14} /></Link></div>}
            {unassignedTransactions.length > 0 && <div className="jar-info-banner jar-unassigned-banner"><CircleHelp size={17} /><span>{unassignedTransactions.length} movimiento{unassignedTransactions.length === 1 ? "" : "s"} por {euro.format(unassignedTotal)} todavía no tiene frasco asignado.</span><button className="text-button" onClick={() => setActiveTab("settings")}>Asignar categorías <ArrowRight size={14} /></button></div>}
            <section className="jar-cards-grid">{jars.map((jar) => <JarCard jar={jar} key={jar.id} />)}</section>
            <section className="panel jars-note-panel"><div className="jars-note-icon"><ArrowUpRight size={18} /></div><div><strong>¿Cómo leer este resumen?</strong><p>Los presupuestos se calculan sobre los ingresos del mes. Los gastos e inversiones se asignan a un frasco mediante el mapeo de categorías. Los traspasos entre cuentas corrientes no cuentan como gasto; los que entran o salen de cuentas de ahorro o inversión se reflejan como aportaciones o retiros de ALP y LFI, sin duplicarlos como gasto.</p></div><button className="text-button" onClick={() => setActiveTab("settings")}>Configurar categorías <ArrowRight size={14} /></button></section>
          </>
        ) : (
          <>
            <section className="jars-welcome settings-welcome">
              <div><span className="eyebrow">TU MÉTODO, TUS REGLAS</span><h2>Ajusta tus proporciones.</h2><p>Los cambios se aplican solo a esta pantalla. No editan ni migran tus movimientos.</p></div>
              {saved && <span className="jar-saved-message"><ChartNoAxesCombined size={15} /> Configuración guardada</span>}
            </section>
            <SettingsPanel settings={data.settings} categories={data.categories} saving={saving} onSave={saveSettings} />
          </>
        )}
        <footer className="footer-note">Un paso a la vez. Tus finanzas son tuyas. <span>♡</span></footer>
      </main>
      {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Cerrar menú" />}
    </div>
  );
}
