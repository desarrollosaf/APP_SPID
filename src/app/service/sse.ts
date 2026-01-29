import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class Sse {
  constructor(private zone: NgZone) {}

  streamEvento(): Observable<any> {
    return new Observable(sub => {
      const es = new EventSource('https://spidplem.gob.mx/api/validacionEvento/stream');

      const onEvento = (ev: MessageEvent) => {
        this.zone.run(() => {
          try {
            sub.next(JSON.parse(ev.data));
          } catch {
            sub.next(ev.data);
          }
        });
      };

      es.addEventListener('evento', onEvento);

      // (opcional) si quieres ignorar ping:
      // es.addEventListener('ping', () => {});

      es.onerror = (err) => {
        // OJO: EventSource por default reintenta solo.
        // Si mandas sub.error(err), matas tu observable y ya no se recupera.
        // Mejor solo log, o maneja reconexión tú.
        console.error('SSE error', err);
        // NO hacemos sub.error(err) para permitir que EventSource se recupere
      };

      return () => es.close();
    });
  }
}
