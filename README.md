# 🏁 Dino Kart

Kart in **3D vero** per tablet, nella famiglia di Mario Kart e Crash Team
Racing. Offline, un solo file, nessuna libreria: il motore 3D è un piccolo
renderer WebGL scritto per questo gioco (`src/10-gl.js`), con triangoli a
facce piatte, sole, luce ambiente e nebbia che sfuma nel cielo.

## Il gioco

- **Otto piste in due coppe.** Coppa Frutta: Prato Fiorito, Spiaggia Cocco,
  Giungla Liane, Castello di Dino. Coppa Stella: Monte Neve, Vulcano
  Ruggente, Fabbrica di Dolci, Pista Arcobaleno (nello spazio, senza
  barriere: chi cade viene riportato su).
- **Otto kart**, ognuno col suo dino al volante. Il tuo ha il colore del tuo
  profilo; gli altri sono Rex, Trici, Stego, Ptero, Brachi, Anchi, Spino e Pachi.
- **Derapata con mini-turbo**: in curva tieni lo sterzo a fondo e il kart
  derapa. Le scintille passano da blu ad arancio a viola; molli e parte il
  turbo. In derapata, sterzare verso l'interno stringe, verso l'esterno allarga.
- **Scatole delle armi** sulla pista: banana, guscio verde (rimbalza sulle
  barriere), guscio rosso (insegue chi ti sta davanti), turbo, stella
  (invincibile) e frutti. Chi è indietro pesca le armi migliori.
- **Frutti** sulla strada: ognuno aumenta un poco la velocità massima, fino a
  dieci; un colpo ne fa perdere due.
- **Rampe** (in aria un tocco è un trucco: piccolo turbo all'atterraggio) e
  **piattaforme turbo**.
- **Gran Premio**: quattro gare, punti 15·12·10·8·6·4·2·1, classifica dopo
  ogni gara e **podio in 3D** con la coppa d'oro, d'argento o di bronzo. Una
  coppa nella Coppa Frutta apre la Coppa Stella. Poi c'è la **gara singola**,
  con il record per pista.

## Comandi

Tieni premuta la **metà sinistra** dello schermo per sterzare a sinistra, la
**metà destra** per sterzare a destra. Il gas va da solo. Quando hai un'arma
compare un grande **tasto rotondo** in basso al centro. Da tastiera: frecce o
A/D, spazio per l'arma, freccia su per i trucchi.

- **Piccolo** (3 anni): due giri, avversari più lenti, e una mano sul volante
  che lo riporta in strada quando esce sull'erba. Le curve però le fa lui:
  chi non sterza arriva ultimo.
- **Grande** (6 anni): tre giri, avversari più veloci. Le barriere fermano
  davvero: chi non sterza resta lì.

I profili sono quelli di tutta la collezione (chiavi `dk.`): ogni pilota ha le
sue coppe e i suoi record.

## Sviluppo

```
node build.js
node test/smoke.js   # gare intere al volo: piste, pilota automatico, passivo, derapata, armi, Gran Premio
node test/look.js    # Chrome vero (3D via software, muto): fotogrammi in test/frames e tocchi reali
```

La gara è dati puri (`src/30-race.js`) con un suo generatore casuale a seme:
ogni kart vive in coordinate di pista (s lungo la linea centrale, d di lato).
Piste in `src/20-tracks.js`: punti di controllo di una curva chiusa, da cui
nascono strada, cordoli, barriere, paesaggio e traiettoria ideale degli
avversari. Il collaudo verifica anche che nessuna pista si incroci o si sfiori.
