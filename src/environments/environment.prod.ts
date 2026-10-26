export const environment = {
  production: true,
  apiUrl: 'https://parlamentario.congresoedomex.gob.mx/api',
  socketUrl: 'https://parlamentario.congresoedomex.gob.mx',
  socketPath: '/socket.io',

  // Transmisión que se muestra en la pestaña Sesión mientras hay sesión en curso.
  // Acepta cualquier enlace de YouTube (watch?v=, youtu.be/, /live/). Vacío = sin video.
  sesionVideoUrl: 'https://www.youtube.com/watch?v=XaqTPouuyE4',

  // Módulo de Presidencia (portado de SIPresidencia)
  presidencia: {
    // La vista de Presidencia la ve quien preside la Junta de Coordinación Política (se detecta solo).
    agendaApiUrl: 'https://administracionyfinanzasplem.gob.mx/Documentacion/backend/api/agenda',
    // Backend de SIPresidencia para el botón "Notificar al congreso" (Roland P-6).
    // En producción va con el /api de su nginx, p. ej. https://<servidor-sipresidencia>/api
    sipApiUrl: 'https://presidencia.congresoedomex.gob.mx/api',
  },
};
