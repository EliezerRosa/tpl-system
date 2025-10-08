import {
  CLASSIFICATIONS,
  PARTICIPATION_STATUS,
  OBJECTIVES,
  DEFAULT_PERMISSIONS,
} from "./constants.js";
import { StorageProvider, createInMemoryStorage } from "./storage.js";

const classificationPriority = [
  CLASSIFICATIONS.ANCIOS,
  CLASSIFICATIONS.SERVOS,
  CLASSIFICATIONS.GERAIS,
];

const objectivePriority = Object.values(OBJECTIVES);

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sanitiseObjectives = (objectives) => {
  if (!Array.isArray(objectives)) {
    return [];
  }
  const allowed = new Set(Object.values(OBJECTIVES));
  const unique = new Set();
  objectives.forEach((item) => {
    if (allowed.has(item)) {
      unique.add(item);
    }
  });
  return [...unique];
};

export const SAMPLE_PARTICIPANTS = [
  {
    id: "p-anci-1",
    name: "Carlos Alberto",
    classification: CLASSIFICATIONS.ANCIOS,
    status: PARTICIPATION_STATUS.ACTIVE,
    objectives: [OBJECTIVES.PRELETOR, OBJECTIVES.AUXILIAR],
    permissions: DEFAULT_PERMISSIONS[CLASSIFICATIONS.ANCIOS],
    notes: "Preferência por discursos iniciais",
  },
  {
    id: "p-servo-1",
    name: "Marcos Pereira",
    classification: CLASSIFICATIONS.SERVOS,
    status: PARTICIPATION_STATUS.ACTIVE,
    objectives: [OBJECTIVES.AUXILIAR, OBJECTIVES.AUDIO_VIDEO],
    permissions: DEFAULT_PERMISSIONS[CLASSIFICATIONS.SERVOS],
    notes: "Opera a projeção quando necessário",
  },
  {
    id: "p-geral-1",
    name: "Ana Souza",
    classification: CLASSIFICATIONS.GERAIS,
    status: PARTICIPATION_STATUS.SUBSTITUTE,
    objectives: [OBJECTIVES.VISITANTE, OBJECTIVES.LEITOR],
    permissions: DEFAULT_PERMISSIONS[CLASSIFICATIONS.GERAIS],
    notes: "Disponível para leituras de última hora",
  },
  {
    id: "p-anci-2",
    name: "João Batista",
    classification: CLASSIFICATIONS.ANCIOS,
    status: PARTICIPATION_STATUS.ABSENT,
    objectives: [OBJECTIVES.PRELETOR],
    permissions: DEFAULT_PERMISSIONS[CLASSIFICATIONS.ANCIOS],
    notes: "Ausente nas próximas 2 semanas",
  },
];

const buildPermissions = (classification, overrides = {}) => ({
  ...DEFAULT_PERMISSIONS[classification],
  ...overrides,
});

const normaliseParticipant = (raw) => {
  const {
    id = generateId(),
    name,
    classification,
    status = PARTICIPATION_STATUS.ACTIVE,
    objectives = [],
    permissions,
    notes = "",
  } = raw;

  if (!name || !classification) {
    throw new Error("Nome e classificação são obrigatórios");
  }

  if (!Object.values(CLASSIFICATIONS).includes(classification)) {
    throw new Error(`Classificação inválida: ${classification}`);
  }

  if (!Object.values(PARTICIPATION_STATUS).includes(status)) {
    throw new Error(`Status inválido: ${status}`);
  }

  return {
    id,
    name: name.trim(),
    classification,
    status,
    objectives: sanitiseObjectives(objectives),
    permissions: permissions || buildPermissions(classification),
    notes,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const sortByPriority = (collection, getter, priorityOrder) => {
  const weights = new Map(priorityOrder.map((value, index) => [value, index]));
  return [...collection].sort((a, b) => {
    const weightA = weights.get(getter(a)) ?? priorityOrder.length;
    const weightB = weights.get(getter(b)) ?? priorityOrder.length;
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
  });
};

export class ParticipantRegistry {
  constructor({ storageProvider } = {}) {
    this.storage =
      storageProvider ?? new StorageProvider({ storage: getDefaultStorage() });
    this.participants = [];
    this.load();
  }

  load() {
    const stored = this.storage.read();
    if (Array.isArray(stored) && stored.length > 0) {
      this.participants = stored.map((item) => ({
        ...item,
        objectives: sanitiseObjectives(item.objectives),
      }));
      return;
    }

    this.participants = this.storage.seed(SAMPLE_PARTICIPANTS);
  }

  save() {
    this.storage.write(this.participants);
  }

  all() {
    return [...this.participants];
  }

  addParticipant(rawParticipant) {
    const participant = normaliseParticipant(rawParticipant);
    this.participants = sortByPriority(
      [...this.participants.filter((item) => item.id !== participant.id), participant],
      (item) => item.classification,
      classificationPriority,
    );
    this.save();
    return participant;
  }

  updateParticipant(id, updates) {
    const index = this.participants.findIndex((participant) => participant.id === id);
    if (index === -1) {
      throw new Error(`Participante não encontrado: ${id}`);
    }
    const existing = this.participants[index];
    const merged = normaliseParticipant({
      ...existing,
      ...updates,
      id,
      createdAt: existing.createdAt,
    });
    this.participants.splice(index, 1, merged);
    this.participants = sortByPriority(
      this.participants,
      (item) => item.classification,
      classificationPriority,
    );
    this.save();
    return merged;
  }

  updateStatus(id, status) {
    if (!Object.values(PARTICIPATION_STATUS).includes(status)) {
      throw new Error(`Status inválido: ${status}`);
    }
    return this.updateParticipant(id, { status });
  }

  assignObjectives(id, objectives) {
    return this.updateParticipant(id, { objectives: sanitiseObjectives(objectives) });
  }

  setCustomPermissions(id, overrides) {
    const participant = this.participants.find((item) => item.id === id);
    if (!participant) {
      throw new Error(`Participante não encontrado: ${id}`);
    }
    const permissions = buildPermissions(participant.classification, overrides);
    return this.updateParticipant(id, { permissions });
  }

  getParticipantsByClassification(classification) {
    return sortByPriority(
      this.participants.filter((item) => item.classification === classification),
      (item) => item.status,
      [
        PARTICIPATION_STATUS.ACTIVE,
        PARTICIPATION_STATUS.SUBSTITUTE,
        PARTICIPATION_STATUS.ABSENT,
      ],
    );
  }

  getParticipantsByObjective(objective) {
    if (!objectivePriority.includes(objective)) {
      throw new Error(`Objetivo inválido: ${objective}`);
    }
    const filtered = this.participants.filter((participant) =>
      participant.objectives.includes(objective),
    );
    return sortByPriority(filtered, (item) => item.classification, classificationPriority);
  }

  getObjectivesWithParticipants() {
    return objectivePriority.map((objective) => ({
      objective,
      participants: this.getParticipantsByObjective(objective),
    }));
  }

  generateScheduleAdjustments({
    objective,
    date,
    required = 1,
    specialDemand = "",
  }) {
    if (!objectivePriority.includes(objective)) {
      throw new Error("Informe um objetivo válido para gerar ajustes");
    }

    const eventDate = date ? new Date(date) : new Date();
    const assigned = this.getParticipantsByObjective(objective);
    const active = assigned.filter(
      (participant) => participant.status === PARTICIPATION_STATUS.ACTIVE,
    );
    const absent = assigned.filter(
      (participant) => participant.status === PARTICIPATION_STATUS.ABSENT,
    );
    const substitutes = this.participants.filter(
      (participant) =>
        participant.status === PARTICIPATION_STATUS.SUBSTITUTE &&
        participant.objectives.includes(objective),
    );

    const shortage = Math.max(0, required - active.length);

    const suggestions = shortage
      ? substitutes.slice(0, shortage).map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          classification: candidate.classification,
        }))
      : [];

    return {
      objective,
      date: eventDate.toISOString().split("T")[0],
      required,
      available: active.length,
      shortage,
      absent: absent.map((item) => ({ id: item.id, name: item.name })),
      suggestions,
      specialDemand,
      message:
        shortage === 0
          ? "Equipe suficiente para o objetivo selecionado."
          : `Faltam ${shortage} participante(s). Sugestões de substituição listadas acima.`,
    };
  }

  resetToSampleData() {
    this.participants = SAMPLE_PARTICIPANTS.map((participant) => ({
      ...participant,
      objectives: [...participant.objectives],
      permissions: { ...participant.permissions },
    }));
    this.save();
  }
}

const getDefaultStorage = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return createInMemoryStorage();
};

export const createTestRegistry = (seed = SAMPLE_PARTICIPANTS) =>
  new ParticipantRegistry({
    storageProvider: new StorageProvider({
      storage: createInMemoryStorage({
        "rvm.participants": JSON.stringify(seed),
      }),
    }),
  });

export { CLASSIFICATIONS, PARTICIPATION_STATUS, OBJECTIVES };
