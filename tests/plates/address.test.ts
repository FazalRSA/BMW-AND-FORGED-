import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanShareCode, configureHref, isConfigureAddress, parseConfigureAddress } from '../../services/plates/address';
import { FACTORY_WHEEL, Selection, reconcileSelection } from '../../services/plates/selection';
import { catalog } from './fixtures';

const cat = catalog();
const selection: Selection = { car: 'm2_cs_g87', view: 'side', paint: 'portimao_blue_metallic', wheel: 'forged_fsa002', finish: 'gold' };
const parse = (href: string) => {
  const url = new URL(href, 'https://example.test');
  return parseConfigureAddress(url.pathname, url.search);
};

describe('configureHref and parseConfigureAddress', () => {
  test('the whole configuration is in the address and comes back from it', () => {
    const href = configureHref({ selection, size: '21"', step: 'summary' });
    assert.equal(href, '/configure?car=m2_cs_g87&view=side&paint=portimao_blue_metallic&wheel=forged_fsa002&finish=gold&size=21&step=summary');
    const address = parse(href);
    assert.deepEqual(reconcileSelection(cat, address.wanted), selection);
    assert.equal(address.size, '21"');
    assert.equal(address.step, 'summary');
    assert.equal(address.code, undefined);
  });

  test('the factory wheel has no finish in the address', () => {
    const factory = { ...selection, wheel: FACTORY_WHEEL, finish: FACTORY_WHEEL };
    assert.equal(configureHref({ selection: factory }), '/configure?car=m2_cs_g87&view=side&paint=portimao_blue_metallic&wheel=factory');
    assert.deepEqual(reconcileSelection(cat, parse(configureHref({ selection: factory })).wanted), factory);
  });

  test('a link that only knows part of the configuration', () => {
    assert.equal(configureHref(), '/configure');
    assert.equal(configureHref({ selection: { car: 'm5_g90' } }), '/configure?car=m5_g90');
    assert.equal(configureHref({ selection: { wheel: 'sixnine_ff1', finish: 'silver' }, size: '20"' }), '/configure?wheel=sixnine_ff1&finish=silver&size=20');
    assert.equal(configureHref({ code: 'K7QM4XR2PD' }), '/configure?config=K7QM4XR2PD');
  });

  test('bad or stale parameters fall back to defaults, silently', () => {
    const address = parse('/configure?car=%3Cscript%3E&view=../../x&paint=&wheel=a b&finish=%00&size=huge&step=checkout&config=nope&utm_source=ig');
    assert.deepEqual(address, { wanted: {}, size: undefined, step: 'configure', code: undefined });
    // a stale but well-formed id is dropped when the selection is reconciled
    assert.deepEqual(reconcileSelection(cat, parse('/configure?car=m3_g80&paint=isle_of_man_green&wheel=forged_fsa_01').wanted), reconcileSelection(cat));
    // a query string that is not even one
    assert.deepEqual(parse('/configure?%%%=&&&=1').wanted, {});
  });

  test('sizes: 20 and 20" are a size, nothing else is', () => {
    assert.equal(parse('/configure?size=20').size, '20"');
    assert.equal(parse('/configure?size=21%22').size, '21"');
    assert.equal(parse('/configure?size=2').size, undefined);
    assert.equal(parse('/configure?size=20x9').size, undefined);
  });

  test('/summary is the summary step', () => {
    assert.equal(parse('/summary').step, 'summary');
    assert.equal(parse('/configure?step=summary').step, 'summary');
    assert.equal(parse('/configure').step, 'configure');
  });
});

describe('share codes', () => {
  test('are ten letters and digits, however they were typed', () => {
    assert.equal(cleanShareCode('k7qm-4xr2pd'), 'K7QM4XR2PD');
    assert.equal(cleanShareCode(' K7QM 4XR2 PD '), 'K7QM4XR2PD');
    assert.equal(cleanShareCode('K7QM4XR2'), undefined);
    assert.equal(cleanShareCode(''), undefined);
    assert.equal(cleanShareCode(null), undefined);
    assert.equal(parse('/?config=k7qm4xr2pd').code, 'K7QM4XR2PD');
  });
});

describe('isConfigureAddress', () => {
  test('the configurator, its summary, and shared builds', () => {
    assert.equal(isConfigureAddress('/configure', ''), true);
    assert.equal(isConfigureAddress('/Configure/', '?car=m5_g90'), true);
    assert.equal(isConfigureAddress('/summary', ''), true);
    assert.equal(isConfigureAddress('/', '?config=K7QM4XR2PD'), true);
  });

  test('the rest of the site', () => {
    for (const path of ['/', '/models', '/forged', '/rims/forged_fsa002', '/admin', '/terms']) assert.equal(isConfigureAddress(path, ''), false, path);
    assert.equal(isConfigureAddress('/', '?config=bad'), false);
    assert.equal(isConfigureAddress('/admin', '?config=K7QM4XR2PD'), false);
  });
});
