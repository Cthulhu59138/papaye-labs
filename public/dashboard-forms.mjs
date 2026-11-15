const pendingForms = new WeakMap();

// Freeze the whole dialog/card, including buttons outside the form. Retain the
// original disabled states so a failed request cannot enable a forbidden action.
export function setFormBusy(form,busy,{scope=form,values={}}={}) {
  if (busy) {
    if (pendingForms.has(form)) return;
    const controls = [...scope.querySelectorAll('button,input,textarea,select,fieldset')].map(control=>({control,disabled:control.disabled}));
    pendingForms.set(form,{controls,values:{...values},ariaBusy:form.getAttribute('aria-busy')});
    for (const {control} of controls) control.disabled=true;
    form.dataset.busy='true';form.setAttribute('aria-busy','true');
  } else {
    const saved=pendingForms.get(form);
    if (!saved) return;
    for (const {control,disabled} of saved.controls) control.disabled=disabled;
    if (saved.ariaBusy===null) form.removeAttribute('aria-busy');else form.setAttribute('aria-busy',saved.ariaBusy);
    form.dataset.busy='false';pendingForms.delete(form);
  }
}

// FormData excludes disabled fields. Use the submitted snapshot while frozen,
// notably when an expired session must retain the draft only in memory.
export function readFormValues(form) {
  const saved=pendingForms.get(form);
  return saved ? {...saved.values} : Object.fromEntries(new FormData(form));
}
