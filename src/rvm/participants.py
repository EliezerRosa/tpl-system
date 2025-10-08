"""Módulo de cadastro e classificação de participantes da Reunião Vida e Ministério (RVM).

O objetivo é fornecer uma base sólida para registrar participantes, acompanhar o status
(e.g., ativo, ausente, substituto) e oferecer mecanismos simples para ajustar a
programação diante de eventos periódicos ou demandas especiais.

As estruturas aqui definidas são pensadas para evoluir futuramente para o controle das
partes designadas na reunião.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum, auto
from typing import Dict, Iterable, List, Optional, Set, Tuple
from uuid import UUID, uuid4


class Classification(Enum):
    """Classificações principais dos participantes."""

    ELDER = "anciãos"
    MINISTERIAL_SERVANT = "servos ministeriais"
    GENERAL_PARTICIPANT = "participantes gerais"

    @property
    def priority(self) -> int:
        """Determina a prioridade na ordenação das designações."""
        priorities = {
            Classification.ELDER: 0,
            Classification.MINISTERIAL_SERVANT: 1,
            Classification.GENERAL_PARTICIPANT: 2,
        }
        return priorities[self]

    def default_objectives(self) -> Set[Objective]:
        """Sugere objetivos mais frequentes para cada classificação."""
        mapping = {
            Classification.ELDER: {Objective.PRELETOR, Objective.AUXILIAR},
            Classification.MINISTERIAL_SERVANT: {Objective.AUXILIAR},
            Classification.GENERAL_PARTICIPANT: {Objective.VISITANTE},
        }
        return set(mapping[self])


class ParticipationStatus(Enum):
    """Status atuais de participação na reunião."""

    ACTIVE = "ativo"
    ABSENT = "ausente"
    SUBSTITUTE = "substituto"


class Objective(Enum):
    """Objetivos/participações associadas às partes da reunião."""

    PRELETOR = "preletor"
    AUXILIAR = "auxiliar"
    VISITANTE = "visitante"
    LEITURA = "leitura"
    DEMONSTRACAO = "demonstração"


class Permission(Enum):
    """Permissões de participação que podem ser expandidas futuramente."""

    ASSIGN_TALKS = auto()
    SUPPORT_STUDIES = auto()
    HOST_VISITORS = auto()
    PARTICIPATE_AS_STUDENT = auto()
    OBSERVE_ONLY = auto()


# Matriz de permissões base para cada classificação.
PERMISSION_MATRIX: Dict[Classification, Set[Permission]] = {
    Classification.ELDER: {
        Permission.ASSIGN_TALKS,
        Permission.SUPPORT_STUDIES,
        Permission.HOST_VISITORS,
    },
    Classification.MINISTERIAL_SERVANT: {
        Permission.SUPPORT_STUDIES,
        Permission.HOST_VISITORS,
    },
    Classification.GENERAL_PARTICIPANT: {
        Permission.PARTICIPATE_AS_STUDENT,
        Permission.OBSERVE_ONLY,
    },
}


@dataclass
class Participant:
    """Representa um participante cadastrado na RVM."""

    full_name: str
    classification: Classification
    objectives: Set[Objective] = field(default_factory=set)
    status: ParticipationStatus = ParticipationStatus.ACTIVE
    permissions: Set[Permission] = field(default_factory=set)
    notes: Optional[str] = None
    participant_id: UUID = field(default_factory=uuid4, init=False)

    def __post_init__(self) -> None:
        # Garante que objetivos e permissões tenham valores padrão coerentes.
        if not self.objectives:
            self.objectives = self.classification.default_objectives()
        if not self.permissions:
            self.permissions = set(PERMISSION_MATRIX[self.classification])

    def assign_objective(self, objective: Objective) -> None:
        """Adiciona um objetivo ao conjunto de compromissos do participante."""
        self.objectives.add(objective)

    def revoke_objective(self, objective: Objective) -> None:
        """Remove um objetivo quando não for mais necessário."""
        self.objectives.discard(objective)

    def update_status(self, new_status: ParticipationStatus) -> None:
        """Atualiza o status do participante."""
        self.status = new_status


class ParticipantRegistry:
    """Centraliza o cadastro e consultas de participantes."""

    def __init__(self) -> None:
        self._participants: Dict[UUID, Participant] = {}

    def register(self, participant: Participant) -> UUID:
        """Adiciona um participante já instanciado ao cadastro."""
        self._participants[participant.participant_id] = participant
        return participant.participant_id

    def register_participant(
        self,
        *,
        full_name: str,
        classification: Classification,
        objectives: Optional[Iterable[Objective]] = None,
        status: ParticipationStatus = ParticipationStatus.ACTIVE,
        permissions: Optional[Iterable[Permission]] = None,
        notes: Optional[str] = None,
    ) -> UUID:
        """Cria e registra um novo participante."""
        participant = Participant(
            full_name=full_name,
            classification=classification,
            objectives=set(objectives or set()),
            status=status,
            permissions=set(permissions or set()),
            notes=notes,
        )
        return self.register(participant)

    def get(self, participant_id: UUID) -> Participant:
        """Obtém um participante por ID ou lança KeyError se não existir."""
        return self._participants[participant_id]

    def list_all(self) -> List[Participant]:
        """Retorna todos os participantes cadastrados ordenados por prioridade."""
        return sorted(
            self._participants.values(),
            key=lambda p: (p.classification.priority, p.full_name.lower()),
        )

    def list_by_objective(self, objective: Objective) -> List[Participant]:
        """Lista participantes que possuem determinado objetivo."""
        return [
            participant
            for participant in self.list_all()
            if objective in participant.objectives
        ]

    def list_by_status(self, status: ParticipationStatus) -> List[Participant]:
        """Lista participantes filtrados pelo status atual."""
        return [
            participant
            for participant in self.list_all()
            if participant.status == status
        ]

    def update_status(self, participant_id: UUID, new_status: ParticipationStatus) -> None:
        """Atualiza o status de um participante específico."""
        participant = self.get(participant_id)
        participant.update_status(new_status)

    def participants_summary(self) -> List[Tuple[str, str, str]]:
        """Retorna um resumo útil para exibição em relatórios."""
        return [
            (
                p.full_name,
                p.classification.value,
                p.status.value,
            )
            for p in self.list_all()
        ]


class AdjustmentType(Enum):
    """Tipos de eventos que disparam ajustes na programação."""

    PERIODIC_EVENT = "evento periódicos"
    ABSENCE = "ausência"
    SUBSTITUTION = "substituição"
    SPECIAL_DEMAND = "demanda especial"


@dataclass
class AdjustmentEvent:
    """Representa uma ocorrência que pode exigir ajuste na programação."""

    event_type: AdjustmentType
    description: str
    effective_date: date
    participant_id: Optional[UUID] = None
    substitute_participant_id: Optional[UUID] = None
    recurrence: Optional[str] = None  # e.g., "mensal", "trimestral"

    def is_future_event(self, reference: Optional[date] = None) -> bool:
        reference = reference or date.today()
        return self.effective_date >= reference


@dataclass
class AdjustmentAction:
    """Descreve uma ação sugerida para ajustar a programação."""

    message: str
    priority: int = 1  # 0 = alta, 1 = média, 2 = baixa


class ProgramAdjuster:
    """Aplica critérios simples para gerar sugestões de ajuste da programação."""

    def __init__(self, registry: ParticipantRegistry) -> None:
        self.registry = registry

    def propose_adjustments(
        self, events: Iterable[AdjustmentEvent], reference_date: Optional[date] = None
    ) -> List[AdjustmentAction]:
        """Recebe eventos e sugere ações corretivas ordenadas por prioridade."""
        reference_date = reference_date or date.today()
        actions: List[AdjustmentAction] = []

        for event in events:
            if not event.is_future_event(reference_date):
                continue

            if event.event_type == AdjustmentType.ABSENCE and event.participant_id:
                participant = self.registry.get(event.participant_id)
                action = AdjustmentAction(
                    message=(
                        f"Reagendar {participant.full_name} (status: ausente) e buscar substituto."
                    ),
                    priority=0,
                )
                actions.append(action)
            elif (
                event.event_type == AdjustmentType.SUBSTITUTION
                and event.participant_id
                and event.substitute_participant_id
            ):
                absent = self.registry.get(event.participant_id)
                substitute = self.registry.get(event.substitute_participant_id)
                action = AdjustmentAction(
                    message=(
                        f"Confirmar {substitute.full_name} como substituto de {absent.full_name}"
                        f" na data {event.effective_date:%d/%m/%Y}."
                    ),
                    priority=0,
                )
                actions.append(action)
            elif event.event_type == AdjustmentType.PERIODIC_EVENT:
                actions.append(
                    AdjustmentAction(
                        message=(
                            "Verificar periodicidade '{evento}' e distribuir partes entre diferentes "
                            "participantes para evitar sobrecarga."
                        ).format(evento=event.recurrence or "indefinida"),
                        priority=1,
                    )
                )
            elif event.event_type == AdjustmentType.SPECIAL_DEMAND:
                actions.append(
                    AdjustmentAction(
                        message=(
                            "Avaliar demanda especial: {descricao}. Ajustar programação e comunicar "
                            "anciãos responsáveis."
                        ).format(descricao=event.description),
                        priority=1,
                    )
                )

        # Ordena ações por prioridade e mantém a ordem relativa para prioridades iguais.
        return sorted(actions, key=lambda a: a.priority)


def load_demo_data() -> ParticipantRegistry:
    """Cria um cadastro exemplo com alguns participantes predefinidos."""
    registry = ParticipantRegistry()

    # Exemplo 1: Ancião preparado para conduzir partes principais.
    registry.register_participant(
        full_name="Fernando Silva",
        classification=Classification.ELDER,
        objectives={Objective.PRELETOR, Objective.AUXILIAR},
        permissions={Permission.ASSIGN_TALKS, Permission.SUPPORT_STUDIES},
        notes="Coordena o comitê de programação mensal.",
    )

    # Exemplo 2: Servo ministerial com foco em apoio logístico.
    registry.register_participant(
        full_name="João Almeida",
        classification=Classification.MINISTERIAL_SERVANT,
        objectives={Objective.AUXILIAR, Objective.DEMONSTRACAO},
        notes="Disponível para substituições de última hora aos domingos.",
    )

    # Exemplo 3: Participante geral interessado em participar como estudante.
    registry.register_participant(
        full_name="Maria Costa",
        classification=Classification.GENERAL_PARTICIPANT,
        objectives={Objective.LEITURA},
        status=ParticipationStatus.SUBSTITUTE,
        notes="Treinando para leitura de relatos.",
    )

    # Exemplo 4: Visitante recorrente que pode ser alocado para demonstrações simples.
    registry.register_participant(
        full_name="Ana Souza",
        classification=Classification.GENERAL_PARTICIPANT,
        objectives={Objective.VISITANTE, Objective.DEMONSTRACAO},
        permissions={Permission.PARTICIPATE_AS_STUDENT},
    )

    return registry
