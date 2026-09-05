# Libro de caja — Sublime / Personal

Sistema simple para cargar ingresos y gastos separando la cuenta Sublime de tu cuenta personal.

## Qué es cada archivo

- `app/page.jsx` — la pantalla principal (carga de movimientos, totales, lista).
- `app/login/page.jsx` — pantalla de inicio de sesión.
- `supabase-schema.sql` — crea la tabla en tu base de datos y la protege para que solo vos veas tus datos.
- `.env.local.example` — modelo de las claves que hay que completar.

## Pasos para dejarlo funcionando

### 1. Base de datos (Supabase)

1. Entrá a tu proyecto en supabase.com.
2. Andá a **SQL Editor** → **New query**.
3. Copiá y pegá todo el contenido de `supabase-schema.sql`, y tocá **Run**.
4. Andá a **Authentication → Users** → **Add user** → creá tu usuario con tu email y una contraseña (esa es la que vas a usar para entrar al sistema).
5. Andá a **Project Settings → API** y copiá la **Project URL** y la **anon public key**.

### 2. Variables de entorno

1. Renombrá el archivo `.env.local.example` a `.env.local`.
2. Pegá ahí la URL y la key que copiaste en el paso anterior.

### 3. Probar en tu computadora (opcional)

```
npm install
npm run dev
```

Abrí `http://localhost:3000` e iniciá sesión con el email/contraseña que creaste.

### 4. Publicar en Vercel

1. Subí esta carpeta a un repositorio de GitHub (Claude Code te puede ayudar con esto).
2. Entrá a vercel.com → **Add New Project** → elegí ese repositorio.
3. Antes de darle a "Deploy", agregá las mismas dos variables de entorno (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en la sección **Environment Variables**.
4. Dale a **Deploy**. En un par de minutos te da la URL final.

### 5. Usarlo desde el celular

Abrí la URL de Vercel en el navegador del celular, y desde el menú de compartir elegí **"Agregar a pantalla de inicio"**. Queda como un ícono más, se abre a pantalla completa.

## Seguridad

- Cada movimiento queda asociado a tu usuario (`user_id`), y las políticas de la base de datos (RLS) hacen que nadie más pueda leer o modificar tus datos aunque conozca la URL del sitio.
- Nunca subas el archivo `.env.local` a un repositorio público — ya está ignorado por defecto en proyectos Next.js.
