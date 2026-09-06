import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBrief, evaluateScope, sanitizeScopeInput, scopeCatalog } from '../scope-estimator/engine.mjs';

test('simple isolated feature stays in STANDARD guide',()=>{const r=evaluateScope({projectType:'feature',existing:'new',roles:'single',data:'simple',integrations:'none',operation:'basic',schedule:'normal'});assert.equal(r.packageName,'STANDARD');assert.equal(r.budget,'49~99만원');});

test('typical excel workflow starts in DELUXE guide',()=>{const r=evaluateScope({projectType:'excel',existing:'new',roles:'single',data:'simple',integrations:'none',operation:'basic',schedule:'normal'});assert.equal(r.packageName,'DELUXE');assert.match(r.firstPhase,/Import/);});

test('relational admin workflow with multiple roles reaches PREMIUM',()=>{const r=evaluateScope({projectType:'admin',existing:'new',roles:'multi',data:'relational',integrations:'none',operation:'advanced',schedule:'normal'});assert.equal(r.packageName,'PREMIUM');});

test('high-complexity existing integration is CUSTOM',()=>{const r=evaluateScope({projectType:'integration',existing:'existing',roles:'multi',data:'relational',integrations:'multiple',operation:'advanced',schedule:'urgent'});assert.equal(r.packageName,'CUSTOM');});

test('all seven flagship categories plus feature are allow-listed',()=>{for(const type of ['feature','excel','admin','ai','integration','commerce','field','document']){const clean=sanitizeScopeInput({projectType:type});assert.equal(clean.projectType,type);assert.ok(scopeCatalog.projectTypes[type]);}});

test('commerce, field and document categories expose domain-specific first phases',()=>{assert.match(evaluateScope({projectType:'commerce'}).firstPhase,/Order|Refund/);assert.match(evaluateScope({projectType:'field'}).firstPhase,/예약|Dispatch/);assert.match(evaluateScope({projectType:'document'}).firstPhase,/제출|검수/);});

test('AI scope explains evidence and human review boundary',()=>{const r=evaluateScope({projectType:'ai',existing:'new',roles:'single',data:'simple',integrations:'none',operation:'advanced',schedule:'normal'});assert.equal(r.projectLabel,'AI Workflow / Local RAG');assert.ok(r.reasons.some(x=>/근거|승인/.test(x)));assert.match(r.firstPhase,/Structured Output/);});

test('untrusted enum values normalize to allow-listed defaults',()=>{const clean=sanitizeScopeInput({projectType:'unknown',existing:'hack',roles:'x',data:'x',integrations:'x',operation:'x',schedule:'x'});assert.equal(clean.projectType,'feature');assert.equal(clean.existing,'new');});

test('generated brief contains package guide but no user secrets',()=>{const r=evaluateScope({projectType:'document',existing:'new',roles:'multi',data:'relational',integrations:'one',operation:'advanced',schedule:'normal'});const brief=buildBrief(r);assert.match(brief,/예상 패키지 가이드/);assert.match(brief,/문서접수 \/ 검수 \/ 승인/);assert.doesNotMatch(brief,/api[_ -]?key|secret|password/i);});
