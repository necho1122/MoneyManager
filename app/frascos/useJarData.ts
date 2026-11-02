"use client";

import { collection, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import {
  categoryMappingKey,
  defaultJarForCategory,
  normalizeJarSettings,
  type JarAccount,
  type JarId,
  type JarSettings,
  type JarTransaction,
} from "@/lib/jars";
import type { User } from "firebase/auth";

export type CategoryMappingOption = {
  key: string;
  type: "expense" | "investment";
  category: string;
  subcategory?: string;
  defaultJar: JarId | null;
};

function parseJarTransaction(data: Record<string, unknown>, id: string): JarTransaction | null {
  const type = data.type;
  if (
    (type !== "income" && type !== "expense" && type !== "investment" && type !== "transfer")
    || typeof data.amount !== "number"
    || typeof data.date !== "string"
    || typeof data.accountId !== "string"
    || (data.category !== undefined && typeof data.category !== "string")
    || (data.subcategory !== undefined && typeof data.subcategory !== "string")
    || (data.transferToAccountId !== undefined && typeof data.transferToAccountId !== "string")
  ) return null;
  return {
    id,
    type,
    amount: data.amount,
    date: data.date,
    accountId: data.accountId,
    ...(typeof data.category === "string" ? { category: data.category } : {}),
    ...(typeof data.subcategory === "string" ? { subcategory: data.subcategory } : {}),
    ...(typeof data.transferToAccountId === "string" ? { transferToAccountId: data.transferToAccountId } : {}),
  };
}

export function useJarData(user: User | null) {
  const [transactions, setTransactions] = useState<JarTransaction[]>([]);
  const [accounts, setAccounts] = useState<JarAccount[]>([]);
  const [categoryDefinitions, setCategoryDefinitions] = useState<Array<{ type: "expense" | "investment"; name: string; parentName: string | null }>>([]);
  const [settings, setSettings] = useState<JarSettings>(normalizeJarSettings(undefined));
  const [readyCount, setReadyCount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !db) {
      setTransactions([]);
      setAccounts([]);
      setCategoryDefinitions([]);
      setSettings(normalizeJarSettings(undefined));
      setReadyCount(0);
      setError("");
      return;
    }

    setTransactions([]);
    setAccounts([]);
    setCategoryDefinitions([]);
    setSettings(normalizeJarSettings(undefined));
    setReadyCount(0);
    setError("");
    let loadedTransactions = false;
    let loadedAccounts = false;
    let loadedSettings = false;
    let loadedCategories = false;
    const markReady = () => {
      if (loadedTransactions && loadedAccounts && loadedSettings && loadedCategories) setReadyCount(4);
    };
    const userRef = doc(db, "users", user.uid);
    const unsubscribeTransactions = onSnapshot(
      query(collection(userRef, "movements"), orderBy("date", "desc")),
      (snapshot) => {
        setTransactions(snapshot.docs.flatMap((item) => {
          const transaction = parseJarTransaction(item.data(), item.id);
          return transaction ? [transaction] : [];
        }));
        loadedTransactions = true;
        markReady();
      },
      (snapshotError) => {
        setError(`No se pudieron cargar los movimientos: ${snapshotError.message}`);
        loadedTransactions = true;
        markReady();
      },
    );
    const unsubscribeAccounts = onSnapshot(
      collection(userRef, "accounts"),
      (snapshot) => {
        setAccounts(snapshot.docs.flatMap((item) => {
          const data = item.data();
          if (data.type !== "bank" && data.type !== "cash" && data.type !== "savings" && data.type !== "investment") return [];
          return [{ id: item.id, type: data.type }];
        }));
        loadedAccounts = true;
        markReady();
      },
      (snapshotError) => {
        setError(`No se pudieron cargar las cuentas: ${snapshotError.message}`);
        loadedAccounts = true;
        markReady();
      },
    );
    const unsubscribeSettings = onSnapshot(
      doc(userRef, "jarSettings", "config"),
      (snapshot) => {
        setSettings(normalizeJarSettings(snapshot.exists() ? snapshot.data() : undefined));
        loadedSettings = true;
        markReady();
      },
      (snapshotError) => {
        setError(`No se pudo cargar la configuración de los frascos: ${snapshotError.message}`);
        loadedSettings = true;
        markReady();
      },
    );
    const unsubscribeCategories = onSnapshot(
      collection(userRef, "categories"),
      (snapshot) => {
        setCategoryDefinitions(snapshot.docs.flatMap((item) => {
          const data = item.data();
          if (
            (data.type !== "expense" && data.type !== "investment")
            || typeof data.name !== "string"
            || (data.parentName !== null && typeof data.parentName !== "string")
          ) return [];
          return [{ type: data.type, name: data.name, parentName: data.parentName as string | null }];
        }));
        loadedCategories = true;
        markReady();
      },
      (snapshotError) => {
        setError(`No se pudieron cargar las categorías: ${snapshotError.message}`);
        loadedCategories = true;
        markReady();
      },
    );
    return () => {
      unsubscribeTransactions();
      unsubscribeAccounts();
      unsubscribeSettings();
      unsubscribeCategories();
    };
  }, [user]);

  const categories = useMemo(() => {
    const options = new Map<string, CategoryMappingOption>();
    const addOption = (type: "expense" | "investment", category: string, subcategory?: string) => {
      const key = categoryMappingKey(type, category, subcategory);
      options.set(key, {
        key,
        type,
        category,
        subcategory,
        defaultJar: defaultJarForCategory(type, category),
      });
    };
    for (const transaction of transactions) {
      if ((transaction.type !== "expense" && transaction.type !== "investment") || !transaction.category?.trim()) continue;
      const category = transaction.category.trim();
      const subcategory = transaction.subcategory?.trim() || undefined;
      addOption(transaction.type, category);
      if (subcategory) addOption(transaction.type, category, subcategory);
    }
    for (const category of categoryDefinitions) {
      if (category.parentName) addOption(category.type, category.parentName, category.name);
      else addOption(category.type, category.name);
    }
    return [...options.values()].sort((a, b) =>
      a.type.localeCompare(b.type, "es")
      || a.category.localeCompare(b.category, "es")
      || (a.subcategory || "").localeCompare(b.subcategory || "", "es"),
    );
  }, [categoryDefinitions, transactions]);

  const saveSettings = async (nextSettings: JarSettings) => {
    if (!db || !user) throw new Error("Inicia sesión para guardar la configuración.");
    await setDoc(doc(db, "users", user.uid, "jarSettings", "config"), {
      percentages: nextSettings.percentages,
      categoryMappings: nextSettings.categoryMappings,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  };

  return { transactions, accounts, settings, categories, loading: readyCount !== 4, error, saveSettings };
}
