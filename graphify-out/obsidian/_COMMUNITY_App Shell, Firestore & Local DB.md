---
type: community
cohesion: 0.13
members: 40
---

# App Shell, Firestore & Local DB

**Cohesion:** 0.13 - loosely connected
**Members:** 40 nodes

## Members
- [[App()]] - code - src/App.tsx
- [[App.tsx]] - code - src/App.tsx
- [[ApplicationIntegrationsHub()]] - code - src/components/ApplicationIntegrationsHub.tsx
- [[ApplicationIntegrationsHub.tsx]] - code - src/components/ApplicationIntegrationsHub.tsx
- [[ApplicationTracker()]] - code - src/components/ApplicationTracker.tsx
- [[ApplicationTracker.tsx]] - code - src/components/ApplicationTracker.tsx
- [[FirestoreErrorInfo]] - code - src/db.ts
- [[JobApplication]] - code - src/components/ApplicationTracker.tsx
- [[OperationType]] - code - src/db.ts
- [[RFC-2822]] - concept - src/components/ApplicationIntegrationsHub.tsx
- [[STAGES]] - code - src/components/ApplicationTracker.tsx
- [[TailorResponse]] - code - src/types.ts
- [[TargetSpecifications()]] - code - src/components/TargetSpecifications.tsx
- [[TargetSpecifications.tsx]] - code - src/components/TargetSpecifications.tsx
- [[TargetSpecificationsProps]] - code - src/components/TargetSpecifications.tsx
- [[auth_1]] - code - src/lib/firebase.ts
- [[db.ts]] - code - src/db.ts
- [[firebase.ts_1]] - code - src/lib/firebase.ts
- [[getAccessToken()]] - code - src/lib/firebase.ts
- [[getAiConfig()]] - code - src/db.ts
- [[getDB()]] - code - src/utils/localDb.ts
- [[getHistory()]] - code - src/db.ts
- [[getInitialResume()]] - code - src/App.tsx
- [[getJobApplications()]] - code - src/db.ts
- [[getMasterResume()]] - code - src/db.ts
- [[googleSignIn()]] - code - src/lib/firebase.ts
- [[handleFirestoreError()]] - code - src/db.ts
- [[initAuth()]] - code - src/lib/firebase.ts
- [[localDb]] - code - src/utils/localDb.ts
- [[localDb.ts]] - code - src/utils/localDb.ts
- [[logout()]] - code - src/lib/firebase.ts
- [[provider]] - code - src/lib/firebase.ts
- [[removeUndefined()]] - code - src/db.ts
- [[saveAiConfig()]] - code - src/db.ts
- [[saveHistory()]] - code - src/db.ts
- [[saveJobApplications()]] - code - src/db.ts
- [[saveMasterResume()]] - code - src/db.ts
- [[useAuth()]] - code - src/AuthContext.tsx
- [[useToast()]] - code - src/components/Toast.tsx
- [[validateAndCleanResumeData()]] - code - src/App.tsx

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/App_Shell_Firestore__Local_DB
SORT file.name ASC
```

## Connections to other communities
- 30 edges to [[_COMMUNITY_Feature Views & Data Types]]
- 13 edges to [[_COMMUNITY_Auth, Toast & Firebase Init]]
- 1 edge to [[_COMMUNITY_Landing Page Component]]

## Top bridge nodes
- [[App.tsx]] - degree 40, connects to 3 communities
- [[db.ts]] - degree 21, connects to 2 communities
- [[ApplicationIntegrationsHub.tsx]] - degree 19, connects to 2 communities
- [[useToast()]] - degree 15, connects to 2 communities
- [[App()]] - degree 14, connects to 1 community