// Otakudesu Online Streaming Provider for Seanime (otakudesu.blog)

const SITE = 'https://otakudesu.blog';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function _cleanTitle(t) {
  return String(t || '')
    .replace(/\s*(Subtitle Indonesia|Sub Indo)\s*/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _b64Decode(b64) {
  if (typeof atob === 'function') return atob(b64);
  if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const str = String(b64).replace(/[=]+$/, '');
  let out = '';
  for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++)); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? out += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return out;
}

function _unpack(code) {
  try {
    const match = code.match(/eval\s*\(\s*function\s*\([^\)]*\)\s*\{[\s\S]*?\}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\s*\.split\(/i)
      || code.match(/}\s*\(\s*['"]([\s\S]*?)['"]\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*['"]([\s\S]*?)['"]\s*\.split\(/i);
    if (!match) return '';
    const payload = match[1];
    const radix = parseInt(match[2], 10);
    const count = parseInt(match[3], 10);
    const symtab = match[4].split('|');

    const encode = function (c) {
      return (c < radix ? '' : encode(Math.floor(c / radix))) +
        ((c = c % radix) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
    };

    let result = payload;
    for (let i = count; i--;) {
      if (symtab[i]) {
        result = result.replace(new RegExp('\\b' + encode(i) + '\\b', 'g'), symtab[i]);
      }
    }
    return result;
  } catch (e) {
    return '';
  }
}

async function _get(url, ref) {
  const h = { 'User-Agent': UA, 'Referer': ref || SITE + '/' };
  try {
    const res = await fetch(url, { headers: h });
    return await res.text();
  } catch (e) {
    return '';
  }
}

async function _post(url, data, ref) {
  const h = {
    'User-Agent': UA,
    'Referer': ref || SITE + '/',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest'
  };
  let body = '';
  if (typeof data === 'string') {
    body = data;
  } else if (data && typeof data === 'object') {
    const pairs = [];
    for (const k in data) {
      if (Object.prototype.hasOwnProperty.call(data, k)) {
        pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(data[k]));
      }
    }
    body = pairs.join('&');
  }
  try {
    const res = await fetch(url, { method: 'POST', headers: h, body });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  } catch (e) {
    return null;
  }
}

async function _extractFromEmbed(embedUrl, ref, depth = 0) {
  if (!embedUrl) return [];
  if (/blogger\.com|filedon\.co|mega\.nz|krakenfiles\.com|nekoclouds\.com|moedesu/i.test(embedUrl)) {
    return [];
  }
  try {
    const html = await _get(embedUrl, ref || SITE + '/');
    if (!html) return [];
    const out = [];

    const addStream = function (sUrl, q) {
      if (!sUrl) return;
      sUrl = sUrl.replace(/\\/g, '').trim();
      if (sUrl.indexOf('http') !== 0 || sUrl.indexOf('novideo') > -1) return;
      const isHls = /\.m3u8(\?|$)/i.test(sUrl) || /\/hls[23]?\//i.test(sUrl);
      const isGvideo = /googlevideo\.com/i.test(sUrl);
      const isArchive = /archive\.org/i.test(sUrl);

      const streamHeaders = { 'User-Agent': UA };
      if (isGvideo) {
        streamHeaders['Referer'] = 'https://www.blogger.com/';
      } else if (!isArchive) {
        streamHeaders['Referer'] = embedUrl;
      }

      out.push({
        url: sUrl,
        type: isHls ? 'm3u8' : 'mp4',
        quality: q || '720p',
        subtitles: []
      });
    };

    // 1. Direct video source or file URL
    const fileMatch = html.match(/const\s+videoURL\s*=\s*["']([^"']+)["']/i)
      || html.match(/videoURL\s*=\s*["']([^"']+)["']/i)
      || html.match(/<source[^>]+src=["']([^"']+)["']/i)
      || html.match(/file\s*:\s*["'](https?:[^"']+\.(?:mp4|m3u8)[^"']*)["']/i)
      || html.match(/src\s*:\s*["'](https?:[^"']+\.(?:mp4|m3u8)[^"']*)["']/i)
      || html.match(/player\.src\(\s*\{[^}]*src:\s*["']([^"']+)["']/i)
      || html.match(/property=["']og:video["']\s+content=["']([^"']+)["']/i)
      || html.match(/<video[^>]+src=["']([^"']+)["']/i);

    if (fileMatch && fileMatch[1]) {
      addStream(fileMatch[1]);
      return out;
    }

    // 2. Packed JS evaluation (VidHide, StreamWish, etc.)
    if (html.indexOf('eval(') > -1) {
      const unpacked = _unpack(html);
      if (unpacked) {
        const m3u8Match = unpacked.match(/https?:\/\/[^"'\s`\\]+\.m3u8[^"'\s`\\]*/i)
          || unpacked.match(/https?:\/\/[^"'\s`\\]+\/hls[23]?\/[^"'\s`\\]*/i)
          || unpacked.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4)[^"']*)["']/i);
        if (m3u8Match) {
          addStream(m3u8Match[1] || m3u8Match[0]);
          return out;
        }
      }
    }

    // 3. Nested iframe (e.g. desudrive wrapping yourupload)
    if (depth < 2) {
      const nestedIfr = (html.match(/<iframe[^>]+src=["']([^"']+)["']/i) || [])[1];
      if (nestedIfr && nestedIfr !== embedUrl && !/blogger\.com|mega\.nz|moedesu/i.test(nestedIfr)) {
        return await _extractFromEmbed(nestedIfr, embedUrl, depth + 1);
      }
    }

    return out;
  } catch (e) {
    return [];
  }
}

async function _resolveFallbackMirrors(epHtml, episodeUrl) {
  const nonceActions = epHtml.match(/action:\s*"([a-f0-9]{32})"/g) || [];
  if (nonceActions.length < 2) return [];

  const streamAction = (nonceActions[0].match(/"([a-f0-9]{32})"/) || [])[1];
  const nonceAction = (nonceActions[1].match(/"([a-f0-9]{32})"/) || [])[1];

  try {
    const nonceRes = await _post(SITE + '/wp-admin/admin-ajax.php', { action: nonceAction }, episodeUrl);
    const nonce = nonceRes && nonceRes.data;
    if (!nonce) return [];

    const mirrorLinks = epHtml.match(/<a[^>]+data-content="([^"]+)"[^>]*>([^<]+)<\/a>/g) || [];
    const candidates = [];

    for (let m = 0; m < mirrorLinks.length; m++) {
      const linkTag = mirrorLinks[m];
      const contentB64 = (linkTag.match(/data-content="([^"]+)"/) || [])[1];
      if (!contentB64) continue;
      const decoded = _b64Decode(contentB64);
      let parsed;
      try { parsed = JSON.parse(decoded); } catch (e) { parsed = null; }
      if (!parsed) continue;

      const name = ((linkTag.match(/>([^<]+)<\/a>/) || [])[1] || '').trim().toLowerCase();
      if (name.indexOf('moedesu') > -1) continue;

      const q = parsed.q || '';
      const is720 = q.indexOf('720') > -1 || q.indexOf('1080') > -1;
      const is480 = q.indexOf('480') > -1;
      const score = (is720 ? 100 : (is480 ? 50 : 10)) + (name.indexOf('vidhide') > -1 ? 30 : 0);
      candidates.push({ parsed, name, score, q });
    }

    candidates.sort((a, b) => b.score - a.score);

    const selected = [];
    const seenQualities = {};
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const provider = c.name.indexOf('vidhide') > -1 ? 'vidhide'
        : (c.name.indexOf('yourupload') > -1 ? 'yu' : 'ondesu');
      const key = c.q + '_' + provider;
      if (!seenQualities[key]) {
        seenQualities[key] = 1;
        selected.push(c);
        if (selected.length >= 3) break;
      }
    }

    const tasks = selected.map(async (c) => {
      const payload = { id: c.parsed.id, i: c.parsed.i, q: c.parsed.q, nonce: nonce, action: streamAction };
      try {
        const sRes = await _post(SITE + '/wp-admin/admin-ajax.php', payload, episodeUrl);
        if (!sRes || !sRes.data) return [];
        const htmlBlock = _b64Decode(sRes.data);
        const ifrSrc = (htmlBlock.match(/<iframe[^>]+src="([^"]+)"/i) || [])[1];
        if (!ifrSrc) return [];
        const mSources = await _extractFromEmbed(ifrSrc, episodeUrl);
        for (let k = 0; k < mSources.length; k++) {
          if (c.parsed.q) mSources[k].quality = c.parsed.q;
        }
        return mSources;
      } catch (e) {
        return [];
      }
    });

    const nested = await Promise.all(tasks);
    const flat = [];
    for (let i = 0; i < nested.length; i++) {
      for (let j = 0; j < nested[i].length; j++) flat.push(nested[i][j]);
    }
    return flat;
  } catch (e) {
    return [];
  }
}

class Provider {
  getSettings() {
    return {
      episodeServers: ["default"],
      supportsDub: false
    };
  }

  async search(opts) {
    const q = opts.query || (opts.media && (opts.media.romajiTitle || opts.media.englishTitle)) || '';
    if (!q || !q.trim()) return [];

    const url = SITE + '/?s=' + encodeURIComponent(q.trim()) + '&post_type=anime';
    const html = await _get(url, SITE + '/');
    const out = [];
    const seen = {};

    const chunks = html.split('<ul class="chivsrc">');
    if (chunks.length < 2) return [];
    const listBlock = chunks[1].split('</ul>')[0];
    const items = listBlock.split('<li');

    for (let i = 1; i < items.length; i++) {
      const it = items[i];
      const linkMatch = it.match(/<h2[^>]*>\s*<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/i)
        || it.match(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
      if (!linkMatch) continue;
      const aurl = linkMatch[1];
      if (seen[aurl]) continue;
      seen[aurl] = 1;
      const title = _cleanTitle(linkMatch[2]);
      out.push({
        id: aurl,
        title: title,
        url: aurl,
        subOrDub: 'sub'
      });
    }

    return out;
  }

  async findEpisodes(id) {
    const aurl = String(id || '').trim();
    if (!aurl) return [];
    const html = await _get(aurl, SITE + '/');
    const episodes = [];

    const epLists = html.split('<div class="episodelist">');
    for (let i = 1; i < epLists.length; i++) {
      const block = epLists[i].split('</ul>')[0];
      const liItems = block.split('<li>');
      for (let j = 1; j < liItems.length; j++) {
        const item = liItems[j];
        const linkMatch = item.match(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
        if (!linkMatch) continue;
        const epUrl = linkMatch[1];
        if (epUrl.indexOf('/episode/') === -1 || epUrl.indexOf('pembatas-episode') > -1) continue;
        const rawEpTitle = linkMatch[2];
        const numMatch = rawEpTitle.match(/Episode\s+(\d+)/i) || rawEpTitle.match(/(\d+)/);
        const num = numMatch ? parseInt(numMatch[1], 10) : (episodes.length + 1);
        episodes.push({
          id: epUrl,
          number: num,
          title: _cleanTitle(rawEpTitle),
          url: epUrl
        });
      }
    }

    episodes.sort((a, b) => a.number - b.number);
    return episodes;
  }

  async findEpisodeServer(episode, server) {
    const epUrl = episode.url || episode.id;
    const epHtml = await _get(epUrl, SITE + '/');
    if (!epHtml) throw new Error('Otakudesu: episode page not found');

    const mainIfr = (epHtml.match(/<iframe[^>]+src="([^"]+)"/i) || [])[1];
    let sources = [];

    if (mainIfr && /desustream|odvidhide|vidhide|mp4upload/i.test(mainIfr)) {
      sources = await _extractFromEmbed(mainIfr, epUrl);
    }
    if (!sources || sources.length === 0) {
      sources = await _resolveFallbackMirrors(epHtml, epUrl);
    }

    if (!sources || sources.length === 0) {
      throw new Error('Otakudesu: no playable stream found');
    }

    return {
      server: server || 'default',
      headers: {
        'User-Agent': UA,
        'Referer': epUrl
      },
      videoSources: sources
    };
  }
}
