"use strict";
(() => {
  const fields = [
    { key: "equipment", name: "Équipement", title: "Bon. On parle de quoi, exactement ?", question: "Quel équipement, quelle zone, quelle fonction ? Donne un repère anonymisé et l’état actuel du matériel. Le machin là-bas, je ne le connais pas.", placeholder: "Équipement, fonction, zone concernée, état actuel…" },
    { key: "indication", name: "Indication", title: "Tu as vu quoi ? Et avec quoi ?", question: "Type d’indication, localisation, dimensions, méthode de détection, conditions et compte rendu disponible. Sépare ce qui a été observé de ce que tu en déduis.", placeholder: "Constat, méthode, mesures et preuve disponible…" },
    { key: "reference", name: "Référentiel", title: "Le seuil, il est où ?", question: "Quelle réglementation ou procédure est applicable, dans quelle version ? Quelle valeur fait franchir le seuil de caractérisation ? Sans la référence, on garde la question ouverte.", placeholder: "Document, version, paragraphe, seuil et résultat comparé…" },
    { key: "risk", name: "Risque & état", title: "Avant de courir, on regarde le risque.", question: "Quels impacts sont identifiés ou restent à évaluer ? Quel est l’état de l’équipement, quelles mesures ont déjà été prises et qui doit vérifier la situation ?", placeholder: "Impacts connus, incertitudes, état et interlocuteur compétent…" },
    { key: "planning", name: "Planning", title: "“Pour hier”, ce n’est pas un planning.", question: "Quelle échéance, quelle contrainte d’exploitation ou d’accès ? Quelles compétences et ressources faut-il mobiliser ? On distingue le souhait du délai confirmé.", placeholder: "Échéance, justification, accès, dépendances et ressources…" },
    { key: "documents", name: "FSI & DTE", title: "Le formulaire vient après les faits.", question: "Le dépassement du seuil est-il établi ? Le défaut réel est-il confirmé, ou le caractère parasite reste-t-il à examiner ? Note les preuves et les références des FSI/DTE existants, s’il y en a.", placeholder: "Seuil dépassé : oui / non / inconnu. Défaut réel : confirmé / non / inconnu. Justification…" }
  ];
  const example = [
    "Cas fictif — équipement E-01, zone soudée Z-2. Fonction et état d’exploitation à confirmer.",
    "Signal observé lors d’un contrôle. Localisation et dimensions exactes à relever dans le compte rendu ; origine non confirmée.",
    "Référentiel, version et seuil de caractérisation à demander au responsable du contrôle. Comparaison non établie.",
    "Impact non évalué. État du matériel et mesures en vigueur à vérifier avec le responsable compétent.",
    "Point de cadrage souhaité avant le prochain jalon. Date, accès et disponibilité du contrôleur à confirmer.",
    "Dépassement du seuil : inconnu. Défaut réel / parasite : non confirmé. Aucune référence FSI ou DTE fournie."
  ];
  let answers = Array(fields.length).fill("");
  let visited = Array(fields.length).fill(false);
  let current = 0;
  let fictitious = false;
  let widgetLoaded = false;
  const $ = (id) => document.getElementById(id);
  const status = (text) => { $("local-status").textContent = text; };
  function storeCurrent() {
    if (current < fields.length) answers[current] = $("answer").value.trim();
  }
  function refreshSummary() {
    const dl = $("summary"); dl.replaceChildren();
    fields.forEach((f, i) => {
      const dt = document.createElement("dt"); dt.textContent = f.name;
      const dd = document.createElement("dd"); dd.textContent = answers[i] || "À préciser";
      if (!answers[i]) dd.className = "empty";
      dl.append(dt, dd);
    });
    const count = answers.filter(Boolean).length;
    $("progress-text").textContent = `${count} / 6 rubriques renseignées`;
    $("progress-bar").style.width = `${count / fields.length * 100}%`;
    $("orientation-text").textContent = "À instruire. Base provisoire : FSI si le seuil de caractérisation est dépassé ; DTE si l’indication est un défaut réel, non parasite. Aucun verdict automatique dans cet aperçu.";
    $("export").disabled = count === 0;
    document.querySelectorAll(".step-button").forEach((b, i) => {
      b.classList.toggle("done", Boolean(answers[i]));
      b.setAttribute("aria-label", `${fields[i].name} — ${answers[i] ? "renseigné, à vérifier" : visited[i] ? "à préciser" : "non renseigné"}`);
      b.querySelector(".step-number").textContent = answers[i] ? "✓" : String(i + 1).padStart(2, "0");
    });
  }
  function render(focus = false) {
    const done = current === fields.length;
    $("answer-form").hidden = done;
    document.querySelector(".question-wrap").hidden = done;
    $("finished").hidden = !done;
    document.querySelectorAll(".step-button").forEach((b, i) => {
      if (i === current) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    if (!done) {
      const f = fields[current];
      $("question-count").textContent = `${fictitious ? "CAS FICTIF · " : ""}ÉTAPE ${String(current + 1).padStart(2, "0")} / 06`;
      $("question-title").textContent = f.title;
      $("question-text").textContent = f.question;
      $("answer").value = answers[current];
      $("answer").placeholder = f.placeholder;
      $("answer-label").textContent = `${f.name} — les faits, même incomplets`;
      $("next").textContent = current === fields.length - 1 ? "Préparer ma fiche →" : "On avance →";
    }
    refreshSummary();
    if (focus) (done ? $("export-finished") : $("answer")).focus({ preventScroll: true });
  }
  fields.forEach((f, i) => {
    const li = document.createElement("li");
    const b = document.createElement("button"); b.type = "button"; b.className = "step-button";
    const n = document.createElement("span"); n.className = "step-number";
    const label = document.createElement("span"); label.textContent = f.name;
    b.append(n, label); b.addEventListener("click", () => { storeCurrent(); current = i; status(""); render(true); });
    li.append(b); $("steps").append(li);
  });
  $("answer").addEventListener("input", () => { storeCurrent(); refreshSummary(); status(""); });
  $("answer-form").addEventListener("submit", (e) => {
    e.preventDefault(); storeCurrent();
    if (!answers[current]) { status("Écris ce que tu sais, ou choisis « À préciser plus tard »."); $("answer").focus(); return; }
    visited[current] = true; current++; status("Brouillon conservé dans cet onglet. Pense à télécharger la fiche avant de fermer."); render(true);
  });
  $("unknown").addEventListener("click", () => { storeCurrent(); visited[current] = true; current++; status("Le point reste à préciser ; on conserve les éléments déjà saisis."); render(true); });
  let pendingReset = "clear";
  function applyReset(mode) {
    answers = mode === "example" ? [...example] : Array(fields.length).fill("");
    visited = Array(fields.length).fill(mode === "example"); fictitious = mode === "example"; current = 0;
    status(mode === "example" ? "Exemple fictif chargé. Modifie les rubriques pour tester le parcours." : "Nouveau cadrage. À toi de jouer.");
    render(true); $("atelier").scrollIntoView({ behavior: "smooth" });
  }
  function requestReset(mode) { storeCurrent(); pendingReset = mode; if (answers.some(Boolean)) $("reset-dialog").showModal(); else applyReset(mode); }
  $("example").addEventListener("click", () => requestReset("example"));
  $("reset").addEventListener("click", () => requestReset("clear"));
  $("reset-cancel").addEventListener("click", () => $("reset-dialog").close());
  $("reset-confirm").addEventListener("click", () => { $("reset-dialog").close(); applyReset(pendingReset); });
  function exportFile() {
    storeCurrent();
    const lines = ["GM-IETI — Fiche de cadrage", `Date : ${new Date().toLocaleDateString("fr-FR")}`, fictitious ? "CAS FICTIF — démonstration" : "BROUILLON — informations déclarées, à vérifier", "", ...fields.flatMap((f, i) => [`${i + 1}. ${f.name}`, answers[i] || "À préciser", ""]), "Orientation FSI / DTE : À INSTRUIRE", "Principe provisoire fourni par le porteur du projet : FSI si indication au-delà du seuil de caractérisation ; DTE si défaut réel et non parasite. Les subtilités métier et le référentiel restent à compléter.", "Cet aperçu ne compare aucun seuil et ne rend aucun verdict de conformité.", "", "Informations non renseignées :", ...fields.filter((_, i) => !answers[i]).map(f => `- ${f.name}`), "", "Prochaines actions proposées :", "- Compléter les informations manquantes et joindre les éléments de preuve.", "- Faire vérifier le référentiel, les seuils et l’orientation FSI/DTE par l’interlocuteur compétent.", "- Confirmer les intervenants, ressources, échéances et dépendances.", "- Faire valider toute conclusion avant action sur l’équipement."];
    if (answers.every(Boolean)) lines.splice(lines.indexOf("Informations non renseignées :") + 1, 0, "Toutes les rubriques contiennent du texte. Les inconnues indiquées dans les réponses restent à traiter.");
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "gm-ieti-fiche-cadrage.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); status("Fiche préparée pour téléchargement.");
  }
  $("export").addEventListener("click", exportFile); $("export-finished").addEventListener("click", exportFile);
  $("voice-open").addEventListener("click", () => {
    $("voice-dialog").showModal();
    const id = window.GM_IETI_CONFIG?.agentId;
    if (id && /^agent_[a-zA-Z0-9_-]+$/.test(id)) {
      $("voice-detail").textContent = "La conversation vocale s’ouvre dans le module ElevenLabs. Ta fiche écrite et la conversation vocale sont indépendantes dans cette première version.";
      $("voice-confirm").textContent = "Ouvrir la conversation vocale";
    }
  });
  $("voice-confirm").addEventListener("click", () => {
    const id = window.GM_IETI_CONFIG?.agentId;
    if (!id || !/^agent_[a-zA-Z0-9_-]+$/.test(id)) { $("voice-dialog").close(); $("atelier").scrollIntoView({ behavior: "smooth" }); return; }
    // Load the provider only after the visitor explicitly opens voice mode.
    if (!widgetLoaded) {
      const widget = document.createElement("elevenlabs-convai"); widget.setAttribute("agent-id", id);
      widget.setAttribute("action-text", "Parler au GM-IETI"); widget.setAttribute("start-call-text", "Commencer");
      widget.setAttribute("end-call-text", "Terminer"); widget.setAttribute("listening-text", "Le GM écoute…");
      widget.setAttribute("speaking-text", "Le GM te répond…"); widget.setAttribute("expand-text", "Ouvrir la conversation");
      document.body.append(widget);
      const script = document.createElement("script"); script.src = "https://unpkg.com/@elevenlabs/convai-widget-embed"; script.async = true;
      script.onerror = () => { widget.remove(); script.remove(); widgetLoaded = false; status("Le module vocal n’a pas pu être chargé. Réessaie depuis « Et avec la voix ? »."); };
      document.body.append(script); widgetLoaded = true;
    }
    $("voice-dialog").close(); status("Le module vocal est ouvert. Utilise son bouton pour démarrer la conversation.");
  });
  $("voice-close").addEventListener("click", () => $("voice-dialog").close());
  window.addEventListener("beforeunload", (e) => { if (answers.some(Boolean)) { e.preventDefault(); e.returnValue = ""; } });
  render();
})();
