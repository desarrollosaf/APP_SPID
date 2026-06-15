export interface DiputadoPerfil {
  id: string;
  apaterno: string;
  amaterno: string;
  nombres: string;
  email: string;
}

export interface IntegranteLegislatura {
  id: string;
  diputado_id: string;
  diputado: DiputadoPerfil;
}

export interface UserBackend {
  id: string;
  name: string;
  nombreCompleto?: string;
  email: string;
  integrante_legislatura_id: string | null;
}

export interface Users {
  user: UserBackend;
  bandera: boolean;
  role: string;
  token: string;
  // Campos calculados en el cliente
  nombre?: string;
  integrante_legislatura_id?: string | null;
}

export interface MiComision {
  id: string;
  nombre: string;
  cargo: string;
  nivel: number;
}

export interface EstadoPanel {
  asistencia: {
    idComision: string;
    idAgenda: string;
    yaRegistro: boolean;
    descripcion: string;
    fecha: string;
  } | null;
  votacion: {
    idComision: string;
    idAgenda: string;
    punto: any;
    id_voto_punto: string;
    yaVoto: boolean;
    sentidoActual: number | null;
    descripcion: string;
    fecha: string;
    idPunto?: string | null;
    idReserva?: string | null;
    idIniciativa?: string | null;
  } | null;
}
