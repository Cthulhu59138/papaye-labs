import test from 'node:test';
import assert from 'node:assert/strict';
import { selectQuestionMedia, freezeQuestionMedia, createPhotoGate } from '../../public/explorateurs/media-view.js';

test('question alternates by repetitions; no drawing/image fallback', () => {
 const card={id:'oak-leaf',questionMediaIds:['leaf-a','leaf-b'],image:'old.svg'};
 assert.equal(selectQuestionMedia(card,0),'leaf-a');
 assert.equal(selectQuestionMedia(card,1),'leaf-b');
 assert.equal(selectQuestionMedia(card,2),'leaf-a');
 assert.equal(selectQuestionMedia({image:'old.svg'}),null);
 assert.equal(selectQuestionMedia({questionMediaIds:[]}),null);
});
test('session selection stays frozen after review or source changes', () => {
 const cards=[{id:'oak-leaf',questionMediaIds:['leaf-a','leaf-b']}];
 const reviews={'oak-leaf':{repetitions:1}};
 const chosen=freezeQuestionMedia(cards,reviews);
 reviews['oak-leaf'].repetitions=2; cards[0].questionMediaIds.reverse();
 assert.deepEqual(chosen,['leaf-b']); assert.ok(Object.isFrozen(chosen));
});
test('late success cannot unlock next card or failed replacement', () => {
 const gate=createPhotoGate(); const old=gate.begin('one');
 const current=gate.begin('two');
 assert.equal(gate.settle(old,true),false); assert.equal(gate.ready('two'),false);
 gate.settle(current,false); assert.equal(gate.ready('two'),false);
 const retry=gate.begin('two');
 assert.equal(gate.settle(current,true),false); assert.equal(gate.ready('two'),false);
 gate.settle(retry,true); assert.equal(gate.ready('two'),true); assert.equal(gate.ready('one'),false);
 gate.invalidate(); assert.equal(gate.ready('two'),false);
});
