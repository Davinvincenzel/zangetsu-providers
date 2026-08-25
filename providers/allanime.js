// AllAnime provider — https://allanime.to (API: https://api.mkissa.net/api / https://api.allanime.day/api)

var API = 'https://api.mkissa.net/api';
var API_FALLBACK = 'https://api.allanime.day/api';
var REFERER = 'https://mkissa.to';
var ORIGIN = 'https://mkissa.to';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0';
var SOURCE_ID = 'allanime';

// Apollo Persisted Query sha256 hash for episode sourceUrls / tobeparsed query
var SOURCES_HASH = 'f4662f4b7510b26795dd53ef824a0bf1740fbbc5d1273fab18222ac831bca8d0';
var SOURCES_HASH_FALLBACK = '50193c20a60c7a416666ffb41f5b6660c398ed979655842074dd1c510a5962e1';

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

// ── WebCrypto / AES-GCM Helpers ─────────────────────────────────────────────

function _getSubtleCrypto() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  return null;
}

function _sha256Bytes(data) {
  var subtle = _getSubtleCrypto();
  if (subtle) {
    var raw = (typeof data === 'string') ? new TextEncoder().encode(data) : data;
    return subtle.digest('SHA-256', raw).then(function (buf) {
      return new Uint8Array(buf);
    });
  }
  if (typeof require !== 'undefined') {
    var c = require('crypto');
    var hash = c.createHash('sha256').update(data).digest();
    return Promise.resolve(new Uint8Array(hash));
  }
  return Promise.reject(new Error('AllAnime: crypto digest unavailable'));
}

function _aesGcmEncrypt(keyBytes, ivBytes, plainText) {
  var subtle = _getSubtleCrypto();
  if (subtle) {
    var data = new TextEncoder().encode(plainText);
    return subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
      .then(function (k) {
        return subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, k, data);
      })
      .then(function (cipherBuf) {
        var ct = new Uint8Array(cipherBuf);
        var out = new Uint8Array(1 + ivBytes.length + ct.length);
        out[0] = 0x01;
        out.set(ivBytes, 1);
        out.set(ct, 1 + ivBytes.length);
        return _bytesToBase64(out);
      });
  }
  if (typeof require !== 'undefined') {
    var c = require('crypto');
    var cipher = c.createCipheriv('aes-256-gcm', Buffer.from(keyBytes), Buffer.from(ivBytes));
    var ctBuf = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    var tagBuf = cipher.getAuthTag();
    var outBuf = Buffer.concat([Buffer.from([0x01]), Buffer.from(ivBytes), ctBuf, tagBuf]);
    return Promise.resolve(outBuf.toString('base64'));
  }
  return Promise.reject(new Error('AllAnime: AES-GCM encrypt unavailable'));
}

function _aesGcmDecrypt(keyBytes, nonceBytes, cipherWithTag) {
  var subtle = _getSubtleCrypto();
  if (subtle) {
    return subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt'])
      .then(function (k) {
        return subtle.decrypt({ name: 'AES-GCM', iv: nonceBytes }, k, cipherWithTag);
      })
      .then(function (plainBuf) {
        return new TextDecoder().decode(plainBuf);
      });
  }
  if (typeof require !== 'undefined') {
    var c = require('crypto');
    var tag = cipherWithTag.slice(cipherWithTag.length - 16);
    var ciphertext = cipherWithTag.slice(0, cipherWithTag.length - 16);
    var decipher = c.createDecipheriv('aes-256-gcm', Buffer.from(keyBytes), Buffer.from(nonceBytes));
    decipher.setAuthTag(Buffer.from(tag));
    var plain = Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()]);
    return Promise.resolve(plain.toString('utf8'));
  }
  return Promise.reject(new Error('AllAnime: AES-GCM decrypt unavailable'));
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
