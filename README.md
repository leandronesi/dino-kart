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

## La gara

Per un po' questo è stato solo un simulatore di strada: aprivi e ti trovavi già
in corsa, senza un momento in cui cominciava e senza uno in cui finiva. Adesso
c'è la cornice, ed è quella che lo rende un gioco.

- **Menu**: scegli la pista e la difficoltà, poi **VIA!**
  - *Facile* — 2 giri, avversari all'86%
  - *Corsa* — 3 giri, avversari al 100%
- **Semaforo**: tre luci, e finché sono accese il kart sta fermo.
- **Durante**: giro, posizione, tempo sul giro e velocità. Quattro numeri, non uno
  di più — un cruscotto un bambino di sei anni non lo legge.
- **Arrivo**: l'ordine completo dei sei kart, il tuo posto, il giro migliore
  salvato per pista, e due tasti: *Ancora!* e *Menu*.

Un giro dura una ventina di secondi, una gara fra i 40 e i 60. La posizione è
vera: conta la strada percorsa, niente aggiustamenti nascosti. Nessun avversario
è più veloce di te a tavoletta — guidando bene si vince, guidando male si perde,
e passando un quarto di gara sull'erba si arriva ultimi.

## Derapata e casse premio

- **Casse premio**: tre in fila attraverso la strada, ogni due secondi circa.
  Passarci dentro dà una spinta, e basta: niente inventario, niente tasto da
  premere. Un oggetto da usare vorrebbe un dito, e i diti sono già occupati a
  sterzare. **Le prendono anche gli avversari** — senza quello non è un
  potenziamento, è un regalo che rende la gara una passeggiata.
- **Derapata**: tieni il dito da un lato in curva. Le scintille passano da
  bianche a azzurre a arancioni; molli, e parti. Caricarla non costa niente che
  un bambino di tre anni non stesse già facendo — tenere premuto *è* come
  sterza. La bimba grande scoprirà che la tenuta lunga paga il doppio, e quello
  è il suo gioco in più.

## Le due piste

| | carattere | giro |
|---|---|---|
| **La Collina** | prati e saliscendi, curvoni aperti su cui ti appoggi | ~19s |
| **La Spiaggia** | stretta e nervosa: più curve, meno strada in mezzo, e una sinistra lunga in fondo | ~17s |

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
pilota passivo passa il 39% della gara sull'erba e arriva ultimo, e chi sterza
resta pulito e vince.

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
src/01-art-kart.js   il kart visto di spalle — una sola angolazione, più il lean
src/05-menu.js       pista, difficoltà, VIA
src/10-pista.js      la strada pseudo-3D, la guida, gli avversari, la gara
src/99-boot.js       avvio: profilo silenzioso e via al menu
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
