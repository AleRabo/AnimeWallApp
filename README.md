# AnimeWall App

Versione desktop di AnimeWall basata su Electron e Next.js.

## Configurazione

1. Copiare `.env.example` in `.env.local`.
2. Inserire `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Installare le dipendenze con `npm install`.

Per le release GitHub, configurare gli stessi due valori come **Actions
secrets** nella repository pubblica `AleRabo/AnimeWallApp`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (oppure `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)

Sono variabili pubbliche necessarie al client Supabase Realtime. Non inserirle
nel codice o nei file committati: la GitHub Action le usa soltanto durante la
build e il valore viene incorporato nel bundle client, come previsto per le
variabili `NEXT_PUBLIC_*`.

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

La build desktop usa il runtime standalone di Next.js e un pacchetto ASAR per
evitare di distribuire l'intero progetto di sviluppo. Electron/Chromium resta
necessario per il funzionamento dell'app Windows, quindi l'installer non può
avere le dimensioni di una semplice pagina web.

La home include anche **Continua a guardare**: anime, episodio, copertina,
percentuale, durata, posizione corrente e data dell'ultimo aggiornamento vengono
salvati nel `localStorage` del dispositivo. I dati non vengono inviati a
Supabase o ad altri servizi e possono essere rimossi singolarmente dalla home.

## App Android

Il progetto Android si trova nella cartella [`android`](./android). È un APK
leggero che apre il sito AnimeWall ufficiale, quindi usa la stessa interfaccia,
le stesse API AnimeWorld e Watch Together del PC. La cronologia locale resta
separata per dispositivo; per sincronizzare anche il minutaggio tra PC e
Android servirà in seguito un account o una sincronizzazione cloud dedicata.

Per creare una release Android:

```bash
git tag android-v1.0.0
git push origin android-v1.0.0
```

La GitHub Action pubblica automaticamente l'APK nella release GitHub. L'app
controlla le nuove release Android all'avvio e propone il download; Android
richiede comunque la conferma dell'utente per installare un APK aggiornato.

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
