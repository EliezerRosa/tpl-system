import unittest
from datetime import date, timedelta

from rvm.participants import (
    AdjustmentEvent,
    AdjustmentType,
    Objective,
    ParticipationStatus,
    ProgramAdjuster,
    load_demo_data,
)


class ParticipantRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.registry = load_demo_data()

    def test_list_by_objective_orders_by_priority(self) -> None:
        speakers = self.registry.list_by_objective(Objective.PRELETOR)
        self.assertGreaterEqual(len(speakers), 1)
        # A lista deve estar ordenada por prioridade da classificação.
        priorities = [participant.classification.priority for participant in speakers]
        self.assertEqual(priorities, sorted(priorities))

    def test_update_status_marks_participant_absent(self) -> None:
        participant = self.registry.list_all()[0]
        self.registry.update_status(participant.participant_id, ParticipationStatus.ABSENT)
        self.assertEqual(participant.status, ParticipationStatus.ABSENT)


class ProgramAdjusterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.registry = load_demo_data()
        self.adjuster = ProgramAdjuster(self.registry)
        self.reference_date = date.today()

    def test_absence_generates_high_priority_action(self) -> None:
        participant = self.registry.list_all()[0]
        event = AdjustmentEvent(
            event_type=AdjustmentType.ABSENCE,
            description="Ausência por viagem",
            effective_date=self.reference_date + timedelta(days=1),
            participant_id=participant.participant_id,
        )
        actions = self.adjuster.propose_adjustments([event], reference_date=self.reference_date)
        self.assertTrue(actions)
        self.assertEqual(actions[0].priority, 0)
        self.assertIn(participant.full_name, actions[0].message)

    def test_substitution_generates_confirmation(self) -> None:
        absent, substitute = self.registry.list_all()[:2]
        event = AdjustmentEvent(
            event_type=AdjustmentType.SUBSTITUTION,
            description="Substituição programada",
            effective_date=self.reference_date + timedelta(days=3),
            participant_id=absent.participant_id,
            substitute_participant_id=substitute.participant_id,
        )
        actions = self.adjuster.propose_adjustments([event], reference_date=self.reference_date)
        self.assertTrue(any(substitute.full_name in action.message for action in actions))


if __name__ == "__main__":
    unittest.main()
