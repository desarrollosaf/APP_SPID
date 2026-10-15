export const environment = {
  production: true,
  apiUrl: 'https://parlamentario.congresoedomex.gob.mx/api',
  socketUrl: 'https://parlamentario.congresoedomex.gob.mx',
  socketPath: '/socket.io',

  // Módulo de Presidencia (portado de SIPresidencia)
  presidencia: {
    // Usuarios con acceso, por correo o nombre completo (sin importar acentos ni mayúsculas).
    usuarios: ['paco.vazquez@legislativoedomex.gob.mx'],
    agendaApiUrl: 'https://administracionyfinanzasplem.gob.mx/Documentacion/api/agenda',
    // Pad del Roland P-6 que toca el botón "Notificar al congreso".
    p6Pad: { bank: 'A', pad: 1 },
  },
};
