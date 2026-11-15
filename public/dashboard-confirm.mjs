// One accessible app-owned confirmation at a time. Privacy/session changes call
// cancel(), resolving the pending decision as false and removing its content.
export function createConfirmation(dialog) {
  let pending=null;
  function finish(accepted) {
    const current=pending;
    if(!current)return;
    pending=null;
    if(dialog.open)dialog.close();
    dialog.replaceChildren();
    if(current.focus?.isConnected)current.focus.focus({preventScroll:true});
    current.resolve(accepted);
  }
  dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});
  // Native close events are queued: the previous dialog may already have been
  // replaced by a new open confirmation when its close event is delivered.
  dialog.addEventListener('close',()=>{if(!dialog.open)finish(false);});
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('[data-confirmation]');
    if(button)finish(button.dataset.confirmation==='accept');
  });
  return {
    request({title,message,confirmLabel='Confirmer',destructive=false}) {
      finish(false);
      return new Promise(resolve=>{
        pending={resolve,focus:dialog.ownerDocument.activeElement};
        dialog.innerHTML='<div class="dialog-heading"><h2 id="confirmation-title"></h2></div><div class="dialog-fields"><p id="confirmation-description"></p></div><div class="dialog-footer"><button type="button" class="button" data-confirmation="cancel" autofocus>Annuler</button><button type="button" class="button primary" data-confirmation="accept"></button></div>';
        dialog.querySelector('#confirmation-title').textContent=title;
        dialog.querySelector('#confirmation-description').textContent=message;
        const accept=dialog.querySelector('[data-confirmation="accept"]');
        accept.textContent=confirmLabel;
        if(destructive)accept.classList.add('destructive');
        dialog.showModal();
        dialog.querySelector('[data-confirmation="cancel"]').focus();
      });
    },
    cancel(){finish(false);},
  };
}
