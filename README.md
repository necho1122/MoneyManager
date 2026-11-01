# Mi Dinero

Aplicación personal para revisar ingresos, gastos, cuentas e inversiones desde el móvil o el ordenador. Usa Next.js, Firebase Authentication y Cloud Firestore.

## Desarrollo local

1. Instala Node.js 20 o posterior.
2. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/), añade una aplicación web y copia sus valores de configuración a `.env.local` usando `.env.example` como plantilla.
3. En Firebase Authentication, activa el proveedor **Google** y añade `localhost` a los dominios autorizados.
4. Crea la base de datos de Firestore e instala las reglas de `firestore.rules`.
5. Ejecuta `npm install` y `npm run dev`.

Las cuentas y movimientos se guardan bajo `users/{uid}`. Las reglas impiden que otros usuarios lean o escriban esos documentos.

## Despliegue en Vercel

Importa el repositorio en Vercel, configura las mismas variables `NEXT_PUBLIC_FIREBASE_*` en el proyecto y despliega. Añade el dominio de Vercel a los dominios autorizados de Firebase Authentication. Las claves de configuración web de Firebase son públicas por diseño; la protección de los datos depende de las reglas de Firestore.
