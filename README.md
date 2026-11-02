# Mi Dinero

Aplicación personal para revisar ingresos, gastos, cuentas e inversiones desde el móvil o el ordenador. Usa Next.js, Firebase Authentication y Cloud Firestore.

## Desarrollo local

1. Instala Node.js 20 o posterior.
2. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/), añade una aplicación web y copia sus valores de configuración a `.env.local` usando `.env.example` como plantilla.
3. En Firebase Authentication, activa el proveedor **Google** y añade `localhost` a los dominios autorizados.
4. Crea la base de datos de Firestore e instala las reglas de `firestore.rules`.
5. Ejecuta `npm install` y `npm run dev`.

Las cuentas, categorías personalizadas y movimientos se guardan bajo `users/{uid}`. Las reglas impiden que otros usuarios lean o escriban esos documentos. Puedes ajustar el saldo inicial de una cuenta sin alterar los movimientos, crear categorías y subcategorías al registrar una operación, y registrar traspasos entre cuentas propias. Un traspaso resta el importe de la cuenta de origen y lo suma a la cuenta de destino sin contarlo como ingreso o gasto. Las inversiones nuevas también requieren elegir una cuenta de inversión: reducen el saldo de origen, aumentan el saldo de inversión y aparecen en el total invertido del mes. Los movimientos de inversión registrados antes de este cambio conservan el comportamiento previo porque no tienen una cuenta de destino guardada.

## Método de los seis frascos

Abre `/frascos` para consultar la distribución mensual de ingresos. La sección lee los movimientos, cuentas y categorías existentes, asigna sugerencias predeterminadas a categorías habituales y permite personalizar porcentajes y mapeos. Las preferencias se guardan de forma independiente en `users/{uid}/jarSettings/config`; no se modifican los documentos ni los flujos existentes de movimientos. Los porcentajes deben sumar 100%. Los movimientos sin frasco asignado se muestran para que no queden ocultos. Los traspasos entre cuentas corrientes no cuentan como gasto; los que entran o salen de cuentas de ahorro/inversión cuentan como aportaciones/retiros en ALP/LFI, no como gasto.

## Despliegue en Vercel

Importa el repositorio en Vercel, configura las mismas variables `NEXT_PUBLIC_FIREBASE_*` en el proyecto y despliega. Añade el dominio de Vercel a los dominios autorizados de Firebase Authentication. Las claves de configuración web de Firebase son públicas por diseño; la protección de los datos depende de las reglas de Firestore.
