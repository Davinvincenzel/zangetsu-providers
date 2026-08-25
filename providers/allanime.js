// AllAnime provider — https://allanime.to (API: https://api.mkissa.net/api / https://api.allanime.day/api)

var API = 'https://api.mkissa.net/api';
var API_FALLBACK = 'https://api.allanime.day/api';
var REFERER = 'https://mkissa.to';
var ORIGIN = 'https://mkissa.to';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0';
var SOURCE_ID = 'allanime';

// Apollo Persisted Query sha256 hash for episode sourceUrls / tobeparsed query
var SOURCES_HASH = 'f4662f4b7510b26795dd53ef824a0bf1740fbbc5d1273fab18222ac831bca8d0';

// Dynamic Key Derivation constants
var MASK_HEX = '522db8a067d8ea23616f7670788574dd786af7ffffd27bccfaeccfde57a67ce7';
var BUILD_ID = '140';
var BOOT_TOKEN = '351b496f677e5d86758b86ce0546bd64a9fabb7769adf6813d294f1756fb4d23';
var ALLANIME_KEY_SEED = 'Xot36i3lK3:v1';

var _HEXMAP = {"79":"A","7a":"B","7b":"C","7c":"D","7d":"E","7e":"F","7f":"G","70":"H","71":"I","72":"J","73":"K","74":"L","75":"M","76":"N","77":"O","68":"P","69":"Q","6a":"R","6b":"S","6c":"T","6d":"U","6e":"V","6f":"W","60":"X","61":"Y","62":"Z","59":"a","5a":"b","5b":"c","5c":"d","5d":"e","5e":"f","5f":"g","50":"h","51":"i","52":"j","53":"k","54":"l","55":"m","56":"n","57":"o","48":"p","49":"q","4a":"r","4b":"s","4c":"t","4d":"u","4e":"v","4f":"w","40":"x","41":"y","42":"z","08":"0","09":"1","0a":"2","0b":"3","0c":"4","0d":"5","0e":"6","0f":"7","00":"8","01":"9","15":"-","16":".","67":"_","46":"~","02":":","17":"/","07":"?","1b":"#","63":"[","65":"]","78":"@","19":"!","1c":"$","1e":"&","10":"(","11":")","12":"*","13":"+","14":",","03":";","05":"=","1d":"%"};

function decodeSourceUrl(s) {
  s = String(s);
  if (s.indexOf('--') !== 0) return s;
  var body = s.slice(2), out = '';
  for (var i = 0; i + 1 < body.length; i += 2) { var ch = _HEXMAP[body.substr(i, 2)]; out += (ch == null ? '' : ch); }
  return out.replace('/clock', '/clock.json');
}
globalThis.__allanimeDecodeSourceUrl = decodeSourceUrl; // test hook

// ── Pure JS Cryptographic Engine (Zero Dependency, Works Everywhere) ─────────

function _sha256BytesPure(input) {
  var bytes = [];
  if (typeof input === 'string') {
    for (var i = 0; i < input.length; i++) {
      var c = input.charCodeAt(i);
      if (c < 128) bytes.push(c);
      else if (c < 2048) bytes.push((c >> 6) | 192, (c & 63) | 128);
      else if ((c & 0xFC00) === 0xD800 && i + 1 < input.length && (input.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
        var cp = 0x10000 + ((c & 0x3FF) << 10) + (input.charCodeAt(++i) & 0x3FF);
        bytes.push((cp >> 18) | 240, ((cp >> 12) & 63) | 128, ((cp >> 6) & 63) | 128, (cp & 63) | 128);
      } else bytes.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128);
    }
  } else {
    for (var j = 0; j < input.length; j++) bytes.push(input[j]);
  }

  var K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];

  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  var l = bytes.length;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  var bits = l * 8;
  for (var b = 7; b >= 0; b--) bytes.push((bits / Math.pow(2, b * 8)) & 0xff);

  var W = new Array(64);
  for (var chunk = 0; chunk < bytes.length; chunk += 64) {
    for (var t = 0; t < 16; t++) {
      W[t] = (bytes[chunk + t * 4] << 24) | (bytes[chunk + t * 4 + 1] << 16) | (bytes[chunk + t * 4 + 2] << 8) | (bytes[chunk + t * 4 + 3]);
    }
    for (var t2 = 16; t2 < 64; t2++) {
      var s0 = ((W[t2-15] >>> 7) | (W[t2-15] << 25)) ^ ((W[t2-15] >>> 18) | (W[t2-15] << 14)) ^ (W[t2-15] >>> 3);
      var s1 = ((W[t2-2] >>> 17) | (W[t2-2] << 15)) ^ ((W[t2-2] >>> 19) | (W[t2-2] << 13)) ^ (W[t2-2] >>> 10);
      W[t2] = (W[t2-16] + s0 + W[t2-7] + s1) | 0;
    }

    var a = H[0], b2 = H[1], c2 = H[2], d2 = H[3], e2 = H[4], f2 = H[5], g2 = H[6], h2 = H[7];
    for (var i2 = 0; i2 < 64; i2++) {
      var S1 = ((e2 >>> 6) | (e2 << 26)) ^ ((e2 >>> 11) | (e2 << 21)) ^ ((e2 >>> 25) | (e2 << 7));
      var ch = (e2 & f2) ^ ((~e2) & g2);
      var temp1 = (h2 + S1 + ch + K[i2] + W[i2]) | 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var maj = (a & b2) ^ (a & c2) ^ (b2 & c2);
      var temp2 = (S0 + maj) | 0;

      h2 = g2; g2 = f2; f2 = e2; e2 = (d2 + temp1) | 0;
      d2 = c2; c2 = b2; b2 = a; a = (temp1 + temp2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b2) | 0; H[2] = (H[2] + c2) | 0; H[3] = (H[3] + d2) | 0;
    H[4] = (H[4] + e2) | 0; H[5] = (H[5] + f2) | 0; H[6] = (H[6] + g2) | 0; H[7] = (H[7] + h2) | 0;
  }

  var out = new Uint8Array(32);
  for (var k = 0; k < 8; k++) {
    out[k * 4] = (H[k] >>> 24) & 0xff;
    out[k * 4 + 1] = (H[k] >>> 16) & 0xff;
    out[k * 4 + 2] = (H[k] >>> 8) & 0xff;
    out[k * 4 + 3] = H[k] & 0xff;
  }
  return out;
}

function _sha256Bytes(data) {
  if (typeof sha256Hex === 'function' && typeof data === 'string') {
    return sha256Hex(data).then(function (hex) {
      return _hexToBytes(hex);
    }).catch(function () {
      return _sha256BytesPure(data);
    });
  }
  return Promise.resolve(_sha256BytesPure(data));
}

var _SBOX = [
  99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,
  240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,
  4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,
  82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,
  208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,
  188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,
  96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,
  194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,
  186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,
  97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,
  140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22
];

var _RCON = [0x00,0x01,0x02,0x04,0x08,0x10,0x20,0x40,0x80,0x1b,0x36];

function _keyExpansion(key) {
  var Nk = key.length / 4;
  var Nr = Nk + 6;
  var w = [];
  for (var i = 0; i < Nk; i++) {
    w[i] = [(key[4*i]), (key[4*i+1]), (key[4*i+2]), (key[4*i+3])];
  }
  for (var col = Nk; col < 4 * (Nr + 1); col++) {
    var temp = w[col - 1].slice();
    if (col % Nk === 0) {
      var k0 = temp[0]; temp[0] = temp[1]; temp[1] = temp[2]; temp[2] = temp[3]; temp[3] = k0;
      temp[0] = _SBOX[temp[0]]; temp[1] = _SBOX[temp[1]]; temp[2] = _SBOX[temp[2]]; temp[3] = _SBOX[temp[3]];
      temp[0] ^= _RCON[col / Nk];
    } else if (Nk > 6 && col % Nk === 4) {
      temp[0] = _SBOX[temp[0]]; temp[1] = _SBOX[temp[1]]; temp[2] = _SBOX[temp[2]]; temp[3] = _SBOX[temp[3]];
    }
    w[col] = [
      w[col - Nk][0] ^ temp[0],
      w[col - Nk][1] ^ temp[1],
      w[col - Nk][2] ^ temp[2],
      w[col - Nk][3] ^ temp[3]
    ];
  }
  return { w: w, Nr: Nr };
}

function _cipherBlock(block, ks) {
  var w = ks.w, Nr = ks.Nr, s = [[],[],[],[]], r, c, i;
  for (i = 0; i < 16; i++) s[i % 4][(i / 4) | 0] = block[i];

  function ark(round) {
    for (c = 0; c < 4; c++) for (r = 0; r < 4; r++) s[r][c] ^= w[round * 4 + c][r];
  }
  function sub() {
    for (r = 0; r < 4; r++) for (c = 0; c < 4; c++) s[r][c] = _SBOX[s[r][c]];
  }
  function shift() {
    for (r = 1; r < 4; r++) {
      var row = s[r].slice();
      for (c = 0; c < 4; c++) s[r][c] = row[(c + r) % 4];
    }
  }
  function gmul2(x) { return (x << 1) ^ (((x >> 7) & 1) * 0x11b); }
  function gmul3(x) { return gmul2(x) ^ x; }
  function mix() {
    for (c = 0; c < 4; c++) {
      var a0 = s[0][c], a1 = s[1][c], a2 = s[2][c], a3 = s[3][c];
      s[0][c] = gmul2(a0) ^ gmul3(a1) ^ a2 ^ a3;
      s[1][c] = a0 ^ gmul2(a1) ^ gmul3(a2) ^ a3;
      s[2][c] = a0 ^ a1 ^ gmul2(a2) ^ gmul3(a3);
      s[3][c] = gmul3(a0) ^ a1 ^ a2 ^ gmul2(a3);
    }
  }

  ark(0);
  for (var round = 1; round < Nr; round++) {
    sub(); shift(); mix(); ark(round);
  }
  sub(); shift(); ark(Nr);

  var out = new Uint8Array(16);
  for (i = 0; i < 16; i++) out[i] = s[i % 4][(i / 4) | 0];
  return out;
}

function _aesCtrCrypt(key, iv12, data, initialCounter) {
  var ks = _keyExpansion(key);
  var out = new Uint8Array(data.length);
  var cb = new Uint8Array(16);
  cb.set(iv12, 0);

  var counter = initialCounter || 2;
  var off = 0;
  while (off < data.length) {
    cb[12] = (counter >>> 24) & 0xff;
    cb[13] = (counter >>> 16) & 0xff;
    cb[14] = (counter >>> 8) & 0xff;
    cb[15] = counter & 0xff;
    counter++;

    var mask = _cipherBlock(cb, ks);
    var blockSize = Math.min(16, data.length - off);
    for (var i = 0; i < blockSize; i++) {
      out[off + i] = data[off + i] ^ mask[i];
    }
    off += blockSize;
  }
  return out;
}

function _ghash(H, data, aad) {
  aad = aad || new Uint8Array(0);
  var v = new Uint32Array(4);
  var h = new Uint32Array(4);
  for (var i = 0; i < 4; i++) {
    h[i] = (H[i*4] << 24) | (H[i*4+1] << 16) | (H[i*4+2] << 8) | (H[i*4+3]);
  }

  function mulBlock(x, block) {
    for (var j = 0; j < 4; j++) {
      x[j] ^= (block[j*4] << 24) | (block[j*4+1] << 16) | (block[j*4+2] << 8) | (block[j*4+3]);
    }
    var z = new Uint32Array(4);
    var vCur = new Uint32Array(h);
    for (var b = 0; b < 128; b++) {
      var word = (b / 32) | 0;
      var bit = 31 - (b % 32);
      if ((x[word] >>> bit) & 1) {
        z[0] ^= vCur[0]; z[1] ^= vCur[1]; z[2] ^= vCur[2]; z[3] ^= vCur[3];
      }
      var lsb = vCur[3] & 1;
      vCur[3] = (vCur[3] >>> 1) | (vCur[2] << 31);
      vCur[2] = (vCur[2] >>> 1) | (vCur[1] << 31);
      vCur[1] = (vCur[1] >>> 1) | (vCur[0] << 31);
      vCur[0] = (vCur[0] >>> 1);
      if (lsb) vCur[0] ^= 0xe1000000;
    }
    x[0] = z[0]; x[1] = z[1]; x[2] = z[2]; x[3] = z[3];
  }

  var padded = [];
  for (var a = 0; a < aad.length; a++) padded.push(aad[a]);
  while (padded.length % 16 !== 0) padded.push(0);
  for (var d = 0; d < data.length; d++) padded.push(data[d]);
  while (padded.length % 16 !== 0) padded.push(0);

  var aadBits = aad.length * 8;
  var dataBits = data.length * 8;
  var lenBlock = new Uint8Array(16);
  lenBlock[4] = (aadBits >>> 24) & 0xff; lenBlock[5] = (aadBits >>> 16) & 0xff; lenBlock[6] = (aadBits >>> 8) & 0xff; lenBlock[7] = aadBits & 0xff;
  lenBlock[12] = (dataBits >>> 24) & 0xff; lenBlock[13] = (dataBits >>> 16) & 0xff; lenBlock[14] = (dataBits >>> 8) & 0xff; lenBlock[15] = dataBits & 0xff;

  for (var p = 0; p < padded.length; p += 16) {
    mulBlock(v, padded.slice(p, p + 16));
  }
  mulBlock(v, lenBlock);

  var tag = new Uint8Array(16);
  for (var t = 0; t < 4; t++) {
    tag[t*4] = (v[t] >>> 24) & 0xff;
    tag[t*4+1] = (v[t] >>> 16) & 0xff;
    tag[t*4+2] = (v[t] >>> 8) & 0xff;
    tag[t*4+3] = v[t] & 0xff;
  }
  return tag;
}

function _aesGcmEncrypt(keyBytes, ivBytes, plainText) {
  var raw = [];
  for (var i = 0; i < plainText.length; i++) {
    var c = plainText.charCodeAt(i);
    if (c < 128) raw.push(c);
    else if (c < 2048) raw.push((c >> 6) | 192, (c & 63) | 128);
    else raw.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128);
  }
  var rawBytes = new Uint8Array(raw);
  var ks = _keyExpansion(keyBytes);
  var H = _cipherBlock(new Uint8Array(16), ks);
  var ct = _aesCtrCrypt(keyBytes, ivBytes, rawBytes, 2);

  var j0 = new Uint8Array(16);
  j0.set(ivBytes, 0); j0[15] = 1;
  var ek0 = _cipherBlock(j0, ks);

  var ghashTag = _ghash(H, ct);
  var tag = new Uint8Array(16);
  for (var k = 0; k < 16; k++) tag[k] = ghashTag[k] ^ ek0[k];

  var out = new Uint8Array(1 + 12 + ct.length + 16);
  out[0] = 0x01;
  out.set(ivBytes, 1);
  out.set(ct, 13);
  out.set(tag, 13 + ct.length);
  return Promise.resolve(_bytesToBase64(out));
}

function _aesGcmDecrypt(keyBytes, nonceBytes, cipherWithTag) {
  var ct = cipherWithTag.slice(0, cipherWithTag.length - 16);
  var pt = _aesCtrCrypt(keyBytes, nonceBytes, ct, 2);
  var str = '';
  for (var i = 0; i < pt.length; i++) {
    var c = pt[i];
    if (c < 128) str += String.fromCharCode(c);
    else if (c > 191 && c < 224) { str += String.fromCharCode(((c & 31) << 6) | (pt[++i] & 63)); }
    else { str += String.fromCharCode(((c & 15) << 12) | ((pt[++i] & 63) << 6) | (pt[++i] & 63)); }
  }
  return Promise.resolve(str);
}

function _bytesToBase64(bytes) {
  if (typeof btoa === 'function') {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  return '';
}

function _base64ToBytes(b64) {
  if (typeof atob === 'function') {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  return new Uint8Array(0);
}

function _hexToBytes(hex) {
  var out = new Uint8Array(hex.length / 2);
  for (var i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

// ── Dynamic Key Derivation & aaReq ──────────────────────────────────────────

var _aaKeysCache = null;
var _aaKeysExp = 0;

function _fetchAAKeys() {
  var now = Date.now();
  if (_aaKeysCache && now < _aaKeysExp) {
    return Promise.resolve(_aaKeysCache);
  }

  var bootUrl = 'https://api.mkissa.net/client-crypto/v1/bootstrap?buildId=' + BUILD_ID + '&k=k7';
  var headers = {
    'Referer': REFERER,
    'Origin': ORIGIN,
    'User-Agent': UA,
    'x-build-id': BUILD_ID,
    'x-aa-boot': BOOT_TOKEN
  };

  return fetch(bootUrl, { headers: headers, timeoutMs: 6000 })
    .then(function (r) {
      if (!r.ok) throw new Error('AllAnime: bootstrap HTTP ' + r.status);
      var j; try { j = JSON.parse(r.body || 'null'); } catch (e) { throw new Error('AllAnime: bad bootstrap JSON'); }
      if (!j || !j.partB) throw new Error('AllAnime: missing partB in bootstrap');

      var epoch = String(j.epoch || '2955');
      var partB = _base64ToBytes(j.partB);
      var mask = _hexToBytes(MASK_HEX);
      var key = new Uint8Array(32);
      for (var i = 0; i < 32; i++) {
        key[i] = (mask[i] || 0) ^ (partB[i] || 0);
      }

      _aaKeysCache = { epoch: epoch, key: key };
      _aaKeysExp = now + 180000; // 3 minutes TTL
      return _aaKeysCache;
    })
    .catch(function () {
      // Fallback: derive static fallback key
      return _sha256Bytes(ALLANIME_KEY_SEED).then(function (k) {
        _aaKeysCache = { epoch: '2955', key: k.slice(0, 32) };
        _aaKeysExp = now + 60000;
        return _aaKeysCache;
      });
    });
}

function _buildAAReq(qh, keys) {
  var aaReqWindowMillis = 300000; // 5 minutes
  var ts = Math.floor(Date.now() / aaReqWindowMillis) * aaReqWindowMillis;
  var payload = JSON.stringify({ v: 1, ts: ts, epoch: Number(keys.epoch) || 2955, qh: qh });
  var ivSeed = keys.epoch + ':' + qh + ':' + ts;

  return _sha256Bytes(ivSeed).then(function (ivHash) {
    var iv = ivHash.slice(0, 12);
    return _aesGcmEncrypt(keys.key, iv, payload);
  });
}

// ── GraphQL Definitions ─────────────────────────────────────────────────────

var SEARCH_GQL = 'query( $search: SearchInput $limit: Int $page: Int $translationType: VaildTranslationTypeEnumType $countryOrigin: VaildCountryOriginEnumType ) { shows( search: $search limit: $limit page: $page translationType: $translationType countryOrigin: $countryOrigin ) { edges { _id name thumbnail availableEpisodes __typename } }}';
var SHOW_GQL = 'query ($showId: String!) { show( _id: $showId ) { _id name englishName thumbnail description malId availableEpisodes availableEpisodesDetail }}';
var POPULAR_GQL = 'query($type:VaildPopularTypeEnumType!,$size:Int!,$dateRange:Int,$page:Int,$allowAdult:Boolean,$allowUnknown:Boolean){queryPopular(type:$type,size:$size,dateRange:$dateRange,page:$page,allowAdult:$allowAdult,allowUnknown:$allowUnknown){recommendations{anyCard{_id name englishName thumbnail availableEpisodes __typename}}}}';
var EPISODE_GQL = 'query ($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) { episode( showId: $showId translationType: $translationType episodeString: $episodeString ) { episodeString sourceUrls }}';
var EPISODE_INFOS_GQL = 'query ($showId: String!, $episodeNumStart: Float!, $episodeNumEnd: Float!) { episodeInfos( showId: $showId episodeNumStart: $episodeNumStart episodeNumEnd: $episodeNumEnd ) { episodeIdNum notes thumbnails vidInforssub vidInforsdub vidInforsraw }}';

function _headers() { return { 'Referer': REFERER, 'Origin': ORIGIN, 'User-Agent': UA, 'Content-Type': 'application/json' }; }

function _post(query, variables, endpoint) {
  var ep = endpoint || API;
  return fetch(ep, { method: 'POST', headers: _headers(), body: JSON.stringify({ variables: variables, query: query }), timeoutMs: 10000 })
    .then(function (r) {
      if (!r.ok) throw new Error('AllAnime: HTTP ' + r.status);
      try { return JSON.parse(r.body || 'null'); } catch (e) { throw new Error('AllAnime: bad JSON (' + r.status + ')'); }
    })
    .catch(function (err) {
      if (ep === API && API_FALLBACK) {
        return _post(query, variables, API_FALLBACK);
      }
      throw err;
    });
}

function getInfo() {
  return { name: 'AllAnime', lang: 'en', baseUrl: 'https://allanime.to', logo: 'https://allanime.to/favicon.ico', type: 'anime', version: '1.0.5' };
}

// ── Episode thumbnails (Kitsu, keyed by the show's malId) ────────────────────
function _kitsuStills(malId) {
  if (!malId) return Promise.resolve({});
  var H = { 'Accept': 'application/vnd.api+json', 'User-Agent': UA };
  var mapUrl = 'https://kitsu.io/api/edge/mappings?filter%5BexternalSite%5D=myanimelist/anime'
    + '&filter%5BexternalId%5D=' + encodeURIComponent(malId) + '&include=item';
  return fetch(mapUrl, { headers: H, timeoutMs: 8000 }).then(function (r) {
    var j; try { j = JSON.parse(r.body || 'null'); } catch (e) { return {}; }
    var inc = (j && j.included) || [];
    var kid = null;
    for (var i = 0; i < inc.length; i++) {
      if (inc[i] && inc[i].type === 'anime') { kid = inc[i].id; break; }
    }
    if (!kid) return {};
    var map = {};
    function page(off, depth) {
      if (depth > 8) return map;
      var u = 'https://kitsu.io/api/edge/anime/' + kid +
        '/episodes?page%5Blimit%5D=20&page%5Boffset%5D=' + off;
      return fetch(u, { headers: H, timeoutMs: 8000 }).then(function (r2) {
        var d; try { d = JSON.parse(r2.body || 'null'); } catch (e) { return map; }
        var eps = (d && d.data) || [];
        for (var k = 0; k < eps.length; k++) {
          var at = eps[k].attributes || {};
          var th = at.thumbnail && at.thumbnail.original;
          if (at.number != null && th) map[at.number] = th;
        }
        if (eps.length < 20) return map;
        return page(off + 20, depth + 1);
      }).catch(function () { return map; });
    }
    return page(0, 0);
  }).catch(function () { return {}; });
}

function _mode(opts) { var m = (opts && opts.category) || 'sub'; return (m === 'dub') ? 'dub' : 'sub'; }

function search(query, page, opts) {
  var vars = { search: { allowAdult: false, allowUnknown: false, query: String(query || '') }, limit: 26, page: page || 1, translationType: _mode(opts), countryOrigin: 'ALL' };
  return _post(SEARCH_GQL, vars).then(function (j) {
    var edges = (j && j.data && j.data.shows && j.data.shows.edges) || [];
    var out = [];
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      out.push({ id: e._id, title: e.name, cover: e.thumbnail || null, url: e._id, type: 'anime', sourceId: SOURCE_ID });
    }
    return out;
  });
}

function popular(opts) {
  opts = opts || {};
  var vars = { type: 'anime', size: opts.size || 26,
    dateRange: (opts.dateRange == null ? 7 : opts.dateRange),
    page: opts.page || 1, allowAdult: false, allowUnknown: false };
  return _post(POPULAR_GQL, vars).then(function (j) {
    var recs = (j && j.data && j.data.queryPopular && j.data.queryPopular.recommendations) || [];
    var out = [];
    for (var i = 0; i < recs.length; i++) {
      var c = recs[i] && recs[i].anyCard; if (!c || !c._id) continue;
      var ae = c.availableEpisodes || {};
      out.push({ id: c._id, title: c.name, englishTitle: c.englishName || null,
        cover: c.thumbnail || null, url: c._id, type: 'anime', sourceId: SOURCE_ID,
        subCount: ae.sub || 0, dubCount: ae.dub || 0 });
    }
    return out;
  });
}

function getHome(opts) {
  opts = opts || {};
  var cat = _mode(opts);
  var rows = [
    { title: 'Trending Now',       dateRange: 1 },
    { title: 'Popular This Week',  dateRange: 7 },
    { title: 'New This Month',     dateRange: 30 },
    { title: 'All-Time Favorites', dateRange: 0 }
  ];
  return Promise.all(rows.map(function (r) {
    return popular({ category: cat, dateRange: r.dateRange, page: 1 })
      .then(function (items) { return { title: r.title, items: items }; })
      .catch(function () { return { title: r.title, items: [] }; });
  }));
}

function getDetail(url, opts) {
  var showId = String(url);
  var cat = (opts && opts.category === 'dub') ? 'dub' : 'sub';
  return _post(SHOW_GQL, { showId: showId }).then(function (j) {
    var show = (j && j.data && j.data.show) || {};
    var aed = show.availableEpisodesDetail || {};
    var ae = show.availableEpisodes || {};
    var keys = (aed[cat] || []).slice().sort(function (a, b) { return parseFloat(a) - parseFloat(b); });
    var eps = [];
    for (var i = 0; i < keys.length; i++) {
      var n = keys[i];
      eps.push({ id: cat + ':' + n, title: 'Episode ' + n, number: parseFloat(n),
        url: 'allanime://' + showId + '/' + cat + '/' + n });
    }
    var detail = { id: showId, title: show.name || showId, englishTitle: show.englishName || null,
      cover: show.thumbnail || null, url: showId, description: htmlText(show.description || ''),
      status: 'unknown', genres: [], studios: [], type: 'anime', sourceId: SOURCE_ID,
      malId: (show.malId != null) ? parseInt(show.malId, 10) : null,
      episodes: eps, subCount: (ae.sub != null ? ae.sub : (aed.sub || []).length),
      dubCount: (ae.dub != null ? ae.dub : (aed.dub || []).length) };

    return _kitsuStills(show.malId).then(function (stills) {
      if (stills) {
        for (var k = 0; k < eps.length; k++) {
          var img = stills[eps[k].number];
          if (img) eps[k].thumbnail = img;
        }
      }
      return detail;
    }).catch(function () { return detail; });
  });
}

function getEpisodes(url, opts) { return getDetail(url, opts).then(function (d) { return d.episodes; }); }

// ── Decryption & Source Retrieval ───────────────────────────────────────────

function _decryptTobeparsed(b64, keys) {
  var bytes = _base64ToBytes(b64);
  if (bytes.length < 29) {
    return Promise.reject(new Error('AllAnime: tobeparsed payload too short'));
  }

  var nonce = bytes.slice(1, 13);
  var cipherWithTag = bytes.slice(13);

  return _aesGcmDecrypt(keys.key, nonce, cipherWithTag)
    .then(function (plain) {
      var obj; try { obj = JSON.parse(plain); } catch (e) { throw new Error('AllAnime: decrypt parse failed'); }
      return (obj.data && obj.data.episode && obj.data.episode.sourceUrls) ||
        (obj.episode && obj.episode.sourceUrls) ||
        obj.sourceUrls || [];
    })
    .catch(function () {
      // Fallback: try with ALLANIME_KEY_SEED
      return _sha256Bytes(ALLANIME_KEY_SEED).then(function (seedKey) {
        return _aesGcmDecrypt(seedKey.slice(0, 32), nonce, cipherWithTag)
          .then(function (plain) {
            var obj = JSON.parse(plain);
            return (obj.episode && obj.episode.sourceUrls) || obj.sourceUrls || [];
          });
      });
    });
}

function _fetchSourceUrls(showId, mode, epNo) {
  return _fetchAAKeys().then(function (keys) {
    // 1. Try Persisted Query GET with aaReq
    return _buildAAReq(SOURCES_HASH, keys)
      .then(function (aaReq) {
        var vars = JSON.stringify({ showId: showId, translationType: mode, episodeString: String(epNo) });
        var ext = JSON.stringify({
          persistedQuery: { version: 1, sha256Hash: SOURCES_HASH },
          aaReq: aaReq
        });
        var url = API + '?variables=' + encodeURIComponent(vars) + '&extensions=' + encodeURIComponent(ext);

        return fetch(url, { headers: { 'Referer': REFERER, 'Origin': ORIGIN, 'User-Agent': UA }, timeoutMs: 8000 })
          .then(function (r) {
            if (!r.ok) return null;
            var j; try { j = JSON.parse(r.body || 'null'); } catch (e) { return null; }
            var data = j && j.data;
            if (data && data.tobeparsed) return _decryptTobeparsed(data.tobeparsed, keys);
            if (data && data.episode && data.episode.sourceUrls) return data.episode.sourceUrls;
            return null;
          })
          .catch(function () { return null; });
      })
      .then(function (sources) {
        if (sources && sources.length) return sources;

        // 2. Fallback: GraphQL POST with episode query & aaReq
        return _buildAAReq(SOURCES_HASH, keys).then(function (aaReq) {
          var vars = { showId: showId, translationType: mode, episodeString: String(epNo) };
          var body = JSON.stringify({
            query: EPISODE_GQL,
            variables: vars,
            extensions: { aaReq: aaReq }
          });
          return fetch(API, { method: 'POST', headers: _headers(), body: body, timeoutMs: 8000 })
            .then(function (r) {
              if (!r.ok) return null;
              var j; try { j = JSON.parse(r.body || 'null'); } catch (e) { return null; }
              var data = j && j.data;
              if (data && data.tobeparsed) return _decryptTobeparsed(data.tobeparsed, keys);
              if (data && data.episode && data.episode.sourceUrls) return data.episode.sourceUrls;
              return null;
            })
            .catch(function () { return null; });
        });
      })
      .then(function (sources) {
        if (sources && sources.length) return sources;

        // 3. Fallback: GraphQL episodeInfos (unprotected against captcha)
        var num = parseFloat(epNo) || 1.0;
        var vars = { showId: showId, episodeNumStart: num, episodeNumEnd: num };
        return _post(EPISODE_INFOS_GQL, vars).then(function (j) {
          var infos = (j && j.data && j.data.episodeInfos) || [];
          var info = infos[0];
          if (!info) throw new Error('AllAnime: no sources in response');

          var vidObj = (mode === 'dub') ? (info.vidInforsdub || info.vidInforssub) : (info.vidInforssub || info.vidInforsdub);
          var out = [];
          if (vidObj && vidObj.vidPath) {
            out.push({
              sourceName: 'AllAnime-CDN',
              sourceUrl: vidObj.vidPath,
              priority: 100,
              type: 'player',
              resolutionStr: vidObj.vidResolution ? (vidObj.vidResolution + 'p') : '1080p'
            });
          }
          if (out.length === 0) throw new Error('AllAnime: no sources in response');
          return out;
        });
      });
  });
}

function _resolveClock(path, mode) {
  var hosts = ['https://allanime.day', 'https://tools.allmanga.to'];
  function tryHost(idx) {
    if (idx >= hosts.length) return Promise.resolve([]);
    var base = hosts[idx];
    return fetch(base + path, { headers: { 'Referer': REFERER, 'User-Agent': UA }, timeoutMs: 8000 })
      .then(function (r) {
        var j; try { j = JSON.parse(r.body || 'null'); } catch (e) { return tryHost(idx + 1); }
        var links = (j && j.links) || [];
        var out = [];
        for (var i = 0; i < links.length; i++) {
          var lk = links[i]; var u = lk.link || lk.url; if (!u) continue;
          var isHls = lk.hls === true || /\.m3u8/.test(u) || /repackager\.wixmp/.test(u);
          out.push({
            url: u,
            quality: lk.resolutionStr || '',
            container: isHls ? 'hls' : 'mp4',
            headers: { 'Referer': REFERER, 'User-Agent': UA },
            kind: mode,
            audioLang: mode === 'dub' ? 'en' : 'ja',
            subtitles: []
          });
        }
        if (out.length === 0) return tryHost(idx + 1);
        return out;
      })
      .catch(function () { return tryHost(idx + 1); });
  }
  return tryHost(0);
}

function _settleWithDeadline(jobs, deadlineMs) {
  return new Promise(function (resolve) {
    var results = [];
    var pending = jobs.length;
    var done = false;
    function finish() { if (!done) { done = true; resolve(results); } }
    if (pending === 0) { resolve(results); return; }
    for (var i = 0; i < jobs.length; i++) {
      Promise.resolve(jobs[i])
        .then(function (arr) { if (arr && arr.length) results = results.concat(arr); })
        .catch(function () {})
        .then(function () { pending -= 1; if (pending === 0) finish(); });
    }
    setTimeout(finish, deadlineMs);
  });
}
globalThis.__allanimeSettleWithDeadline = _settleWithDeadline; // test hook

function getVideoSources(episodeUrl) {
  var m = String(episodeUrl).replace('allanime://', '').split('/');
  var showId = m[0], mode = (m[1] === 'dub') ? 'dub' : 'sub', epNo = m[2];

  return _fetchSourceUrls(showId, mode, epNo).then(function (sourceUrls) {
    var SKIP = { 'Ss-Hls': 1 }; // dead host
    var hdr = { 'Referer': REFERER, 'User-Agent': UA };
    var list = sourceUrls.slice().sort(function (a, b) {
      return (b.priority || 0) - (a.priority || 0);
    });

    var jobs = [];
    for (var i = 0; i < list.length; i++) {
      var su = list[i];
      var name = su.sourceName || '';
      var raw = String(su.sourceUrl || '');
      var type = su.sourceName ? (su.type || '') : '';
      if (SKIP[name]) continue;

      // 1. Internal clock endpoint (`--`-obfuscated)
      if (raw.indexOf('--') === 0) {
        var path = decodeSourceUrl(raw);
        if (path.indexOf('/clock') !== -1) {
          jobs.push(_resolveClock(path, mode).catch(function () { return []; }));
        }
        continue;
      }

      // 2. Direct CDN path or full URL
      var streamUrl = raw;
      if (streamUrl.indexOf('/') === 0) {
        streamUrl = 'https://allanime.day' + streamUrl;
      }

      if (!/^https?:\/\//.test(streamUrl)) continue;

      if (type === 'player' || /\.(m3u8|mp4)(\?|$)/i.test(streamUrl)) {
        jobs.push(Promise.resolve([{
          url: streamUrl,
          quality: su.resolutionStr || '1080p',
          container: /\.m3u8/i.test(streamUrl) ? 'hls' : 'mp4',
          headers: hdr,
          kind: mode,
          audioLang: mode === 'dub' ? 'en' : 'ja',
          subtitles: []
        }]));
      } else {
        jobs.push(extractVideo(streamUrl, { headers: hdr, kind: mode, audioLang: mode === 'dub' ? 'en' : 'ja' }).catch(function () { return []; }));
      }
    }

    var deadline = (typeof globalThis.__allanimeDeadlineMs === 'number') ? globalThis.__allanimeDeadlineMs : 8000;
    return _settleWithDeadline(jobs, deadline).then(function (all) {
      if (all.length === 0) throw new Error('AllAnime: no playable sources');
      return all;
    });
  });
}
