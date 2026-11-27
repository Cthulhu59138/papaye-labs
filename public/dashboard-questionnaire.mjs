import {QUESTIONNAIRE_PATH, sections, automationSections, COMMENT_LIMIT, QUESTION_COMMENT_LIMIT} from './code-papaye-questionnaire.mjs';

let draft = null;
export const hasQuestionnaireDraft = () => draft !== null;
export function clearQuestionnaireDraft() { draft = null; }

export function questionnaireMarkup() {
  return '<details id="questionnaire" class="panel questionnaire-panel"><summary><span>Questionnaire d’usage</span></summary><div data-questionnaire-body></div></details>';
}

function questionComment(key) {
  return `<details class="question-comment">
    <summary>Commentaire libre<span data-comment-marker></span></summary>
    <label for="comment-${key}">Préciser cette question (facultatif)</label>
    <textarea id="comment-${key}" data-question-comment="${key}" maxlength="${QUESTION_COMMENT_LIMIT}" rows="3"></textarea>
  </details>`;
}

export function mountQuestionnaire(panel, api, archived) {
  const body = panel.querySelector('[data-questionnaire-body]');
  let revision;
  async function load() {
    body.innerHTML = '<p role="status">Chargement de tes réponses…</p>';
    try {
      const data = await api(QUESTIONNAIRE_PATH);
      const current = !archived && draft ? draft : data;
      revision = current.revision;
      render(current);
    } catch (error) {
      const message = document.createElement('p');
      message.setAttribute('role','alert');
      message.textContent = error.message;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'button';
      retry.textContent = 'Réessayer';
      retry.addEventListener('click',load);
      body.replaceChildren(message,retry);
    }
  }

  function render(data) {
    const automationLink = location.hash === '#automatisations';
    const proposalCount = automationSections.reduce((sum,[,questions])=>sum+questions.length,0);
    body.innerHTML = `<form class="questionnaire-form">
      <details id="automatisations" class="questionnaire-group questionnaire-automations" open>
        <summary><span>Automatisations à prioriser</span><span class="questionnaire-count" data-total></span></summary>
        <p>Indique ce qui te ferait gagner du temps au travail. Pour chaque proposition, tu peux choisir « Prioritaire », « Utile », « Plus tard », « Hors sujet » ou « À clarifier ». Chaque proposition a son commentaire libre. Tu peux laisser le choix vide.</p>
        ${automationSections.map(([title, questions], index) => `<details class="questionnaire-group"${index === 0 ? ' open' : ''}>
          <summary><span>${title}</span><span class="questionnaire-count" data-group-count></span></summary>
          ${questions.map(([key,label,choices]) => `<div class="automation-row"><label for="${key}">${label}</label>
            <select id="${key}" name="${key}"><option value="">Sans réponse</option>${choices.map(([value, label])=>`<option value="${value}">${label}</option>`).join('')}</select>
            ${questionComment(key)}
          </div>`).join('')}
        </details>`).join('')}
      </details>
      <details class="questionnaire-group questionnaire-usage"${automationLink ? '' : ' open'}>
        <summary>Questionnaire d’usage initial</summary>
      <p>Coche autant de réponses que tu veux. Tu peux laisser des questions vides et revenir modifier tes choix.</p>
      <p class="muted">Indique les valeurs que tu utilises dans tes calculs, comme PS, TS ou l’épaisseur de calcul. Une référence courte suffit si tu veux préciser leur origine.</p>
      ${sections.map(([title, questions], index) => `<details class="questionnaire-group"${index === 0 ? ' open' : ''}>
        <summary><span>${title}</span><span class="questionnaire-count" data-group-count></span></summary>
        ${questions.map(([key, question, choices]) => `<fieldset class="questionnaire-question"><legend>${question}</legend>
          <div class="questionnaire-options">${choices.map(([value,label]) => `<label><input type="checkbox" name="${key}" value="${value}"><span>${label}</span></label>`).join('')}</div>
          ${questionComment(key)}
        </fieldset>`).join('')}
      </details>`).join('')}
      </details>
      <div class="questionnaire-comment"><label for="questionnaire-comment">Commentaire général</label>
        <p id="questionnaire-help" class="muted">Décris une liaison utile, une proposition à écarter ou une donnée qui manque. Garde les références et valeurs métier sur ton poste.</p>
        <textarea id="questionnaire-comment" name="comment" rows="6" maxlength="${COMMENT_LIMIT}" aria-describedby="questionnaire-help" placeholder="Par exemple, j’ai deux mesures d’épaisseur et une vitesse de perte. Je veux connaître l’épaisseur projetée et la marge jusqu’au prochain arrêt."></textarea>
      </div>
      <div class="questionnaire-actions">
        ${archived ? '' : '<button type="submit" class="button primary">Enregistrer mes réponses</button>'}
        <p role="status" aria-live="polite"></p>
      </div>
    </form>`;
    const form = body.querySelector('form');
    const status = form.querySelector('[role="status"]');
    const fields = [...form.querySelectorAll('input[type="checkbox"], select, textarea')];
    for (const field of fields) {
      if (field.name === 'comment') field.value = data.comment;
      else if (field.dataset.questionComment) field.value = data.questionComments?.[field.dataset.questionComment] ?? '';
      else if (field.matches('select')) field.value = data.answers[field.name]?.[0] ?? '';
      else field.checked = data.answers[field.name]?.includes(field.value) ?? false;
      field.disabled = archived;
    }
    const commentFields = fields.filter(field=>field.dataset.questionComment);
    function updateCommentMarker(field) {
      field.closest('details').querySelector('[data-comment-marker]').textContent =
        field.value.trim() ? ' · renseigné' : '';
    }
    commentFields.forEach(updateCommentMarker);
    const button = form.querySelector('button[type="submit"]');
    function count() {
      for (const counter of form.querySelectorAll('[data-group-count]')) {
        const group = counter.closest('details');
        const total = group.querySelectorAll('input:checked').length +
          [...group.querySelectorAll('select')].filter(field=>field.value).length;
        counter.textContent = total ? `${total} choix` : '';
      }
      const rated = [...form.querySelectorAll('.questionnaire-automations select')].filter(field=>field.value).length;
      form.querySelector('[data-total]').textContent = `${rated}/${proposalCount} évaluées`;
    }
    count();
    status.textContent = archived ? 'Questionnaire archivé.' : draft ? 'Modifications à enregistrer.' : data.revision ? 'Réponses enregistrées.' : '';
    if (automationLink) form.querySelector('#automatisations').scrollIntoView({block:'start'});
    if (archived) return;
    function readAnswers() {
      const answers = {};
      const formData = new FormData(form);
      for (const [, questions] of [...sections,...automationSections])
        for (const [key] of questions) answers[key] = formData.getAll(key).filter(Boolean);
      const questionComments = Object.fromEntries(commentFields.map(field =>
        [field.dataset.questionComment,field.value]));
      return {answers,comment:formData.get('comment'),questionComments,revision};
    }
    form.addEventListener('input', event => {
      if (event.target.dataset.questionComment) updateCommentMarker(event.target);
      draft = readAnswers();
      count();
      status.textContent = 'Modifications à enregistrer.';
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (button.disabled) return;
      const snapshot = draft ?? readAnswers();
      button.disabled = true;
      fields.forEach(field => {field.disabled = true;});
      status.textContent = 'Enregistrement…';
      try {
        const result = await api(QUESTIONNAIRE_PATH,{
          method:'PATCH', body:snapshot
        });
        if (draft === snapshot) draft = null;
        revision = result.revision;
        status.textContent = 'Réponses enregistrées.';
      } catch (error) {
        status.textContent = error.message;
      } finally {
        fields.forEach(field => {field.disabled = false;});
        button.disabled = false;
      }
    });
  }

  panel.addEventListener('toggle', () => {
    if (panel.open && !body.hasChildNodes()) void load();
  });
  if (['#questionnaire','#automatisations'].includes(location.hash) || draft) {
    panel.open = true;
    if (location.hash === '#questionnaire') panel.scrollIntoView({block:'start'});
  }
}
