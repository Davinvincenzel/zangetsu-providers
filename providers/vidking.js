// Vidking — Movie & TV Series Provider for Zangetsu (https://www.vidking.net)
//
// Fast direct HLS streams (2160p, 1080p, 720p, 480p) via speedracelight backend.
// Self-contained PRNG stream-cipher decryption without external dependencies.

var SOURCE_ID = (typeof __SOURCE_ID !== 'undefined' && __SOURCE_ID)
  ? String(__SOURCE_ID) : 'vidking';

var SITE = 'https://www.vidking.net';
var BASE_DB = 'https://db.speedracelight.com/3';
var BASE_API = 'https://api.speedracelight.com';
var POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
var STILL_BASE = 'https://image.tmdb.org/t/p/w300';
var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function getInfo() {
  return {
    name: 'Vidking',
    lang: 'en',
    baseUrl: SITE,
    logo: SITE + '/assets/icon/apple-icon-180x180.png',
    type: 'movie',
    version: '1.0.2'
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function _trim(s) {
  return String(s == null ? '' : s).replace(/^\s+|\s+$/g, '');
}

function _get(url, ref, timeoutMs) {
  var h = {
    'User-Agent': UA,
    'Referer': ref || SITE + '/'
  };
  return fetch(url, { headers: h, timeoutMs: timeoutMs || 8000 })
    .then(function (r) {
      if (!r) return '';
      if (typeof r === 'string') return r;
      if (typeof r.body === 'string') return r.body;
      if (typeof r.text === 'function') return r.text();
      return '';
    })
    .catch(function () { return ''; });
}

function _getJson(url, ref, timeoutMs) {
  return _get(url, ref, timeoutMs).then(function (body) {
    try {
      return JSON.parse(body || 'null');
    } catch (e) {
      return null;
    }
  });
}

// ── Cipher & Decryption (Speedracelight protocol) ─────────────────────────────
var Hl = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580];
var _f = [1732584193, 4023233417, 2562383102, 271733878];
var Js = 61, Sf = 8, ms = 2654435769, Ys = [109, 118, 109, 49];

function _ci(l) {
  l >>>= 0; l ^= l >>> 16; l = Math.imul(l, 2246822507) >>> 0;
  l ^= l >>> 13; l = Math.imul(l, 3266489909) >>> 0; l ^= l >>> 16;
  return l >>> 0;
}

function _ps(l, o) {
  l >>>= 0; o &= 31;
  return o === 0 ? (l >>> 0) : ((l << o | l >>> (32 - o)) >>> 0);
}

function _Af(l) {
  var o = _f[0] >>> 0;
  for (var e = 0; e < l.length; e++) {
    o = _ps((o ^ Math.imul(l.charCodeAt(e), Hl[e & 15])) >>> 0, 5);
  }
  return _ci(o);
}

function _wf(l) {
  var o = new Array(256);
  for (var i = 0; i < 256; i++) o[i] = i;
  var e = 0;
  for (var i = 0; i < 256; i++) {
    e = (e + o[i] + l.charCodeAt(i % l.length)) & 255;
    var r = o[i]; o[i] = o[e]; o[e] = r;
  }
  return o;
}

function _vf(l) {
  var o = 2166136261;
  for (var e = 0; e < l.length; e++) {
    o = Math.imul(o ^ l.charCodeAt(e), 16777619) >>> 0;
  }
  return _ci(o);
}

function _Nf(l, o, e) {
  return (((l ^ o) >>> 0) | ((l & o & e) >>> 0)) >>> 0;
}

function _Rf(l, o) {
  if (((l.length * (l.length + 1)) & 1) === 1) return { S: _wf(l), acc: _Af(l) };
  var e = new Array(Js);
  var i = _ci(_vf(l) ^ _ci((o >>> 0) ^ ms)) >>> 0;
  for (var r = 0; r < Sf; r++) {
    if (((r * (r + 1)) & 1) === 0) {
      var n = i % Js;
      i = _ps((i + ms) >>> 0, 7 + (r & 7));
      e[n] = (i ^ _ci(i)) >>> 0;
      i = _ci((i + n) >>> 0);
    } else {
      e[r] = Hl[r & 15];
    }
  }
  return { S: e, acc: _ci(i ^ 2779096485) >>> 0 };
}

function _Cf(l, o) {
  var e = l.S; var i = l.acc;
  var r = i % Js, n = 0 - +(r in e), u = e[r] >>> 0, d = Math.imul(ms, o + 1) >>> 0;
  var g = _Nf(i, (u ^ d) >>> 0, n);
  g = (_ps((g + i) >>> 0, r & 31) ^ _ps(i, Math.imul(r, 7) & 31)) >>> 0;
  i = _ci((g + ms) >>> 0);
  e[r] = i >>> 0; l.acc = i;
  return i >>> 0;
}

function _xf(l, o, e) {
  var i = _Rf(l, o), r = new Uint8Array(e);
  var n = 0;
  for (var u = 0; u < e;) {
    var d = _Cf(i, n++);
    r[u++] = d & 255;
    if (u < e) r[u++] = (d >>> 8) & 255;
    if (u < e) r[u++] = (d >>> 16) & 255;
    if (u < e) r[u++] = (d >>> 24) & 255;
  }
  return r;
}

function _b64DecodeBytes(str) {
  var b64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  var bytes = [], i = 0;
  while (i < b64.length) {
    var e1 = chars.indexOf(b64.charAt(i++));
    var e2 = chars.indexOf(b64.charAt(i++));
    var e3 = chars.indexOf(b64.charAt(i++));
    var e4 = chars.indexOf(b64.charAt(i++));
    bytes.push((e1 << 2) | (e2 >> 4));
    if (e3 !== 64 && e3 !== -1) bytes.push(((e2 & 15) << 4) | (e3 >> 2));
    if (e4 !== 64 && e4 !== -1) bytes.push(((e3 & 3) << 6) | e4);
  }
  return new Uint8Array(bytes);
}

function _bytesToUtf8(bytes) {
  var out = '', i = 0;
  while (i < bytes.length) {
    var c = bytes[i++];
    if (c < 128) {
      out += String.fromCharCode(c);
    } else if (c > 191 && c < 224) {
      var c2 = bytes[i++];
      out += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
    } else if (c > 223 && c < 240) {
      var c2 = bytes[i++], c3 = bytes[i++];
      out += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
    } else {
      var c2 = bytes[i++], c3 = bytes[i++], c4 = bytes[i++];
      var u = (((c & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63)) - 0x10000;
      out += String.fromCharCode((u >> 10) + 0xD800, (u & 0x3FF) + 0xDC00);
    }
  }
  return out;
}

function _decryptPayload(payload, seed, tmdbId) {
  var bytes = _b64DecodeBytes(payload);
  var key = _xf(seed, tmdbId, bytes.length);
  for (var n = 0; n < bytes.length; n++) bytes[n] ^= key[n];
  for (var n = 0; n < Ys.length; n++) {
    if (bytes[n] !== Ys[n]) throw new Error('Vidking decrypt: signature check failed');
  }
  var jsonStr = _bytesToUtf8(bytes.subarray(Ys.length));
  return JSON.parse(jsonStr);
}

// ── Catalog Cards ─────────────────────────────────────────────────────────────
function _mapCard(item) {
  if (!item || (!item.id && !item.title && !item.name)) return null;
  var isTv = (item.media_type === 'tv') || (!item.title && !!item.name);
  var mediaType = isTv ? 'tv' : 'movie';
  var title = _trim(item.title || item.name || 'Untitled');
  var url = SITE + '/embed/' + mediaType + '/' + item.id;
  var cover = item.poster_path ? (POSTER_BASE + item.poster_path) : null;
  return {
    id: url,
    title: title,
    cover: cover,
    url: url,
    type: 'movie',
    sourceId: SOURCE_ID
  };
}

// ── Home ──────────────────────────────────────────────────────────────────────
function getHome(opts) {
  var sections = [
    { title: 'Trending Hari Ini', path: '/trending/all/day' },
    { title: 'Popular Movies', path: '/movie/popular' },
    { title: 'Popular TV Shows', path: '/tv/popular' },
    { title: 'Top Rated Movies', path: '/movie/top_rated' }
  ];

  var tasks = sections.map(function (sec) {
    return _getJson(BASE_DB + sec.path, SITE + '/', 6000).then(function (data) {
      var items = [];
      if (data && Array.isArray(data.results)) {
        for (var i = 0; i < data.results.length; i++) {
          var card = _mapCard(data.results[i]);
          if (card) items.push(card);
        }
      }
      return { title: sec.title, items: items };
    }).catch(function () {
      return { title: sec.title, items: [] };
    });
  });

  return Promise.all(tasks);
}

// ── Search ────────────────────────────────────────────────────────────────────
function search(query, page, opts) {
  var p = parseInt(page, 10) || 1;
  var url = BASE_DB + '/search/multi?query=' + encodeURIComponent(query || '') + '&page=' + p;
  return _getJson(url, SITE + '/', 6000).then(function (data) {
    var out = [];
    if (data && Array.isArray(data.results)) {
      for (var i = 0; i < data.results.length; i++) {
        var item = data.results[i];
        if (item.media_type !== 'movie' && item.media_type !== 'tv') continue;
        var card = _mapCard(item);
        if (card) out.push(card);
      }
    }
    return out;
  }).catch(function () {
    return [];
  });
}

// ── Detail & Episodes ─────────────────────────────────────────────────────────
function _parseUrl(url) {
  var str = String(url || '');
  var m = str.match(/\/embed\/(movie|tv)\/(\d+)(?:\/(\d+)\/(\d+))?/i);
  if (m) {
    return {
      type: m[1].toLowerCase(),
      tmdbId: parseInt(m[2], 10),
      season: m[3] ? parseInt(m[3], 10) : 1,
      episode: m[4] ? parseInt(m[4], 10) : 1
    };
  }
  var mId = str.match(/(\d+)/);
  return {
    type: /tv/i.test(str) ? 'tv' : 'movie',
    tmdbId: mId ? parseInt(mId[1], 10) : 0,
    season: 1,
    episode: 1
  };
}

function getDetail(url, opts) {
  var parsed = _parseUrl(url);
  var mediaType = parsed.type;
  var tmdbId = parsed.tmdbId;
  if (!tmdbId) throw new Error('Vidking: Invalid TMDB ID in URL');

  var detailUrl = BASE_DB + '/' + mediaType + '/' + tmdbId + '?append_to_response=external_ids';
  return _getJson(detailUrl, SITE + '/', 7000).then(function (data) {
    if (!data) throw new Error('Vidking: Failed to fetch metadata');

    var isTv = mediaType === 'tv';
    var title = _trim(isTv ? (data.name || data.original_name) : (data.title || data.original_title));
    var year = (isTv ? data.first_air_date : data.release_date || '').slice(0, 4);
    var cover = data.poster_path ? (POSTER_BASE + data.poster_path) : null;
    var desc = _trim(data.overview || '');
    var genres = (data.genres || []).map(function (g) { return g.name; });

    if (!isTv) {
      var movieEp = [{
        id: 'movie',
        number: 1,
        title: title || 'Movie',
        url: SITE + '/embed/movie/' + tmdbId
      }];
      return {
        id: url,
        title: title,
        cover: cover,
        url: url,
        description: desc,
        status: data.status || 'Released',
        genres: genres,
        studios: (data.production_companies || []).map(function (p) { return p.name; }),
        type: 'movie',
        sourceId: SOURCE_ID,
        episodes: movieEp,
        year: year,
        subCount: 1,
        dubCount: 0,
        tmdbId: tmdbId,
        tmdbIsTv: false
      };
    }

    // TV Show: fetch seasons concurrently
    var validSeasons = (data.seasons || []).filter(function (s) {
      return s.season_number > 0;
    });

    var seasonJobs = validSeasons.map(function (s) {
      var sNum = s.season_number;
      var sUrl = BASE_DB + '/tv/' + tmdbId + '/season/' + sNum;
      return _getJson(sUrl, SITE + '/', 7000).then(function (sData) {
        return { seasonNumber: sNum, episodes: (sData && sData.episodes) || [] };
      }).catch(function () {
        return { seasonNumber: sNum, episodes: [] };
      });
    });

    return Promise.all(seasonJobs).then(function (seasonResults) {
      var allEpisodes = [];
      var epCounter = 1;

      for (var i = 0; i < seasonResults.length; i++) {
        var sInfo = seasonResults[i];
        var sNum = sInfo.seasonNumber;
        for (var j = 0; j < sInfo.episodes.length; j++) {
          var ep = sInfo.episodes[j];
          var epNum = ep.episode_number;
          var epTitle = 'S' + sNum + ' E' + epNum + (ep.name ? (' - ' + ep.name) : '');
          var epUrl = SITE + '/embed/tv/' + tmdbId + '/' + sNum + '/' + epNum;
          allEpisodes.push({
            id: 's' + sNum + 'e' + epNum,
            number: epCounter++,
            title: epTitle,
            url: epUrl,
            thumbnail: ep.still_path ? (STILL_BASE + ep.still_path) : null,
            date: ep.air_date || null
          });
        }
      }

      return {
        id: url,
        title: title,
        cover: cover,
        url: url,
        description: desc,
        status: data.status || 'Returning Series',
        genres: genres,
        studios: (data.production_companies || []).map(function (p) { return p.name; }),
        type: 'movie',
        sourceId: SOURCE_ID,
        episodes: allEpisodes,
        year: year,
        subCount: allEpisodes.length,
        dubCount: 0,
        tmdbId: tmdbId,
        tmdbIsTv: true
      };
    });
  });
}

function getEpisodes(url, opts) {
  return getDetail(url, opts).then(function (d) {
    return (d && d.episodes) || [];
  });
}

// ── Stream Extraction ─────────────────────────────────────────────────────────
function getVideoSources(episodeUrl, opts) {
  var parsed = _parseUrl(episodeUrl);
  var mediaType = parsed.type;
  var tmdbId = parsed.tmdbId;
  var season = parsed.season || 1;
  var episode = parsed.episode || 1;

  if (!tmdbId) throw new Error('Vidking: Invalid TMDB ID in episode URL');

  // 1. Fetch metadata (title, year, imdbId)
  var metaUrl = BASE_DB + '/' + mediaType + '/' + tmdbId + '?append_to_response=external_ids';
  return _getJson(metaUrl, SITE + '/', 6000).then(function (meta) {
    if (!meta) throw new Error('Vidking: Failed to fetch stream metadata');

    var isTv = mediaType === 'tv';
    var title = _trim(isTv ? (meta.name || meta.original_name) : (meta.title || meta.original_title));
    var year = (isTv ? meta.first_air_date : meta.release_date || '').slice(0, 4);
    var imdbId = (meta.external_ids && meta.external_ids.imdb_id) || '';

    // 2. Fetch seed
    var seedUrl = BASE_API + '/seed?mediaId=' + tmdbId;
    return _getJson(seedUrl, SITE + '/', 6000).then(function (seedData) {
      if (!seedData || !seedData.seed) throw new Error('Vidking: Failed to fetch decryption seed');
      var seed = seedData.seed;

      var q = 'title=' + encodeURIComponent(title) +
        '&mediaType=' + encodeURIComponent(mediaType) +
        '&year=' + encodeURIComponent(year) +
        '&episodeId=' + encodeURIComponent(String(episode)) +
        '&seasonId=' + encodeURIComponent(String(season)) +
        '&tmdbId=' + encodeURIComponent(String(tmdbId)) +
        '&imdbId=' + encodeURIComponent(imdbId) +
        '&enc=2&seed=' + encodeURIComponent(seed);

      var endpoints = [
        { name: 'Breach', path: 'm4uhd/sources-with-title' },
        { name: 'Yoru', path: 'cdn/sources-with-title' }
      ];

      var tasks = endpoints.map(function (ep) {
        var epUrl = BASE_API + '/' + ep.path + '?' + q;
        return _get(epUrl, SITE + '/', 7000).then(function (encText) {
          if (!encText) return null;
          try {
            return {
              name: ep.name,
              data: _decryptPayload(encText, seed, tmdbId)
            };
          } catch (e) {
            return null;
          }
        }).catch(function () { return null; });
      });

      return Promise.all(tasks).then(function (results) {
        var sources = [];
        var allSubtitles = [];
        var seenSubUrls = {};
        var seenUrls = {};

        // Collect subtitles first (deduplicated)
        for (var i = 0; i < results.length; i++) {
          var res = results[i];
          if (res && res.data && Array.isArray(res.data.subtitles)) {
            for (var k = 0; k < res.data.subtitles.length; k++) {
              var sub = res.data.subtitles[k];
              if (sub && sub.url && !seenSubUrls[sub.url]) {
                seenSubUrls[sub.url] = 1;
                allSubtitles.push({
                  lang: sub.lang || sub.language || 'en',
                  language: sub.language || sub.lang || 'English',
                  url: sub.url
                });
              }
            }
          }
        }

        // Collect video sources (prefer direct discrete variants over master.m3u8 to ensure instant seek)
        for (var i = 0; i < results.length; i++) {
          var res = results[i];
          if (!res || !res.data) continue;
          var d = res.data;

          var hasDirectSources = Array.isArray(d.sources) && d.sources.length > 0;

          if (hasDirectSources) {
            for (var s = 0; s < d.sources.length; s++) {
              var src = d.sources[s];
              if (src && src.url && !seenUrls[src.url]) {
                seenUrls[src.url] = 1;
                var qRaw = _trim(src.quality || 'HLS');
                var qLower = qRaw.toLowerCase();
                var qStr = qRaw;
                var displayLabel = qRaw;

                if (res.name === 'Breach') {
                  // Breach (m4uhd) streams are 1080p TS; assign 1080p so player recognizes it as full HD
                  qStr = '1080p';
                  displayLabel = '1080p';
                } else if (qLower === '2160p' || qLower.indexOf('4k') !== -1 || qLower.indexOf('uhd') !== -1) {
                  // Label 4K so standard auto-selection defaults to 1080p (prevents 13MB chunk seek stalls),
                  // while users who explicitly set 4K still match via resolutionPx('4K') -> 2160
                  qStr = '4K';
                  displayLabel = '4K';
                } else if (qLower === '1080p') {
                  qStr = '1080p';
                  displayLabel = '1080p';
                } else if (qLower === '720p') {
                  qStr = '720p';
                  displayLabel = '720p';
                } else if (qLower === '480p') {
                  qStr = '480p';
                  displayLabel = '480p';
                } else if (qLower === '360p') {
                  qStr = '360p';
                  displayLabel = '360p';
                }

                sources.push({
                  url: src.url,
                  quality: qStr,
                  container: 'hls',
                  headers: { 'User-Agent': UA, 'Referer': SITE + '/' },
                  subtitles: allSubtitles,
                  serverName: res.name,
                  label: 'Vidking - ' + res.name + ' (' + displayLabel + ')'
                });
              }
            }
          } else if (d.playlist && !seenUrls[d.playlist]) {
            // Fallback: master.m3u8 only if discrete variants are missing
            seenUrls[d.playlist] = 1;
            var isBreach = res.name === 'Breach';
            var qFallback = isBreach ? '1080p' : 'Auto';
            var labelFallback = isBreach ? '1080p' : 'Auto HLS';
            sources.push({
              url: d.playlist,
              quality: qFallback,
              container: 'hls',
              headers: { 'User-Agent': UA, 'Referer': SITE + '/' },
              subtitles: allSubtitles,
              serverName: res.name,
              label: 'Vidking - ' + res.name + ' (' + labelFallback + ')'
            });
          }
        }

        if (!sources.length) {
          throw new Error('Vidking: No playable stream sources found');
        }

        var rank = {
          '1080p': 6,
          '720p': 5,
          '480p': 4,
          '360p': 3,
          '4K': 2,
          'Auto': 1,
          'Auto HLS': 1
        };
        var serverPref = { 'Breach': 1, 'Yoru': 2 };

        sources.sort(function (a, b) {
          var rDiff = (rank[b.quality] || 0) - (rank[a.quality] || 0);
          if (rDiff !== 0) return rDiff;
          var aPref = a.serverName ? (serverPref[a.serverName] || 99) : 99;
          var bPref = b.serverName ? (serverPref[b.serverName] || 99) : 99;
          return aPref - bPref;
        });

        return sources;
      });
    });
  });
}
