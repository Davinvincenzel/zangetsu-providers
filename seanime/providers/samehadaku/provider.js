// Samehadaku Online Streaming Provider for Seanime (v2.samehadaku.how)

const SITE = 'https://v2.samehadaku.how';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function _cleanTitle(t) {
  return String(t || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/\s*(Subtitle Indonesia|Sub Indo)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

async function _extractFromEmbed(embedUrl, ref, qualityHint = '720p') {
  if (!embedUrl) return [];
  const u = String(embedUrl).trim();
  if (u.indexOf('http') !== 0) return [];

  // Direct media URL (.mp4 / .m3u8)
  if (/\.(mp4|mkv|m3u8)(\?|$)/i.test(u)) {
    const isHls = /\.m3u8(\?|$)/i.test(u);
    return [{
      url: u,
      type: isHls ? 'm3u8' : 'mp4',
      quality: qualityHint,
      subtitles: []
    }];
  }

  // Pixeldrain direct API
  if (u.indexOf('pixeldrain.com/u/') > -1) {
    const id = u.replace(/\/$/, '').split('/').pop();
    const directPd = 'https://pixeldrain.com/api/file/' + id;
    return [{
      url: directPd,
      type: 'mp4',
      quality: qualityHint,
      subtitles: []
    }];
  }

  // Wibufile embed
  if (u.indexOf('wibufile.com/embed') > -1) {
    try {
      const html = await _get(u, ref);
      const sourcesMatch = html.match(/sources\s*:\s*(\[[^\]]+\])/i)
        || html.match(/file\s*:\s*["']([^"']+\.mp4[^"']*)["']/i);
      if (sourcesMatch) {
        const resList = [];
        try {
          const arr = JSON.parse(sourcesMatch[1]);
          for (let k = 0; k < arr.length; k++) {
            if (arr[k].file) {
              resList.push({
                url: arr[k].file.replace(/\\/g, ''),
                type: 'mp4',
                quality: qualityHint,
                subtitles: []
              });
            }
          }
        } catch (e) {
          if (sourcesMatch[1]) {
            resList.push({
              url: sourcesMatch[1].replace(/\\/g, ''),
              type: 'mp4',
              quality: qualityHint,
              subtitles: []
            });
          }
        }
        return resList;
      }
    } catch (e) {}
    return [];
  }

  // Vidhide / Vidlion
  if (u.indexOf('vidhide') > -1 || u.indexOf('vidlion') > -1) {
    try {
      const html = await _get(u, ref);
      let unpacked = html;
      if (/eval\(function\(p,a,c,k,e/.test(html)) {
        unpacked = _unpack(html);
      }
      const combined = unpacked + '\n' + html;
      const m = combined.match(/(?:file|sources?|src)\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i)
        || combined.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/i);
      if (m && m[1]) {
        return [{
          url: m[1].replace(/\\/g, ''),
          type: 'm3u8',
          quality: qualityHint,
          subtitles: []
        }];
      }
    } catch (e) {}
    return [];
  }

  return [];
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

    const url = SITE + '/?s=' + encodeURIComponent(q.trim());
    const html = await _get(url, SITE + '/');
    const articles = html.match(/<article[^>]*class="[^"]*animpost[^"]*"[\s\S]*?<\/article>/gi) || [];
    const out = [];
    const seen = {};

    for (let i = 0; i < articles.length; i++) {
      const art = articles[i];
      const linkMatch = art.match(/<a\s+href="([^"]+)"[^>]*title="([^"]+)"/i)
        || art.match(/href="([^"]+)"/i);
      if (!linkMatch) continue;
      const aurl = linkMatch[1];
      if (seen[aurl]) continue;
      seen[aurl] = 1;

      const titleMatch = art.match(/<h2[^>]*class="entry-title"[^>]*>([^<]+)<\/h2>/i)
        || art.match(/title="([^"]+)"/i);
      const title = _cleanTitle(titleMatch ? (titleMatch[1] || linkMatch[2]) : 'Anime');

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

    const lstepMatch = html.match(/<div class="lstepsiode">([\s\S]*?)<\/ul>/i);
    if (lstepMatch) {
      const items = lstepMatch[1].split('<li');
      for (let i = 1; i < items.length; i++) {
        const item = items[i];
        const linkMatch = item.match(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/i)
          || item.match(/<a\s+href="([^"]+)"/i);
        if (!linkMatch) continue;
        const epUrl = linkMatch[1];
        const titleMatch = item.match(/<div class="lastep"[^>]*>([^<]+)<\/div>/i);
        const rawEpTitle = titleMatch ? titleMatch[1] : (linkMatch[2] || '');
        const numMatch = rawEpTitle.match(/Episode\s+(\d+)/i) || rawEpTitle.match(/(\d+)/);
        const num = numMatch ? parseInt(numMatch[1], 10) : (episodes.length + 1);
        episodes.push({
          id: epUrl,
          number: num,
          title: _cleanTitle(rawEpTitle || `Episode ${num}`),
          url: epUrl
        });
      }
    }

    if (episodes.length === 0) {
      const epLists = html.split('<div class="episodelist">');
      for (let i = 1; i < epLists.length; i++) {
        const block = epLists[i].split('</ul>')[0];
        const liItems = block.split('<li>');
        for (let j = 1; j < liItems.length; j++) {
          const item = liItems[j];
          const linkMatch = item.match(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
          if (!linkMatch) continue;
          const epUrl = linkMatch[1];
          const rawEpTitle = linkMatch[2];
          const numMatch = rawEpTitle.match(/Episode\s+(\d+)/i) || rawEpTitle.match(/(\d+)/);
          const num = numMatch ? parseInt(numMatch[1], 10) : (episodes.length + 1);
          episodes.push({
            id: epUrl,
            number: num,
            title: _cleanTitle(rawEpTitle || `Episode ${num}`),
            url: epUrl
          });
        }
      }
    }

    episodes.sort((a, b) => a.number - b.number);
    return episodes;
  }

  async findEpisodeServer(episode, server) {
    const fullUrl = episode.url || episode.id;
    const html = await _get(fullUrl, SITE + '/');
    if (!html) throw new Error('Samehadaku: episode page not found');

    const serverTasks = [];

    // 1. AJAX Player options (.east_player_option)
    const regex = /<div id=["']player-option-(\d+)["'] class=["']east_player_option["'] data-post=["']([^"']+)["'] data-nume=["']([^"']+)["'] data-type=["']([^"']+)["']><span>([^<]+)<\/span>/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
      const post = m[2];
      const nume = m[3];
      const type = m[4];
      const label = m[5];

      const qMatch = label.match(/(360p|480p|720p|1080p|4k)/i);
      const q = qMatch ? qMatch[1].toLowerCase() : (label.indexOf('HD') > -1 ? '720p' : 'auto');

      serverTasks.push(
        _post(
          SITE + '/wp-admin/admin-ajax.php',
          { action: 'player_ajax', post: post, nume: nume, type: type },
          fullUrl
        ).then(async (res) => {
          if (!res) return [];
          const ifr = typeof res === 'string' ? res : (res.data || res.html || '');
          const ifrSrc = (ifr.match(/<iframe[^>]+src=["']([^"']+)["']/i) || [])[1];
          if (ifrSrc) {
            return await _extractFromEmbed(ifrSrc, fullUrl, q);
          }
          return [];
        }).catch(() => [])
      );
    }

    // 2. Direct iframes in page
    const directIframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (directIframeMatch && directIframeMatch[1]) {
      serverTasks.push(_extractFromEmbed(directIframeMatch[1], fullUrl, '720p'));
    }

    const results = await Promise.all(serverTasks);
    const flat = [];
    for (let i = 0; i < results.length; i++) {
      for (let j = 0; j < results[i].length; j++) flat.push(results[i][j]);
    }

    if (flat.length === 0) {
      throw new Error('Samehadaku: no playable stream found');
    }

    return {
      server: server || 'default',
      headers: {
        'User-Agent': UA,
        'Referer': fullUrl
      },
      videoSources: flat
    };
  }
}
