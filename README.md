# AnimeWall App

Versione desktop di AnimeWall basata su Electron e Next.js.

## Configurazione

1. Copiare `.env.example` in `.env.local`.
2. Inserire `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Installare le dipendenze con `npm install`.

## Avvio

Per lo sviluppo:

```bash
npm run desktop:dev
```

Per la modalità produzione locale:

```bash
npm run desktop:build
npm run desktop:start
```

La finestra desktop carica sempre il server Next.js locale su `127.0.0.1:3210`.
Le API server-side continuano a interrogare AnimeWorld, mentre la chat Watch
Together usa Supabase Realtime come nel sito originale.

## Aggiornamenti automatici

Gli aggiornamenti dell'app desktop vengono pubblicati come GitHub Release nella
repository pubblica [AleRabo/AnimeWallApp](https://github.com/AleRabo/AnimeWallApp).
L'app controlla le nuove release solo quando è installata come pacchetto
Windows; in sviluppo non effettua richieste di update.

Per creare una release:

```bash
git tag v1.0.1
git push origin v1.0.1
```

La GitHub Action di release compila l'installer Windows e pubblica gli asset.
Gli utenti ricevono una notifica, possono scaricare l'aggiornamento e
riavviare l'app per installarlo.

Il primo avvio dell'installer può mostrare un avviso Microsoft SmartScreen:
gli installer non sono firmati con un certificato Authenticode commerciale.
Per rimuovere l'avviso serve un certificato di firma del codice e la relativa
secret GitHub Actions; non è possibile includere un certificato privato nel
repository pubblico.

Il sito AnimeWall e GitHub hanno ruoli diversi: AnimeWorld resta la fonte live
per ricerca, catalogo e streaming, mentre la repository pubblica AnimeWallApp
distribuisce gli aggiornamenti del client desktop. L'app controlla direttamente
GitHub, quindi un eventuale down del sito AnimeWall non impedisce di ricevere
gli aggiornamenti.
