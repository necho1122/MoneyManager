"use client";

import { Check, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  categoryMappingKey,
  JARS,
  totalJarPercentages,
  type JarId,
  type JarSettings,
} from "@/lib/jars";
import type { CategoryMappingOption } from "../useJarData";

type SettingsPanelProps = {
  settings: JarSettings;
  categories: CategoryMappingOption[];
  saving: boolean;
  onSave: (settings: JarSettings) => Promise<void>;
};

const jarNames: Record<JarId, string> = {
  NEC: "Necesidades básicas",
  LFI: "Libertad financiera",
  ALP: "Ahorro y proyectos",
  EDU: "Educación y desarrollo",
  OCI: "Ocio y disfrute",
  DON: "Donativos y dar",
};

export function SettingsPanel({ settings, categories, saving, onSave }: SettingsPanelProps) {
  const [percentages, setPercentages] = useState(settings.percentages);
  const [categoryMappings, setCategoryMappings] = useState(settings.categoryMappings);
  const [error, setError] = useState("");

  useEffect(() => {
    setPercentages(settings.percentages);
    setCategoryMappings(settings.categoryMappings);
  }, [settings]);

  const percentageTotal = useMemo(() => totalJarPercentages(percentages), [percentages]);
  const percentageValid = Math.abs(percentageTotal - 100) < 0.001
    && JARS.every((jar) => Number.isFinite(percentages[jar.id]) && percentages[jar.id] >= 0 && percentages[jar.id] <= 100);

  const handleSave = async () => {
    if (!percentageValid) {
      setError("Las proporciones de los seis frascos deben sumar exactamente 100%.");
      return;
    }
    setError("");
    try {
      await onSave({ percentages, categoryMappings });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la configuración.");
    }
  };

  return (
    <section className="panel jars-settings-panel">
      <div className="panel-heading"><div><h3><Settings2 size={16} /> Personaliza tu método</h3><p>Configura los porcentajes y a qué frasco pertenece cada categoría.</p></div></div>
      <div className="jar-settings-section">
        <div className="jar-settings-title"><strong>Proporciones mensuales</strong><span className={percentageValid ? "percentage-valid" : "percentage-invalid"}>{percentageTotal.toFixed(percentageTotal % 1 ? 1 : 0)}% / 100%</span></div>
        <div className="jar-percentage-grid">
          {JARS.map((jar) => (
            <label className="jar-percentage-field" key={jar.id}>
              <span><i style={{ backgroundColor: jar.color }} />{jar.id} · {jar.name}</span>
              <div><input type="number" min="0" max="100" step="0.1" value={percentages[jar.id]} onChange={(event) => {
                const value = Number(event.target.value);
                setPercentages((previous) => ({ ...previous, [jar.id]: Number.isFinite(value) ? value : 0 }));
              }} aria-label={`Porcentaje ${jar.name}`} /><span>%</span></div>
            </label>
          ))}
        </div>
      </div>
      <div className="jar-settings-section">
        <div className="jar-settings-title"><strong>Asignación de categorías</strong><span className="jar-mapping-count">{categories.length} categorías</span></div>
        {categories.length ? <div className="jar-mapping-list">
          {categories.map((category) => {
            const selectedJar = categoryMappings[category.key] ?? "";
            const inheritedJar = category.subcategory
              ? categoryMappings[categoryMappingKey(category.type, category.category)]
              : undefined;
            const automaticJar = inheritedJar && inheritedJar !== "none" ? inheritedJar : category.defaultJar;
            return (
              <label className="jar-mapping-row" key={category.key}>
                <span className="jar-mapping-category"><strong>{category.subcategory ? `${category.category} · ${category.subcategory}` : category.category}</strong><small>{category.type === "expense" ? "Gasto" : "Inversión"}{category.defaultJar ? ` · sugerido: ${category.defaultJar}` : ""}</small></span>
                <select value={selectedJar} aria-label={`Frasco para ${category.category}${category.subcategory ? ` ${category.subcategory}` : ""}`} onChange={(event) => setCategoryMappings((previous) => {
                  const next = { ...previous };
                  if (event.target.value === "none") next[category.key] = "none";
                  else if (event.target.value) {
                    const selected = JARS.find((jar) => jar.id === event.target.value);
                    if (selected) next[category.key] = selected.id;
                  }
                  else delete next[category.key];
                  return next;
                })}>
                  <option value="">{automaticJar ? `Automático (${automaticJar})` : "Automático (sin sugerencia)"}</option>
                  <option value="none">Sin asignar</option>
                  {JARS.map((jar) => <option value={jar.id} key={jar.id}>{jar.id} · {jarNames[jar.id]}</option>)}
                </select>
              </label>
            );
          })}
        </div> : <p className="jar-no-mappings">Cuando registres gastos, inversiones o categorías personalizadas, podrás asignarlos aquí.</p>}
      </div>
      {error && <p className="error-message">{error}</p>}
      <div className="jar-settings-actions"><p><Check size={14} /> La configuración es solo de este módulo; tus movimientos no se modifican.</p><button className="primary-button" onClick={() => void handleSave()} disabled={saving || !percentageValid}>{saving ? "Guardando..." : "Guardar cambios"}</button></div>
    </section>
  );
}
