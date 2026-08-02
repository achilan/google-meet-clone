import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";

// Valor centinela de `className` para "desenfocar el propio fondo" (sin imagen).
// Distinto de "" (que significa "sin fondo / desactivado").
export const BLUR_BACKGROUND = "blur";

// Base de los assets (wasm + modelo) de MediaPipe.
// Por defecto se auto-hospedan desde `public/mediapipe/selfie_segmentation`
// (copiados desde node_modules) para NO depender de una red externa en runtime
// — importante en una app médica embebida en un iframe. Se puede sobreescribir
// con REACT_APP_MEDIAPIPE_BASE (p. ej. apuntando de nuevo al CDN si se prefiere).
const MEDIAPIPE_BASE =
  process.env.REACT_APP_MEDIAPIPE_BASE ||
  `${process.env.PUBLIC_URL || ""}/mediapipe/selfie_segmentation`;

/**
 * Procesa el video de UNA sola fuente (la cámara local) reemplazando el fondo,
 * y expone el resultado como un MediaStream vía canvas.captureStream().
 *
 * Diseño clave frente a la implementación anterior:
 *  - Una única instancia de SelfieSegmentation por procesador (no se comparte
 *    entre participantes) y `onResults` se registra UNA vez, no por frame.
 *  - La segmentación ocurre en el EMISOR: el track ya compuesto se envía por
 *    WebRTC, así que los receptores no re-segmentan nada.
 *  - Bombeo de frames con requestVideoFrameCallback (solo frames nuevos) y
 *    pausa automática cuando la pestaña queda oculta.
 *  - Bordes suavizados (feathering) + suavizado temporal para reducir el flicker.
 */
export class BackgroundProcessor {
  constructor(options = {}) {
    this.fps = options.fps || 24;
    this.feather = options.feather != null ? options.feather : 6; // px de blur en el borde
    this.smoothing = options.smoothing != null ? options.smoothing : 0.5; // 0..1 mezcla temporal
    this.backgroundImage = null;

    this._running = false;
    this._paused = false;
    this._sending = false;
    this._frameHandle = null;
    this._usesRVFC = false;
    this._outputStream = null;

    // Video oculto que alimenta el pipeline con la cámara cruda.
    this.inputVideo = document.createElement("video");
    this.inputVideo.muted = true;
    this.inputVideo.playsInline = true;
    this.inputVideo.autoplay = true;

    // Lienzos de trabajo.
    this.outputCanvas = document.createElement("canvas"); // salida final (captureStream)
    this.outputCtx = this.outputCanvas.getContext("2d");
    this.maskCanvas = document.createElement("canvas"); // máscara suavizada del frame actual
    this.maskCtx = this.maskCanvas.getContext("2d");
    this.prevMaskCanvas = document.createElement("canvas"); // máscara del frame anterior (EMA)
    this.prevMaskCtx = this.prevMaskCanvas.getContext("2d");

    this._resize(640, 480);

    this.segmentation = new SelfieSegmentation({
      locateFile: (file) => `${MEDIAPIPE_BASE}/${file}`,
    });
    // modelSelection 0 = modelo general (256x256), mejor calidad para webcam frontal.
    this.segmentation.setOptions({ modelSelection: 0, selfieMode: false });
    this.segmentation.onResults(this._onResults.bind(this)); // registrado UNA sola vez

    this._onVisibility = this._onVisibility.bind(this);
    document.addEventListener("visibilitychange", this._onVisibility);
  }

  _resize(w, h) {
    if (!w || !h) return;
    [
      this.outputCanvas,
      this.maskCanvas,
      this.prevMaskCanvas,
    ].forEach((c) => {
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
    });
  }

  /** Conecta la cámara cruda como entrada del procesador. */
  async setInputStream(stream) {
    this._inputStream = stream;
    this.inputVideo.srcObject = stream;
    try {
      await this.inputVideo.play();
    } catch (e) {
      /* autoplay puede fallar silenciosamente; el pump reintenta */
    }
    const track = stream.getVideoTracks()[0];
    const settings = track && track.getSettings ? track.getSettings() : {};
    const w = settings.width || this.inputVideo.videoWidth || 640;
    const h = settings.height || this.inputVideo.videoHeight || 480;
    this._resize(w, h);
  }

  /** Carga la imagen de fondo (o null para usar el propio video desenfocado). */
  async setBackgroundImage(url) {
    if (!url) {
      this.backgroundImage = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
      img.src = url;
    });
    this.backgroundImage = img.complete && img.naturalWidth > 0 ? img : null;
  }

  /** MediaStream de salida (video compuesto). Estable entre activaciones. */
  getOutputStream() {
    if (!this._outputStream) {
      this._outputStream = this.outputCanvas.captureStream(this.fps);
    }
    return this._outputStream;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._paused = document.hidden;
    if (!this._paused) this._pump();
  }

  stop() {
    this._running = false;
    if (this._frameHandle != null) {
      if (this._usesRVFC && this.inputVideo.cancelVideoFrameCallback) {
        this.inputVideo.cancelVideoFrameCallback(this._frameHandle);
      } else {
        clearTimeout(this._frameHandle);
      }
      this._frameHandle = null;
    }
  }

  /** Libera todos los recursos. */
  destroy() {
    this.stop();
    document.removeEventListener("visibilitychange", this._onVisibility);
    try {
      this.segmentation.close();
    } catch (e) {
      /* noop */
    }
    if (this._outputStream) {
      this._outputStream.getTracks().forEach((t) => t.stop());
      this._outputStream = null;
    }
    this.inputVideo.srcObject = null;
  }

  _onVisibility() {
    if (document.hidden) {
      this._paused = true;
    } else if (this._running && this._paused) {
      this._paused = false;
      this._pump();
    }
  }

  _pump() {
    if (!this._running || this._paused) return;

    const process = async () => {
      if (!this._running || this._paused) return;
      if (!this._sending && this.inputVideo.readyState >= 2) {
        this._sending = true;
        try {
          await this.segmentation.send({ image: this.inputVideo });
        } catch (e) {
          /* reintenta en el próximo frame */
        } finally {
          this._sending = false;
        }
      }
      this._schedule(process);
    };

    this._schedule(process);
  }

  _schedule(cb) {
    if (typeof this.inputVideo.requestVideoFrameCallback === "function") {
      this._usesRVFC = true;
      this._frameHandle = this.inputVideo.requestVideoFrameCallback(() => cb());
    } else {
      this._usesRVFC = false;
      this._frameHandle = setTimeout(cb, 1000 / this.fps);
    }
  }

  _onResults(results) {
    if (!this._running) return;
    const w = this.outputCanvas.width;
    const h = this.outputCanvas.height;
    if (!w || !h || !results.segmentationMask) return;

    // 1) Máscara suavizada: feathering (blur del borde) + mezcla temporal (EMA)
    //    con la máscara del frame anterior para reducir el parpadeo.
    const mctx = this.maskCtx;
    mctx.save();
    mctx.globalCompositeOperation = "source-over";
    mctx.clearRect(0, 0, w, h);
    mctx.filter = this.feather ? `blur(${this.feather}px)` : "none";
    mctx.globalAlpha = this.smoothing;
    mctx.drawImage(this.prevMaskCanvas, 0, 0, w, h);
    mctx.globalAlpha = 1 - this.smoothing;
    mctx.drawImage(results.segmentationMask, 0, 0, w, h);
    mctx.restore();

    // Guardar como "anterior" para el próximo frame.
    this.prevMaskCtx.globalCompositeOperation = "copy";
    this.prevMaskCtx.clearRect(0, 0, w, h);
    this.prevMaskCtx.drawImage(this.maskCanvas, 0, 0, w, h);

    // 2) Composición final en el lienzo de salida:
    //    máscara (alpha = persona) -> persona recortada -> fondo detrás.
    const octx = this.outputCtx;
    octx.save();
    octx.globalCompositeOperation = "source-over";
    octx.clearRect(0, 0, w, h);

    // La máscara aporta el canal alpha (persona opaca, fondo transparente).
    octx.drawImage(this.maskCanvas, 0, 0, w, h);

    // Mantener el video sólo donde hay persona.
    octx.globalCompositeOperation = "source-in";
    octx.drawImage(results.image, 0, 0, w, h);

    // Rellenar el fondo POR DETRÁS de la persona.
    octx.globalCompositeOperation = "destination-over";
    if (this.backgroundImage) {
      this._drawCover(octx, this.backgroundImage, w, h);
    } else {
      // Sin imagen: fondo del propio video desenfocado.
      octx.filter = "blur(12px)";
      octx.drawImage(results.image, 0, 0, w, h);
      octx.filter = "none";
    }
    octx.restore();
  }

  /** Dibuja una imagen cubriendo el lienzo (object-fit: cover). */
  _drawCover(ctx, img, w, h) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
}
