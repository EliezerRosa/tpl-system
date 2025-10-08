import { CLASSIFICATIONS, OBJECTIVES, PARTICIPATION_STATUS } from "./registry.js";

export const populateClassificationSelect = (select) => {
  Object.values(CLASSIFICATIONS).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
};

export const populateStatusSelect = (select) => {
  Object.values(PARTICIPATION_STATUS).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
};

export const populateObjectiveSelect = (select) => {
  Object.values(OBJECTIVES).forEach((objective) => {
    const option = document.createElement("option");
    option.value = objective;
    option.textContent = objective;
    select.append(option);
  });
};

export const createObjectiveChecklist = (container) => {
  container.innerHTML = "";
  Object.values(OBJECTIVES).forEach((objective) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "objectives";
    input.value = objective;
    label.append(input, document.createTextNode(objective));
    container.append(label);
  });
};

const statusLabels = {
  [PARTICIPATION_STATUS.ACTIVE]: "Ativo",
  [PARTICIPATION_STATUS.ABSENT]: "Ausente",
  [PARTICIPATION_STATUS.SUBSTITUTE]: "Substituto",
};

export const renderObjectiveLists = (
  container,
  objectivesWithParticipants,
  onStatusChange,
) => {
  container.innerHTML = "";
  objectivesWithParticipants.forEach(({ objective, participants }) => {
    const card = document.createElement("article");
    card.className = "objective-card";

    const title = document.createElement("h3");
    title.textContent = objective.charAt(0).toUpperCase() + objective.slice(1);
    card.append(title);

    if (participants.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "muted";
      emptyState.textContent = "Sem participantes cadastrados";
      card.append(emptyState);
    } else {
      const list = document.createElement("div");
      list.className = "participant-list";

      participants.forEach((participant) => {
        const item = document.createElement("article");
        item.className = "participant-item";
        item.dataset.status = participant.status;

        const header = document.createElement("div");
        header.className = "item-header";

        const name = document.createElement("span");
        name.textContent = participant.name;
        header.append(name);

        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = participant.classification;
        header.append(badge);

        const statusControl = document.createElement("div");
        statusControl.className = "status-control";

        const select = document.createElement("select");
        Object.entries(statusLabels).forEach(([value, label]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          if (value === participant.status) {
            option.selected = true;
          }
          select.append(option);
        });

        select.addEventListener("change", () => {
          onStatusChange(participant.id, select.value);
        });

        statusControl.append(select);
        item.append(header, statusControl);

        if (participant.notes) {
          const notes = document.createElement("p");
          notes.textContent = participant.notes;
          notes.className = "muted";
          item.append(notes);
        }

        list.append(item);
      });

      card.append(list);
    }

    container.append(card);
  });
};

export const renderAdjustmentResult = (container, adjustment) => {
  container.innerHTML = "";
  if (!adjustment) {
    return;
  }

  const card = document.createElement("article");
  card.className = "adjustment-card";

  const title = document.createElement("h3");
  title.textContent = `Programação para ${adjustment.objective} em ${adjustment.date}`;
  card.append(title);

  const summary = document.createElement("p");
  summary.textContent = adjustment.message;
  card.append(summary);

  const details = document.createElement("div");
  details.className = "adjustment-details";

  const available = document.createElement("p");
  available.textContent = `Disponíveis: ${adjustment.available} | Necessários: ${adjustment.required}`;
  details.append(available);

  if (adjustment.absent.length) {
    const absentList = document.createElement("ul");
    absentList.innerHTML = `<strong>Ausentes:</strong>`;
    adjustment.absent.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item.name;
      absentList.append(li);
    });
    details.append(absentList);
  }

  if (adjustment.suggestions.length) {
    const suggestionList = document.createElement("ul");
    suggestionList.innerHTML = `<strong>Sugestões de substituição:</strong>`;
    adjustment.suggestions.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = `${item.name} (${item.classification})`;
      suggestionList.append(li);
    });
    details.append(suggestionList);
  }

  if (adjustment.specialDemand) {
    const demand = document.createElement("p");
    demand.textContent = `Observação: ${adjustment.specialDemand}`;
    details.append(demand);
  }

  card.append(details);
  container.append(card);
};
