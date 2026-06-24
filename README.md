# Robinson — Röstningsapp

En "Robinson-liknande" webbaserad röstningsapp. Spelledaren skapar ett spel, lägger till namn att rösta om, bjuder in spelare via unika länkar, och kör omgångar tills ett namn är kvar. En central storbildsvy kan delas via Teams.

Stack: **React (Vite) + Convex (realtime backend) + Vercel** (hosting).

## Setup

### 1. Convex — backend

```bash
npm install
npx convex dev
```

Första körningen av `convex dev`:

- Loggar in dig på Convex (öppnar webbläsaren)
- Frågar om du vill skapa nytt projekt → välj **"robinson"**
- Genererar `convex/_generated/` (TypeScript-typer + API-stub)
- Skriver din `VITE_CONVEX_URL` till `.env.local` automatiskt
- Deployar schema + functions till ditt Convex dev-projekt
- Står och watch:ar — håll den igång medan du utvecklar

### 2. Frontend

I en **andra terminal**:

```bash
npm run dev
```

Öppna [http://localhost:5173](http://localhost:5173). Convex pushar realtidsuppdateringar över WebSocket — alla vyer synkar live.

### 3. Deploy på Vercel

Två vägar:

**Via Convex Vercel-integration (rekommenderad):**

1. Pusha repot till GitHub.
2. På [vercel.com](https://vercel.com), klicka **Add New → Project** → importera repot.
3. Under **Storage / Marketplace** välj **Convex** → koppla till ditt Convex-projekt. Detta sätter `CONVEX_DEPLOY_KEY` + `VITE_CONVEX_URL` automatiskt.
4. Sätt **Build Command** till:
   ```
   npx convex deploy --cmd 'npm run build'
   ```
5. Deploy.

**Manuellt:**

1. Pusha repot.
2. Importera på Vercel.
3. Lägg till `VITE_CONVEX_URL` (från Convex dashboard → Project Settings) som env var.
4. Lägg till `CONVEX_DEPLOY_KEY` (från Convex dashboard → Settings → Deploy Keys).
5. Sätt Build Command till `npx convex deploy --cmd 'npm run build'`.
6. Deploy.

## Hur du spelar

1. **Spelledaren** går till startsidan och klickar "Skapa nytt spel" → landar på `/admin/[gameId]`.
2. Lägg till alla **namn** som ska rötas ut (minst 3).
3. Lägg till alla **spelare** — du själv först (du blir admin). Varje spelare får en unik `/play/[token]`-länk. Dela ut.
4. Dela storbildslänken `/view/[gameId]` via Teams (skärmdelning eller separat fönster).
5. Klicka **Starta omgång 1**.
6. Alla spelare lägger **2 röster** (kan vara på samma namn).
7. Spelledaren ser i realtid vem som röstat. När alla är klara → **Stäng omgången**.
8. Storbildsvyn visar dramatisk avslöjning. **De 2 namn med lägst röster elimineras.**
9. Spelledaren klickar **Starta omgång X+1** och så vidare tills bara ett namn är kvar.
10. Vinnaren visas stort med konfetti på storbildsvyn 🎉

## Tiebreak-kedja

Om det blir lika röster på sistaplatsen:

1. **Namnet med flest unika röstare överlever** (dvs. namn med färre unika röstare elimineras).
2. Fortfarande lika → **ny röstomgång endast på de inblandade namnen**.
3. Fortfarande lika efter det → **slumpen avgör**.

Logiken körs **server-side** i `convex/games.ts` → `closeRound`. Klienten kallar bara mutationen, kan inte fuska med rösträkningen.

## Datamodell

Se [`convex/schema.ts`](convex/schema.ts):

- `games` — status, current_round, tiebreak-fält, vinnare
- `names` — namnen att rösta om, eliminated-flagga
- `players` — spelare med unik token, is_admin-flagga
- `votes` — en rad per röst (varje spelare lägger 2 per omgång)

Convex pushar förändringar över WebSocket → alla vyer (admin, play, view) uppdateras automatiskt utan polling.

## Struktur

```
src/
  pages/
    Home.jsx     — skapa nytt spel
    Admin.jsx    — spelledarvy med inbyggd röstningspanel
    Play.jsx     — spelarvy (en URL per spelare)
    View.jsx     — central storbildsvy (för Teams)
  components/
    VotePanel.jsx — delad röstningskomponent (admin + play)
  lib/
    useGame.js    — hook (useQuery + reaktiv data)
    gameLogic.js  — ren spelogik: räkning, eliminering, tiebreak (delas med servern)
  main.jsx        — ConvexProvider + router
  styles.css      — mörkt tema, lila/gult, alla animationer
convex/
  schema.ts       — databasens schema
  games.ts        — game queries/mutations + closeRound-logik
  names.ts        — names CRUD
  players.ts      — players CRUD
  votes.ts        — votes submit/list
```

## Säkerhet

Ingen inloggning. Identitet styrs av token i URL. Convex-mutationerna validerar:

- `votes.submit` förkastar dubbel-röstning i samma omgång
- `votes.submit` kräver att spelet är i `voting`-status
- `players.remove` kan inte ta bort admin
- `games.closeRound` accepterar bara `voting`-status

För publika spel: håll URL:erna privata. Vill du strikt åtkomstkontroll, lägg på Convex Auth.
