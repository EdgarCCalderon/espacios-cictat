# Arquitectura — Espacios CICTAT (Clean Architecture + MVC)

```
app/                         ← VISTA (rutas Expo Router; pantallas delgadas)
src/
├── domain/                  ← MODELO (núcleo, sin dependencias externas)
│   ├── models/              Tipos/interfaces que espejean la BD de Supabase
│   ├── repositories/        Contratos (puertos) que la infraestructura implementa
│   └── usecases/            Reglas de negocio (traslapes, limpieza, aprobación…)
├── infrastructure/          ← ADAPTADORES (detalles técnicos)
│   ├── supabase/            Cliente singleton + nombres de tablas/buckets
│   ├── repositories/        Implementaciones Supabase de los contratos
│   └── services/            PDF (expo-print), compartir, picker de documentos
└── presentation/            ← CONTROLADOR + UI reutilizable
    ├── controllers/         Hooks que conectan vistas ↔ casos de uso
    ├── context/             Estado global (AuthContext)
    ├── components/common/   Componentes de marca (BrushTitle…)
    └── theme/               Sistema de diseño CICTAT
```

**Regla de dependencias:** `app → presentation → domain ← infrastructure`.
Las vistas nunca importan `supabase` directamente; usan controladores.
