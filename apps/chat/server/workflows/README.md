# Workflows Architecture

Cette structure suit les meilleures pratiques de Vercel Workflows pour des workflows durables et atomiques.

## Structure

```
server/
├── lib/
│   └── sandbox/
│       ├── context.ts      # Création et configuration de sandbox
│       ├── git.ts          # Opérations Git (commit, push, etc.)
│       ├── source-sync.ts  # Synchronisation des sources GitHub
│       ├── logging.ts      # Logging structuré
│       ├── manager.ts      # Gestion des sessions sandbox
│       ├── session.ts      # KV session storage
│       ├── snapshot.ts     # KV snapshot storage
│       ├── types.ts        # Types partagés
│       └── index.ts        # Exports publics
│
└── workflows/
    ├── sync-docs/
    │   ├── workflow.ts     # Entry point - Orchestration du workflow
    │   ├── types.ts        # Types TypeScript
    │   ├── index.ts        # Exports publics
    │   └── steps/          # Steps atomiques
    │       ├── sync-all.ts     # Step complet (sandbox + sync + push + snapshot)
    │       └── index.ts
    │
    └── create-snapshot/
        ├── workflow.ts     # Entry point - Orchestration du workflow
        ├── types.ts        # Types TypeScript
        ├── index.ts        # Exports publics
        └── steps/          # Steps atomiques
            ├── create-and-snapshot.ts  # Step complet (sandbox + snapshot)
            └── index.ts
```

### Principes d'organisation

- **Entry point** : `workflow.ts` est le point d'entrée de chaque workflow
- **Steps isolés** : Chaque step est dans son propre fichier pour une meilleure lisibilité
- **Types séparés** : Les types sont définis dans `types.ts` au niveau du workflow
- **Exports centralisés** : Chaque dossier `steps/` a un `index.ts` pour exporter tous les steps

## Principes

### 1. **Séparation des responsabilités**

- **`lib/`** : Fonctions utilitaires réutilisables, sans état
- **`workflows/`** : Orchestration des workflows avec state management

### 2. **Steps atomiques et sérialisation**

Chaque step est annoté avec `'use step'` pour bénéficier de :
- Retry automatique en cas d'erreur
- Persistance de l'état entre les steps
- Récupération après crash

**⚠️ Contrainte importante** : Les valeurs retournées par les steps doivent être **sérialisables** (objets simples, arrays, primitives, Date, RegExp, Map, Set). Les objets complexes comme `Sandbox` ne peuvent pas être passés entre les steps.

```typescript
// ❌ INCORRECT - L'objet Sandbox n'est pas sérialisable
export async function stepCreateSandbox(): Promise<{ sandbox: Sandbox }> {
  'use step'
  const sandbox = await Sandbox.create(...)
  return { sandbox } // Erreur de sérialisation!
}

// ✅ CORRECT - On retourne seulement des données sérialisables
export async function stepSyncAll(
  config: SyncConfig,
  sources: GitHubSource[],
): Promise<SyncAllResult> {
  'use step'

  // Créer et utiliser le sandbox dans le même step
  const sandbox = await createSandbox(config)
  const results = await syncSources(sandbox, sources)
  const snapshot = await sandbox.snapshot()

  // Retourner seulement les données sérialisables
  return { snapshotId: snapshot.snapshotId, results }
}
```

### 3. **Workflows composables**

Les workflows orchestrent les steps de manière séquentielle :

```typescript
export async function syncDocumentation(
  config: SyncConfig,
  sources: GitHubSource[],
): Promise<SyncResult> {
  'use workflow'

  // Step 1: Create sandbox
  const { sandbox } = await stepCreateSandbox(config)

  // Step 2: Sync sources
  const { results } = await stepSyncSources(sandbox, sources)

  // Step 3: Push to git
  await stepPushToGit(sandbox, config, results)

  // Step 4: Create snapshot
  const { snapshotId } = await stepCreateSnapshot(sandbox)

  return { success: true, snapshotId, results }
}
```

### 4. **Types explicites**

Chaque step retourne un type explicite pour faciliter la composition :

```typescript
interface SandboxResult {
  sandbox: Sandbox
  sandboxId: string
}

interface SyncResult {
  results: SyncSourceResult[]
  totalFiles: number
}
```

## Workflows disponibles

### sync-docs

Synchronise les sources de documentation depuis GitHub vers le repo snapshot.

**Steps :**
1. `stepCreateSandbox` - Crée un sandbox depuis le repo git
2. `stepSyncSources` - Clone et filtre les sources GitHub
3. `stepPushToGit` - Commit et push les changements
4. `stepCreateSnapshot` - Prend un snapshot Vercel

**API :** `POST /api/sync` ou `POST /api/sync/:sourceId`

### create-snapshot

Crée un nouveau snapshot Vercel depuis un repo Git.

**Steps :**
1. `stepCreateSandbox` - Crée un sandbox depuis le repo git
2. `stepTakeSnapshot` - Prend un snapshot

**API :** `POST /api/sandbox/snapshot`

## Utilisation des helpers

Les helpers dans `lib/sandbox/` peuvent être utilisés directement dans les steps :

```typescript
import { createSandbox, generateAuthRepoUrl } from '../../lib/sandbox/context'
import { syncSources } from '../../lib/sandbox/source-sync'
import { pushChanges, generateCommitMessage } from '../../lib/sandbox/git'

// Dans un step
const sandbox = await createSandbox(config)
const results = await syncSources(sandbox, sources)
const commitMessage = generateCommitMessage(results)
```

## Bonnes pratiques

1. **Steps purs** : Les steps ne doivent pas avoir d'effets de bord non contrôlés
2. **Logging structuré** : Utiliser le logger de `@savoir/logger` avec contexte
3. **Error handling** : Les erreurs dans les steps déclenchent automatiquement un retry
4. **Types stricts** : Toujours typer les paramètres et retours de fonctions
5. **Imports relatifs** : Utiliser des chemins relatifs pour les imports locaux

## Ajout d'un nouveau workflow

1. Créer un dossier dans `workflows/`
2. Définir les types dans `types.ts`
3. Implémenter les steps dans `steps.ts` (avec `'use step'`)
4. Orchestrer dans `workflow.ts` (avec `'use workflow'`)
5. Créer un endpoint API dans `server/api/`

## Références

- [Vercel Workflows Documentation](https://vercel.com/docs/workflow)
- [Example: Call Summary Agent](https://github.com/vercel-labs/call-summary-agent-with-sandbox)
