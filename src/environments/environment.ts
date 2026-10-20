// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiUrl: 'https://parlamentario.congresoedomex.gob.mx/api',
  socketUrl: 'https://parlamentario.congresoedomex.gob.mx',
  socketPath: '/socket.io',

  // Transmisión que se muestra en la pestaña Sesión mientras hay sesión en curso.
  // Acepta cualquier enlace de YouTube (watch?v=, youtu.be/, /live/). Vacío = sin video.
  sesionVideoUrl: 'https://www.youtube.com/watch?v=XaqTPouuyE4',

  // Módulo de Presidencia (portado de SIPresidencia)
  presidencia: {
    // La vista de Presidencia la ve quien preside la Junta de Coordinación Política (se detecta solo).
    agendaApiUrl: 'https://administracionyfinanzasplem.gob.mx/Documentacion/api/agenda',
    // Backend de SIPresidencia para el botón "Notificar al congreso" (Roland P-6).
    // En producción va con el /api de su nginx, p. ej. https://<servidor-sipresidencia>/api
    sipApiUrl: 'https://presidencia.congresoedomex.gob.mx/api', // SIPresidencia local: http://localhost:3050
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
