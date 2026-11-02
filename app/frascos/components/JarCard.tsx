"use client";

import { ArrowDownRight, ArrowUpRight, Check, PiggyBank } from "lucide-react";
import type { JarReport } from "@/lib/jars";

const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function JarCard({ jar }: { jar: JarReport }) {
  const statusClass = jar.status === "Excedido" ? "jar-status-over" : jar.status === "Completo" ? "jar-status-complete" : "jar-status-within";
  const progressWidth = Math.min(100, Math.max(0, jar.progress));
  const categoryIcon = jar.contribution ? <PiggyBank size={17} /> : <ArrowDownRight size={17} />;
  return (
    <article className="jar-card">
      <div className="jar-card-heading">
        <span className="jar-code" style={{ color: jar.color, backgroundColor: `${jar.color}18` }}>{jar.id}</span>
        <span className={`jar-status ${statusClass}`}>{jar.status === "Completo" && <Check size={12} />}{jar.status}</span>
      </div>
      <h3>{jar.name}</h3>
      <p className="jar-description">{jar.description}</p>
      <div className="jar-budget-row"><span>Asignado <strong>{jar.percentage}%</strong></span><strong>{euro.format(jar.budget)}</strong></div>
      <div className="jar-progress-track" role="progressbar" aria-label={`${jar.name}: ${Math.round(jar.progress)}% ejecutado`} aria-valuenow={Math.round(jar.progress)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${progressWidth}%`, backgroundColor: jar.status === "Excedido" ? "#d88965" : jar.color }} />
      </div>
      <div className="jar-execution-row"><span>{categoryIcon} Ejecutado</span><strong>{euro.format(jar.executed)}</strong></div>
      <div className="jar-footer"><span>{jar.remaining >= 0 ? "Disponible" : "Por encima del presupuesto"}</span><strong className={jar.remaining < 0 ? "jar-negative" : ""}>{jar.remaining < 0 ? <ArrowUpRight size={14} /> : null}{euro.format(Math.abs(jar.remaining))}</strong></div>
    </article>
  );
}
