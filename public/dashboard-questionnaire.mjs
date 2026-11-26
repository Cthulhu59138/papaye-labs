import {QUESTIONNAIRE_PATH, sections, COMMENT_LIMIT} from './code-papaye-questionnaire.mjs';

let draft = null;
export const hasQuestionnaireDraft = () => draft !== null;
export function clearQuestionnaireDraft() { draft = null; }

export function questionnaireMarkup() {
  return '<details id="questionnaire" class="panel questionnaire-panel"><summary><span>Questionnaire d’usage</span></summary><div data-questionnaire-body></div></details>';
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
    body.innerHTML = `<form class="questionnaire-form">
      <p>Coche autant de réponses que tu veux. Tu peux laisser des questions vides et revenir modifier tes choix.</p>
      <p class="muted">Indique les valeurs que tu utilises dans tes calculs, comme PS, TS ou l’épaisseur de calcul. Une référence courte suffit si tu veux préciser leur origine.</p>
      ${sections.map(([title, questions], index) => `<details class="questionnaire-group"${index === 0 ? ' open' : ''}>
        <summary><span>${title}</span><span class="questionnaire-count" data-group-count></span></summary>
        ${questions.map(([key, question, choices]) => `<fieldset class="questionnaire-question"><legend>${question}</legend>
          <div class="questionnaire-options">${choices.map(([value,label]) => `<label><input type="checkbox" name="${key}" value="${value}"><span>${label}</span></label>`).join('')}</div>
        </fieldset>`).join('')}
      </details>`).join('')}
      <div class="questionnaire-comment"><label for="questionnaire-comment">Commentaire libre</label>
        <p id="questionnaire-help" class="muted">Décris un cas typique. Quelles valeurs as-tu au départ, quel calcul veux-tu faire et quelle décision veux-tu pouvoir prendre ?</p>
        <textarea id="questionnaire-comment" name="comment" rows="6" maxlength="${COMMENT_LIMIT}" aria-describedby="questionnaire-help" placeholder="Par exemple, j’ai deux mesures d’épaisseur et une vitesse de perte. Je veux connaître l’épaisseur projetée et la marge jusqu’au prochain arrêt."></textarea>
      </div>
      <div class="questionnaire-actions">
        ${archived ? '' : '<button type="submit" class="button primary">Enregistrer mes réponses</button>'}
        <p role="status" aria-live="polite"></p>
      </div>
    </form>`;
    const form = body.querySelector('form');
    const status = form.querySelector('[role="status"]');
    const fields = [...form.querySelectorAll('input[type="checkbox"], textarea')];
    for (const field of fields) {
      if (field.name === 'comment') field.value = data.comment;
      else field.checked = data.answers[field.name]?.includes(field.value) ?? false;
      field.disabled = archived;
    }
    const button = form.querySelector('button[type="submit"]');
    function count() {
      for (const group of form.querySelectorAll('.questionnaire-group')) {
        const total = group.querySelectorAll('input:checked').length;
        group.querySelector('[data-group-count]').textContent = total ? `${total} choix` : '';
      }
    }
    count();
    status.textContent = archived ? 'Questionnaire archivé.' : draft ? 'Modifications à enregistrer.' : data.revision ? 'Réponses enregistrées.' : '';
    if (archived) return;
    function readAnswers() {
      const answers = {};
      const formData = new FormData(form);
      for (const [, questions] of sections)
        for (const [key] of questions) answers[key] = formData.getAll(key);
      return {answers,comment:formData.get('comment'),revision};
    }
    form.addEventListener('input', () => {
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
  if (location.hash === '#questionnaire' || draft) {
    panel.open = true;
    if (location.hash === '#questionnaire') panel.scrollIntoView({block:'start'});
  }
}
