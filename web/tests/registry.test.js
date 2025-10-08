import test from "node:test";
import assert from "node:assert/strict";

import {
  ParticipantRegistry,
  CLASSIFICATIONS,
  PARTICIPATION_STATUS,
  OBJECTIVES,
  SAMPLE_PARTICIPANTS,
} from "../scripts/registry.js";
import { StorageProvider, createInMemoryStorage } from "../scripts/storage.js";

const createRegistry = (seed) =>
  new ParticipantRegistry({
    storageProvider: new StorageProvider({
      storage: createInMemoryStorage(
        seed ? { "rvm.participants": JSON.stringify(seed) } : undefined,
      ),
    }),
  });

test("carrega participantes de exemplo quando não há dados persistidos", () => {
  const registry = createRegistry();
  const participants = registry.all();

  assert.equal(participants.length, SAMPLE_PARTICIPANTS.length);
  assert.ok(participants.every((item) => Array.isArray(item.objectives)));
});

test("permite cadastrar novo participante com classificações e objetivos", () => {
  const registry = createRegistry();
  const novo = registry.addParticipant({
    name: "Teste Automatizado",
    classification: CLASSIFICATIONS.GERAIS,
    status: PARTICIPATION_STATUS.ACTIVE,
    objectives: [OBJECTIVES.VISITANTE],
    notes: "Caso de teste",
  });

  const stored = registry.all().find((item) => item.id === novo.id);

  assert.ok(novo.id.startsWith("p-") || novo.id.length > 10);
  assert.equal(stored?.classification, CLASSIFICATIONS.GERAIS);
  assert.deepEqual(stored?.objectives, [OBJECTIVES.VISITANTE]);
  assert.equal(stored?.status, PARTICIPATION_STATUS.ACTIVE);
});

test("gera recomendações para ausências usando substitutos cadastrados", () => {
  const seed = [
    {
      id: "ativo-1",
      name: "Ativo 1",
      classification: CLASSIFICATIONS.ANCIOS,
      status: PARTICIPATION_STATUS.ACTIVE,
      objectives: [OBJECTIVES.PRELETOR],
    },
    {
      id: "ausente-1",
      name: "Ausente",
      classification: CLASSIFICATIONS.ANCIOS,
      status: PARTICIPATION_STATUS.ABSENT,
      objectives: [OBJECTIVES.PRELETOR],
    },
    {
      id: "substituto-1",
      name: "Substituto",
      classification: CLASSIFICATIONS.SERVOS,
      status: PARTICIPATION_STATUS.SUBSTITUTE,
      objectives: [OBJECTIVES.PRELETOR],
    },
  ];

  const registry = createRegistry(seed);
  const adjustment = registry.generateScheduleAdjustments({
    objective: OBJECTIVES.PRELETOR,
    required: 2,
    date: "2025-10-08",
    specialDemand: "Reunião de assembleia",
  });

  assert.equal(adjustment.available, 1);
  assert.equal(adjustment.shortage, 1);
  assert.equal(adjustment.absent.length, 1);
  assert.equal(adjustment.suggestions.length, 1);
  assert.equal(adjustment.suggestions[0].name, "Substituto");
  assert.equal(adjustment.specialDemand, "Reunião de assembleia");
});

test("atualiza status e persiste mudanças", () => {
  const registry = createRegistry();
  const [first] = registry.all();

  registry.updateStatus(first.id, PARTICIPATION_STATUS.ABSENT);
  const updated = registry.all().find((item) => item.id === first.id);

  assert.equal(updated.status, PARTICIPATION_STATUS.ABSENT);
});
