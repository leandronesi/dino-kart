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
e sterzi a sinistra. Niente altro da imparare.

## Com'è organizzato

Il motore è quello di Dino Giungla — scene, salvataggi per profilo, HUD, audio
sintetizzato, voce italiana, PWA, service worker network-first, deploy su GitHub
Pages via Actions — con le scene buttate e le chiavi di `localStorage` cambiate
da `dg.` a `dk.`, così i due giochi non si pestano i piedi sullo stesso tablet.

```
src/00-core.js   il motore (invariato rispetto a Dino Giungla)
src/10-pista.js  la strada pseudo-3D, la guida, il kart
src/99-boot.js   avvio: profilo silenzioso e via in pista
```

```bash
node build.js       # ricostruisce index.html + sw.js
node test/smoke.js  # collaudo headless
```
