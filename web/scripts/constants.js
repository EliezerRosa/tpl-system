export const CLASSIFICATIONS = Object.freeze({
  ANCIOS: "anciãos",
  SERVOS: "servos ministeriais",
  GERAIS: "participantes gerais",
});

export const PARTICIPATION_STATUS = Object.freeze({
  ACTIVE: "ativo",
  ABSENT: "ausente",
  SUBSTITUTE: "substituto",
});

export const OBJECTIVES = Object.freeze({
  PRELETOR: "preletores",
  AUXILIAR: "auxiliares",
  VISITANTE: "visitantes",
  LEITOR: "leitores",
  AUDIO_VIDEO: "áudio/vídeo",
});

export const DEFAULT_PERMISSIONS = Object.freeze({
  [CLASSIFICATIONS.ANCIOS]: {
    podeDirigir: true,
    podeEnsinar: true,
    podeAuxiliar: true,
    podeVisitar: true,
  },
  [CLASSIFICATIONS.SERVOS]: {
    podeDirigir: false,
    podeEnsinar: true,
    podeAuxiliar: true,
    podeVisitar: true,
  },
  [CLASSIFICATIONS.GERAIS]: {
    podeDirigir: false,
    podeEnsinar: false,
    podeAuxiliar: true,
    podeVisitar: true,
  },
});

export const STORAGE_KEY = "rvm.participants";
