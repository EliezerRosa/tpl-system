import {
  ParticipantRegistry,
  OBJECTIVES,
  PARTICIPATION_STATUS,
} from "./registry.js";
import {
  populateClassificationSelect,
  populateStatusSelect,
  populateObjectiveSelect,
  createObjectiveChecklist,
  renderObjectiveLists,
  renderAdjustmentResult,
} from "./ui.js";

const registry = new ParticipantRegistry();

const selectors = {
  form: document.getElementById("participant-form"),
  status: document.getElementById("status"),
  classification: document.getElementById("classification"),
  objectivesContainer: document.getElementById("objectives-options"),
  objectiveLists: document.getElementById("objective-lists"),
  adjustmentForm: document.getElementById("adjustment-form"),
  adjustmentResults: document.getElementById("adjustment-results"),
  eventObjective: document.getElementById("event-objective"),
};

populateClassificationSelect(selectors.classification);
populateStatusSelect(selectors.status);
populateObjectiveSelect(selectors.eventObjective);
createObjectiveChecklist(selectors.objectivesContainer);

const collectObjectives = () =>
  Array.from(
    selectors.objectivesContainer.querySelectorAll('input[name="objectives"]:checked'),
  ).map((input) => input.value);

const refreshObjectiveLists = () => {
  const data = registry.getObjectivesWithParticipants();
  renderObjectiveLists(selectors.objectiveLists, data, (id, status) => {
    registry.updateStatus(id, status);
    refreshObjectiveLists();
  });
};

selectors.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(selectors.form);

  const payload = {
    name: formData.get("name"),
    classification: formData.get("classification"),
    status: formData.get("status") || PARTICIPATION_STATUS.ACTIVE,
    objectives: collectObjectives(),
    notes: formData.get("notes") || "",
  };

  try {
    registry.addParticipant(payload);
    selectors.form.reset();
    refreshObjectiveLists();
  } catch (error) {
    alert(error.message);
  }
});

selectors.adjustmentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(selectors.adjustmentForm);

  try {
    const adjustment = registry.generateScheduleAdjustments({
      objective: formData.get("eventObjective"),
      required: Number(formData.get("required")) || 1,
      date: formData.get("eventDate"),
      specialDemand: formData.get("specialDemand") || "",
    });

    renderAdjustmentResult(selectors.adjustmentResults, adjustment);
  } catch (error) {
    alert(error.message);
  }
});

refreshObjectiveLists();

if (import.meta.env?.MODE !== "production") {
  // Facilita depuração via console
  window.rvmRegistry = registry;
  window.RVM_CONSTANTS = { OBJECTIVES, PARTICIPATION_STATUS };
}
