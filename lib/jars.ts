export type JarId = "NEC" | "LFI" | "ALP" | "EDU" | "OCI" | "DON";
export type JarMovementType = "income" | "expense" | "investment" | "transfer";
export type JarTransaction = {
  id: string;
  type: JarMovementType;
  amount: number;
  category?: string;
  subcategory?: string;
  date: string;
  accountId: string;
  transferToAccountId?: string;
};
export type JarAccount = {
  id: string;
  type: "bank" | "cash" | "savings" | "investment";
};
export type JarDefinition = {
  id: JarId;
  name: string;
  description: string;
  defaultPercentage: number;
  contribution: boolean;
  color: string;
};
export type JarSettings = {
  percentages: Record<JarId, number>;
  categoryMappings: Record<string, JarId | "none">;
};
export type JarReport = JarDefinition & {
  percentage: number;
  budget: number;
  executed: number;
  remaining: number;
  progress: number;
  status: "En límite" | "Excedido" | "Completo";
};

export const JARS: JarDefinition[] = [
  { id: "NEC", name: "Necesidades básicas", description: "Vivienda, alimentación, salud y gastos esenciales.", defaultPercentage: 50, contribution: false, color: "#7587ed" },
  { id: "LFI", name: "Libertad financiera", description: "Aportaciones a inversiones para tu futuro financiero.", defaultPercentage: 10, contribution: true, color: "#57b99a" },
  { id: "ALP", name: "Ahorro y proyectos", description: "Ahorro a largo plazo y proyectos importantes.", defaultPercentage: 10, contribution: true, color: "#70b8ce" },
  { id: "EDU", name: "Educación y desarrollo", description: "Formación, cursos, libros y crecimiento personal.", defaultPercentage: 10, contribution: false, color: "#a68bd6" },
  { id: "OCI", name: "Ocio y disfrute", description: "Restaurantes, cine, viajes y momentos para disfrutar.", defaultPercentage: 10, contribution: false, color: "#ed9e72" },
  { id: "DON", name: "Donativos y dar", description: "Donaciones, regalos solidarios y ayuda a otras personas.", defaultPercentage: 10, contribution: false, color: "#ca78a4" },
];

export const DEFAULT_PERCENTAGES = Object.fromEntries(
  JARS.map((jar) => [jar.id, jar.defaultPercentage]),
) as Record<JarId, number>;

export const EMPTY_JAR_SETTINGS: JarSettings = {
  percentages: DEFAULT_PERCENTAGES,
  categoryMappings: {},
};

const DEFAULT_CATEGORY_JARS: Record<string, JarId> = {
  "expense:alimentación": "NEC",
  "expense:vivienda": "NEC",
  "expense:transporte": "NEC",
  "expense:salud": "NEC",
  "expense:servicios": "NEC",
  "expense:alquiler": "NEC",
  "expense:luz": "NEC",
  "expense:supermercado": "NEC",
  "expense:ocio": "OCI",
  "expense:restaurantes": "OCI",
  "expense:restaurante": "OCI",
  "expense:cine": "OCI",
  "expense:cursos": "EDU",
  "expense:libros": "EDU",
  "expense:educación": "EDU",
  "expense:educacion": "EDU",
  "expense:donativos": "DON",
  "expense:donaciones": "DON",
  "expense:ahorro": "ALP",
  "expense:proyectos": "ALP",
  "expense:compras en broker": "LFI",
  "expense:compras broker": "LFI",
  "expense:acciones": "LFI",
  "expense:fondos": "LFI",
  "expense:criptomonedas": "LFI",
  "investment:acciones": "LFI",
  "investment:fondos": "LFI",
  "investment:criptomonedas": "LFI",
};

export function categoryMappingKey(type: "expense" | "investment", category: string, subcategory?: string) {
  return JSON.stringify([type, category, subcategory || null]);
}

export function normalizeJarSettings(data: unknown): JarSettings {
  const percentages = { ...DEFAULT_PERCENTAGES };
  const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const storedPercentages = record.percentages;
  if (storedPercentages && typeof storedPercentages === "object") {
    for (const jar of JARS) {
      const value = (storedPercentages as Record<string, unknown>)[jar.id];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) {
        percentages[jar.id] = value;
      }
    }
  }
  const categoryMappings: Record<string, JarId | "none"> = {};
  const storedMappings = record.categoryMappings;
  if (storedMappings && typeof storedMappings === "object" && !Array.isArray(storedMappings)) {
    for (const [key, value] of Object.entries(storedMappings)) {
      if (value === "none") categoryMappings[key] = "none";
      else {
        const jar = JARS.find((item) => item.id === value);
        if (jar) categoryMappings[key] = jar.id;
      }
    }
  }
  return { percentages, categoryMappings };
}

export function defaultJarForCategory(type: "expense" | "investment", category: string): JarId | null {
  return DEFAULT_CATEGORY_JARS[`${type}:${category.trim().toLocaleLowerCase("es")}`] || null;
}

export function getJarForTransaction(transaction: JarTransaction, settings: JarSettings): JarId | null {
  if (transaction.type !== "expense" && transaction.type !== "investment") return null;
  const category = transaction.category?.trim();
  if (!category) return transaction.type === "investment" ? "LFI" : null;

  const subcategoryKey = categoryMappingKey(transaction.type, category, transaction.subcategory);
  const categoryKey = categoryMappingKey(transaction.type, category);
  const subcategoryMapping = settings.categoryMappings[subcategoryKey];
  if (subcategoryMapping === "none") return null;
  if (subcategoryMapping) return subcategoryMapping;
  const categoryMapping = settings.categoryMappings[categoryKey];
  if (categoryMapping === "none") return null;
  if (categoryMapping) return categoryMapping;
  return defaultJarForCategory(transaction.type, category)
    || (transaction.type === "investment" ? "LFI" : null);
}

export function calculateJarReport(
  income: number,
  transactions: JarTransaction[],
  settings: JarSettings,
  accounts: JarAccount[] = [],
): JarReport[] {
  const executed = Object.fromEntries(JARS.map((jar) => [jar.id, 0])) as Record<JarId, number>;
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  for (const transaction of transactions) {
    if (transaction.type === "transfer" && Number.isFinite(transaction.amount) && transaction.amount > 0) {
      const source = accountsById.get(transaction.accountId);
      const destination = transaction.transferToAccountId
        ? accountsById.get(transaction.transferToAccountId)
        : undefined;
      if (!source || !destination) continue;
      if (source.type !== destination.type) {
        const sourceJar = source.type === "savings" ? "ALP" : source.type === "investment" ? "LFI" : null;
        const destinationJar = destination.type === "savings" ? "ALP" : destination.type === "investment" ? "LFI" : null;
        if (sourceJar) executed[sourceJar] -= transaction.amount;
        if (destinationJar) executed[destinationJar] += transaction.amount;
      }
      continue;
    }
    if (
      (transaction.type !== "expense" && transaction.type !== "investment")
      || !Number.isFinite(transaction.amount)
      || transaction.amount <= 0
    ) continue;
    const jarId = getJarForTransaction(transaction, settings);
    if (jarId) executed[jarId] += transaction.amount;
  }

  const incomeCents = Math.round(Math.max(0, income) * 100);
  const percentagesSumTo100 = Math.abs(totalJarPercentages(settings.percentages) - 100) < 0.001;
  let assignedBudgetCents = 0;
  return JARS.map((jar, index) => {
    const percentage = settings.percentages[jar.id];
    const budgetCents = percentagesSumTo100 && index === JARS.length - 1
      ? Math.max(0, incomeCents - assignedBudgetCents)
      : Math.round(incomeCents * percentage / 100);
    assignedBudgetCents += budgetCents;
    const budget = budgetCents / 100;
    const amount = Math.round(executed[jar.id] * 100) / 100;
    const remaining = Math.round((budget - amount) * 100) / 100;
    const progress = budget > 0 ? amount / budget * 100 : amount > 0 ? 100 : 0;
    const status = amount > budget + 0.005
      ? "Excedido"
      : jar.contribution && amount >= budget - 0.005 && budget > 0
        ? "Completo"
        : "En límite";
    return { ...jar, percentage, budget, executed: amount, remaining, progress, status };
  });
}

export function totalJarPercentages(percentages: Record<JarId, number>) {
  return JARS.reduce((total, jar) => total + (Number(percentages[jar.id]) || 0), 0);
}
