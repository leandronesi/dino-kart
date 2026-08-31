# 🏁 Dino Kart

Una gara di kart **in prima persona**, per tablet. Stesso dino di
[Dino Giungla](../dino-giungla) — è il marchio — ma un gioco diverso, e
deliberatamente in un progetto separato.

## Perché non è dentro Dino Giungla

Ci abbiamo provato. Dino Giungla ha tre vincoli, scritti nel suo contratto, che
messi insieme rendono **impossibile** un gioco di corse:

1. **Non si perde mai.** Da lì vengono avversari che non ti superano davvero e
   nessuna posizione in classifica: cioè niente gara.
2. **Prima il bimbo di 3 anni.** Da lì l'auto-sterzo e il gas che va avanti da
   solo: cioè niente da fare.
3. **Stile piatto, tutto disegnato a runtime.** Da lì la vista dall'alto.

Ne era uscita una giostra, che infatti là dentro adesso si chiama *Il Girotondo*.
Qui invece **si può perdere**: posizione vera, avversari che superano, giro
veloce, e fuori pista si rallenta.

## Come è fatta la strada

Pseudo-3D **a segmenti**, la tecnica di Out Run e Super Mario Kart. Non c'è
geometria 3D da nessuna parte:

- La pista è una lista di segmenti, ognuno con una curvatura e una pendenza.
- Proiettare un punto è **una divisione**: `scale = CAM_D / (z - camZ)`, e da lì
  cadono fuori x, y e larghezza sullo schermo.
- Si disegna dal fondo verso la telecamera, un trapezio per segmento.
- **Le curve sono finte**, ed è questo il trucco: la strada non piega mai davvero
  nello spazio. Ogni segmento porta uno scostamento orizzontale che si accumula
  verso l'orizzonte, e il kart deriva della stessa quantità — è quello che fa
  *sentire* la curva che ti spinge in fuori.

## Comandi

Tocchi la **metà destra** dello schermo e sterzi a destra, la **metà sinistra**
e sterzi a sinistra. Niente altro da imparare. Il gas va da solo: chi deve
sterzare *e* tenere premuto un acceleratore ha due lavori, e quello che conta è
lo sterzo.

Quando hai un'arma in mano — e **solo** allora — la fascia in fondo allo schermo
diventa il tasto **TIRA!**. A mani vuote sterza come tutto il resto, quindi non
esiste nessuna zona morta da imparare: c'è un tasto, o non c'è.

## Chi guida

All'avvio si passa sempre da **"Chi guida?"**, come in Dino Giungla e per la
stessa ragione: due bambini sullo stesso tablet vogliono due elenchi di record,
non uno mescolato. Ogni pilota ha il suo nome, il colore del suo kart, il suo
giro migliore per pista e le sue vittorie.

- **Il segreto sono tre figure**, non una password. Un bambino di tre anni non
  sa scrivere ma ricorda benissimo "cuore, stella, luna". Non è sicurezza: è una
  serratura di famiglia, tiene un fratello fuori dai progressi dell'altro e
  nient'altro. Si può anche fare un pilota **senza** segreto.
- **L'età sceglie la difficoltà di partenza** — Piccolo parte da Facile, Grande
  da Gara — e non apre giochi diversi. Poi si cambia dal menu quando si vuole:
  un bambino cresce più in fretta di quanto si rifaccia un profilo.
- Dopo tre segreti sbagliati compare **"Chiedi a un grande"**: chi ha
  dimenticato le sue figure non deve restare chiuso fuori dal proprio gioco.
- Dal menu, in alto a sinistra, c'è chi sta guidando: si tocca e si cambia.
  Senza quello la scelta del pilota sarebbe una porta a senso unico.

Cambiare nome, cambiare colore ed eliminare un pilota stanno dietro al
**cancello dei grandi** (una moltiplicazione a due cifre) — non è sicurezza, è
un attrito che un bambino di sei anni non supera per sbaglio.

## Le armi

Nelle casse non c'è solo la spinta. Se ne porta **una alla volta**: niente
inventario, niente scelta, niente da spiegare. E una cassa presa con le mani già
piene diventa turbo, così una cassa è *sempre* una buona notizia — che a tre anni
è l'unica regola che serve sapere.

| | cosa fa |
|---|---|
| **TURBO** | il più frequente: è l'unico che serve anche quando sei in testa |
| **COCCO** | vola dritto, lo devi mirare |
| **API** | inseguono da sole il primo che ti sta davanti |
| **FULMINE** | niente proiettile: prende **tutti** quelli davanti a te in una volta |

Il rallentamento del colpito si applica **dopo** la banda di recupero, non prima:
messo prima, la banda gli avrebbe restituito quasi tutto quello che il colpo gli
aveva tolto, e tirargli il cocco sarebbe stato un bell'effetto senza nessuna
conseguenza.

Gli avversari per ora non tirano niente: prima deve essere divertente sparare,
poi si vedrà se è divertente essere colpiti.

## La gara

Per un po' questo è stato solo un simulatore di strada: aprivi e ti trovavi già
in corsa, senza un momento in cui cominciava e senza uno in cui finiva. Adesso
c'è la cornice, ed è quella che lo rende un gioco.

- **Menu**: scegli la pista e la difficoltà, poi **VIA!**
  - *Facile* — 2 giri, per imparare
  - *Gara* — 3 giri, la sfida predefinita per il Grande
  - *Campioni* — 3 giri, per quando Gara è diventata facile
- **Semaforo**: tre luci, e finché sono accese il kart sta fermo.
- **Durante**: giro, posizione, tempo sul giro e velocità. Quattro numeri, non uno
  di più — un cruscotto un bambino di sei anni non lo legge.
- **Arrivo**: l'ordine completo dei sei kart, il tuo posto, il giro migliore
  salvato per pista, e due tasti: *Ancora!* e *Menu*.

Un giro dura una mezza minuto, una gara fra i 50 e gli 85 secondi. La posizione
è vera: conta la strada percorsa; il passaggio della linea è interpolato e
congelato, quindi HUD, traguardo e podio raccontano lo stesso arrivo.

Gli avversari hanno una forza ordinata, da Pippi a Rufo; le difficoltà alzano
insieme il loro passo senza scambiare il più scarso con il più forte. Questo
rovescia una regola
che avevo scritto e difeso due volte. L'ha rovesciata un numero: col campo
tutto più lento di un pilota pulito, la frazione di gara passata con *qualcuno
davanti* era il **3%**. Il 97% eri in testa su una strada deserta — cioè una
prova a cronometro, non una gara, e non c'era nessuno a cui sparare.

Adesso c'è una **banda di recupero**: chi è avanti molla il gas, chi è dietro
spinge e può sfondare il tetto della velocità massima. Chi è davanti a te però
non lo sfonda mai, quindi non ti scappa: per passarlo servono la derapata, le
casse e quello che gli tiri dietro. Guidare male perde lo stesso, e di brutto —
la banda dà al massimo +24%, un kart sull'erba va al 38%.

  qualcuno davanti:  3% → 63%

## Derapata e casse premio

- **Casse premio**: tre in fila attraverso la strada, ogni due secondi circa.
  Dentro c'è una delle quattro cose qui sopra. **Le prendono anche gli
  avversari** — senza quello non è un potenziamento, è un +30% permanente
  regalato al giocatore contro un campo che al massimo va a tavoletta.
- **Derapata**: tieni il dito da un lato in curva. Le scintille passano da
  bianche a azzurre a arancioni; molli, e parti. Caricarla non costa niente che
  un bambino di tre anni non stesse già facendo — tenere premuto *è* come
  sterza. La bimba grande scoprirà che la tenuta lunga paga il doppio, e quello
  è il suo gioco in più.

## Le due piste

| | carattere | giro |
|---|---|---|
| **La Collina** | prati e saliscendi, curvoni aperti su cui ti appoggi, senso orario | ~28s |
| **La Spiaggia** | stretta e nervosa, tre esse di fila, senso antiorario | ~24s |

C'è anche la **mappa in tempo reale**, in alto a sinistra: l'anello e sei
pallini. È l'unico posto dove i cinque avversari esistono tutti insieme —
sulla strada vedi chi hai davanti e nient'altro. Disegnarla ha scoperto una
cosa che in prima persona non si vedeva affatto: **le prime piste non erano
anelli**. Curve destre e sinistre si bilanciavano quasi esattamente, giro netto
zero, il percorso se ne andava in diagonale e non tornava mai a casa. Nessuna
scala di disegno poteva chiuderlo, perché non c'era niente da chiudere.

Non è la stessa pista ridipinta: cambiano il tracciato, il cielo, i colori
dell'asfalto e del fuoripista, e gli alberi diventano palme. Il collaudo lo
pretende — due piste con lo stesso verde sono una pista sola, e lo dice.

Il giro migliore è salvato **per pista**, e compare sul tasto al posto della
descrizione appena ne hai fatto uno.

## Il numero che rende questo un gioco

Due costanti, lo sterzo e la forza centrifuga, sono state trovate **simulando**,
non a occhio: tre piloti fatti correre sul codice vero, uno che corregge presto,
uno che corregge all'ultimo, e uno che **non tocca mai lo schermo**.

Con i primi valori il pilota passivo arrivava **primo**, sull'asfalto per tutta
la gara, senza fare niente — cioè lo stesso difetto per cui *Il Girotondo* è
finito a fare la giostra. Non c'era nessun errore da nessuna parte: solo un gioco
che non era un gioco, e un collaudo che guidava bene non se ne sarebbe mai
accorto.

La cura non è stata alzare la centrifuga, che rende la strada intenibile, ma
**allungare le curve**: curve corte che si alternano si annullano a vicenda,
mentre un curvone tenuto due secondi e mezzo ti porta fuori di una strada intera
pur restando istantaneamente più debole del volante a fondo corsa. Adesso il
pilota passivo passa quasi tutta la gara sull'erba e arriva ultimo, e chi sterza
resta pulito e se la gioca.

`test/smoke.js` guida una gara intera **su ogni pista** senza toccare lo schermo
e pretende di perderle tutte. Ogni asserzione del collaudo è stata verificata in
negativo: rotta apposta la cosa che controlla, per vedere che l'asserzione se ne
accorga.

## Il collaudo che guarda lo schermo

`test/smoke.js` controlla numeri: velocità, giro, posizione, chi vince. Ha
passato quaranta asserzioni su una build che era **oggettivamente ingiocabile**,
perché nessuna di quelle asserzioni aveva mai guardato un'immagine.

Tre difetti, tutti invisibili a un test numerico e ovvi in un fotogramma:

- La strada era larga **quasi tre schermi** dove sta il kart, quindi nella metà
  bassa dell'immagine non si vedeva **nessuno dei due bordi**: guidavi al centro
  di una lastra grigia senza riferimenti, e scoprivi dov'eri finendo sull'erba.
- Appena mettevi una ruota fuori l'asfalto usciva **del tutto** dall'inquadratura
  e restavi in un prato con un albero, senza sapere da che parte fosse la pista.
- Le bande chiare e scure della strada differivano di **8 unità su 255**: a
  12.000 o a 4.000 lo schermo era identico, nessun senso di velocità.

Quindi `test/raster.js` è una canvas 2D scritta a mano — poligoni a scanline,
gradienti, un font 5×7, PNG in uscita, zero dipendenze — e `test/look.js`
disegna il gioco vero su un bitmap e **asserisce sui pixel**:

```bash
node test/look.js     # e guarda i fotogrammi in test/frames/
```

| controlla | perché |
|---|---|
| tutti e due i bordi della strada sono in quadro | senza, non sai dove sei |
| il kart è disegnato al centro e sopra c'è asfalto | scivolava di 64px mentre la strada ne faceva 773 |
| le bande hanno contrasto ≥14 su 255 | è il contrasto a fare la velocità, non la velocità |
| al massimo scarto laterale la pista è ancora in vista | CTR ha i muri: puoi sporcare una ruota, non emigrare |

Anche queste verificate in negativo, rimettendo i valori vecchi uno alla volta.
I fotogrammi in [test/frames/](test/frames/) sono aggiornati a ogni esecuzione:
è il modo più rapido di vedere il gioco senza tablet.

## Com'è organizzato

Il motore è quello di Dino Giungla — scene, salvataggi per profilo, HUD, audio
sintetizzato, voce italiana, PWA, service worker network-first, deploy su GitHub
Pages via Actions — con le scene buttate e le chiavi di `localStorage` cambiate
da `dg.` a `dk.`, così i due giochi non si pestano i piedi sullo stesso tablet.

```
src/00-core.js       il motore (invariato rispetto a Dino Giungla)
src/01-art-kart.js   il kart di spalle, e le tre cose che si tirano
src/03-profili.js    chi guida: piloti, segreto a figure, colore, cancello
src/05-menu.js       pista, difficoltà, VIA
src/10-pista.js      la strada pseudo-3D, la guida, gli avversari, le armi, la gara
src/99-boot.js       avvio: si comincia da "chi guida?"
```

```
test/smoke.js    collaudo headless: guida, e controlla i numeri
test/look.js     collaudo a occhio: disegna, e controlla i pixel
test/raster.js   la canvas 2D software che serve a look.js
```

```bash
node build.js       # ricostruisce index.html + sw.js
node test/smoke.js  # collaudo headless
node test/look.js   # collaudo a occhio, scrive test/frames/*.png
```
