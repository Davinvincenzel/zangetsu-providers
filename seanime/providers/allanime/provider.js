// AllAnime Online Streaming Provider for Seanime (allanime.to / mkissa.to)

const API = 'https://api.mkissa.net/api';
const API_FALLBACK = 'https://api.allanime.day/api';
const REFERER = 'https://mkissa.to';
const ORIGIN = 'https://mkissa.to';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0';

const SOURCES_HASH = 'f4662f4b7510b26795dd53ef824a0bf1740fbbc5d1273fab18222ac831bca8d0';
const MASK_HEX = '522db8a067d8ea23616f7670788574dd786af7ffffd27bccfaeccfde57a67ce7';
const BUILD_ID = '140';
const BOOT_TOKEN = '351b496f677e5d86758b86ce0546bd64a9fabb7769adf6813d294f1756fb4d23';
const ALLANIME_KEY_SEED = 'Xot36i3lK3:v1';

const _HEXMAP = {"79":"A","7a":"B","7b":"C","7c":"D","7d":"E","7e":"F","7f":"G","70":"H","71":"I","72":"J","73":"K","74":"L","75":"M","76":"N","77":"O","68":"P","69":"Q","6a":"R","6b":"S","6c":"T","6d":"U","6e":"V","6f":"W","60":"X","61":"Y","62":"Z","59":"a","5a":"b","5b":"c","5c":"d","5d":"e","5e":"f","5f":"g","50":"h","51":"i","52":"j","53":"k","54":"l","55":"m","56":"n","57":"o","48":"p","49":"q","4a":"r","4b":"s","4c":"t","4d":"u","4e":"v","4f":"w","40":"x","41":"y","42":"z","08":"0","09":"1","0a":"2","0b":"3","0c":"4","0d":"5","0e":"6","0f":"7","00":"8","01":"9","15":"-","16":".","67":"_","46":"~","02":":","17":"/","07":"?","1b":"#","63":"[","65":"]","78":"@","19":"!","1c":"$","1e":"&","10":"(","11":")","12":"*","13":"+","14":",","03":";","05":"=","1d":"%"};

function decodeSourceUrl(s) {
  s = String(s);
  if (s.indexOf('--') !== 0) return s;
  const body = s.slice(2);
  let out = '';
  for (let i = 0; i + 1 < body.length; i += 2) {
    const ch = _HEXMAP[body.substr(i, 2)];
    out += (ch == null ? '' : ch);
  }
  return out.replace('/clock', '/clock.json');
}

function _cleanTitle(t) {
  return String(t || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _sha256BytesPure(input) {
  const bytes = [];
  if (typeof input === 'string') {
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      if (c < 128) bytes.push(c);
      else if (c < 2048) bytes.push((c >> 6) | 192, (c & 63) | 128);
      else if ((c & 0xFC00) === 0xD800 && i + 1 < input.length && (input.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
        const cp = 0x10000 + ((c & 0x3FF) << 10) + (input.charCodeAt(++i) & 0x3FF);
        bytes.push((cp >> 18) | 240, ((cp >> 12) & 63) | 128, ((cp >> 6) & 63) | 128, (cp & 63) | 128);
      } else bytes.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128);
    }
  } else {
    for (let j = 0; j < input.length; j++) bytes.push(input[j]);
  }

  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];

  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const l = bytes.length;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const bitLenHi = Math.floor(l / 0x20000000);
  const bitLenLo = (l * 8) >>> 0;
  bytes.push((bitLenHi >>> 24) & 255, (bitLenHi >>> 16) & 255, (bitLenHi >>> 8) & 255, bitLenHi & 255);
  bytes.push((bitLenLo >>> 24) & 255, (bitLenLo >>> 16) & 255, (bitLenLo >>> 8) & 255, bitLenLo & 255);

  const W = new Uint32Array(64);
  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] = (bytes[i + t * 4] << 24) | (bytes[i + t * 4 + 1] << 16) | (bytes[i + t * 4 + 2] << 8) | (bytes[i + t * 4 + 3]);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^ ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^ (W[t - 15] >>> 3);
      const s1 = ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^ ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }

  const out = new Uint8Array(32);
  for (let j = 0; j < 8; j++) {
    out[j * 4] = (H[j] >>> 24) & 255;
    out[j * 4 + 1] = (H[j] >>> 16) & 255;
    out[j * 4 + 2] = (H[j] >>> 8) & 255;
    out[j * 4 + 3] = H[j] & 255;
  }
  return out;
}

function _base64ToBytes(b64) {
  if (typeof atob === 'function') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  return new Uint8Array(0);
}

function _hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

const SEARCH_GQL = 'query( $search: SearchInput $limit: Int $page: Int $translationType: VaildTranslationTypeEnumType $countryOrigin: VaildCountryOriginEnumType ) { shows( search: $search limit: $limit page: $page translationType: $translationType countryOrigin: $countryOrigin ) { edges { _id name thumbnail availableEpisodes __typename } }}';
const SHOW_GQL = 'query ($showId: String!) { show( _id: $showId ) { _id name englishName thumbnail description malId availableEpisodes availableEpisodesDetail }}';

async function _postGql(query, variables, endpoint = API) {
  const headers = { 'Referer': REFERER, 'Origin': ORIGIN, 'User-Agent': UA, 'Content-Type': 'application/json' };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ variables, query })
    });
    return await res.json();
  } catch (err) {
    if (endpoint === API && API_FALLBACK) {
      return await _postGql(query, variables, API_FALLBACK);
    }
    throw err;
  }
}

class Provider {
  getSettings() {
    return {
      episodeServers: ["default"],
      supportsDub: true
    };
  }

  async search(opts) {
    const q = opts.query || (opts.media && (opts.media.englishTitle || opts.media.romajiTitle)) || '';
    if (!q || !q.trim()) return [];

    const mode = opts.dub ? 'dub' : 'sub';
    const vars = {
      search: { allowAdult: false, allowUnknown: false, query: q.trim() },
      limit: 26,
      page: 1,
      translationType: mode,
      countryOrigin: 'ALL'
    };

    try {
      const j = await _postGql(SEARCH_GQL, vars);
      const edges = (j && j.data && j.data.shows && j.data.shows.edges) || [];
      const out = [];

      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        out.push({
          id: e._id,
          title: _cleanTitle(e.name),
          url: `https://allanime.to/anime/${e._id}`,
          subOrDub: opts.dub ? 'dub' : 'sub'
        });
      }

      return out;
    } catch (e) {
      return [];
    }
  }

  async findEpisodes(id) {
    const showId = String(id).replace(/^https?:\/\/[^/]+\/anime\//i, '').replace(/#.*$/, '');
    const j = await _postGql(SHOW_GQL, { showId });
    const show = (j && j.data && j.data.show) || {};
    const aed = show.availableEpisodesDetail || {};

    const subKeys = (aed.sub || []).slice();
    const dubKeys = (aed.dub || []).slice();
    const allKeys = Array.from(new Set([...subKeys, ...dubKeys]));
    allKeys.sort((a, b) => parseFloat(a) - parseFloat(b));

    const eps = [];
    for (let i = 0; i < allKeys.length; i++) {
      const n = allKeys[i];
      const num = parseFloat(n);
      eps.push({
        id: JSON.stringify({ showId, n }),
        number: isNaN(num) ? i + 1 : num,
        title: `Episode ${n}`,
        url: `https://allanime.to/anime/${showId}/ep-${n}`
      });
    }

    return eps;
  }

  async findEpisodeServer(episode, server) {
    let showId, epNo;
    try {
      const data = JSON.parse(episode.id);
      showId = data.showId;
      epNo = data.n;
    } catch (e) {
      const m = String(episode.url || '').match(/anime\/([^/]+)/);
      showId = m ? m[1] : episode.id;
      epNo = String(episode.number || 1);
    }

    // Fallback direct resolver via Anikoto/MegaPlay
    const showGqlRes = await _postGql(SHOW_GQL, { showId });
    const show = (showGqlRes && showGqlRes.data && showGqlRes.data.show) || {};
    const title = show.englishName || show.name || '';
    if (!title) throw new Error('AllAnime: show not found');

    const searchTitle = title.replace(/\s*Season\s*(\d+)/i, ' Season $1').replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
    const searchUrl = 'https://anikoto.cz/filter?keyword=' + encodeURIComponent(searchTitle);
    const sHtmlRes = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
    const sHtml = await sHtmlRes.text();

    const slugMatch = sHtml.match(/class="[^"]*film-poster-ahref[^"]*"\s+href="\/watch\/([^"?#]+)"/i)
      || sHtml.match(/\/watch\/([^"?#]+)/i);
    if (!slugMatch) throw new Error('AllAnime: fallback search not found');

    const slug = slugMatch[1].replace(/\/ep-\d+$/, '');
    const watchUrl = 'https://anikoto.cz/watch/' + slug;
    const watchHtmlRes = await fetch(watchUrl, { headers: { 'User-Agent': UA } });
    const watchHtml = await watchHtmlRes.text();

    const animeId = (watchHtml.match(/data-id="(\d+)"/i) || [])[1];
    if (!animeId) throw new Error('AllAnime: fallback animeId not found');

    const epListUrl = 'https://anikoto.cz/ajax/episode/list/' + animeId;
    const epListRes = await fetch(epListUrl, {
      headers: { 'User-Agent': UA, 'Referer': watchUrl, 'X-Requested-With': 'XMLHttpRequest' }
    });
    const epListJson = await epListRes.json();
    const epListHtml = (epListJson && epListJson.result) || '';

    const epRegex = new RegExp('<a[^>]+data-number="' + epNo + '"[^>]+data-ids="([^"]+)"', 'i');
    let m = epListHtml.match(epRegex);
    if (!m) {
      m = epListHtml.match(new RegExp('<a[^>]+data-ids="([^"]+)"[^>]+data-number="' + epNo + '"', 'i'));
    }
    if (!m) throw new Error('AllAnime: episode ' + epNo + ' not found in mirror');

    const serverIds = m[1];
    const srvListUrl = 'https://anikoto.cz/ajax/server/list?servers=' + encodeURIComponent(serverIds);
    const srvListRes = await fetch(srvListUrl, {
      headers: { 'User-Agent': UA, 'Referer': watchUrl, 'X-Requested-With': 'XMLHttpRequest' }
    });
    const srvListJson = await srvListRes.json();
    const srvHtml = (srvListJson && srvListJson.result) || '';

    const linkIdMatch = srvHtml.match(/data-link-id="([^"]+)"/i);
    if (!linkIdMatch) throw new Error('AllAnime: no server link found in mirror');

    const linkId = linkIdMatch[1];
    const serverUrl = 'https://anikoto.cz/ajax/server?get=' + encodeURIComponent(linkId);
    const serverRes = await fetch(serverUrl, {
      headers: { 'User-Agent': UA, 'Referer': watchUrl, 'X-Requested-With': 'XMLHttpRequest' }
    });
    const serverJson = await serverRes.json();
    const embedUrl = (serverJson && serverJson.result && serverJson.result.url) || '';
    if (!embedUrl) throw new Error('AllAnime: no embed URL from mirror');

    const embedRes = await fetch(embedUrl, { headers: { 'User-Agent': UA, 'Referer': 'https://anikoto.cz/' } });
    const embedHtml = await embedRes.text();
    const dataId = (embedHtml.match(/data-id="(\d+)"/i) || [])[1];
    if (!dataId) throw new Error('AllAnime: no player data-id found');

    const base = (embedUrl.match(/^(https?:\/\/[^/]+)/) || [])[1] || 'https://megaplay.buzz';
    const streamRes = await fetch(base + '/stream/getSources?id=' + dataId, {
      headers: { 'User-Agent': UA, 'Referer': embedUrl, 'X-Requested-With': 'XMLHttpRequest' }
    });
    const streamJson = await streamRes.json();
    const s = streamJson && streamJson.sources;
    const file = s ? (s.file || (s[0] && s[0].file)) : null;
    if (!file) throw new Error('AllAnime: no stream file from mirror');

    const subs = [];
    const tracks = (streamJson && streamJson.tracks) || [];
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (!t || !t.file) continue;
      if (t.kind && t.kind !== 'captions' && t.kind !== 'subtitles') continue;
      subs.push({
        id: String(i),
        url: t.file,
        language: t.label || 'Sub',
        isDefault: !!t.default
      });
    }

    return {
      server: server || 'default',
      headers: {
        'User-Agent': UA,
        'Referer': base + '/'
      },
      videoSources: [
        {
          url: file,
          type: /\.m3u8(\?|$)/i.test(file) ? 'm3u8' : 'mp4',
          quality: 'auto',
          subtitles: subs
        }
      ]
    };
  }
}
