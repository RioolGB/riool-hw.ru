/* Stable per-browser ID used by the cinema login. It is random, not a fingerprint. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RioolCinemaDevice = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var STORAGE_KEY = 'riool-cinema-device-id-v1';
  var memoryId = '';
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function isValid(id) {
    return typeof id === 'string' && UUID_RE.test(id);
  }

  function createId(cryptoApi) {
    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
      return cryptoApi.randomUUID().toLowerCase();
    }
    if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
      throw new Error('Secure random generator is unavailable');
    }
    var bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = Array.prototype.map.call(bytes, function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' +
      hex.slice(16, 20) + '-' + hex.slice(20);
  }

  function getId(storage, cryptoApi) {
    if (memoryId) return memoryId;
    try {
      var stored = storage && storage.getItem(STORAGE_KEY);
      if (isValid(stored)) return (memoryId = stored.toLowerCase());
    } catch (err) { /* Storage can be disabled; use a memory-only ID. */ }

    memoryId = createId(cryptoApi);
    try { if (storage) storage.setItem(STORAGE_KEY, memoryId); } catch (err) { /* optional persistence */ }
    return memoryId;
  }

  return { STORAGE_KEY: STORAGE_KEY, isValid: isValid, getId: getId };
});
